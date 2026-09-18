"""
Rate limiting & IP ban enforcement — MyStore Security Layer.

Two components:
  1. RateLimiter    — Redis sliding-window per (IP, path) with in-memory fallback.
  2. IPBanList      — Redis-backed permanent/TTL IP ban list with auto-escalation.
                      After BAN_THRESHOLD consecutive 429s from the same IP within
                      AUTO_BAN_WINDOW_SECONDS, the IP is automatically banned for
                      AUTO_BAN_DURATION_SECONDS (default 1 hour).
"""
import time
import os
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── Auto-ban escalation thresholds ───────────────────────────────────────────
BAN_THRESHOLD = int(os.getenv("BAN_THRESHOLD", "5"))           # violations before auto-ban
AUTO_BAN_WINDOW_SECONDS = int(os.getenv("AUTO_BAN_WINDOW", "60"))   # track violations within this window
AUTO_BAN_DURATION_SECONDS = int(os.getenv("AUTO_BAN_DURATION", "3600"))  # 1-hour default ban
PERM_BAN_DURATION_SECONDS = int(os.getenv("PERM_BAN_DURATION", str(60 * 60 * 24 * 365)))  # 1 year = permanent


# ==============================================================================
# IP BAN LIST
# ==============================================================================

class IPBanList:
    """
    Redis-backed IP ban list with TTL support.
    - Manual bans: admin explicitly bans an IP (permanent or with TTL).
    - Auto-bans: automatically applied when an IP triggers BAN_THRESHOLD 429s
      within AUTO_BAN_WINDOW_SECONDS.
    - All bans survive restarts (stored in Redis).
    - In-memory set fallback for Redis outages.
    """

    BAN_KEY_PREFIX = "ip_ban:"
    VIOLATION_KEY_PREFIX = "ip_violations:"

    def __init__(self):
        self._local_bans: set = set()   # in-memory fallback
        try:
            self._redis = aioredis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=1.0
            )
        except Exception:
            self._redis = None

    # ── Check ──────────────────────────────────────────────────────────────

    async def is_banned(self, ip: str) -> bool:
        """Returns True if the IP is currently banned."""
        if ip in self._local_bans:
            return True
        if self._redis:
            try:
                return bool(await self._redis.exists(f"{self.BAN_KEY_PREFIX}{ip}"))
            except Exception:
                pass
        return False

    # ── Ban ────────────────────────────────────────────────────────────────

    async def ban(self, ip: str, duration_seconds: int = AUTO_BAN_DURATION_SECONDS,
                  reason: str = "manual", admin_id: str = "") -> dict:
        """
        Ban an IP for `duration_seconds`. Pass duration_seconds=PERM_BAN_DURATION_SECONDS
        for a permanent (1-year) ban.
        Returns a dict with ban metadata.
        """
        key = f"{self.BAN_KEY_PREFIX}{ip}"
        metadata = {
            "ip": ip,
            "reason": reason,
            "banned_by": admin_id or "system",
            "banned_at": int(time.time()),
            "expires_at": int(time.time()) + duration_seconds,
            "duration_seconds": duration_seconds,
        }
        if self._redis:
            try:
                import json
                await self._redis.setex(key, duration_seconds, json.dumps(metadata))
                logger.warning(
                    f"[SECURITY] IP banned: {ip} | reason={reason} | "
                    f"duration={duration_seconds}s | admin={admin_id or 'system'}"
                )
            except Exception:
                self._local_bans.add(ip)
        else:
            self._local_bans.add(ip)
        return metadata

    async def unban(self, ip: str, admin_id: str = "") -> bool:
        """Remove a ban. Returns True if the ban existed."""
        existed = False
        if ip in self._local_bans:
            self._local_bans.discard(ip)
            existed = True
        if self._redis:
            try:
                deleted = await self._redis.delete(f"{self.BAN_KEY_PREFIX}{ip}")
                existed = existed or bool(deleted)
                # also clear any accumulated violations
                await self._redis.delete(f"{self.VIOLATION_KEY_PREFIX}{ip}")
                logger.info(f"[SECURITY] IP unbanned: {ip} | admin={admin_id or 'system'}")
            except Exception:
                pass
        return existed

    async def get_ban_info(self, ip: str) -> Optional[dict]:
        """Return ban metadata dict or None if not banned."""
        if self._redis:
            try:
                import json
                raw = await self._redis.get(f"{self.BAN_KEY_PREFIX}{ip}")
                if raw:
                    data = json.loads(raw)
                    ttl = await self._redis.ttl(f"{self.BAN_KEY_PREFIX}{ip}")
                    data["ttl_remaining_seconds"] = ttl
                    return data
            except Exception:
                pass
        if ip in self._local_bans:
            return {"ip": ip, "reason": "in-memory ban (Redis unavailable)", "ttl_remaining_seconds": -1}
        return None

    async def list_bans(self) -> List[dict]:
        """Return all currently active bans."""
        bans = []
        if self._redis:
            try:
                import json
                keys = await self._redis.keys(f"{self.BAN_KEY_PREFIX}*")
                for key in keys:
                    raw = await self._redis.get(key)
                    if raw:
                        data = json.loads(raw)
                        ttl = await self._redis.ttl(key)
                        data["ttl_remaining_seconds"] = ttl
                        bans.append(data)
            except Exception:
                pass
        for ip in self._local_bans:
            bans.append({"ip": ip, "reason": "in-memory ban", "ttl_remaining_seconds": -1})
        return bans

    # ── Auto-ban escalation ────────────────────────────────────────────────

    async def record_violation(self, ip: str) -> int:
        """
        Increments the violation counter for this IP.
        If the count reaches BAN_THRESHOLD, auto-bans the IP.
        Returns the current violation count.
        """
        vkey = f"{self.VIOLATION_KEY_PREFIX}{ip}"
        count = 1
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(vkey)
                pipe.expire(vkey, AUTO_BAN_WINDOW_SECONDS)
                results = await pipe.execute()
                count = results[0]
            except Exception:
                count = 1

        if count >= BAN_THRESHOLD:
            already_banned = await self.is_banned(ip)
            if not already_banned:
                await self.ban(
                    ip,
                    duration_seconds=AUTO_BAN_DURATION_SECONDS,
                    reason=f"auto-ban: {count} violations in {AUTO_BAN_WINDOW_SECONDS}s"
                )
                logger.warning(
                    f"[SECURITY] AUTO-BAN triggered: {ip} | violations={count}"
                )
        return count


# ==============================================================================
    async def reset(self):
        """Clears all bans (memory and redis). Used for testing."""
        self._local_bans.clear()
        if self._redis:
            try:
                keys = await self._redis.keys(f"{self.BAN_KEY_PREFIX}*")
                vkeys = await self._redis.keys(f"{self.VIOLATION_KEY_PREFIX}*")
                all_keys = keys + vkeys
                if all_keys:
                    await self._redis.delete(*all_keys)
            except Exception:
                pass

# RATE LIMITER
# ==============================================================================

class RateLimiter:
    """
    Redis-backed sliding-window rate limiter with in-memory fallback.
    On a 429 event, it records a violation in the IPBanList — after
    BAN_THRESHOLD violations the IP is auto-banned.
    """
    def __init__(self, max_requests: int = 15, window_seconds: int = 60,
                 ban_list: Optional["IPBanList"] = None):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = {}
        self.ban_list = ban_list  # injected so violations escalate to bans
        try:
            self.redis_client = aioredis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=1.0
            )
        except Exception:
            self.redis_client = None

    def _get_client_ip(self, request: Request) -> str:
        # Nginx sets X-Real-IP directly from the remote client address
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def check(self, request: Request):
        now = time.time()
        client_ip = self._get_client_ip(request)
        key = f"rate_limit:{client_ip}:{request.url.path}"
        valid_window_start = now - self.window_seconds

        if self.redis_client:
            try:
                async with self.redis_client.pipeline(transaction=True) as pipe:
                    pipe.zremrangebyscore(key, "-inf", valid_window_start)
                    pipe.zcard(key)
                    pipe.zadd(key, {str(now): now})
                    pipe.expire(key, self.window_seconds)
                    results = await pipe.execute()
                    request_count = results[1]

                    if request_count >= self.max_requests:
                        oldest = await self.redis_client.zrange(key, 0, 0, withscores=True)
                        retry_after = self.window_seconds
                        if oldest:
                            oldest_time = oldest[0][1]
                            retry_after = int(self.window_seconds - (now - oldest_time))

                        # Escalate to ban tracker
                        if self.ban_list:
                            await self.ban_list.record_violation(client_ip)

                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many requests. Please try again later.",
                            headers={"Retry-After": str(max(1, retry_after))},
                        )
                    return
            except HTTPException:
                raise
            except Exception:
                pass  # Redis outage → fall through to in-memory

        # In-memory sliding-window fallback
        timestamps = self._requests.get(key, [])
        valid_timestamps = [t for t in timestamps if t > valid_window_start]
        if len(valid_timestamps) >= self.max_requests:
            oldest_time = valid_timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest_time))
            if self.ban_list:
                await self.ban_list.record_violation(client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )
        valid_timestamps.append(now)
        self._requests[key] = valid_timestamps

    async def reset(self):
        """Clears in-memory cache and all Redis rate limit keys."""
        self._requests.clear()
        if self.redis_client:
            try:
                keys = await self.redis_client.keys("rate_limit:*")
                if keys:
                    await self.redis_client.delete(*keys)
            except Exception:
                pass


# ==============================================================================
# Singletons
# ==============================================================================

# Shared ban list used by both rate limiters and the middleware
ip_ban_list = IPBanList()

# Auth: 15 req/min per IP — auto-bans after BAN_THRESHOLD violations
auth_rate_limiter = RateLimiter(max_requests=15, window_seconds=60, ban_list=ip_ban_list)

# Global: 100 req/min per IP across ALL /api/v1/ — Python-layer backstop
api_rate_limiter = RateLimiter(max_requests=100, window_seconds=60, ban_list=ip_ban_list)
