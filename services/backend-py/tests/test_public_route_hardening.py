import hashlib
import hmac
import json
import time
import urllib.parse
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app
from app.modules.delivery import api_auth

BOT_TOKEN = "123:test-bot-token"
ANONYMOUS_ALLOWLIST = {
    "/auth/customer-session",
    "/auth/login",
    "/auth/passkeys/login/options",
    "/auth/passkeys/login/verify",
    "/auth/refresh",
    "/auth/register",
    "/apps/registry",
    "/apps/resolve",
    "/bot-builder/webhook/{bot_id}",
    "/delivery/auth/login/auto",
    "/delivery/auth/register/init",
    "/delivery/auth/register/verify",
    "/infra/agents/heartbeat",
    "/public/categories/tree",
    "/public/products",
    "/sales/bakong-webhook",
    "/sales/orders/{sale_id}/confirm-payment",
    "/sales/orders/{sale_id}/payment-status",
    "/sales/payment-methods",
    "/sales/payway-webhook",
    "/telegram/mini-app/auth",
}


def _signed_init_data(token=BOT_TOKEN, user_id=42, auth_date=None):
    fields = {"auth_date": str(auth_date or int(time.time())), "user": json.dumps({"id": user_id})}
    check = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


@pytest.fixture
def known_bot(monkeypatch):
    async def tokens(db):
        return [BOT_TOKEN]

    monkeypatch.setattr(api_auth, "_telegram_bot_tokens", tokens)


@pytest.mark.asyncio
async def test_signed_telegram_data_is_accepted(known_bot):
    assert (await api_auth.verified_telegram_user(_signed_init_data(), None))["id"] == 42


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "init_data",
    [
        "",
        "not-signed",
        'user={"id":42}',
        _signed_init_data(token="999:another-bot"),
        _signed_init_data(auth_date=int(time.time()) - 90000),
    ],
)
async def test_forged_or_stale_telegram_data_is_refused(known_bot, init_data):
    with pytest.raises(HTTPException) as denied:
        await api_auth.verified_telegram_user(init_data, None)
    assert denied.value.status_code == 401


def test_no_backdoor_otp_remains():
    import inspect

    assert "123456" not in inspect.getsource(api_auth)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method, path, body",
    [
        ("GET", "/api/v1/delivery/tasks", None),
        ("POST", "/api/v1/delivery/tasks", {}),
        ("POST", "/api/v1/delivery/orders/public", {}),
        ("PATCH", "/api/v1/delivery/tasks/some-id/status", {"status": "DELIVERED"}),
        ("POST", "/api/v1/telegram/webhook", {"message": {"text": "/help"}}),
        ("POST", "/api/v1/telegram/mini-app/sync-contact", {"customerId": "victim", "phone": "1"}),
        ("GET", "/api/v1/infra/events/stream", None),
    ],
)
async def test_anonymous_callers_are_refused(method, path, body):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(method, path, json=body)
    assert response.status_code in (400, 401), response.text
    if body is None or method == "PATCH" or "telegram" in path:
        assert response.status_code == 401


def test_new_anonymous_routes_must_be_reviewed():
    from app.core.dependencies import (
        get_current_user,
        get_optional_streaming_user,
        get_optional_user,
        get_streaming_user,
    )

    known_auth = {get_current_user, get_streaming_user, get_optional_user, get_optional_streaming_user}

    def calls(dependant):
        found = {dependant.call}
        for sub in dependant.dependencies:
            found |= calls(sub)
        return found

    unreviewed = []
    for route in app.routes:
        if not hasattr(route, "dependant") or not route.path.startswith("/api/v1/"):
            continue
        deps = calls(route.dependant)
        guarded = deps & known_auth or any(type(dep).__name__.startswith("Require") for dep in deps)
        if not guarded and route.path.removeprefix("/api/v1") not in ANONYMOUS_ALLOWLIST:
            unreviewed.append(route.path)
    assert unreviewed == []
