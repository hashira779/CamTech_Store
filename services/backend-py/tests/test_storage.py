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
