import time
import os
from typing import Dict, List
from fastapi import Request, HTTPException, status
import redis
import redis.asyncio as aioredis
from redis.exceptions import RedisError

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RateLimiter:
    """
    Redis-backed sliding-window rate limiter with in-memory fallback.
    Protects sensitive auth endpoints against brute-force attacks across microservices.
    """
    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = {}
        try:
            self.redis_client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1.0)
        except Exception:
            self.redis_client = None

    def _get_client_identifier(self, request: Request) -> str:
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
        client_ip = self._get_client_identifier(request)
        key = f"rate_limit:{client_ip}:{request.url.path}"
        valid_window_start = now - self.window_seconds

        if self.redis_client:
            try:
                async with self.redis_client.pipeline(transaction=True) as pipe:
                    # Remove timestamps older than the sliding window
                    pipe.zremrangebyscore(key, "-inf", valid_window_start)
                    # Count the number of valid requests in the window
                    pipe.zcard(key)
                    # Add the current request
                    pipe.zadd(key, {str(now): now})
                    # Set an expiration on the key to prevent memory leaks
                    pipe.expire(key, self.window_seconds)
                    
                    results = await pipe.execute()
                    request_count = results[1]
                    
                    if request_count >= self.max_requests:
                        # Get the oldest timestamp to calculate Retry-After
                        oldest = await self.redis_client.zrange(key, 0, 0, withscores=True)
                        retry_after = self.window_seconds
                        if oldest:
                            oldest_time = oldest[0][1]
                            retry_after = int(self.window_seconds - (now - oldest_time))
                            
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many requests. Please try again later.",
                            headers={"Retry-After": str(max(1, retry_after))}
                        )
                    return
            except HTTPException:
                raise
            except Exception:
                # Redis outage or connection error: fall back to in-memory limiter
                pass

        # In-memory sliding window fallback (for local development or Redis outages)
        timestamps = self._requests.get(key, [])
        valid_timestamps = [t for t in timestamps if t > valid_window_start]
        if len(valid_timestamps) >= self.max_requests:
            oldest_time = valid_timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest_time))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))}
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

auth_rate_limiter = RateLimiter(max_requests=15, window_seconds=60)
