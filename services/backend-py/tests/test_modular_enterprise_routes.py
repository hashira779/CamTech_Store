import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_user, TenantUser

class MockUser:
    def __init__(self):
        self.id = "usr_test_ceo"
        self.organization_id = "org_default_test"
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

@pytest.mark.asyncio
async def test_payroll_calculation_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "baseSalary": 3000.0,
            "allowances": 500.0,
            "deductions": 200.0,
            "taxRatePct": 10.0
        }
        resp = await client.post("/api/v1/hr/payroll/calculate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["baseSalary"] == 3000.0
        assert data["grossPay"] == 3500.0
        assert data["taxAmount"] == 330.0
        assert data["netPay"] == 2970.0

@pytest.mark.asyncio
async def test_tax_calculation_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "amount": 100.0,
            "ratePct": 10.0,
            "isInclusive": False
        }
        resp = await client.post("/api/v1/taxes/calculate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["taxAmount"] == 10.0
        assert data["totalAmount"] == 110.0

@pytest.mark.asyncio
async def test_promotions_evaluate_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "type": "PERCENTAGE",
            "value": 20.0,
            "cartTotal": 200.0,
            "minSpend": 50.0
        }
        resp = await client.post("/api/v1/promotions/evaluate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["applicable"] is True
        assert data["discount"] == 40.0
        assert data["finalTotal"] == 160.0

@pytest.mark.asyncio
async def test_pricing_resolve_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "basePrice": 100.0,
            "customerTier": "WHOLESALE",
            "quantity": 10
        }
        resp = await client.post("/api/v1/pricing/resolve", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["resolvedPrice"] > 0
        assert data["quantity"] == 10

@pytest.mark.asyncio
async def test_storage_upload_intent_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"fileName": "invoice_receipt.pdf"}
        resp = await client.post("/api/v1/storage/upload-intent", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert "uploadUrl" in data
        assert "fileKey" in data
        assert "invoice_receipt.pdf" in data["fileKey"]

@pytest.mark.asyncio
async def test_reporting_dashboard_modular_route(mock_tenant_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/reports/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert "kpi" in data
        assert data["kpi"]["currency"] == "USD"
        assert len(data["salesByChannel"]) > 0
