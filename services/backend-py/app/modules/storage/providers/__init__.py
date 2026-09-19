from typing import Dict, Any, Optional

from .base import StorageProviderAdapter
from .local_s3 import LocalS3Provider
from .google_drive import GoogleDriveProvider
from .r2 import CloudflareR2Provider

def get_provider_adapter(provider_type: str, config: Dict[str, Any], credentials_data: Optional[Dict[str, Any]] = None) -> StorageProviderAdapter:
    """
    Factory function to instantiate the correct storage provider adapter based on type.
    """
    if provider_type in ("CLOUDFLARE_R2", "R2"):
        return CloudflareR2Provider(config)
    elif provider_type == "LOCAL_S3":
        # If config specifies an R2 endpoint or account_id, use R2 provider
        if config.get("account_id") or "r2.cloudflarestorage.com" in str(config.get("endpoint_url", "")):
            return CloudflareR2Provider(config)
        return LocalS3Provider(config)
    elif provider_type == "GOOGLE_DRIVE":
        return GoogleDriveProvider(config, credentials_data or {})
    else:
        raise ValueError(f"Unsupported storage provider type: {provider_type}")
