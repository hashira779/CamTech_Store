import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

def _get_redis_url() -> str:
    url = os.getenv("REDIS_URL")
    if url:
        return url
    if os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER"):
        return "redis://redis:6379/0"
    return "redis://localhost:6379/0"

REDIS_URL = _get_redis_url()

class RealtimeEventBus:
    """
    2026–2030 Standard Real-Time Enterprise Event Bus (Spec §109, §110).
    Provides pub/sub broadcasting for Server-Sent Events (SSE) and WebSocket clients.
    Backed by Redis to support scaling across multiple microservice processes.
    """

    def __init__(self):
        self._url = REDIS_URL
        try:
            self.redis_client = aioredis.from_url(self._url, decode_responses=True, socket_connect_timeout=1.5)
        except Exception as e:
            logger.warning(f"Failed to initialize Redis client with URL {self._url}: {e}")
            self.redis_client = None

    async def get_pubsub(self, org_id: str):
        """
        Creates and returns a Redis PubSub object subscribed to the tenant's channel.
        The caller is responsible for calling .unsubscribe() and .close() on it.
        Returns None if Redis is unreachable or subscription fails.
        """
        if not self.redis_client:
            try:
                self.redis_client = aioredis.from_url(self._url, decode_responses=True, socket_connect_timeout=1.5)
            except Exception:
                return None

        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(f"mystore:events:{org_id}")
            return pubsub
        except Exception as e:
            logger.warning(f"Redis PubSub subscription failed for org {org_id}: {e}")
            return None

    async def publish(self, org_id: str, event_type: str, data: Dict[str, Any]):
        """
        Broadcasts an event payload to all active client streams in the tenant via Redis.
        """
        payload = {
            "event": event_type,
            "data": data,
            "organizationId": org_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        raw = f"data: {json.dumps(payload)}\n\n"
        channel_name = f"mystore:events:{org_id}"
        if not self.redis_client:
            try:
                self.redis_client = aioredis.from_url(self._url, decode_responses=True, socket_connect_timeout=1.5)
            except Exception:
                return

        try:
            await self.redis_client.publish(channel_name, raw)
        except Exception as e:
            logger.warning(f"Failed to publish event {event_type} to Redis: {e}")

# Global singleton event bus
event_bus = RealtimeEventBus()
