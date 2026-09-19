from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class StorageProviderAdapter(ABC):
    """
    Base abstraction for any storage backend.
    All adapters must implement these methods to be plugged into the StorageService.
    """
    
    @abstractmethod
    async def get_upload_url(self, object_key: str, mime_type: str, expires_in: int = 3600) -> str:
        """Get a presigned URL or upload intent URL for direct client-to-storage upload."""
        pass
        
    @abstractmethod
    async def get_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Get a presigned URL or download intent URL."""
        pass
        
    @abstractmethod
    async def delete_object(self, object_key: str) -> bool:
        """Delete an object from the storage backend."""
        pass
        
    async def stream_object(self, object_key: str):
        """
        Returns a streaming response (AsyncGenerator) for the object bytes, 
        along with the content type. Useful for proxying private files.
        Returns: (stream_generator, content_type)
        If not supported, returns (None, None).
        """
        return None, None
        
    @abstractmethod
    async def get_object_metadata(self, object_key: str) -> Dict[str, Any]:
        """Fetch metadata (size, mime type) from the storage backend directly."""
        pass

    @abstractmethod
    async def check_health(self) -> bool:
        """Check if the provider is reachable and correctly configured."""
        pass

    async def upload(self, object_key: str, data: bytes, mime_type: str = "application/octet-stream", cache_control: Optional[str] = None) -> str:
        """Directly upload binary data to the storage backend. Returns public or storage URL."""
        raise NotImplementedError("Direct upload not implemented by this adapter.")

    async def exists(self, object_key: str) -> bool:
        """Check if an object exists in the storage backend."""
        try:
            meta = await self.get_object_metadata(object_key)
            return meta is not None
        except Exception:
            return False

    async def get_url(self, object_key: str, variant: Optional[str] = None) -> str:
        """Get public CDN or direct URL for an object (or specific variant)."""
        return await self.get_download_url(object_key)

    async def get_signed_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Get temporary signed URL for a private object."""
        return await self.get_download_url(object_key, expires_in=expires_in)
