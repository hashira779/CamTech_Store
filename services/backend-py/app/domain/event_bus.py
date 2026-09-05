import json
import os
from datetime import datetime, timezone
from typing import Dict, Any
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RealtimeEventBus:
    """
    2026–2030 Standard Real-Time Enterprise Event Bus (Spec §109, §110).
    Provides pub/sub broadcasting for Server-Sent Events (SSE) and WebSocket clients.
    Backed by Redis to support scaling across multiple microservice processes.
    """

    def __init__(self):
        self.redis_client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1.0)

    async def get_pubsub(self, org_id: str):
        """
        Creates and returns a Redis PubSub object subscribed to the tenant's channel.
        The caller is responsible for calling .unsubscribe() and .close() on it.
        """
        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe(f"mystore:events:{org_id}")
        return pubsub

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
        await self.redis_client.publish(channel_name, raw)

# Global singleton event bus
event_bus = RealtimeEventBus()
