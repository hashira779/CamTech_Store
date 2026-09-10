import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.core.database import engine
from app.core.dependencies import get_current_user, TenantUser

TEST_ORG_ID = "cmtk8h18o0000vkd0etmdacgw"

class MockUser:
    def __init__(self):
        self.id = "usr_dispatcher_01"
        self.organization_id = TEST_ORG_ID
        self.email = "dispatcher@mystore.test"
        self.name = "Fleet Dispatcher"
        self.roles = '["ORG_ADMIN", "DISPATCHER"]'
        self.location_id = None

@pytest.fixture
def mock_tenant_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN", "DISPATCHER"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_delivery_endpoints_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/delivery/orders")
        assert res.status_code == 401
        res_drivers = await client.get("/api/v1/delivery/drivers")
        assert res_drivers.status_code == 401

@pytest.mark.asyncio
async def test_delivery_flow_authenticated(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Ensure at least 3 drivers exist for test tenant
        drivers_res = await client.get("/api/v1/delivery/drivers")
        assert drivers_res.status_code == 200
        drivers = drivers_res.json()["data"]
        for i in range(len(drivers), 3):
            await client.post("/api/v1/delivery/drivers", json={
                "name": f"Test Driver {i+1}",
                "phone": f"+855 89 000 00{i+1}",
                "vehicleType": "MOTORCYCLE",
                "licensePlate": f"PP-202{i}-A"
            })
        drivers_res = await client.get("/api/v1/delivery/drivers")
        drivers = drivers_res.json()["data"]
        assert len(drivers) >= 3
        test_driver_id = drivers[0]["id"]

        # 2. Ensure at least 2 orders exist for test tenant
        orders_res = await client.get("/api/v1/delivery/orders")
        assert orders_res.status_code == 200
        orders_list = orders_res.json()["data"]
        for i in range(len(orders_list), 2):
            await client.post("/api/v1/delivery/orders", json={
                "recipientName": f"Recipient {i+1}",
                "recipientPhone": f"+855 12 000 00{i+1}",
                "deliveryAddress": f"Street {i+100}, Phnom Penh",
            })
        orders_res = await client.get("/api/v1/delivery/orders")
        assert orders_res.status_code == 200
        assert len(orders_res.json()["data"]) >= 2

        try:
            # 3. Create new delivery order
            create_payload = {
                "recipientName": "Chenda Keo",
                "recipientPhone": "+855 89 112 334",
                "deliveryAddress": "Tuol Tompoung St 432, Phnom Penh",
                "destLat": 11.5412,
                "destLng": 104.9125,
                "codAmount": 45.00,
                "deliveryFee": 3.00,
                "notes": "Gate code #4412"
            }
            create_res = await client.post("/api/v1/delivery/orders", json=create_payload)
            assert create_res.status_code == 200
            new_order = create_res.json()["data"]
            assert new_order["trackingNumber"].startswith("TRK-")
            assert new_order["status"] == "PENDING"
            order_id = new_order["id"]

            # 4. Assign driver
            assign_res = await client.post(
                f"/api/v1/delivery/orders/{order_id}/assign",
                json={"driverId": test_driver_id}
            )
            assert assign_res.status_code == 200
            assigned_order = assign_res.json()["data"]
            assert assigned_order["status"] == "DISPATCHED"
            assert assigned_order["driverId"] == test_driver_id
            assert assigned_order["distanceKm"] is not None

            # 5. Ping driver location
            ping_res = await client.post(
                f"/api/v1/delivery/drivers/{test_driver_id}/location",
                json={
                    "driverId": test_driver_id,
                    "latitude": 11.5500,
                    "longitude": 104.9200,
                    "batteryLevel": 88
                }
            )
            assert ping_res.status_code == 200
            driver_updated = ping_res.json()["data"]
            assert driver_updated["currentLat"] == 11.55
            assert driver_updated["batteryLevel"] == 88

            # 6. Update status to IN_TRANSIT then DELIVERED
            transit_res = await client.patch(
                f"/api/v1/delivery/orders/{order_id}/status",
                json={"status": "IN_TRANSIT"}
            )
            assert transit_res.status_code == 200
            assert transit_res.json()["data"]["status"] == "IN_TRANSIT"

            delivered_res = await client.patch(
                f"/api/v1/delivery/orders/{order_id}/status",
                json={
                    "status": "DELIVERED",
                    "proofOfDelivery": "SIG_9941_VERIFIED",
                    "notes": "Handed to customer"
                }
            )
            assert delivered_res.status_code == 200
            final_order = delivered_res.json()["data"]
            assert final_order["status"] == "DELIVERED"
            assert final_order["deliveredAt"] is not None

            # 7. Live tracking snapshot
            snap_res = await client.get("/api/v1/delivery/live-tracking")
            assert snap_res.status_code == 200
            snap_data = snap_res.json()["data"]
            assert "drivers" in snap_data
            assert "activeOrders" in snap_data
        finally:
            async with engine.begin() as conn:
                await conn.execute(text('DELETE FROM delivery_orders WHERE "organizationId" = :org_id'), {"org_id": TEST_ORG_ID})
                await conn.execute(text('DELETE FROM delivery_drivers WHERE "organizationId" = :org_id AND name LIKE :pat'), {"org_id": TEST_ORG_ID, "pat": "Test Driver%"})
