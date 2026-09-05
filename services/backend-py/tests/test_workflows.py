import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def auth_headers():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/auth/login", json={"email": "admin@demo.test", "password": "Admin123!"})
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        token = resp.json()["data"]["accessToken"]
        return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_list_workflow_instances(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/workflows/instances?status=PENDING", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

@pytest.mark.asyncio
async def test_workflow_lifecycle_submit_and_review(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Submit workflow instance
        payload = {
            "entityType": "PURCHASE_ORDER",
            "entityId": "PO-TEST-9999",
            "title": "Restock Order Approval - High Volume",
            "metadata": {"amount": 5400, "supplier": "TechSupplies Co"},
            "steps": [
                {"stepOrder": 1, "name": "Branch Manager Review", "assignedRole": "BRANCH_MANAGER"},
                {"stepOrder": 2, "name": "CFO Approval", "assignedRole": "SUPER_ADMIN"}
            ]
        }
        create_resp = await client.post("/api/v1/workflows/instances", json=payload, headers=auth_headers)
        assert create_resp.status_code == 201
        created = create_resp.json()["data"]
        assert created["entityType"] == "PURCHASE_ORDER"
        assert created["status"] == "PENDING"
        assert created["currentStep"] == 1
        assert len(created["steps"]) == 2
        assert len(created["logs"]) >= 1

        instance_id = created["id"]
        step1_id = created["steps"][0]["id"]
        step2_id = created["steps"][1]["id"]

        # 2. Get instance by ID
        get_resp = await client.get(f"/api/v1/workflows/instances/{instance_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["data"]["id"] == instance_id

        # 3. Review Step 1 (APPROVE)
        review1_resp = await client.post(
            f"/api/v1/workflows/instances/{instance_id}/steps/{step1_id}/review",
            json={"action": "APPROVE", "comment": "Verified unit prices"},
            headers=auth_headers
        )
        assert review1_resp.status_code == 200
        after_step1 = review1_resp.json()["data"]
        assert after_step1["status"] == "PENDING"
        assert after_step1["currentStep"] == 2
        assert after_step1["steps"][0]["status"] == "APPROVED"

        # 4. Review Step 2 (APPROVE) -> Full approval
        review2_resp = await client.post(
            f"/api/v1/workflows/instances/{instance_id}/steps/{step2_id}/review",
            json={"action": "APPROVE", "comment": "Approved budget"},
            headers=auth_headers
        )
        assert review2_resp.status_code == 200
        after_step2 = review2_resp.json()["data"]
        assert after_step2["status"] == "APPROVED"
        assert after_step2["steps"][1]["status"] == "APPROVED"
