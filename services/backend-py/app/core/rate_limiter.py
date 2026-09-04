import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, HTTPException, status

class RateLimiter:
    """
    Sliding-window in-memory rate limiter with clean automatic expiration.
    Protects sensitive auth endpoints against brute-force attacks.
    """
    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_identifier(self, request: Request) -> str:
        # Prefer X-Forwarded-For if behind a reverse proxy (e.g., Nginx)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def check(self, request: Request):
        now = time.time()
        client_ip = self._get_client_identifier(request)
        key = f"{client_ip}:{request.url.path}"

        # Clean old timestamps outside the sliding window
        valid_window_start = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > valid_window_start]

        if len(self._requests[key]) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - self._requests[key][0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))}
            )

        self._requests[key].append(now)

auth_rate_limiter = RateLimiter(max_requests=15, window_seconds=60)
