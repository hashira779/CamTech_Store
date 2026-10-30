import datetime
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient

from app.core import external_identity
from app.core.access_policy import is_allowed
from app.core.config import settings
from app.core.external_identity import ExternalIdentityError, verify_external_token
from app.main import app

PROJECT = "mystore-test"
SUPABASE_URL = "https://example.supabase.co"
SUPABASE_SECRET = "s" * 40
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", PROJECT, raising=False)
    monkeypatch.setattr(settings, "SUPABASE_URL", SUPABASE_URL, raising=False)
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", SUPABASE_SECRET, raising=False)
    monkeypatch.setattr(external_identity, "_signing_key", lambda url, token: KEY.public_key())


def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def _firebase_token(key=KEY, **overrides):
    claims = {
        "iss": f"https://securetoken.google.com/{PROJECT}",
        "aud": PROJECT,
        "sub": "uid-1",
        "iat": _now(),
        "exp": _now() + datetime.timedelta(hours=1),
        "email": "Buyer@Example.com",
        "email_verified": True,
        "name": "Buyer",
    }
    return jwt.encode({**claims, **overrides}, key, algorithm="RS256")


def _supabase_token(secret=SUPABASE_SECRET, **overrides):
    claims = {
        "iss": f"{SUPABASE_URL}/auth/v1",
        "aud": "authenticated",
        "sub": "uid-2",
        "exp": _now() + datetime.timedelta(hours=1),
        "email": "buyer@example.com",
        "user_metadata": {"email_verified": True, "full_name": "Buyer"},
    }
    return jwt.encode({**claims, **overrides}, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_valid_firebase_token_gives_normalized_email():
    identity = await verify_external_token("firebase", _firebase_token())
    assert identity.email == "buyer@example.com"
    assert identity.provider == "firebase"


@pytest.mark.asyncio
async def test_valid_supabase_token_is_accepted_as_fallback():
    identity = await verify_external_token("supabase", _supabase_token())
    assert identity.email == "buyer@example.com"
    assert identity.name == "Buyer"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token",
    [
        _firebase_token(key=OTHER_KEY),
        _firebase_token(aud="another-project"),
        _firebase_token(iss="https://securetoken.google.com/another-project"),
        _firebase_token(exp=_now() - datetime.timedelta(minutes=5)),
        _firebase_token(email_verified=False),
        _firebase_token(email=""),
        "not-a-token",
    ],
)
async def test_bad_firebase_tokens_are_rejected(token):
    with pytest.raises(ExternalIdentityError):
        await verify_external_token("firebase", token)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token",
    [
        _supabase_token(secret="x" * 40),
        _supabase_token(aud="anon"),
        _supabase_token(iss="https://evil.supabase.co/auth/v1"),
        _supabase_token(user_metadata={"email_verified": False}),
    ],
)
async def test_bad_supabase_tokens_are_rejected(token):
    with pytest.raises(ExternalIdentityError):
        await verify_external_token("supabase", token)


@pytest.mark.asyncio
async def test_firebase_refuses_a_symmetric_token():
    forged = jwt.encode({"email": "admin@example.com", "email_verified": True}, "k" * 40, algorithm="HS256")
    with pytest.raises(ExternalIdentityError):
        await verify_external_token("firebase", forged)


@pytest.mark.asyncio
async def test_unconfigured_provider_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "", raising=False)
    with pytest.raises(ExternalIdentityError):
        await verify_external_token("firebase", _firebase_token())


@pytest.mark.parametrize(
    "method, area",
    [
        ("GET", "customers/profile"),
        ("POST", "customers/sync"),
        ("POST", "customers/cart"),
        ("GET", "sales/customer-orders"),
        ("POST", "sales/store-checkout"),
        ("GET", "auth/me"),
    ],
)
def test_customers_reach_their_own_routes(method, area):
    assert is_allowed(method, f"/api/v1/{area}", ["CUSTOMER"], [])


@pytest.mark.parametrize(
    "method, area",
    [
        ("GET", "customers"),
        ("GET", "sales"),
        ("POST", "sales"),
        ("GET", "notifications"),
        ("GET", "reports/dashboard"),
        ("GET", "auth/users"),
        ("POST", "ai/chat"),
        ("GET", "customersx/profile"),
    ],
)
def test_customers_are_refused_everywhere_else(method, area):
    assert not is_allowed(method, f"/api/v1/{area}", ["CUSTOMER"], [])


def test_a_staff_role_is_not_limited_by_the_customer_list():
    assert is_allowed("GET", "/api/v1/sales", ["CUSTOMER", "CASHIER"], [])


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_unverified_email_login_route_is_gone():
    async with _client() as client:
        response = await client.post("/api/v1/auth/oauth-sync", json={"email": "owner@example.com"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_customer_session_rejects_a_forged_token():
    async with _client() as client:
        response = await client.post(
            "/api/v1/auth/customer-session",
            json={"provider": "firebase", "idToken": _firebase_token(key=OTHER_KEY)},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method, path, body",
    [
        ("POST", "/api/v1/customers/sync", {"name": "x", "email": "victim@example.com"}),
        ("POST", "/api/v1/customers/public-sync", {"name": "x", "email": "victim@example.com"}),
        ("GET", "/api/v1/customers/profile?email=victim@example.com", None),
        ("GET", "/api/v1/customers/cart?email=victim@example.com", None),
        ("POST", "/api/v1/customers/cart", {"email": "victim@example.com", "items": []}),
    ],
)
async def test_customer_data_needs_a_login(method, path, body):
    async with _client() as client:
        response = await client.request(method, path, json=body)
    assert response.status_code == 401


def test_one_customer_cannot_name_another():
    from fastapi import HTTPException

    from app.modules.customers.api import _authorized_email

    customer = SimpleNamespace(email="me@example.com", roles=["CUSTOMER"])
    assert _authorized_email(customer, " ME@example.com ") == "me@example.com"
    with pytest.raises(HTTPException) as denied:
        _authorized_email(customer, "victim@example.com")
    assert denied.value.status_code == 403

    admin = SimpleNamespace(email="admin@example.com", roles=["ORG_ADMIN"])
    assert _authorized_email(admin, "someone@example.com") == "someone@example.com"
