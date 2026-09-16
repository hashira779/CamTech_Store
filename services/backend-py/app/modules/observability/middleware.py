# ==============================================================================
# Request Capture Middleware  (spec §12, §13, §39)
# ==============================================================================
# Turns each served request into one ApiRequestRecord and hands it to the
# ingestion buffer. This is the component that replaces invented dashboard
# numbers with observed ones.
#
# It reuses the correlation identifiers the existing middleware already mints
# (request.state.trace_id / span_id / request_id, plus the W3C traceparent
# header), so a request recorded here is joinable to the logs that request
# emitted without changing how logging works.
#
# The middleware is wrapped so that no failure inside it can affect the
# response: capture is best-effort by design (see ingestion.py's rationale).
# ==============================================================================

from __future__ import annotations

import datetime
import os
import re
from typing import Optional, Set

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.telemetry import get_logger

from .classification import redact_path, redact_query_string, scrub_value
from .ingestion import get_ingestor
from .records import ApiRequestRecord

logger = get_logger("mystore.observability.capture")

SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "mystore-backend")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", os.getenv("APP_VERSION", "2.0.0"))
# Distinguishes replicas of the same service in the inspector's instance count.
INSTANCE_ID = os.getenv("HOSTNAME") or os.getenv("INSTANCE_ID") or f"pid-{os.getpid()}"

# Paths excluded from capture. These are liveness probes and static assets that
# would otherwise dominate the request table without telling an operator
# anything — a Kubernetes probe hitting /health every second is not traffic.
DEFAULT_EXCLUDED_PREFIXES: tuple[str, ...] = (
    "/health",
    "/ready",
    "/favicon.ico",
    "/static/",
)

# Recording the live-tail endpoint would make the request stream describe itself:
# each poll creates a row, which the next poll reports, forever.
SELF_OBSERVATION_PREFIXES: tuple[str, ...] = (
    "/api/v1/observability/stream",
    "/api/v1/observability/health",
)

# Whether to resolve the authenticated actor. Uses the same verifying decoder
# the auth layer uses, so the identity is proven rather than taken from an
# unverified claim. Disable to save one signature verification per request.
def _capture_actor_enabled() -> bool:
    return os.getenv("OBS_CAPTURE_ACTOR", "true").strip().lower() not in ("0", "false", "no", "off")


# Segments that should collapse into a parameter so that /products/abc and
# /products/def aggregate as one endpoint rather than two. Applied only when the
# router did not give us a template.
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_NUMERIC_RE = re.compile(r"^\d+$")
# Opaque identifier: long, unbroken, and containing a digit. The digit and the
# absence of separators matter — an earlier version matched any long
# [A-Za-z0-9_-] run, which collapsed ordinary slugs like
# "definitely-not-a-route" or "product-categories" into "{token}" and merged
# unrelated endpoints in the top-N lists.
_LONG_OPAQUE_RE = re.compile(r"^(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{20,}$")


def template_route(request: Request) -> str:
    """The aggregation key for an endpoint.

    Prefers the matched router path ("/api/v1/products/{product_id}"), which is
    exact. Falls back to collapsing identifier-shaped segments, because without
    templating every id becomes its own endpoint and the top-endpoint lists in
    §12 turn into noise.
    """
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    if template:
        return str(template)

    path = request.url.path or "/"
    segments = []
    for segment in path.split("/"):
        if not segment:
            continue
        if _UUID_RE.match(segment):
            segments.append("{uuid}")
        elif _NUMERIC_RE.match(segment):
            segments.append("{id}")
        elif _LONG_OPAQUE_RE.match(segment):
            segments.append("{token}")
        else:
            segments.append(segment)
    return "/" + "/".join(segments) if segments else "/"


def _client_ip(request: Request) -> Optional[str]:
    """Caller address, trusting the proxy headers nginx sets.

    Order matters: X-Real-IP is set by our own nginx and is authoritative here,
    whereas X-Forwarded-For is a client-supplied list that can be prepended to.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:64]
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def _resolve_actor(request: Request) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """(actor_id, actor_type, organization_id), or Nones.

    Only identity already established by CamTech's own authenticated systems is
    recorded (§2, §18). Nothing is inferred from the network address.
    """
    # Preferred: a dependency already resolved the caller and stashed it.
    stashed = getattr(request.state, "observability_actor", None)
    if stashed:
        return stashed

    if not _capture_actor_enabled():
        return (None, None, None)

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return (None, None, None)

    try:
        from app.core.security import decode_access_token

        payload = decode_access_token(header[7:].strip())
        if not payload:
            return (None, None, None)
        subject = payload.get("sub")
        token_type = payload.get("type")
        actor_type = "DRIVER" if token_type == "delivery" else "USER"
        return (
            str(subject) if subject else None,
            actor_type,
            payload.get("orgId") or payload.get("organization_id"),
        )
    except Exception:  # noqa: BLE001 - never let attribution break capture
        return (None, None, None)


def record_actor(request: Request, *, actor_id: str, actor_type: str, organization_id: Optional[str]) -> None:
    """Let an auth dependency publish the caller it already resolved.

    Calling this from `get_current_user` removes the duplicate token
    verification in `_resolve_actor`. Kept optional so the observability module
    does not have to reach into the auth layer to function.
    """
    request.state.observability_actor = (actor_id, actor_type, organization_id)


class ObservabilityCaptureMiddleware(BaseHTTPMiddleware):
    """Records one row per served request. Never alters the response."""

    def __init__(
        self,
        app,
        *,
        excluded_prefixes: tuple[str, ...] = DEFAULT_EXCLUDED_PREFIXES,
        service_name: str = SERVICE_NAME,
    ):
        super().__init__(app)
        self._excluded: tuple[str, ...] = tuple(excluded_prefixes) + SELF_OBSERVATION_PREFIXES
        self._service_name = service_name
        self._warned_no_ingestor = False

    def _should_skip(self, path: str) -> bool:
        return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in self._excluded)

    async def dispatch(self, request: Request, call_next):
        if self._should_skip(request.url.path):
            return await call_next(request)

        started = datetime.datetime.utcnow()
        monotonic = __import__("time").perf_counter()

        response: Response = await call_next(request)

        # Everything below is best-effort; the response is already decided.
        try:
            duration_ms = (__import__("time").perf_counter() - monotonic) * 1000.0
            self._capture(request, response, started, duration_ms)
        except Exception as exc:  # noqa: BLE001
            if not self._warned_no_ingestor:
                logger.error("Telemetry capture failed: %s", exc)
                self._warned_no_ingestor = True

        return response

    def _capture(
        self,
        request: Request,
        response: Response,
        started: datetime.datetime,
        duration_ms: float,
    ) -> None:
        ingestor = get_ingestor()
        if ingestor is None:
            return

        state = request.state
        actor_id, actor_type, organization_id = _resolve_actor(request)

        status_code = response.status_code
        # 429 is the rate limiter's own verdict, so it is an observed fact.
        # `blocked` is only ever set from an explicit upstream flag — inferring
        # it from 403 would conflate an ordinary authorization denial with a
        # defensive block and corrupt the security views (§17).
        rate_limited = status_code == 429 or bool(getattr(state, "rate_limited", False))
        blocked = bool(getattr(state, "security_blocked", False))

        record = ApiRequestRecord(
            occurred_at=started,
            request_id=str(getattr(state, "request_id", "") or "") or "unknown",
            trace_id=str(getattr(state, "trace_id", "") or "") or "unknown",
            span_id=str(getattr(state, "span_id", "") or "") or None,
            correlation_id=request.headers.get("x-correlation-id"),
            service=self._service_name,
            environment=ENVIRONMENT,
            version=SERVICE_VERSION,
            instance=INSTANCE_ID,
            method=request.method,
            route=template_route(request),
            path=redact_path(request.url.path),
            query=redact_query_string(request.url.query) or None,
            status_code=status_code,
            duration_ms=round(duration_ms, 3),
            request_bytes=_int_or_none(request.headers.get("content-length")),
            response_bytes=_int_or_none(response.headers.get("content-length")),
            error_code=_error_code(response),
            actor_id=actor_id,
            actor_type=actor_type or ("ANON" if actor_id is None else None),
            organization_id=organization_id,
            client_ip=_client_ip(request),
            user_agent=scrub_value(request.headers.get("user-agent", ""))[:512] or None,
            rate_limited=rate_limited,
            blocked=blocked,
        )
        ingestor.offer(record)


def _int_or_none(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _error_code(response: Response) -> Optional[str]:
    """Machine-readable error code, if the handler published one.

    The platform's error envelope carries a `code` field, but reading the body
    here would require buffering every response. Handlers that want the code
    recorded set the X-Error-Code header instead.
    """
    code = response.headers.get("x-error-code")
    return scrub_value(code)[:64] if code else None
