# ==============================================================================
# HTTP Edge — the single definition of how an API app talks to its clients
# ==============================================================================
# The monolith and every microservice serve the same frontend, so the envelope,
# error shape, tracing and security headers must not differ between them. They
# used to be two copies, and the copies drifted: structured error details and
# gzip ordering were correct in one and broken in the other.
#
# What legitimately differs between deployment shapes is declared in EdgePolicy.
# ==============================================================================

from __future__ import annotations

import json
import logging
import secrets
import time
import uuid
from dataclasses import dataclass
from typing import Callable, Optional

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.telemetry import current_request_id, current_span_id, current_trace_id
from app.core.validation_errors import format_validation_errors, validation_error_details

CORS_ORIGIN_REGEX = (
    r"https?://([a-zA-Z0-9-]+\.)*"
    r"(localhost|127\.0\.0\.1|camtech\.cam|camtech\.local|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)"
    r"(:[0-9]+)?"
)

# Paths that must pass through untouched (docs, health/ops probes).
RAW_PATHS = frozenset({"/docs", "/redoc", "/openapi.json", "/health", "/ready", "/metrics"})

_ERROR_CODES = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 429: "RATE_LIMITED"}

_SCANNER_BAN_SECONDS = 60 * 60 * 24 * 365
_SCANNER_PATTERNS = (
    # Secrets & Environment Files
    ".env", ".aws/credentials", ".ssh/", "id_rsa", "id_ed25519", "authorized_keys",
    # Configuration & Settings
    "config.json", "config.php", "config.yml", "config.yaml", "database.yml",
    "settings.py", "settings.json", "web.config",
    # Backups & Database Dumps
    "backup.sql", "dump.sql", "backup.tar", "backup.zip", "data.sql", "db.sqlite", "storage.sqlite",
    # Path Traversal & System Files
    "/etc/passwd", "/etc/shadow", "/proc/self", "win.ini",
    "../", "..\\", "%2e%2e%2f", "%2e%2e/", "..%2f", "..%5c",
    # Source Control & Metadata
    "/.git", "/.svn", "/.hg", "/.bzr", "/.ds_store",
    # Admin Honeypots, CMS Scanners & Debug Endpoints
    "wp-login.php", "wp-admin", "wp-content", "phpinfo.php", "phpmyadmin", "pma", "adminer",
    "telescope", "actuator/heapdump", "actuator/env", "debug/vars", "server-status",
    # Shell & Remote Code Execution probes
    "/bin/sh", "/bin/bash", "cmd.exe", "powershell", "eval-stdin", "cgi-bin",
)

_BROWSER_POLICY_HEADERS = {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    "Content-Security-Policy": (
        "default-src 'self'; "
        # cdn.tailwindcss.com is intentionally absent: the server-rendered pages
        # now load compiled CSS from 'self' instead of the Tailwind Play CDN.
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://cloudflareinsights.com; "
        "frame-ancestors 'none';"
    ),
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    # Companion to COEP: require-corp makes browsers demand this on no-cors
    # subresources (favicons included). CORS-mode fetch/XHR is unaffected.
    "Cross-Origin-Resource-Policy": "same-site",
}


@dataclass(frozen=True)
class EdgePolicy:
    """What differs between the monolith edge and a service behind the gateway."""

    logger: logging.Logger
    # Only /api/v1 traffic is checked behind the gateway; the monolith checks everything.
    ban_check_api_only: bool = True
    scanner_guard: bool = False
    rate_limit: bool = False
    # CSP, COEP and friends. Only the monolith serves browser-facing HTML directly.
    browser_policy_headers: bool = False
    on_served: Optional[Callable[[Request, Response, float, str, str], None]] = None


def client_ip(request: Request, default: str = "unknown") -> str:
    return (
        request.headers.get("X-Real-IP")
        or (request.headers.get("X-Forwarded-For") or "").split(",")[0]
        or (request.client.host if request.client else default)
    ).strip()


def error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str,
    details: object = None,
    headers: Optional[dict] = None,
) -> JSONResponse:
    content = {"success": False, "code": code, "message": message, "requestId": request_id}
    if details is not None:
        content["details"] = details
    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={"X-Request-Id": request_id, **(headers or {})},
    )


def _http_error_response(exc: StarletteHTTPException, request_id: str) -> JSONResponse:
    # A handler may raise a structured detail (a dict) when the plain message is
    # not enough to act on — the Control Center's authorization denial reports
    # which roles the caller holds versus which are required. Keep the structure,
    # and keep `message` a string so existing clients that read it still work.
    is_structured = isinstance(exc.detail, dict)
    return error_response(
        exc.status_code,
        _ERROR_CODES.get(exc.status_code, "HTTP_ERROR"),
        str(exc.detail.get("message") or "Request failed") if is_structured else str(exc.detail),
        request_id,
        details=exc.detail if is_structured else None,
        headers=exc.headers,
    )


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", str(uuid.uuid4()))


def add_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def add_gzip(app: FastAPI) -> None:
    """Call AFTER install_edge: the envelope has to read uncompressed JSON, so gzip
    must sit outside it. Middleware added last runs outermost."""
    app.add_middleware(GZipMiddleware, minimum_size=1000)


def register_exception_handlers(app: FastAPI, logger: logging.Logger) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return _http_error_response(exc, _request_id(request))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "VALIDATION_ERROR",
            format_validation_errors(exc.errors()),
            _request_id(request),
            details=validation_error_details(exc.errors()),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error(f"Internal server error handling {request.method} {request.url.path}: {exc}", exc_info=True)
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            "An internal server error occurred. Please contact system support.",
            _request_id(request),
        )


def _bind_trace(request: Request, request_id: str) -> tuple[str, str]:
    """Continue the caller's W3C trace, or start one. Returns (trace_id, traceparent)."""
    incoming = request.headers.get("traceparent")
    trace_id = incoming.split("-")[1] if incoming and len(incoming.split("-")) == 4 else secrets.token_hex(16)
    span_id = secrets.token_hex(8)

    request.state.request_id = request_id
    request.state.trace_id = trace_id
    request.state.span_id = span_id
    current_trace_id.set(trace_id)
    current_span_id.set(span_id)
    current_request_id.set(request_id)
    return trace_id, f"00-{trace_id}-{span_id}-01"


async def _reject_blocked_client(request: Request, request_id: str, policy: EdgePolicy) -> Optional[Response]:
    from app.core.rate_limiter import api_rate_limiter, ip_ban_list

    path = request.url.path
    is_api = path.startswith("/api/v1/")
    ip = client_ip(request)

    if (is_api or not policy.ban_check_api_only) and await ip_ban_list.is_banned(ip):
        policy.logger.warning(f"[SECURITY] Blocked banned IP: {ip} -> {path}")
        return error_response(
            status.HTTP_403_FORBIDDEN,
            "IP_BANNED",
            "Your IP address has been blocked due to suspicious activity. Contact support if this is an error.",
            request_id,
        )

    if policy.scanner_guard:
        target = (path + ("?" + request.url.query if request.url.query else "")).lower()
        pattern = next((p for p in _SCANNER_PATTERNS if p in target), None)
        if pattern:
            await ip_ban_list.ban(ip, duration_seconds=_SCANNER_BAN_SECONDS, reason=f"malicious_scanning: {pattern}")
            policy.logger.error(f"[SECURITY] BANNED {ip} for malicious scanning of: {pattern} on {target}")
            return error_response(
                status.HTTP_403_FORBIDDEN,
                "SECURITY_VIOLATION",
                "Security violation detected. Your IP has been permanently banned.",
                request_id,
            )

    if policy.rate_limit and is_api:
        try:
            await api_rate_limiter.check(request)
        except HTTPException as exc:
            # This runs outside ExceptionMiddleware, so re-raising would surface
            # as a 500 instead of the 429 the limiter intends.
            return _http_error_response(exc, request_id)
        except Exception:
            # A limiter outage must not take the API down with it.
            pass

    return None


def _with_body(response: Response, content: bytes) -> Response:
    # Copies raw headers: a dict would keep only the last of several Set-Cookie.
    rebuilt = Response(content=content, status_code=response.status_code)
    rebuilt.raw_headers = [
        (name, value) for name, value in response.raw_headers if name.lower() != b"content-length"
    ] + [(b"content-length", str(len(content)).encode("latin-1"))]
    return rebuilt


async def _wrap_in_envelope(response: Response, request_id: str) -> Response:
    """Wrap a successful JSON response as { success, data, requestId }."""
    raw_body = b"".join([chunk async for chunk in response.body_iterator])
    try:
        parsed = json.loads(raw_body.decode("utf-8"))
    except ValueError:
        return _with_body(response, raw_body)

    if isinstance(parsed, dict) and "success" in parsed and "data" in parsed:
        return _with_body(response, raw_body)
    return _with_body(
        response,
        json.dumps({"success": True, "data": parsed, "requestId": request_id}).encode("utf-8"),
    )


def install_edge(app: FastAPI, policy: EdgePolicy) -> None:
    """Attach the error envelope, response wrapping, tracing and security headers."""
    register_exception_handlers(app, policy.logger)

    @app.middleware("http")
    async def response_envelope_middleware(request: Request, call_next):
        start_time = time.time()
        request_id = str(uuid.uuid4())
        trace_id, traceparent = _bind_trace(request, request_id)
        path = request.url.path

        if path not in RAW_PATHS:
            rejection = await _reject_blocked_client(request, request_id, policy)
            if rejection is not None:
                return rejection

        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Trace-Id"] = trace_id
        response.headers["traceparent"] = traceparent

        if path in RAW_PATHS:
            return response

        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        if policy.browser_policy_headers:
            response.headers.update(_BROWSER_POLICY_HEADERS)

        if path != "/favicon.ico":
            policy.logger.info(
                f"{request.method} {path} {response.status_code} ({process_time:.2f}ms)",
                extra={"durationMs": round(process_time, 2), "statusCode": response.status_code},
            )

        if policy.on_served:
            policy.on_served(request, response, process_time, request_id, trace_id)

        if response.status_code < 400 and "application/json" in response.headers.get("content-type", ""):
            return await _wrap_in_envelope(response, request_id)
        return response
