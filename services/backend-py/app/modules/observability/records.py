# ==============================================================================
# Internal telemetry write records
# ==============================================================================
# Plain frozen dataclasses rather than Pydantic models: one of these is built
# for every single request the platform serves, so the write path must stay
# allocation-cheap and validation-free. Pydantic is used at the API boundary
# (schemas.py) where the cost is paid once per operator query, not once per
# request served.
#
# These records are what a storage adapter receives. Keeping them separate from
# both the ORM models and the API schemas is what lets the storage backend be
# replaced without touching the capture path (§32).
# ==============================================================================

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass(frozen=True, slots=True)
class ApiRequestRecord:
    """One observed HTTP request. All string fields are already redacted."""

    occurred_at: datetime.datetime
    request_id: str
    trace_id: str
    service: str
    method: str
    route: str
    path: str
    status_code: int
    duration_ms: float

    span_id: Optional[str] = None
    correlation_id: Optional[str] = None
    environment: str = "development"
    version: Optional[str] = None
    instance: Optional[str] = None
    query: Optional[str] = None
    request_bytes: Optional[int] = None
    response_bytes: Optional[int] = None
    error_code: Optional[str] = None

    actor_id: Optional[str] = None
    actor_type: Optional[str] = None
    organization_id: Optional[str] = None

    client_ip: Optional[str] = None
    user_agent: Optional[str] = None

    rate_limited: bool = False
    blocked: bool = False
    sample_weight: int = 1

    attributes: Optional[Dict[str, Any]] = None


@dataclass(frozen=True, slots=True)
class SpanRecord:
    """One unit of work inside a trace."""

    occurred_at: datetime.datetime
    trace_id: str
    span_id: str
    name: str
    service: str
    duration_ms: float

    parent_span_id: Optional[str] = None
    kind: str = "INTERNAL"
    environment: str = "development"
    is_error: bool = False
    status_message: Optional[str] = None
    organization_id: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


@dataclass(frozen=True, slots=True)
class LogEventRecord:
    """One structured log line."""

    occurred_at: datetime.datetime
    severity: str
    message: str
    service: str

    logger: Optional[str] = None
    environment: str = "development"
    version: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    request_id: Optional[str] = None
    actor_id: Optional[str] = None
    organization_id: Optional[str] = None
    error_code: Optional[str] = None
    fields: Optional[Dict[str, Any]] = None


@dataclass(slots=True)
class IngestionStats:
    """Counters the platform publishes about its own telemetry pipeline (§30).

    A monitoring system must not be able to fail silently, so drops, write
    errors and queue depth are first-class observable values rather than log
    lines nobody reads.
    """

    accepted: int = 0
    written: int = 0
    dropped_queue_full: int = 0
    write_errors: int = 0
    last_write_at: Optional[datetime.datetime] = None
    last_error: Optional[str] = None
    last_error_at: Optional[datetime.datetime] = None
    queue_depth: int = 0
    queue_capacity: int = 0
    running: bool = False

    def as_dict(self) -> Dict[str, Any]:
        return {
            "accepted": self.accepted,
            "written": self.written,
            "droppedQueueFull": self.dropped_queue_full,
            "writeErrors": self.write_errors,
            "lastWriteAt": self.last_write_at.isoformat() if self.last_write_at else None,
            "lastError": self.last_error,
            "lastErrorAt": self.last_error_at.isoformat() if self.last_error_at else None,
            "queueDepth": self.queue_depth,
            "queueCapacity": self.queue_capacity,
            "running": self.running,
            # Explicit health verdict so the control centre does not have to
            # re-derive the rule in the UI.
            "healthy": self.running and self.dropped_queue_full == 0 and self.write_errors == 0,
        }
