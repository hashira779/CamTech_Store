import pytest
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import engine
from app.core.dependencies import get_current_user, TenantUser
from app.services.delivery_service import delivery_service

TEST_ORG_ID = "cmtk8h18o0000vkd0etmdacgw"

class MockUser:
    def __init__(self):
        self.id = "usr_68851d2c74"
        self.organization_id = TEST_ORG_ID
        self.email = "admin@camtech.cam"
        self.name = "Pipeline Test Admin"
        self.roles = '["ORG_ADMIN", "WAREHOUSE_STAFF", "DELIVERY_DRIVER"]'
        self.location_id = None

@pytest.fixture
def mock_pipeline_user():
    user = MockUser()
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN", "WAREHOUSE_STAFF", "DELIVERY_DRIVER"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_notifications_platform_endpoints(mock_pipeline_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test get stats
        res_stats = await client.get("/api/v1/notifications/stats")
        assert res_stats.status_code == 200
        stats_data = res_stats.json()["data"]
        assert "totalDispatched" in stats_data
        assert "unreadInApp" in stats_data
        assert "activeChannels" in stats_data

        # 2. Test get config
        res_cfg = await client.get("/api/v1/notifications/config")
        assert res_cfg.status_code == 200
        cfg_data = res_cfg.json()["data"]
        assert cfg_data["inAppEnabled"] is True

        # 3. Test patch config
        res_patch = await client.patch(
            "/api/v1/notifications/config",
            json={"telegramEnabled": True, "telegramChatId": "-100123456789"}
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["data"]["telegramEnabled"] is True
        assert res_patch.json()["data"]["telegramChatId"] == "-100123456789"

        # 4. Test send test notification
        res_test = await client.post("/api/v1/notifications/test")
        assert res_test.status_code == 200
        note_data = res_test.json()["data"]
        assert note_data["status"] == "SENT"
        note_id = note_data["id"]

        # 5. Test mark notification as read
        res_read = await client.patch(f"/api/v1/notifications/{note_id}/read")
        assert res_read.status_code == 200
        assert res_read.json()["data"]["isRead"] is True

        # 6. Test read all notifications
        res_read_all = await client.post("/api/v1/notifications/read-all")
        assert res_read_all.status_code == 200
        assert "updatedCount" in res_read_all.json()["data"]

@pytest.mark.asyncio
async def test_store_checkout_order_alerts_pipeline(mock_pipeline_user):
    # Retrieve a valid seeded variant from DB, or seed one dynamically if table is empty
    async with engine.begin() as conn:
        res = await conn.execute(
            text('SELECT id, sku, name, "sellPrice" FROM product_variants WHERE "organizationId" = :org_id LIMIT 1'),
            {"org_id": TEST_ORG_ID}
        )
        row = res.fetchone()
        if not row:
            await conn.execute(text("""
                INSERT INTO products (id, "organizationId", type, name, description, "isActive", "createdAt", "updatedAt")
                VALUES ('prod-test-alert', :org_id, 'PHYSICAL'::"ProductType", 'Test Phone Alert', 'Test Phone', true, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """), {"org_id": TEST_ORG_ID})
            await conn.execute(text("""
                INSERT INTO product_variants (id, "organizationId", "productId", sku, barcode, name, unit, currency, "costPrice", "sellPrice", "taxRatePct", "isActive", "createdAt", "updatedAt")
                VALUES ('var-test-alert', :org_id, 'prod-test-alert', 'SKU-ALERT-1', '885999001', 'Test Phone 256GB', 'piece', 'USD', 400.00, 899.00, 10.00, true, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """), {"org_id": TEST_ORG_ID})
            row = ('var-test-alert', 'SKU-ALERT-1', 'Test Phone 256GB', 899.00)
            
        var_id, sku, prod_name, price = row[0], row[1], row[2], float(row[3])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Customer executes Store Checkout
        checkout_payload = {
            "customerEmail": "customer.alerts.test@camtech.cam",
            "customerName": "Sophea Kem",
            "customerPhone": "+855 12 999 888",
            "deliveryAddress": "Preah Sihanouk Blvd, Khan 7 Makara, Phnom Penh",
            "destLat": 11.5580,
            "destLng": 104.9250,
            "paymentMethod": "KHQR",
            "items": [
                {
                    "id": var_id,
                    "name": prod_name,
                    "price": price,
                    "quantity": 1,
                    "sku": sku,
                    "category": "Electronics"
                }
            ],
            "notes": "Please deliver to office reception on 3rd floor"
        }

        res_checkout = await client.post("/api/v1/sales/store-checkout", json=checkout_payload)
        assert res_checkout.status_code == 200
        sale_data = res_checkout.json()["data"]
        assert sale_data["status"] == "COMPLETED"
        assert sale_data["customerName"] == "Sophea Kem"
        sale_id = sale_data["id"]
        sale_number = sale_data["saleNumber"]

        try:
            # Step 2: Verify Delivery Fleet received order dispatch
            delivery_orders = delivery_service.list_orders(org_id=TEST_ORG_ID)
            matching_delivery = [o for o in delivery_orders if o.saleId == sale_id]
            assert len(matching_delivery) == 1
            deliv_order = matching_delivery[0]
            assert deliv_order.status == "PENDING"
            assert deliv_order.recipientName == "Sophea Kem"
            assert "Preah Sihanouk" in deliv_order.deliveryAddress

            # Step 3: Verify Real-Time Notifications generated for both Delivery and Stocker
            res_notes = await client.get("/api/v1/notifications?limit=30")
            assert res_notes.status_code == 200
            notes = res_notes.json()["data"]

            # Check delivery alert notification
            delivery_notifs = [n for n in notes if "Delivery" in n["title"] and sale_number in n["title"]]
            assert len(delivery_notifs) >= 1
            assert delivery_notifs[0]["status"] == "SENT"

            # Check stocker picking notification
            stocker_notifs = [n for n in notes if "Pick" in n["title"] and sale_number in n["title"]]
            assert len(stocker_notifs) >= 1
            assert stocker_notifs[0]["status"] == "SENT"

            # Step 4: Verify Warehouse Stocker sees order in Picking Queue
            res_picking = await client.get("/api/v1/wms/picking-orders")
            assert res_picking.status_code == 200
            picking_orders = res_picking.json()["data"]
            matching_pick = [p for p in picking_orders if p["id"] == sale_id]
            assert len(matching_pick) == 1
            pick_order = matching_pick[0]
            assert pick_order["wmsStatus"] == "PENDING_PICKING"
            assert len(pick_order["items"]) >= 1

            # Step 5: Warehouse Stocker fulfills picking & packing
            res_fulfill = await client.post(
                f"/api/v1/wms/picking-orders/{sale_id}/fulfill",
                json={"notes": "Boxed in heavy-duty shipping carton", "packerName": "Dara Roth"}
            )
            assert res_fulfill.status_code == 200
            fulfilled_order = res_fulfill.json()["data"]
            assert fulfilled_order["wmsStatus"] == "PICKED"

            # Step 6: Delivery Courier claims/accepts the order
            res_claim = await client.patch(
                f"/api/v1/delivery/tasks/{deliv_order.id}/status",
                json={"status": "DISPATCHED"}
            )
            assert res_claim.status_code == 200
            claimed_order = res_claim.json()["data"]
            assert claimed_order["status"] == "DISPATCHED"

        finally:
            # Clean up test rows in live DB per AGENTS.md Rule
            async with engine.begin() as conn:
                await conn.execute(text('DELETE FROM notification_records WHERE "organizationId" = :org_id AND "title" LIKE :pattern'), {"org_id": TEST_ORG_ID, "pattern": f"%{sale_number}%"})
                await conn.execute(text('DELETE FROM stock_movements WHERE "referenceId" = :sale_id'), {"sale_id": sale_id})
                await conn.execute(text('DELETE FROM sale_payments WHERE "saleId" = :sale_id'), {"sale_id": sale_id})
                await conn.execute(text('DELETE FROM sale_line_items WHERE "saleId" = :sale_id'), {"sale_id": sale_id})
                await conn.execute(text('DELETE FROM sales WHERE id = :sale_id'), {"sale_id": sale_id})
