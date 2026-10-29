"""
Process-wide Redis circuit breaker.

Every Redis client in the request path (IP ban list, rate limiters, realtime
event bus, passkey challenges) falls back to in-memory behaviour when Redis is
unreachable. Without a breaker each request still paid the full connect timeout
(~1s per call, ~2s per request on Windows) before falling back. The breaker
remembers the outage so callers skip Redis immediately, and lets exactly one
caller probe again after the cooldown.

Usage:
    if client and redis_breaker.allow():
        try:
            ...redis call...
            redis_breaker.record_success()
        except Exception as exc:
            redis_breaker.record_failure(exc)
"""
import asyncio
import logging
import os
import time

from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

logger = logging.getLogger(__name__)

# Only transport failures mean "Redis is down"; a bad payload or a WRONGTYPE
# reply must not take Redis out of rotation for every caller.
_OUTAGE_ERRORS = (RedisConnectionError, RedisTimeoutError, OSError, asyncio.TimeoutError)


class RedisCircuitBreaker:
    def __init__(self, cooldown_seconds: float = 30.0):
        self.cooldown_seconds = cooldown_seconds
        self._open_until = 0.0
        self._open = False

    @property
    def is_open(self) -> bool:
        return self._open

    def allow(self) -> bool:
        """True when the caller should try Redis.

        Closed → always. Open → False until the cooldown elapses, then True for
        a single probing caller (the window is pushed forward so concurrent
        requests keep skipping while that probe is in flight).
        """
        if not self._open:
            return True
        now = time.monotonic()
        if now < self._open_until:
            return False
        self._open_until = now + self.cooldown_seconds
        return True

    def record_success(self) -> None:
        if self._open:
            logger.info("Redis reachable again — circuit closed")
        self._open = False
        self._open_until = 0.0

    def record_failure(self, exc: BaseException) -> None:
        if not isinstance(exc, _OUTAGE_ERRORS):
            return
        if not self._open:
            logger.warning(
                "Redis unreachable (%s) — using in-memory fallback, retrying in %ss",
                exc, self.cooldown_seconds,
            )
        self._open = True
        self._open_until = time.monotonic() + self.cooldown_seconds

    def reset(self) -> None:
        self._open = False
        self._open_until = 0.0


redis_breaker = RedisCircuitBreaker(float(os.getenv("REDIS_BREAKER_COOLDOWN", "30")))
