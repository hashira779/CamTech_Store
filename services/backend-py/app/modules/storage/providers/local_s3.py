import asyncio
import boto3
from botocore.exceptions import ClientError
from typing import Dict, Any

from app.modules.storage.providers.base import StorageProviderAdapter

class LocalS3Provider(StorageProviderAdapter):
    """
    Adapter for Local S3-Compatible storage (MinIO, LocalStack, standard AWS S3).
    """
    def __init__(self, config: Dict[str, Any]):
        self.bucket = config.get("bucket", "default")
        self.endpoint_url = config.get("endpoint_url") # For MinIO
        self.region = config.get("region", "us-east-1")
        self.access_key = config.get("access_key")
        self.secret_key = config.get("secret_key")
        
        self.s3_client = boto3.client(
            's3',
            region_name=self.region,
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key
        )

    async def get_upload_url(self, object_key: str, mime_type: str, expires_in: int = 3600) -> str:
        def _generate():
            return self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': object_key,
                    'ContentType': mime_type
                },
                ExpiresIn=expires_in
            )
        return await asyncio.to_thread(_generate)

    async def get_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        def _generate():
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': object_key
                },
                ExpiresIn=expires_in
            )
        return await asyncio.to_thread(_generate)

    async def delete_object(self, object_key: str) -> bool:
        def _delete():
            try:
                self.s3_client.delete_object(Bucket=self.bucket, Key=object_key)
                return True
            except ClientError:
                return False
        return await asyncio.to_thread(_delete)

    async def get_object_metadata(self, object_key: str) -> Dict[str, Any]:
        def _head():
            try:
                response = self.s3_client.head_object(Bucket=self.bucket, Key=object_key)
                return {
                    "sizeBytes": response.get("ContentLength", 0),
                    "mimeType": response.get("ContentType", "application/octet-stream")
                }
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    return None
                raise
        return await asyncio.to_thread(_head)

    async def check_health(self) -> bool:
        def _check():
            try:
                # Just check if the bucket exists and is accessible
                self.s3_client.head_bucket(Bucket=self.bucket)
                return True
            except ClientError:
                return False
            except Exception:
                return False
        return await asyncio.to_thread(_check)
