# ==============================================================================
# Telemetry Data Classification & Redaction  (Control Center spec §29)
# ==============================================================================
# Every field that enters observability storage passes through here first.
#
# The rule this module exists to enforce: telemetry is the one subsystem that
# sees *every* request, so it is also the easiest place to accidentally build a
# permanent, searchable archive of credentials. Secrets are therefore dropped
# before the write path, not masked at read time — nothing unredacted is ever
# persisted, so no future reader, export, or backup can leak it.
#
# Classification levels, lowest to highest sensitivity:
#   PUBLIC        safe for any authenticated operator (method, status, duration)
#   INTERNAL      operational detail (service, route, version, trace ids)
#   CONFIDENTIAL  tenant-scoped (organization id, actor id)
#   SENSITIVE     personal data (client IP, user agent) — retained, restricted
#   SECRET        never stored at any retention, under any permission
# ==============================================================================

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Dict, Iterable, Mapping, Optional


class Classification(str, Enum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    SENSITIVE = "SENSITIVE"
    SECRET = "SECRET"


REDACTED = "[REDACTED]"

# Header names that must never be persisted. Compared case-insensitively.
SECRET_HEADERS: frozenset[str] = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "x-api-secret",
        "x-auth-token",
        "x-access-token",
        "x-refresh-token",
        "x-csrf-token",
        "x-xsrf-token",
        "x-telegram-bot-api-secret-token",
        "x-hub-signature",
        "x-hub-signature-256",
        "x-webhook-signature",
    }
)

# Substrings that mark a key as secret wherever it appears (headers, query
# params, body keys). Deliberately broad: a false positive costs one redacted
# debugging field, a false negative persists a credential.
SECRET_KEY_PATTERNS: tuple[str, ...] = (
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "api_key",
    "privatekey",
    "private_key",
    "credential",
    "authorization",
    "session",
    "cookie",
    "otp",
    "mfa",
    "totp",
    "cvv",
    "cvc",
    "cardnumber",
    "card_number",
    "pan",
    "iban",
    "ssn",
    "passkey",
    "attestation",
    "assertion",
    "signature",
    "clientsecret",
    "client_secret",
)

# Query parameters carrying credentials in the URL. The docs-protection flow and
# the SSE endpoints both accept ?token=, so these genuinely occur in real paths.
SECRET_QUERY_PARAMS: frozenset[str] = frozenset(
    {"token", "access_token", "refresh_token", "api_key", "apikey", "key", "secret", "password", "code"}
)

# Value-shaped detection, for credentials that appear in a field we did not
# anticipate by name. Ordered cheapest-first; all are anchored or bounded to
# keep them safe against pathological input.
_VALUE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # JWT: three base64url segments. Covers access and refresh tokens.
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    # Bearer / Basic credentials embedded in free text.
    ("http-auth", re.compile(r"\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}", re.IGNORECASE)),
    # This platform's own API keys (see ApiKeyGenerator: sk_live_… / sk_test_…).
    ("mystore-api-key", re.compile(r"\bsk_(?:live|test)_[A-Za-z0-9]{6,}\b")),
    # bcrypt hashes — not reversible, but still credential material.
    ("bcrypt", re.compile(r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}")),
    # PEM private keys.
    ("pem", re.compile(r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----")),
)

# Longest value we keep for any free-text telemetry field. Bounds both storage
# growth and the blast radius of something unexpected being logged.
MAX_VALUE_LENGTH = 2048


def classify_key(key: str) -> Classification:
    """Classify a telemetry field by name."""
    lowered = key.strip().lower()
    normalized = lowered.replace("-", "").replace("_", "")

    if lowered in SECRET_HEADERS:
        return Classification.SECRET
    if any(pattern.replace("_", "") in normalized for pattern in SECRET_KEY_PATTERNS):
        return Classification.SECRET

    if normalized in ("clientip", "ip", "sourceip", "remoteaddr", "useragent", "email", "phone"):
        return Classification.SENSITIVE
    if normalized in ("actorid", "userid", "organizationid", "tenantid", "sessionid", "driverid"):
        return Classification.CONFIDENTIAL
    if normalized in ("service", "route", "version", "environment", "traceid", "spanid", "requestid", "correlationid"):
        return Classification.INTERNAL
    return Classification.PUBLIC


def scrub_value(value: Any) -> Any:
    """Redact credential-shaped content from a value, whatever its field name.

    Applies to strings only; other scalars are returned unchanged. Long strings
    are truncated after scrubbing so a truncation can never cut a pattern in
    half and smuggle the tail through.
    """
    if not isinstance(value, str):
        return value

    scrubbed = value
    for _label, pattern in _VALUE_PATTERNS:
        scrubbed = pattern.sub(REDACTED, scrubbed)

    if len(scrubbed) > MAX_VALUE_LENGTH:
        scrubbed = scrubbed[:MAX_VALUE_LENGTH] + "…[truncated]"
    return scrubbed


def redact_mapping(
    data: Optional[Mapping[str, Any]],
    *,
    max_depth: int = 4,
) -> Dict[str, Any]:
    """Redact a header/param/body mapping for storage.

    Secret-named keys are replaced with a marker rather than dropped, so an
    investigator can still see that the field was present — which matters when
    reconstructing what a caller actually sent — without the value existing.
    """
    if not data:
        return {}

    def _walk(node: Any, depth: int) -> Any:
        if depth <= 0:
            return "[depth-limited]"
        if isinstance(node, Mapping):
            out: Dict[str, Any] = {}
            for raw_key, raw_value in node.items():
                key = str(raw_key)
                if classify_key(key) is Classification.SECRET:
                    out[key] = REDACTED
                else:
                    out[key] = _walk(raw_value, depth - 1)
            return out
        if isinstance(node, (list, tuple)):
            # Bound fan-out; telemetry does not need the 500th array element.
            return [_walk(item, depth - 1) for item in list(node)[:20]]
        return scrub_value(node)

    walked = _walk(data, max_depth)
    return walked if isinstance(walked, dict) else {}


def redact_query_string(query: str) -> str:
    """Strip credential values from a raw query string, keeping the shape.

    `?token=eyJhbGciOi…&page=2` becomes `?token=[REDACTED]&page=2`, so the
    operator can see the endpoint was called with a token without the token
    being recoverable.
    """
    if not query:
        return ""

    parts = []
    for segment in query.split("&"):
        if not segment:
            continue
        name, sep, value = segment.partition("=")
        if not sep:
            parts.append(scrub_value(name))
            continue
        if name.strip().lower() in SECRET_QUERY_PARAMS or classify_key(name) is Classification.SECRET:
            parts.append(f"{name}={REDACTED}")
        else:
            parts.append(f"{name}={scrub_value(value)}")
    return "&".join(parts)


def redact_path(path: str) -> str:
    """Scrub a URL path. Paths should not carry secrets, but §29 assumes they
    might, and a token pasted into a path segment would otherwise be stored."""
    return scrub_value(path or "")


def redact_headers(headers: Optional[Iterable[tuple[str, str]]]) -> Dict[str, str]:
    """Redact an ASGI-style header iterable down to a storable mapping."""
    if not headers:
        return {}
    return {
        key: (REDACTED if classify_key(key) is Classification.SECRET else scrub_value(value))
        for key, value in headers
    }


def contains_secret(value: str) -> bool:
    """True when a value still looks credential-shaped. Used by the tests as an
    independent check on the redaction path, and available as a last-line guard
    before a write."""
    if not isinstance(value, str):
        return False
    return any(pattern.search(value) for _label, pattern in _VALUE_PATTERNS)
