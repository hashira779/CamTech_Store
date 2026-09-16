# ==============================================================================
# WebAuthn challenge store
# ==============================================================================
# A WebAuthn challenge must be server-generated, single-use, and short-lived —
# if a challenge can be replayed, a captured assertion can be too. Redis is the
# primary store so challenges survive a worker restart and work across the
# microservice fleet; the in-memory fallback mirrors the pattern in
# app/core/rate_limiter.py so a Redis outage degrades instead of failing login.
#
# Note the fallback is per-process. With multiple workers behind the gateway a
# ceremony could start on one worker and finish on another, so Redis is what
# makes this correct in production, not an optimisation.
# ==============================================================================

import json
import os
import time
from typing import Any, Dict, Optional

import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Long enough for a user to find their device and complete a biometric prompt,
# short enough that a leaked challenge is near-useless.
CHALLENGE_TTL_SECONDS = 300

_KEY_PREFIX = "passkey:challenge:"


class PasskeyChallengeStore:
    def __init__(self) -> None:
        try:
            self._redis = aioredis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=1.0
            )
        except Exception:
            self._redis = None
        self._memory: Dict[str, tuple[float, str]] = {}

    def _prune(self) -> None:
        now = time.time()
        for key in [k for k, (expires, _) in self._memory.items() if expires <= now]:
            self._memory.pop(key, None)

    async def put(self, handle: str, payload: Dict[str, Any]) -> None:
        raw = json.dumps(payload)
        if self._redis:
            try:
                await self._redis.setex(f"{_KEY_PREFIX}{handle}", CHALLENGE_TTL_SECONDS, raw)
                return
            except Exception:
                pass
        self._prune()
        self._memory[handle] = (time.time() + CHALLENGE_TTL_SECONDS, raw)

    async def take(self, handle: str) -> Optional[Dict[str, Any]]:
        """Fetch and delete in one step. Consuming the challenge is what makes
        it single-use, so this never exposes a peek-without-delete path."""
        if self._redis:
            try:
                key = f"{_KEY_PREFIX}{handle}"
                pipe = self._redis.pipeline()
                pipe.get(key)
                pipe.delete(key)
                raw, _ = await pipe.execute()
                if raw:
                    return json.loads(raw)
            except Exception:
                pass

        self._prune()
        entry = self._memory.pop(handle, None)
        if not entry:
            return None
        expires, raw = entry
        if expires <= time.time():
            return None
        return json.loads(raw)


challenge_store = PasskeyChallengeStore()
