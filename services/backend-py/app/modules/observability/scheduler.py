# ==============================================================================
# Detection Scheduler  (spec §25, §30)
# ==============================================================================
# Runs the detection engine on an interval so the Threat Center reflects live
# activity rather than only what someone happened to query.
#
# Deliberately conservative: the loop detects and records. It applies no
# blocks, no rate-limit changes and no account actions. Every high-impact
# defensive response stays operator-initiated, confirmed and audited (§21),
# because an automated blocker driven by a heuristic is one false positive away
# from locking out a legitimate integration — or the operators themselves.
# ==============================================================================

from __future__ import annotations

import asyncio
import contextlib
import datetime
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.telemetry import get_logger

from .detection import INTERVAL_SECONDS, DetectionEngine

logger = get_logger("mystore.observability.scheduler")


class DetectionScheduler:
    def __init__(self, engine: AsyncEngine, *, interval_seconds: int = INTERVAL_SECONDS):
        self._engine = engine
        self._interval = max(interval_seconds, 10)
        self._task: Optional[asyncio.Task[None]] = None
        self._cycles = 0
        self._events_raised = 0
        self._failures = 0
        self._last_run: Optional[datetime.datetime] = None
        self._last_error: Optional[str] = None

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name="observability-detection")
        logger.info("Detection scheduler started (every %ss)", self._interval)

    async def stop(self) -> None:
        if not self._task:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await self._task
        self._task = None
        logger.info(
            "Detection scheduler stopped (cycles=%s, events=%s, failures=%s)",
            self._cycles,
            self._events_raised,
            self._failures,
        )

    async def _run(self) -> None:
        engine = DetectionEngine(self._engine)
        # Let ingestion accumulate a first window before the first evaluation,
        # so a fresh deploy does not immediately alert on an empty baseline.
        await asyncio.sleep(min(self._interval, 30))
        while True:
            try:
                findings = await engine.evaluate()
                self._cycles += 1
                self._events_raised += len(findings)
                self._last_run = datetime.datetime.utcnow()
                self._last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - the loop must survive
                self._failures += 1
                self._last_error = str(exc)[:500]
                logger.error("Detection cycle failed: %s", exc)
            await asyncio.sleep(self._interval)

    def stats(self) -> Dict[str, Any]:
        running = bool(self._task and not self._task.done())
        return {
            "running": running,
            "intervalSeconds": self._interval,
            "cycles": self._cycles,
            "eventsRaised": self._events_raised,
            "failures": self._failures,
            "lastRunAt": self._last_run.isoformat() if self._last_run else None,
            "lastError": self._last_error,
            # Surfaced so the console can warn that the Threat Center is stale
            # rather than presenting "no threats" as a reassuring result.
            "healthy": running and self._failures == 0,
        }


_scheduler: Optional[DetectionScheduler] = None


def get_scheduler() -> Optional[DetectionScheduler]:
    return _scheduler


async def start_detection(engine: AsyncEngine) -> DetectionScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = DetectionScheduler(engine)
        await _scheduler.start()
    return _scheduler


async def stop_detection() -> None:
    global _scheduler
    if _scheduler is None:
        return
    await _scheduler.stop()
    _scheduler = None
