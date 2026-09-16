# ==============================================================================
# Telemetry Ingestion Pipeline  (spec §30, §32, §39)
# ==============================================================================
# Buffers telemetry in-process and writes it in batches on a background task.
#
# Three non-negotiables, in priority order:
#
#   1. Never slow the request down. Capture is a non-blocking put onto a bounded
#      queue; the database write happens later, off the request's critical path.
#      An operator's dashboard is never worth adding latency to a customer's
#      checkout.
#
#   2. Never fail a request because telemetry failed. Every path here swallows
#      its own errors and records them as counters instead. This is the one
#      place where failing open is correct — the alternative is an outage in the
#      monitoring layer taking production down with it. (Authorization still
#      fails closed; that is a different axis, see §34.)
#
#   3. Never fail silently. A dropped record increments a counter that the
#      control centre reads and can alert on, so a saturated or broken pipeline
#      is visible rather than looking like a quiet period of traffic.
#
# The queue is per-process. With several workers each keeps its own buffer and
# writes to the same partitioned tables, which is fine because rows are
# independent and ordering is established by the timestamp, not arrival.
# ==============================================================================

from __future__ import annotations

import asyncio
import datetime
import os
from typing import List, Optional, Sequence, Union

from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.telemetry import get_logger

from .partitioning import ensure_partitions
from .records import ApiRequestRecord, IngestionStats, LogEventRecord, SpanRecord
from .repository import PostgresTelemetryRepository, TelemetrySink

logger = get_logger("mystore.observability.ingestion")

TelemetryRecord = Union[ApiRequestRecord, SpanRecord, LogEventRecord]


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


# Bounded so a telemetry backlog can never exhaust memory under load. At 10k
# records a burst of roughly ten seconds at 1000 rps is absorbed before drops
# begin, which is long enough to ride out a brief database stall.
QUEUE_CAPACITY = _env_int("OBS_QUEUE_CAPACITY", 10_000)

# Rows per INSERT. Large enough to amortise round-trips, small enough that one
# failed batch loses little and one statement stays quick.
BATCH_SIZE = _env_int("OBS_BATCH_SIZE", 200)

# Longest a record waits before being written even if the batch is not full, so
# a quiet system still shows near-live data.
FLUSH_INTERVAL_SECONDS = float(os.getenv("OBS_FLUSH_INTERVAL_SECONDS", "1.0"))

# Master switch. Off disables capture entirely with no other behaviour change.
def ingestion_enabled() -> bool:
    return os.getenv("OBS_INGESTION_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")


class TelemetryIngestor:
    """Owns the buffer, the background writer task, and the pipeline's stats."""

    def __init__(self, sink: TelemetrySink, *, capacity: int = QUEUE_CAPACITY):
        self._sink = sink
        self._queue: asyncio.Queue[TelemetryRecord] = asyncio.Queue(maxsize=capacity)
        self._worker: Optional[asyncio.Task[None]] = None
        self._stats = IngestionStats(queue_capacity=capacity)
        self._stopping = asyncio.Event()
        # Only warn about saturation occasionally; a full queue would otherwise
        # produce a log line per dropped record and become its own incident.
        self._last_drop_warning: Optional[datetime.datetime] = None

    # ── Capture (called from the request path) ────────────────────────────────

    def offer(self, record: TelemetryRecord) -> bool:
        """Enqueue without blocking. Returns False if the record was dropped.

        Deliberately synchronous and never awaits: the caller is mid-request.
        """
        try:
            self._queue.put_nowait(record)
        except asyncio.QueueFull:
            self._stats.dropped_queue_full += 1
            self._warn_saturated()
            return False
        except Exception as exc:  # noqa: BLE001 - capture must never raise
            self._stats.write_errors += 1
            self._stats.last_error = f"offer failed: {exc}"
            self._stats.last_error_at = datetime.datetime.utcnow()
            return False

        self._stats.accepted += 1
        return True

    def _warn_saturated(self) -> None:
        now = datetime.datetime.utcnow()
        if self._last_drop_warning and (now - self._last_drop_warning).total_seconds() < 30:
            return
        self._last_drop_warning = now
        logger.warning(
            "Telemetry queue saturated — dropping records (dropped=%s, capacity=%s). "
            "Dashboards will understate traffic until this clears.",
            self._stats.dropped_queue_full,
            self._stats.queue_capacity,
        )

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        if self._worker and not self._worker.done():
            return
        self._stopping.clear()
        self._worker = asyncio.create_task(self._run(), name="observability-ingestion")
        self._stats.running = True
        logger.info(
            "Telemetry ingestion started (capacity=%s, batch=%s, flush=%ss)",
            self._stats.queue_capacity,
            BATCH_SIZE,
            FLUSH_INTERVAL_SECONDS,
        )

    async def stop(self, *, drain_timeout: float = 5.0) -> None:
        """Signal shutdown and give the writer a bounded chance to flush.

        Bounded on purpose: a shutdown must not hang because the database is
        unreachable. Whatever cannot be flushed in time is lost, and the loss is
        reported rather than hidden.
        """
        self._stopping.set()
        if not self._worker:
            self._stats.running = False
            return
        try:
            await asyncio.wait_for(self._worker, timeout=drain_timeout)
        except asyncio.TimeoutError:
            remaining = self._queue.qsize()
            logger.warning(
                "Telemetry ingestion did not drain within %ss; %s record(s) discarded.",
                drain_timeout,
                remaining,
            )
            self._worker.cancel()
        except asyncio.CancelledError:  # pragma: no cover - shutdown race
            pass
        finally:
            self._stats.running = False
            logger.info(
                "Telemetry ingestion stopped (written=%s, dropped=%s, writeErrors=%s)",
                self._stats.written,
                self._stats.dropped_queue_full,
                self._stats.write_errors,
            )

    # ── Background writer ─────────────────────────────────────────────────────

    async def _run(self) -> None:
        while True:
            batch = await self._collect_batch()
            if batch:
                await self._flush(batch)
            if self._stopping.is_set() and self._queue.empty():
                return

    async def _collect_batch(self) -> List[TelemetryRecord]:
        """Gather up to BATCH_SIZE records, waiting at most FLUSH_INTERVAL."""
        batch: List[TelemetryRecord] = []
        deadline = asyncio.get_running_loop().time() + FLUSH_INTERVAL_SECONDS

        while len(batch) < BATCH_SIZE:
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                break
            try:
                record = await asyncio.wait_for(self._queue.get(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            except asyncio.CancelledError:
                raise
            batch.append(record)
            if self._stopping.is_set():
                # Drain hard during shutdown instead of waiting out the linger.
                while len(batch) < BATCH_SIZE and not self._queue.empty():
                    batch.append(self._queue.get_nowait())
                break

        self._stats.queue_depth = self._queue.qsize()
        return batch

    async def _flush(self, batch: Sequence[TelemetryRecord]) -> None:
        requests = [r for r in batch if isinstance(r, ApiRequestRecord)]
        spans = [r for r in batch if isinstance(r, SpanRecord)]
        logs = [r for r in batch if isinstance(r, LogEventRecord)]

        written = 0
        for records, write in (
            (requests, self._sink.write_api_requests),
            (spans, self._sink.write_spans),
            (logs, self._sink.write_log_events),
        ):
            if not records:
                continue
            try:
                written += await write(records)
            except Exception as exc:  # noqa: BLE001 - a bad batch must not kill the worker
                self._stats.write_errors += 1
                self._stats.last_error = str(exc)[:500]
                self._stats.last_error_at = datetime.datetime.utcnow()
                logger.error("Telemetry batch write failed (%s records): %s", len(records), exc)

        if written:
            self._stats.written += written
            self._stats.last_write_at = datetime.datetime.utcnow()

    # ── Self-monitoring (§30) ────────────────────────────────────────────────

    def stats(self) -> IngestionStats:
        self._stats.queue_depth = self._queue.qsize()
        self._stats.running = bool(self._worker and not self._worker.done())
        return self._stats


# ── Module-level singleton ────────────────────────────────────────────────────
# One ingestor per process. Held at module level so both the capture middleware
# and the health endpoint reach the same instance without threading it through
# every call site.

_ingestor: Optional[TelemetryIngestor] = None


def get_ingestor() -> Optional[TelemetryIngestor]:
    return _ingestor


async def start_ingestion(engine: AsyncEngine) -> Optional[TelemetryIngestor]:
    """Provision partitions and start the background writer.

    Returns None when ingestion is disabled, or when partition provisioning
    fails so badly that writes would be pointless — in that case the platform
    keeps serving traffic and reports the telemetry subsystem as unhealthy
    rather than pretending to record.
    """
    global _ingestor

    if not ingestion_enabled():
        logger.info("Telemetry ingestion disabled via OBS_INGESTION_ENABLED")
        return None

    if _ingestor is not None:
        return _ingestor

    try:
        await ensure_partitions(engine)
    except Exception as exc:  # noqa: BLE001
        # Partitioning is an optimisation; a DEFAULT partition or a plain table
        # still accepts writes. Log and continue rather than lose all telemetry.
        logger.error("Telemetry partition provisioning failed, continuing: %s", exc)

    sink = PostgresTelemetryRepository(engine)
    ingestor = TelemetryIngestor(sink)
    await ingestor.start()
    _ingestor = ingestor
    return ingestor


async def stop_ingestion() -> None:
    global _ingestor
    if _ingestor is None:
        return
    await _ingestor.stop()
    _ingestor = None
