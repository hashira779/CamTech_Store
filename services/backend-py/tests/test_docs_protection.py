import os
import pytest
from fastapi.testclient import TestClient
from app.microservices.gateway import gateway
from app.core.security import create_access_token


@pytest.fixture
def client():
    return TestClient(gateway)


def test_docs_and_redoc_protected_in_production(client):
    old_env = os.environ.get("ENVIRONMENT")
    try:
        os.environ["ENVIRONMENT"] = "production"

        # 1. Unauthenticated request to openapi.json is rejected
        res = client.get("/openapi.json", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 401
        assert res.json()["code"] == "UNAUTHORIZED"

        # 2. Unauthenticated request to /docs is locked
        res = client.get("/docs", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 401
        assert "Restricted API Access" in res.text

        # 3. Unauthenticated request to /redoc is locked
        res = client.get("/redoc", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 401
        assert "Restricted API Access" in res.text

        # 4. Non-admin user cannot access
        cashier_token = create_access_token({"sub": "cashier-1", "roles": ["CASHIER"]})
        res = client.get(f"/docs?token={cashier_token}", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 401

        # 5. ORG_ADMIN can unlock docs
        admin_token = create_access_token({"sub": "admin-1", "roles": ["ORG_ADMIN"]})
        res = client.get(f"/docs?token={admin_token}", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 200
        assert "swagger-ui" in res.text.lower()

        # 6. SUPER_ADMIN can unlock openapi.json
        super_token = create_access_token({"sub": "super-1", "roles": ["SUPER_ADMIN"]})
        res = client.get(f"/openapi.json?token={super_token}", headers={"Host": "gateway.camtech.cam"})
        assert res.status_code == 200
        data = res.json()
        assert "paths" in data

    finally:
        if old_env is not None:
            os.environ["ENVIRONMENT"] = old_env
        else:
            os.environ.pop("ENVIRONMENT", None)
