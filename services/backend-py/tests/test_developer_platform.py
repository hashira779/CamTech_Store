import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, delete
from app.modules.organizations.models import Organization
from app.modules.automations.models import DeveloperApp, ApiKey, WebhookSubscription, TelegramChatBinding, TelegramBot

class MockAdminUser:
    def __init__(self, org_id: str):
        self.id = "usr_dev_test"
        self.organization_id = org_id
        self.email = "admin@demo.test"
        self.name = "Dev Admin"
        self.roles = '["ORG_ADMIN", "SUPER_ADMIN"]'
        self.location_id = None

@pytest.mark.asyncio
async def test_developer_platform_endpoints_flow():
    # 1. Fetch existing organization from DB
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Organization))
        org = res.scalars().first()
        if not org:
            org = Organization(name="Dev Platform Test Org", slug=f"test-org-{uuid.uuid4().hex[:6]}")
            session.add(org)
            await session.commit()
            await session.refresh(org)
        org_id = org.id

    mock_user = MockAdminUser(org_id=org_id)
    tenant_user = TenantUser(user=mock_user, roles=["ORG_ADMIN", "SUPER_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user

    test_run_id = uuid.uuid4().hex[:8]
    created_app_id = None
    created_key_id = None
    created_webhook_id = None
    created_binding_id = None

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. List Developer Apps (GET /developers/apps)
            res = await client.get("/api/v1/developers/apps")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert isinstance(data["data"], list)

            # 2. Create Developer App (POST /developers/apps)
            app_payload = {
                "name": f"Test App {test_run_id}",
                "description": "App created during automated developer platform test",
                "homepageUrl": "https://example.com"
            }
            res = await client.post("/api/v1/developers/apps", json=app_payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            created_app_id = data["data"]["id"]
            assert data["data"]["name"] == app_payload["name"]
            assert data["data"]["homepageUrl"] == app_payload["homepageUrl"]

            # 3. List API Keys (GET /developers/keys) - was 405 Method Not Allowed!
            res = await client.get("/api/v1/developers/keys")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert isinstance(data["data"], list)

            # 4. Create API Key (POST /developers/keys)
            key_payload = {
                "name": f"Test Key {test_run_id}",
                "appId": created_app_id,
                "scopes": ["products:read", "sales:read"],
                "rateLimit": 120,
                "expiresInDays": 30
            }
            res = await client.post("/api/v1/developers/keys", json=key_payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            key_data = data["data"]
            created_key_id = key_data["id"]
            assert key_data["name"] == key_payload["name"]
            assert key_data["keyPrefix"].startswith("sk_live_")
            assert "secretKey" in key_data
            assert key_data["secretKey"].startswith("sk_live_")
            assert key_data["status"] == "ACTIVE"

            # 5. Revoke API Key (DELETE /developers/keys/{key_id})
            res = await client.delete(f"/api/v1/developers/keys/{created_key_id}")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["data"]["status"] == "REVOKED"
            assert data["data"]["revokedAt"] is not None

            # 6. List Webhooks (GET /developers/webhooks) - was 404 Not Found!
            res = await client.get("/api/v1/developers/webhooks")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert isinstance(data["data"], list)

            # 7. Create Webhook (POST /developers/webhooks)
            webhook_payload = {
                "url": f"https://webhook.site/test-{test_run_id}",
                "description": "Test Webhook Endpoint",
                "events": ["order.created", "inventory.low_stock"]
            }
            res = await client.post("/api/v1/developers/webhooks", json=webhook_payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            wh_data = data["data"]
            created_webhook_id = wh_data["id"]
            assert wh_data["url"] == webhook_payload["url"]
            assert wh_data["events"] == webhook_payload["events"]
            assert wh_data["isActive"] is True

            # 8. Delete Webhook (DELETE /developers/webhooks/{webhook_id})
            res = await client.delete(f"/api/v1/developers/webhooks/{created_webhook_id}")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["data"]["success"] is True
            created_webhook_id = None  # Already deleted

            # 9. Multi-Bot Lifecycle (POST /telegram/bots, GET, PATCH, DELETE)
            bot_payload = {
                "name": f"Sales Bot {test_run_id}",
                "botToken": f"123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_{test_run_id}",
                "botUsername": f"sales_bot_{test_run_id}",
                "purpose": "SALES",
                "defaultChatId": f"-100{test_run_id}",
                "isPrimary": True,
            }
            res_bot = await client.post("/api/v1/telegram/bots", json=bot_payload)
            assert res_bot.status_code == 200
            bot_data = res_bot.json()
            assert bot_data["success"] is True
            created_bot_id = bot_data["data"]["id"]
            assert bot_data["data"]["name"] == bot_payload["name"]
            assert bot_data["data"]["purpose"] == "SALES"
            assert bot_data["data"]["isPrimary"] is True

            # List bots
            res_list_bots = await client.get("/api/v1/telegram/bots")
            assert res_list_bots.status_code == 200
            assert any(b["id"] == created_bot_id for b in res_list_bots.json()["data"])

            # Update bot
            res_update_bot = await client.patch(
                f"/api/v1/telegram/bots/{created_bot_id}",
                json={"name": f"Updated Bot {test_run_id}", "purpose": "DELIVERY"}
            )
            assert res_update_bot.status_code == 200
            assert res_update_bot.json()["data"]["name"] == f"Updated Bot {test_run_id}"
            assert res_update_bot.json()["data"]["purpose"] == "DELIVERY"

            # 10. Bind Telegram Chat with botId (POST /telegram/bindings)
            binding_payload = {
                "chatId": f"-100{test_run_id}",
                "chatTitle": f"Dev Channel {test_run_id}",
                "username": "dev_bot",
                "role": "OPERATOR",
                "botId": created_bot_id,
            }
            res = await client.post("/api/v1/telegram/bindings", json=binding_payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            created_binding_id = data["data"]["id"]
            assert data["data"]["chatId"] == binding_payload["chatId"]
            assert data["data"]["botId"] == created_bot_id

            # Broadcast via bot
            res_bcast = await client.post(
                f"/api/v1/telegram/bots/{created_bot_id}/broadcast",
                json={"message": f"Test notification from bot {test_run_id}"}
            )
            assert res_bcast.status_code == 200
            assert res_bcast.json()["success"] is True

            # Delete bot
            res_del_bot = await client.delete(f"/api/v1/telegram/bots/{created_bot_id}")
            assert res_del_bot.status_code == 200
            created_bot_id = None

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        # Cleanup any remaining test rows from the real DB
        async with AsyncSessionLocal() as session:
            if created_key_id:
                await session.execute(delete(ApiKey).where(ApiKey.id == created_key_id))
            if created_webhook_id:
                await session.execute(delete(WebhookSubscription).where(WebhookSubscription.id == created_webhook_id))
            if created_binding_id:
                await session.execute(delete(TelegramChatBinding).where(TelegramChatBinding.id == created_binding_id))
            if created_bot_id:
                await session.execute(delete(TelegramBot).where(TelegramBot.id == created_bot_id))
            if created_app_id:
                await session.execute(delete(DeveloperApp).where(DeveloperApp.id == created_app_id))
            await session.commit()
