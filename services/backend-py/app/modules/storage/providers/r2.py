import asyncio
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Dict, Any, Optional
from app.modules.storage.providers.base import StorageProviderAdapter
from app.core.config import settings

class CloudflareR2Provider(StorageProviderAdapter):
    """
    Adapter for Cloudflare R2 Object Storage using S3-compatible API.
    Zero egress fees, edge-integrated with Cloudflare CDN.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        config = config or {}
        self.account_id = config.get("account_id") or config.get("accountId") or settings.R2_ACCOUNT_ID
        self.access_key = (
            config.get("access_key")
            or config.get("access_key_id")
            or config.get("accessKeyId")
            or settings.R2_ACCESS_KEY_ID
        )
        self.secret_key = (
            config.get("secret_key")
            or config.get("secret_access_key")
            or config.get("secretAccessKey")
            or settings.R2_SECRET_ACCESS_KEY
        )
        self.bucket = config.get("bucket") or settings.R2_BUCKET or "mystore-media"
        self.public_domain = (config.get("public_domain") or config.get("publicDomain") or settings.R2_PUBLIC_DOMAIN or "").rstrip("/")

        endpoint_url = config.get("endpoint_url")
        if not endpoint_url and self.account_id:
            endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        self.endpoint_url = endpoint_url

        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            )
        )

    def is_configured(self) -> bool:
        """Check if required R2 credentials are provided."""
        return bool(self.access_key and self.secret_key and self.endpoint_url)

    async def upload(
        self,
        object_key: str,
        data: bytes,
        mime_type: str = "application/octet-stream",
        cache_control: Optional[str] = None,
        content_type: Optional[str] = None,
        **kwargs
    ) -> str:
        mime_type = content_type or mime_type
        """
        Directly uploads binary data to Cloudflare R2.
        Returns the public CDN URL if public_domain is set, otherwise R2 object key.
        """
        if not cache_control:
            # Immutable 30-day cache for versioned assets
            cache_control = "public, max-age=2592000, immutable"

        params = {
            "Bucket": self.bucket,
            "Key": object_key.lstrip("/"),
            "Body": data,
            "ContentType": mime_type,
            "CacheControl": cache_control,
        }

        def _put():
            self.s3_client.put_object(**params)
            return self.get_url_sync(object_key)

        return await asyncio.to_thread(_put)

    def get_url_sync(self, object_key: str, variant: Optional[str] = None) -> str:
        key = object_key.lstrip("/")
        if self.public_domain:
            return f"{self.public_domain}/{key}"
        return f"{self.endpoint_url}/{self.bucket}/{key}"

    async def get_url(self, object_key: str, variant: Optional[str] = None) -> str:
        """Return the public CDN URL for the object."""
        return self.get_url_sync(object_key, variant)

    async def get_upload_url(self, object_key: str, mime_type: str, expires_in: int = 3600) -> str:
        def _generate():
            return self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': object_key.lstrip("/"),
                    'ContentType': mime_type
                },
                ExpiresIn=expires_in
            )
        return await asyncio.to_thread(_generate)

    async def get_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """If public domain is configured, returns public CDN URL directly. Otherwise presigned URL."""
        if self.public_domain:
            return self.get_url_sync(object_key)

        def _generate():
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': object_key.lstrip("/")
                },
                ExpiresIn=expires_in
            )
        return await asyncio.to_thread(_generate)

    async def get_signed_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Always returns temporary presigned URL for private files."""
        def _generate():
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': object_key.lstrip("/")
                },
                ExpiresIn=expires_in
            )
        return await asyncio.to_thread(_generate)

    async def exists(self, object_key: str) -> bool:
        def _check():
            try:
                self.s3_client.head_object(Bucket=self.bucket, Key=object_key.lstrip("/"))
                return True
            except ClientError as e:
                if e.response['Error']['Code'] in ('404', 'NoSuchKey'):
                    return False
                raise
            except Exception:
                return False
        return await asyncio.to_thread(_check)

    async def delete_object(self, object_key: str) -> bool:
        def _delete():
            try:
                self.s3_client.delete_object(Bucket=self.bucket, Key=object_key.lstrip("/"))
                return True
            except ClientError:
                return False
        return await asyncio.to_thread(_delete)

    async def get_object_metadata(self, object_key: str) -> Optional[Dict[str, Any]]:
        def _head():
            try:
                response = self.s3_client.head_object(Bucket=self.bucket, Key=object_key.lstrip("/"))
                return {
                    "sizeBytes": response.get("ContentLength", 0),
                    "mimeType": response.get("ContentType", "application/octet-stream"),
                    "etag": response.get("ETag", "").strip('"'),
                    "lastModified": response.get("LastModified"),
                }
            except ClientError as e:
                if e.response['Error']['Code'] in ('404', 'NoSuchKey'):
                    return None
                raise
        return await asyncio.to_thread(_head)

    async def check_health(self) -> bool:
        if not self.is_configured():
            return False
        def _check():
            try:
                self.s3_client.head_bucket(Bucket=self.bucket)
                return True
            except Exception:
                return False
        return await asyncio.to_thread(_check)
