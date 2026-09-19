import asyncio
import httpx
from typing import Dict, Any, Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google.auth.exceptions import RefreshError
from fastapi import HTTPException
from app.modules.storage.providers.base import StorageProviderAdapter
from app.core.config import settings

class GoogleDriveProvider(StorageProviderAdapter):
    """
    Adapter for Google Drive storage using OAuth credentials.
    """
    def __init__(self, config: Dict[str, Any], credentials_data: Dict[str, Any]):
        self.folder_id = config.get("folder_id")
        
        # If the user pasted a full URL (e.g. https://drive.google.com/drive/folders/XYZ), extract just the ID
        if self.folder_id and "drive.google.com" in self.folder_id:
            import re
            match = re.search(r'/folders/([a-zA-Z0-9_-]+)', self.folder_id)
            if match:
                self.folder_id = match.group(1) # Optional root folder ID
        
        # We expect credentials_data to contain the refresh token and scopes
        self.credentials = Credentials(
            token=credentials_data.get("access_token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=credentials_data.get("client_id") or settings.GOOGLE_CLIENT_ID,
            client_secret=credentials_data.get("client_secret") or settings.GOOGLE_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/drive.file"]
        )

    def _get_valid_token(self) -> str:
        if not self.credentials.valid:
            try:
                self.credentials.refresh(GoogleRequest())
            except RefreshError as e:
                raise HTTPException(status_code=400, detail=f"Google Drive authentication failed. Verify your Client ID, Secret, and Tokens. Error: {str(e)}")
        return self.credentials.token

    async def get_upload_url(self, object_key: str, mime_type: str, expires_in: int = 3600) -> str:
        """
        Initializes a resumable upload session and returns the upload URI.
        The client can then PUT the file directly to this URI.
        """
        token = await asyncio.to_thread(self._get_valid_token)
        
        metadata = {
            "name": object_key.split("/")[-1],
            "mimeType": mime_type
        }
        if self.folder_id:
            metadata["parents"] = [self.folder_id]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": mime_type
                },
                json=metadata
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                # Give a clear error message back to the frontend
                error_body = response.text
                raise HTTPException(
                    status_code=400,
                    detail=f"Google Drive API rejected the request. Check your Folder ID and permissions. Error: {error_body}"
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to connect to Google Drive API: {str(e)}"
                )
            # The Location header contains the resumable upload URL
            return response.headers["Location"]

    async def get_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        # We cannot return a direct unauthenticated public URL for private Google Drive files.
        # We signal to the API layer to proxy it by returning None or a special internal route.
        # However, we implemented `stream_object` which the API can use.
        # Return a relative path, but the API will just stream it instead.
        return f"/api/v1/storage/{object_key}/download"

    async def _resolve_file_id(self, object_key: str, client: httpx.AsyncClient, token: str) -> Optional[str]:
        filename = object_key.split("/")[-1]
        query = f"name='{filename}' and trashed=false"
        if getattr(self, 'folder_id', None):
            query += f" and '{self.folder_id}' in parents"
            
        res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={"q": query, "fields": "files(id)", "supportsAllDrives": "true", "includeItemsFromAllDrives": "true", "corpora": "allDrives"},
            headers={"Authorization": f"Bearer {token}"}
        )
        if res.status_code == 200:
            files = res.json().get("files", [])
            if files:
                return files[0]["id"]
        return None

    async def stream_object(self, object_key: str):
        token = await asyncio.to_thread(self._get_valid_token)
        
        client = httpx.AsyncClient()
        
        file_id = await self._resolve_file_id(object_key, client, token)
        if not file_id:
            await client.aclose()
            raise HTTPException(status_code=404, detail="File not found in Google Drive")
        
        # Get mimeType
        meta_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=mimeType&supportsAllDrives=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        mime_type = "application/octet-stream"
        if meta_res.status_code == 200:
            mime_type = meta_res.json().get("mimeType", mime_type)
        
        # Download the file content entirely (not streaming, to avoid httpx lifecycle issues)
        download_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        await client.aclose()
        
        if download_res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Google Drive download failed: {download_res.text}")
        
        content = download_res.content
        
        async def _generator():
            yield content
            
        return _generator(), mime_type


    async def delete_object(self, object_key: str) -> bool:
        token = await asyncio.to_thread(self._get_valid_token)
        async with httpx.AsyncClient() as client:
            file_id = await self._resolve_file_id(object_key, client, token)
            if not file_id:
                return True
                
            response = await client.delete(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?supportsAllDrives=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            return response.status_code == 204

    async def get_object_metadata(self, object_key: str) -> Dict[str, Any]:
        token = await asyncio.to_thread(self._get_valid_token)
        async with httpx.AsyncClient() as client:
            file_id = await self._resolve_file_id(object_key, client, token)
            if not file_id:
                return None
                
            response = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=size,mimeType&supportsAllDrives=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            return {
                "sizeBytes": int(data.get("size", 0)),
                "mimeType": data.get("mimeType", "application/octet-stream")
            }

    async def check_health(self) -> bool:
        try:
            token = await asyncio.to_thread(self._get_valid_token)
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/drive/v3/about?fields=user",
                    headers={"Authorization": f"Bearer {token}"}
                )
                return response.status_code == 200
        except Exception:
            return False
