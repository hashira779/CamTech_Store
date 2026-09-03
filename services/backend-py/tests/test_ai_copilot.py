import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser
from app.domain.ai_copilot_engine import AiCopilotEngine

class MockUser:
    def __init__(self, roles=None):
        self.id = "usr_copilot_test"
        self.organization_id = "org_demo"
        self.email = "admin@mystore.test"
        self.name = "Test Copilot Admin"
        self.roles = roles or '["ORG_ADMIN"]'
        self.location_id = None

@pytest.fixture
def mock_admin_user():
    user = MockUser(roles='["ORG_ADMIN"]')
    tenant_user = TenantUser(user=user, roles=["ORG_ADMIN"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
def mock_cashier_user():
    user = MockUser(roles='["CASHIER"]')
    tenant_user = TenantUser(user=user, roles=["CASHIER"])
    app.dependency_overrides[get_current_user] = lambda: tenant_user
    yield tenant_user
    app.dependency_overrides.pop(get_current_user, None)

def test_intent_classification():
    assert AiCopilotEngine.classify_intent("How much sales did we make today?") == "SALES_QUERY"
    assert AiCopilotEngine.classify_intent("Show me low stock items") == "INVENTORY_QUERY"
    assert AiCopilotEngine.classify_intent("Where are our delivery drivers?") == "DELIVERY_QUERY"
    assert AiCopilotEngine.classify_intent("Are there any pending approvals?") == "APPROVAL_QUERY"
    assert AiCopilotEngine.classify_intent("What is our profit margin?") == "FINANCIAL_QUERY"

def test_tool_security_enforcement():
    # Cashier can query sales but NOT executive financial margins (§71)
    assert AiCopilotEngine.validate_tool_permissions("SALES_QUERY", ["CASHIER"]) is True
    assert AiCopilotEngine.validate_tool_permissions("FINANCIAL_QUERY", ["CASHIER"]) is False

    # Org Admin can query everything
    assert AiCopilotEngine.validate_tool_permissions("FINANCIAL_QUERY", ["ORG_ADMIN"]) is True

@pytest.mark.asyncio
async def test_ai_copilot_chat_api(mock_admin_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ai/chat",
            json={"message": "What are today's sales and top products?"}
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["intent"] == "SALES_QUERY"
        assert data["authorized"] is True
        assert "Today's Sales" in data["message"]
        assert data["actionLink"] == "/sales"
        assert len(data["suggestions"]) > 0

@pytest.mark.asyncio
async def test_ai_copilot_suggestions_api(mock_admin_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/ai/suggestions?context=delivery")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["context"] == "delivery"
        assert len(data["prompts"]) >= 3
