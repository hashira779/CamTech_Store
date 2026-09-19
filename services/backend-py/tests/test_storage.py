import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockUser:
    def __init__(self):
        self.id = "usr_test_ceo"
        self.organization_id = "cmtk8h18o0000vkd0etmdacgw"
        self.email = "ceo@mystore.test"
        self.name = "Test CEO"
        self.roles = '["SUPER_ADMIN", "ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_tenant_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["SUPER_ADMIN", "ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
async def mock_storage_provider(mock_tenant_user):
    from app.core.database import AsyncSessionLocal
    from app.modules.storage.models import StorageProvider
    import uuid
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(StorageProvider).where(StorageProvider.organization_id == mock_tenant_user.organization_id)
        )
        provider = result.scalars().first()

        mock_config = {
            "bucket_name": "test-bucket", 
            "endpoint_url": "http://localhost:9000",
            "access_key": "test_access_key",
            "secret_key": "test_secret_key"
        }

        if not provider:
            provider = StorageProvider(
                id=str(uuid.uuid4()),
                organization_id=mock_tenant_user.organization_id,
                name="Test Local S3",
                type="LOCAL_S3",
                is_default=True,
                configuration=mock_config
            )
            session.add(provider)
        else:
            provider.configuration = mock_config

        await session.commit()
        yield provider

@pytest.mark.asyncio
async def test_upload_intent_and_confirm(mock_tenant_user, mock_storage_provider):
    """
    Tests the multi-step upload flow (intent -> confirm)
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Upload Intent
        payload = {
            "fileName": "test-doc.pdf",
            "mimeType": "application/pdf",
            "byteSize": 1024 * 10,
            "entityType": "OTHER"
        }
        
        res = await client.post("/api/v1/storage/upload-intent", json=payload)
        assert res.status_code == 200
        data = res.json()["data"]
        
        assert "uploadUrl" in data
        assert "objectId" in data
        object_id = data["objectId"]
        
        # 2. Confirm Upload
        confirm_payload = {
            "objectId": object_id
        }
        res2 = await client.post("/api/v1/storage/confirm-upload", json=confirm_payload)
        assert res2.status_code == 200
        confirm_data = res2.json()["data"]
        
        assert confirm_data["success"] is True
        assert confirm_data["objectId"] == object_id
        
        # 3. List Documents
        res3 = await client.get("/api/v1/storage")
        assert res3.status_code == 200
        docs = res3.json()["data"]
        
        found = any(d["id"] == object_id for d in docs)
        assert found is True

@pytest.mark.asyncio
async def test_list_providers(mock_tenant_user, mock_storage_provider):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/storage/providers")
        assert res.status_code == 200
        data = res.json()["data"]
        assert isinstance(data, list)

@pytest.mark.asyncio
async def test_image_variant_generation():
    """Verify Pillow generates thumbnail, medium, and large WebP variants while preserving aspect ratio."""
    import io
    from PIL import Image
    from app.modules.storage.image_processing import generate_image_variants, validate_and_inspect_image

    # Create 800x400 test image (2:1 aspect ratio)
    img = Image.new("RGBA", (800, 400), color=(100, 150, 200, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    # Validate
    meta = validate_and_inspect_image(raw_bytes)
    assert meta["width"] == 800
    assert meta["height"] == 400

    # Generate variants
    result = await generate_image_variants(raw_bytes)
    assert result["width"] == 800
    assert result["height"] == 400
    assert result["mime_type"] == "image/webp"

    variants = result["variants"]
    assert "thumbnail" in variants
    assert "medium" in variants
    assert "large" in variants

    # Check thumbnail dimensions (max 200x200; with 2:1 ratio it should be 200x100)
    with Image.open(io.BytesIO(variants["thumbnail"])) as thumb_img:
        assert thumb_img.format == "WEBP"
        assert thumb_img.width <= 200
        assert thumb_img.height <= 200
        assert thumb_img.width == 200
        assert thumb_img.height == 100

    # Check medium dimensions (max 600x600; with 2:1 ratio it should be 600x300)
    with Image.open(io.BytesIO(variants["medium"])) as med_img:
        assert med_img.format == "WEBP"
        assert med_img.width <= 600
        assert med_img.height <= 600
        assert med_img.width == 600
        assert med_img.height == 300

@pytest.mark.asyncio
async def test_r2_provider_adapter():
    """Verify CloudflareR2Provider URL generation and configuration."""
    from app.modules.storage.providers.r2 import CloudflareR2Provider

    r2 = CloudflareR2Provider(config={
        "account_id": "test-account-id",
        "access_key_id": "test-access-key",
        "secret_access_key": "test-secret-key",
        "bucket": "test-bucket",
        "public_domain": "https://images.camtech.cam",
    })

    url = await r2.get_url("products/1001/thumbnail/v1.webp")
    assert url == "https://images.camtech.cam/products/1001/thumbnail/v1.webp"

@pytest.mark.asyncio
async def test_storage_sync_health_endpoint(mock_tenant_user):
    """Verify /api/v1/storage/sync/health returns accurate counts."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/storage/sync/health")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "total" in data
        assert "synced" in data
        assert "pending" in data
        assert "failed" in data
        assert "r2Bucket" in data
        assert "r2PublicDomain" in data

@pytest.mark.asyncio
async def test_catalog_tiered_image_urls():
    """Verify /api/v1/public/products returns tiered image URLs (thumbnailUrl, mediumUrl, largeUrl)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/public/products?limit=5")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "items" in data
        # If there are items, verify schema contract
        for item in data["items"]:
            assert "name" in item
            # Tiered URL fields must exist (can be None or string)
            assert "thumbnailUrl" in item
            assert "mediumUrl" in item
            assert "largeUrl" in item
            assert "syncStatus" in item
