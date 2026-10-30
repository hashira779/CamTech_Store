import base64
import os

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core import external_identity
from app.core.access_policy import is_allowed
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.dependencies import TenantUser, get_current_user
from app.main import app
from app.modules.infra import platform_settings as ps
from app.modules.infra.models import InfraPlatformSetting
from sqlalchemy import delete, select

from types import SimpleNamespace


@pytest.fixture
def vault(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_KEK", base64.b64encode(os.urandom(32)).decode(), raising=False)


@pytest.fixture
async def clean_db():
    async def wipe():
        async with AsyncSessionLocal() as db:
            await db.execute(delete(InfraPlatformSetting))
            await db.commit()
        ps._reset_cache()

    await wipe()
    yield
    await wipe()


def _user(*roles):
    return TenantUser(
        user=SimpleNamespace(id="u1", organization_id="o1", email="a@example.com", name="A", location_id=None),
        roles=list(roles),
    )


@pytest.fixture
def as_role():
    def apply(*roles):
        app.dependency_overrides[get_current_user] = lambda: _user(*roles)

    yield apply
    app.dependency_overrides.pop(get_current_user, None)


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.parametrize(
    "key, value",
    [
        ("FIREBASE_PROJECT_ID", "camtech-571ff"),
        ("FIREBASE_API_KEY", "AIza" + "x" * 35),
        ("FIREBASE_APP_ID", "1:1234567890:web:abc123"),
        ("FIREBASE_AUTH_DOMAIN", "camtech-571ff.firebaseapp.com"),
        ("SUPABASE_URL", "https://abc.supabase.co"),
    ],
)
def test_valid_values_pass(key, value):
    assert ps._validated(key, f" {value} ") == value


@pytest.mark.parametrize(
    "key, value",
    [
        ("FIREBASE_PROJECT_ID", "Bad Project!"),
        ("FIREBASE_AUTH_DOMAIN", "https://evil.example/path"),
        ("SUPABASE_URL", "http://insecure.supabase.co"),
        ("SUPABASE_JWT_SECRET", "short"),
        ("JWT_SECRET", "x" * 64),
        ("POSTGRES_PASSWORD", "x" * 64),
        ("PAYMENT_KEK", "x" * 64),
    ],
)
def test_bad_values_and_protected_keys_are_refused(key, value):
    with pytest.raises(ps.InvalidSetting) as refused:
        ps._validated(key, value)
    assert value not in str(refused.value)


def test_customers_and_cashiers_cannot_reach_settings():
    assert not is_allowed("GET", "/api/v1/infra/platform-settings", ["CUSTOMER"], [])


@pytest.mark.asyncio
async def test_non_admin_cannot_save_and_nothing_changes(as_role, clean_db):
    as_role("ORG_ADMIN")
    async with _client() as client:
        response = await client.put("/api/v1/infra/platform-settings", json={"values": {"FIREBASE_PROJECT_ID": "other-project"}})
    assert response.status_code == 403
    async with AsyncSessionLocal() as db:
        assert (await db.execute(select(InfraPlatformSetting))).scalars().all() == []


@pytest.mark.asyncio
async def test_saved_settings_reach_identity_and_public_config(as_role, clean_db, vault):
    as_role("SUPER_ADMIN")
    secret = "s" * 40
    async with _client() as client:
        saved = await client.put(
            "/api/v1/infra/platform-settings",
            json={"values": {
                "FIREBASE_PROJECT_ID": "console-project",
                "FIREBASE_API_KEY": "AIza" + "x" * 35,
                "SUPABASE_JWT_SECRET": secret,
            }},
        )
        assert saved.status_code == 200, saved.text
        assert secret not in saved.text

        public = await client.get("/api/v1/public/auth-config")
        assert public.json()["data"]["firebase"]["projectId"] == "console-project"
        assert secret not in public.text

        listed = await client.get("/api/v1/infra/platform-settings")
        assert secret not in listed.text

    async with AsyncSessionLocal() as db:
        row = await db.get(InfraPlatformSetting, "SUPABASE_JWT_SECRET")
        assert secret not in row.value
        config = await ps.load_identity_config(db)
    assert config.firebase_project_id == "console-project"
    assert config.supabase_jwt_secret == secret


@pytest.mark.asyncio
async def test_one_bad_field_saves_nothing(as_role, clean_db):
    as_role("SUPER_ADMIN")
    async with _client() as client:
        response = await client.put(
            "/api/v1/infra/platform-settings",
            json={"values": {"FIREBASE_PROJECT_ID": "good-project", "SUPABASE_URL": "http://bad.example.com"}},
        )
    assert response.status_code == 400
    async with AsyncSessionLocal() as db:
        assert await db.get(InfraPlatformSetting, "FIREBASE_PROJECT_ID") is None


@pytest.mark.asyncio
async def test_clearing_falls_back_to_the_environment(as_role, clean_db, monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "env-project", raising=False)
    as_role("SUPER_ADMIN")
    async with _client() as client:
        await client.put("/api/v1/infra/platform-settings", json={"values": {"FIREBASE_PROJECT_ID": "console-project"}})
        async with AsyncSessionLocal() as db:
            assert (await ps.load_identity_config(db)).firebase_project_id == "console-project"
        await client.put("/api/v1/infra/platform-settings", json={"values": {"FIREBASE_PROJECT_ID": None}})
    async with AsyncSessionLocal() as db:
        assert (await ps.load_identity_config(db)).firebase_project_id == "env-project"


def test_verifier_uses_the_config_it_is_given():
    assert external_identity.IdentityConfig("p", "u", "s").firebase_project_id == "p"
