"""BakongService against the response shapes in NBC "Bakong Open API Document" v1.0.2 (no network)."""
import pytest

from app.core.bakong import BakongService


class _Resp:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


@pytest.fixture
def nbc(monkeypatch):
    """Replies to the next Bakong call with (status, body); records the request."""
    state = {"reply": None, "calls": []}

    async def fake_post(self, url, headers=None, json=None):
        state["calls"].append({"url": url, "headers": headers, "json": json})
        status, body = state["reply"]
        return _Resp(status, body)

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)
    monkeypatch.delenv("BAKONG_ALLOW_TEST_ACCOUNTS", raising=False)
    return state


# ---- check_bakong_account (§8) -------------------------------------------------------------

@pytest.mark.asyncio
async def test_account_exists_with_null_data(nbc):
    """Spec success body has data: null — this used to crash on .get() and report every real account invalid."""
    nbc["reply"] = (200, {"responseCode": 0, "responseMessage": "Account ID exists", "errorCode": None, "data": None})
    res = await BakongService.check_bakong_account("coffee_lab@aclb", token="t")
    assert res["valid"] is True
    assert nbc["calls"][0]["json"] == {"accountId": "coffee_lab@aclb"}
    assert nbc["calls"][0]["headers"]["Authorization"] == "Bearer t"


@pytest.mark.asyncio
async def test_account_not_found(nbc):
    nbc["reply"] = (200, {"responseCode": 1, "responseMessage": "Account ID not found", "errorCode": 11, "data": None})
    res = await BakongService.check_bakong_account("nobody@aclb", token="t")
    assert res["valid"] is False and res["reason"] == "NOT_FOUND"
    assert "does not exist" in res["message"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status, body", [(401, None), (200, {"responseCode": 1, "errorCode": 6, "data": None})])
async def test_expired_or_invalid_token(nbc, status, body):
    nbc["reply"] = (status, body)
    res = await BakongService.check_bakong_account("coffee_lab@aclb", token="expired")
    assert res["valid"] is False and res["reason"] == "TOKEN"
    assert "renew" in res["message"].lower()


@pytest.mark.asyncio
async def test_rate_limited(nbc):
    nbc["reply"] = (429, None)
    res = await BakongService.check_bakong_account("coffee_lab@aclb", token="t")
    assert res["reason"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_no_token_fails_without_calling_nbc(nbc, monkeypatch):
    monkeypatch.delenv("BAKONG_AUTH_TOKEN", raising=False)
    res = await BakongService.check_bakong_account("coffee_lab@aclb", token=None)
    assert res["valid"] is False and res["reason"] == "TOKEN" and nbc["calls"] == []


@pytest.mark.asyncio
async def test_test_accounts_need_explicit_flag(nbc, monkeypatch):
    nbc["reply"] = (200, {"responseCode": 1, "errorCode": 11, "data": None})
    assert (await BakongService.check_bakong_account("x@test", token="t"))["valid"] is False
    monkeypatch.setenv("BAKONG_ALLOW_TEST_ACCOUNTS", "1")
    assert (await BakongService.check_bakong_account("x@test", token=None))["valid"] is True


# ---- check_transaction_by_md5 (§5) ---------------------------------------------------------

@pytest.mark.asyncio
async def test_md5_paid_returns_transaction_data(nbc):
    data = {"hash": "8465d722", "fromAccountId": "rieu_dhqj_1984@devb", "toAccountId": "bridge_account@devb",
            "currency": "USD", "amount": 1.0, "description": "testing bakong generator"}
    nbc["reply"] = (200, {"responseCode": 0, "responseMessage": "Getting transaction successfully.", "data": data})
    res = await BakongService.check_transaction_by_md5("d60f3db96913029a2af979a1662c1e72", token="t")
    assert res["verified"] is True and res["data"]["toAccountId"] == "bridge_account@devb"


@pytest.mark.asyncio
@pytest.mark.parametrize("body, reason", [
    ({"data": None, "errorCode": 1, "responseCode": 1, "responseMessage": "Transaction could not be found."}, "NOT_PAID"),
    ({"data": None, "errorCode": 3, "responseCode": 1, "responseMessage": "Transaction failed."}, "FAILED"),
])
async def test_md5_not_paid(nbc, body, reason):
    nbc["reply"] = (200, body)
    res = await BakongService.check_transaction_by_md5("abc", token="t")
    assert res["verified"] is False and res["reason"] == reason


@pytest.mark.asyncio
async def test_md5_network_error_is_not_paid(nbc, monkeypatch):
    async def boom(self, *a, **k):
        raise ConnectionError("down")
    monkeypatch.setattr("httpx.AsyncClient.post", boom)
    res = await BakongService.check_transaction_by_md5("abc", token="t")
    assert res["verified"] is False and res["reason"] == "UNREACHABLE"
