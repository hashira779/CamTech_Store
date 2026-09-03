import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.domain.outbox_engine import (
    OutboxRepository,
    OutboxRelay,
    IdempotentConsumerRegistry,
    SagaCoordinator,
    EventContract,
    OutboxStatus
)

@pytest.mark.asyncio
async def test_outbox_save_and_relay():
    repo = OutboxRepository()
    relay = OutboxRelay(repo)

    # Save event
    evt = EventContract(
        eventType="SALE_COMPLETED",
        tenantId="org_test_1",
        aggregateId="sale_999",
        data={"amount": 49.99}
    )
    rec = repo.save(evt)
    assert rec.status == OutboxStatus.PENDING

    # Publish batch
    published_events = []
    async def mock_publisher(event: EventContract) -> bool:
        published_events.append(event.eventId)
        return True

    res = await relay.publish_batch(publisher_fn=mock_publisher)
    assert res["processed"] == 1
    assert res["published"] == 1
    assert res["failed"] == 0
    assert rec.status == OutboxStatus.PUBLISHED
    assert rec.id in published_events

@pytest.mark.asyncio
async def test_idempotent_consumer_deduplication():
    consumer = IdempotentConsumerRegistry()
    event_id = "evt_dedup_1001"

    assert consumer.has_processed(event_id) is False
    consumer.mark_processed(event_id)
    assert consumer.has_processed(event_id) is True

    # Second check still returns True
    assert consumer.has_processed(event_id) is True

@pytest.mark.asyncio
async def test_saga_successful_execution():
    saga = SagaCoordinator()
    res = await saga.execute_order_fulfillment_saga(
        order_id="ord_success_1",
        tenant_id="org_test",
        amount=150.0,
        stock_sku="MBP-14-M3"
    )
    assert res["status"] == "COMPLETED"
    assert res["compensated"] is False
    assert len(res["steps"]) == 4
    assert res["steps"][0] == "STEP_1:ORDER_RESERVED"
    assert res["steps"][1] == "STEP_2:PAYMENT_AUTHORIZED"
    assert res["steps"][2] == "STEP_3:INVENTORY_DEDUCTED"
    assert res["steps"][3] == "STEP_4:DELIVERY_DISPATCHED"

@pytest.mark.asyncio
async def test_saga_failure_and_compensation():
    saga = SagaCoordinator()
    # Simulate failure at INVENTORY step
    res = await saga.execute_order_fulfillment_saga(
        order_id="ord_fail_inventory",
        tenant_id="org_test",
        amount=150.0,
        stock_sku="MBP-14-M3",
        fail_at_step="INVENTORY"
    )
    assert res["status"] == "COMPENSATED"
    assert res["compensated"] is True
    # Compensations must run in reverse order of executed steps
    assert "COMPENSATE:PAYMENT_REFUNDED" in res["steps"]
    assert "COMPENSATE:ORDER_CANCELLED" in res["steps"]

from app.core.dependencies import get_current_user, TenantUser

class MockUser:
    def __init__(self):
        self.id = "usr_test_01"
        self.organization_id = "org_test"
        self.email = "admin@mystore.test"
        self.name = "Admin User"
        self.roles = '["ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_tenant_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_outbox_api_endpoints(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Check outbox status
        res = await client.get("/api/v1/outbox/status")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "pendingCount" in data

        # 2. Test Saga execution via API
        res_saga = await client.post(
            "/api/v1/outbox/saga/test",
            json={
                "orderId": "ord_api_test",
                "amount": 99.00,
                "stockSku": "SKU-99",
                "failAtStep": "PAYMENT"
            }
        )
        assert res_saga.status_code == 200
        saga_data = res_saga.json()["data"]
        assert saga_data["status"] == "COMPENSATED"
        assert saga_data["compensated"] is True

        # 3. Test Idempotent Consumer API
        evt_payload = {
            "eventId": "evt_api_test_42",
            "eventType": "ORDER_CREATED",
            "version": 1,
            "tenantId": "org_default",
            "aggregateId": "ord_42",
            "data": {"sku": "TEST"}
        }

        # First consumption
        res_c1 = await client.post("/api/v1/outbox/consume", json={"event": evt_payload})
        assert res_c1.status_code == 200
        assert res_c1.json()["data"]["status"] == "PROCESSED_SUCCESSFULLY"

        # Duplicate consumption (must be deduplicated)
        res_c2 = await client.post("/api/v1/outbox/consume", json={"event": evt_payload})
        assert res_c2.status_code == 200
        assert res_c2.json()["data"]["status"] == "DUPLICATE_IGNORED"


