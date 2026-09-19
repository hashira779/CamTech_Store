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
            scopes=None
        )

    def _get_valid_token(self, force_refresh: bool = False) -> str:
        if force_refresh or not self.credentials.token or not self.credentials.valid:
            try:
                self.credentials.refresh(GoogleRequest())
            except RefreshError as e:
                raise HTTPException(status_code=400, detail=f"Google Drive authentication failed. Verify your Client ID, Secret, and Tokens. Error: {str(e)}")
        return self.credentials.token

    async def _request_with_retry(self, client: httpx.AsyncClient, method: str, url: str, **kwargs) -> httpx.Response:
        token = await asyncio.to_thread(self._get_valid_token)
        headers = dict(kwargs.pop("headers", {}))
        headers["Authorization"] = f"Bearer {token}"

        res = await client.request(method, url, headers=headers, **kwargs)
        if res.status_code == 401 and self.credentials.refresh_token:
            # Token expired or rejected by Google; force refresh and retry once
            token = await asyncio.to_thread(self._get_valid_token, force_refresh=True)
            headers["Authorization"] = f"Bearer {token}"
            res = await client.request(method, url, headers=headers, **kwargs)
        return res

    async def get_upload_url(self, object_key: str, mime_type: str, expires_in: int = 3600) -> str:
        """
        Initializes a resumable upload session and returns the upload URI.
        The client can then PUT the file directly to this URI.
        """
        metadata = {
            "name": object_key.split("/")[-1],
            "mimeType": mime_type
        }
        if self.folder_id:
            metadata["parents"] = [self.folder_id]

        async with httpx.AsyncClient() as client:
            response = await self._request_with_retry(
                client,
                "POST",
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
                headers={
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": mime_type
                },
                json=metadata
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
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
            return response.headers["Location"]

    async def get_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        return f"/api/v1/storage/{object_key}/download"

    async def _resolve_file_id(self, object_key: str, client: httpx.AsyncClient, token: Optional[str] = None) -> Optional[str]:
        import logging
        logger = logging.getLogger(__name__)
        filename = object_key.split("/")[-1]
        escaped_name = filename.replace("'", "\\'")
        
        # Search queries in priority order:
        queries = []
        if getattr(self, 'folder_id', None):
            queries.append(f"name='{escaped_name}' and trashed=false and '{self.folder_id}' in parents")
        queries.append(f"name='{escaped_name}' and trashed=false")
        
        if "_" in filename:
            parts = filename.split("_", 1)
            uuid_part = parts[0]
            if len(uuid_part) >= 32:
                queries.append(f"name contains '{uuid_part}' and trashed=false")
            base_name = parts[1].replace("'", "\\'")
            queries.append(f"name='{base_name}' and trashed=false")
        
        params_base = {
            "fields": "files(id, name)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
            "corpora": "user"
        }
        
        for q in queries:
            try:
                res = await self._request_with_retry(
                    client,
                    "GET",
                    "https://www.googleapis.com/drive/v3/files",
                    params={**params_base, "q": q}
                )
                if res.status_code == 200:
                    files = res.json().get("files", [])
                    if files:
                        self.last_resolved_file_id = files[0]["id"]
                        return files[0]["id"]
                else:
                    logger.warning(f"Google Drive search failed for query '{q}': status {res.status_code}, response: {res.text[:200]}")
            except Exception as e:
                logger.warning(f"Google Drive search exception for query '{q}': {e}")
                
        return None

    async def stream_object(self, object_key: str, file_id: Optional[str] = None):
        client = httpx.AsyncClient(timeout=45.0)
        
        if not file_id:
            file_id = await self._resolve_file_id(object_key, client)
            
        if not file_id:
            await client.aclose()
            raise HTTPException(status_code=404, detail=f"File not found in Google Drive: {object_key}")
        
        meta_res = await self._request_with_retry(
            client,
            "GET",
            f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=mimeType&supportsAllDrives=true"
        )
        mime_type = "application/octet-stream"
        if meta_res.status_code == 200:
            mime_type = meta_res.json().get("mimeType", mime_type)
        
        download_res = await self._request_with_retry(
            client,
            "GET",
            f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
        )
        await client.aclose()
        
        if download_res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Google Drive download failed: {download_res.text}")
        
        content = download_res.content
        
        async def _generator():
            yield content
            
        return _generator(), mime_type

    async def delete_object(self, object_key: str) -> bool:
        async with httpx.AsyncClient() as client:
            file_id = await self._resolve_file_id(object_key, client)
            if not file_id:
                return True
                
            response = await self._request_with_retry(
                client,
                "DELETE",
                f"https://www.googleapis.com/drive/v3/files/{file_id}?supportsAllDrives=true"
            )
            return response.status_code == 204

    async def get_object_metadata(self, object_key: str, file_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            if not file_id:
                file_id = await self._resolve_file_id(object_key, client)
            if not file_id:
                return None
                
            response = await self._request_with_retry(
                client,
                "GET",
                f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,name,size,mimeType,modifiedTime,md5Checksum&supportsAllDrives=true"
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            return {
                "fileId": data.get("id"),
                "fileName": data.get("name"),
                "sizeBytes": int(data.get("size", 0)),
                "mimeType": data.get("mimeType", "application/octet-stream"),
                "modifiedTime": data.get("modifiedTime"),
                "checksum": data.get("md5Checksum"),
            }

    async def exists(self, object_key: str, file_id: Optional[str] = None) -> bool:
        meta = await self.get_object_metadata(object_key, file_id)
        return meta is not None

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await self._request_with_retry(
                    client,
                    "GET",
                    "https://www.googleapis.com/drive/v3/about?fields=user"
                )
                return response.status_code == 200
        except Exception:
            return False

