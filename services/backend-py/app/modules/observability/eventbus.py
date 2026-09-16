# ==============================================================================
# Real-Time Event Bus  (Control Center spec §27)
# ==============================================================================
# Fan-out for live operator streams: a detector or capture hook publishes once,
# and every connected SSE client receives it immediately.
#
# Two layers, because one process is not the whole platform:
#
#   in-process broadcaster  every subscriber in THIS worker, with no network hop
#   Redis pub/sub           carries events BETWEEN workers and services
#
# With several workers behind the gateway, a detection running on worker A must
# reach an operator whose SSE connection is pinned to worker B. Redis is what
# makes that work; the in-process path is what makes it instant locally and what
# keeps the stream alive when Redis is down.
#
# Delivery is deliberately lossy per-subscriber: a slow or stalled browser gets
# events dropped rather than being allowed to apply back-pressure to a detector.
# An operator's laggy tab must never stall detection for everyone else.
# ==============================================================================

from __future__ import annotations

import asyncio
import contextlib
import datetime
import json
import os
from typing import Any, AsyncIterator, Dict, Optional, Set

import redis.asyncio as aioredis

from app.core.telemetry import get_logger

logger = get_logger("mystore.observability.eventbus")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = os.getenv("OBS_EVENT_CHANNEL", "camtech:control-center:events")

# Per-subscriber buffer. Small on purpose: an operator wants the newest state,
# not a replay of a minute they already missed.
SUBSCRIBER_BUFFER = 256

# Versioned envelope (§27 "use versioned event schemas") so the console can
# evolve without a flag day.
EVENT_SCHEMA_VERSION = 1

# Event types the console understands (§27).
EVENT_SECURITY = "SECURITY_EVENT"
EVENT_API_ERROR = "API_ERROR"
EVENT_SOURCE_BLOCKED = "SOURCE_BLOCKED"
EVENT_INCIDENT_CREATED = "INCIDENT_CREATED"
EVENT_METRIC_ALERT = "METRIC_ALERT"
EVENT_DETECTION_CYCLE = "DETECTION_CYCLE"


def envelope(event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "schemaVersion": EVENT_SCHEMA_VERSION,
        "event": event_type,
        "emittedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "data": payload,
    }


class EventBus:
    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue[Dict[str, Any]]] = set()
        self._redis: Optional[aioredis.Redis] = None
        self._relay: Optional[asyncio.Task[None]] = None
        self._published = 0
        self._dropped = 0
        self._redis_ok = False

    # ── Publish ──────────────────────────────────────────────────────────────

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Deliver to local subscribers now, and to other workers via Redis.

        Never raises: a detector must not fail because a stream is unavailable.
        """
        message = envelope(event_type, payload)
        self._fan_out_local(message)

        if self._redis is not None:
            try:
                await self._redis.publish(CHANNEL, json.dumps(message, default=str))
                self._redis_ok = True
            except Exception as exc:  # noqa: BLE001
                if self._redis_ok:
                    logger.warning("Event bus Redis publish failed, local-only: %s", exc)
                self._redis_ok = False

        self._published += 1

    def _fan_out_local(self, message: Dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # Drop the oldest so the subscriber keeps receiving current
                # state rather than being stuck replaying a backlog.
                with contextlib.suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(message)
                self._dropped += 1

    # ── Subscribe ────────────────────────────────────────────────────────────

    @contextlib.asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue]:
        queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=SUBSCRIBER_BUFFER)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    # ── Cross-worker relay ───────────────────────────────────────────────────

    async def start(self) -> None:
        """Attach to Redis and relay remote events to local subscribers."""
        if self._relay and not self._relay.done():
            return
        try:
            self._redis = aioredis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=1.0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Event bus running local-only (Redis unavailable): %s", exc)
            self._redis = None
            return
        self._relay = asyncio.create_task(self._relay_loop(), name="observability-eventbus-relay")

    async def _relay_loop(self) -> None:
        assert self._redis is not None
        backoff = 1.0
        while True:
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(CHANNEL)
                self._redis_ok = True
                backoff = 1.0
                logger.info("Event bus relay subscribed to %s", CHANNEL)
                async for raw in pubsub.listen():
                    if raw is None or raw.get("type") != "message":
                        continue
                    try:
                        message = json.loads(raw["data"])
                    except (TypeError, ValueError):
                        continue
                    # Local publishers already fanned out in-process; this path
                    # carries events that originated in another worker.
                    if message.get("_origin") != id(self):
                        self._fan_out_local(message)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                self._redis_ok = False
                logger.warning("Event bus relay lost (retrying in %ss): %s", backoff, exc)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)

    async def stop(self) -> None:
        if self._relay:
            self._relay.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._relay
            self._relay = None
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.close()
            self._redis = None

    # ── Self-monitoring (§30) ────────────────────────────────────────────────

    def stats(self) -> Dict[str, Any]:
        return {
            "subscribers": len(self._subscribers),
            "published": self._published,
            "droppedToSlowSubscribers": self._dropped,
            "redisConnected": self._redis_ok,
            # Local-only still means operators on THIS worker get events; it is
            # degraded, not down, and the distinction matters when triaging.
            "crossWorkerDelivery": self._redis_ok,
        }


event_bus = EventBus()
