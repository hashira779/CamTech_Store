import pytest
import httpx
from app.main import app
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_user_management_lifecycle():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as Admin
        admin_login = await client.post("/api/v1/auth/login", json={
            "email": "admin@demo.test",
            "password": "Admin123!"
        })
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        user_id = None
        try:
            # 2. List Users
            res = await client.get("/api/v1/auth/users", headers=headers)
            assert res.status_code == 200
            data = res.json()["data"]
            assert isinstance(data, list)

            # 3. Create New Cashier User
            import uuid
            test_email = f"cashier_{uuid.uuid4().hex[:6]}@camtech.cam"
            create_payload = {
                "name": "Test Cashier 01",
                "email": test_email,
                "password": "Password123!",
                "roles": ["CASHIER"]
            }
            res_create = await client.post("/api/v1/auth/users", json=create_payload, headers=headers)
            assert res_create.status_code == 201
            created_user = res_create.json()["data"]
            assert created_user["email"] == test_email
            assert "CASHIER" in created_user["roles"]
            user_id = created_user["id"]

            # 4. Login with New Cashier Credentials
            login_res = await client.post("/api/v1/auth/login", json={
                "email": test_email,
                "password": "Password123!"
            })
            assert login_res.status_code == 200
            cashier_token = login_res.json()["data"]["accessToken"]
            assert cashier_token is not None

            # 5. Non-admin cannot list users
            cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
            res_forbidden = await client.get("/api/v1/auth/users", headers=cashier_headers)
            assert res_forbidden.status_code == 403

            # 6. Update Cashier
            res_update = await client.patch(
                f"/api/v1/auth/users/{user_id}",
                json={"name": "Senior Cashier 01", "roles": ["CASHIER", "STAFF"]},
                headers=headers
            )
            assert res_update.status_code == 200
            updated = res_update.json()["data"]
            assert updated["name"] == "Senior Cashier 01"
            assert "STAFF" in updated["roles"]

            # 7. Deactivate Cashier
            res_del = await client.delete(f"/api/v1/auth/users/{user_id}", headers=headers)
            assert res_del.status_code == 200
        finally:
            # Clean up: hard-delete test user from DB to prevent row leak
            if user_id:
                from app.core.database import AsyncSessionLocal
                from app.modules.identity.models import User
                from sqlalchemy import delete
                async with AsyncSessionLocal() as session:
                    await session.execute(delete(User).where(User.id == user_id))
                    await session.commit()
