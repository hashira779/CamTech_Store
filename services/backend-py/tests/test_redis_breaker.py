"""
Redis circuit breaker — a Redis outage must cost one timeout per cooldown,
not one timeout per request.
"""
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError, ResponseError

from app.core import redis_breaker as breaker_module
from app.core.rate_limiter import IPBanList
from app.core.redis_breaker import RedisCircuitBreaker, redis_breaker


class _DownRedis:
    """Stands in for a client whose server is unreachable; counts attempts."""

    def __init__(self):
        self.calls = 0

    async def exists(self, *_):
        self.calls += 1
        raise RedisConnectionError("Error 10061 connecting to localhost:6379")


@pytest.fixture(autouse=True)
def _reset_breaker():
    redis_breaker.reset()
    yield
    redis_breaker.reset()


def test_closed_breaker_allows_calls():
    b = RedisCircuitBreaker(cooldown_seconds=30)
    assert b.allow() is True
    assert b.is_open is False


def test_outage_opens_breaker_and_skips_until_cooldown(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(breaker_module.time, "monotonic", lambda: clock[0])
    b = RedisCircuitBreaker(cooldown_seconds=30)

    b.record_failure(RedisConnectionError("down"))
    assert b.is_open is True
    assert b.allow() is False

    clock[0] += 31
    assert b.allow() is True     # one probe after the cooldown
    assert b.allow() is False    # concurrent callers keep skipping while it runs

    b.record_success()
    assert b.is_open is False
    assert b.allow() is True


def test_non_transport_errors_do_not_open_breaker():
    b = RedisCircuitBreaker(cooldown_seconds=30)
    b.record_failure(ResponseError("WRONGTYPE Operation against a key"))
    b.record_failure(ValueError("bad json"))
    assert b.is_open is False


async def test_ban_list_hits_down_redis_once_then_falls_back():
    bans = IPBanList()
    down = _DownRedis()
    bans._redis = down

    for _ in range(5):
        assert await bans.is_banned("203.0.113.7") is False

    assert down.calls == 1
    assert redis_breaker.is_open is True


async def test_ban_list_never_bans_internal_proxy_ips():
    # cloudflared/nginx traffic arrives from the Docker bridge; banning it blocks every visitor.
    bans = IPBanList()
    down = _DownRedis()
    bans._redis = down

    for ip in ("172.21.0.1", "10.1.0.11", "127.0.0.1"):
        result = await bans.ban(ip, reason="malicious_scanning: .env")
        assert result.get("skipped") == "internal_ip"
        assert await bans.is_banned(ip) is False

    assert down.calls == 0
