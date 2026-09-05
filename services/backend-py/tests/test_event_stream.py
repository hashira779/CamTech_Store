import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.domain.event_bus import event_bus

class MockUser:
    def __init__(self):
        self.id = "usr_stream_tester"
        self.organization_id = "org_stream_test"
        self.email = "stream@mystore.test"
        self.name = "Stream Tester"
        self.roles = '["ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_stream_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_event_bus_publish_and_subscribe():
    org_id = "org_unit_test"
    orig_get_pubsub = event_bus.get_pubsub
    orig_publish = event_bus.publish
    
    try:
        mock_pubsub = AsyncMock()
        mock_pubsub.get_message.side_effect = [
            None,
            {"type": "message", "data": '{"event": "ORDER_DISPATCHED", "data": {"trackingNumber": "TRK-2026-9999"}}'}
        ]
        
        event_bus.get_pubsub = AsyncMock(return_value=mock_pubsub)
        event_bus.publish = AsyncMock()

        pubsub = await event_bus.get_pubsub(org_id)
        
        msg = await pubsub.get_message(ignore_subscribe_messages=True)
        assert msg is None

        await event_bus.publish(
            org_id=org_id,
            event_type="ORDER_DISPATCHED",
            data={"trackingNumber": "TRK-2026-9999"}
        )

        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        assert msg is not None
        assert msg["type"] == "message"
        assert "ORDER_DISPATCHED" in msg["data"]
        assert "TRK-2026-9999" in msg["data"]

        await pubsub.unsubscribe()
        await pubsub.close()
    finally:
        event_bus.get_pubsub = orig_get_pubsub
        event_bus.publish = orig_publish

@pytest.mark.asyncio
async def test_deep_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health/deep")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "healthy"
        assert data["checks"]["database"]["connected"] is True
        assert data["checks"]["eventBus"]["status"] == "active"
