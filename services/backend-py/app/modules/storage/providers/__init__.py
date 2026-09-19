from typing import Dict, Any

from .base import StorageProviderAdapter
from .local_s3 import LocalS3Provider
from .google_drive import GoogleDriveProvider

def get_provider_adapter(provider_type: str, config: Dict[str, Any], credentials_data: Dict[str, Any] = None) -> StorageProviderAdapter:
    """
    Factory function to instantiate the correct storage provider adapter based on type.
    """
    if provider_type == "LOCAL_S3":
        return LocalS3Provider(config)
    elif provider_type == "GOOGLE_DRIVE":
        return GoogleDriveProvider(config, credentials_data or {})
    else:
        raise ValueError(f"Unsupported storage provider type: {provider_type}")
