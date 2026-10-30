# ==============================================================================
# External Identity — proves who a storefront sign-in really is
# ==============================================================================
# Firebase is the primary customer identity provider and Supabase the fallback.
# The browser only ever hands us a signed token: the email comes from verifying
# that signature here, never from the request body. A provider with no
# configuration is unavailable rather than trusted.
# ==============================================================================

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Optional

import jwt
from jwt import PyJWKClient

from app.core.config import settings

FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
_ASYMMETRIC_SUPABASE_ALGORITHMS = ["RS256", "ES256"]
_JWKS_TIMEOUT_SECONDS = 5

_jwks_clients: dict[str, PyJWKClient] = {}


@dataclass(frozen=True)
class IdentityConfig:
    firebase_project_id: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = ""


def _config_from_environment() -> IdentityConfig:
    return IdentityConfig(settings.FIREBASE_PROJECT_ID, settings.SUPABASE_URL, settings.SUPABASE_JWT_SECRET)


class ExternalIdentityError(Exception):
    """The token could not be verified. The message is safe to log, not to return."""


@dataclass(frozen=True)
class VerifiedIdentity:
    provider: str
    email: str
    name: Optional[str] = None


def _signing_key(jwks_url: str, token: str):
    client = _jwks_clients.get(jwks_url)
    if client is None:
        client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=_JWKS_TIMEOUT_SECONDS)
        _jwks_clients[jwks_url] = client
    return client.get_signing_key_from_jwt(token).key


def _identity(provider: str, email: Optional[str], name: Optional[str]) -> VerifiedIdentity:
    if not email or "@" not in email:
        raise ExternalIdentityError(f"{provider} token has no email")
    return VerifiedIdentity(provider=provider, email=email.strip().lower(), name=name)


def _verify_firebase(token: str, config: IdentityConfig) -> VerifiedIdentity:
    project_id = config.firebase_project_id
    if not project_id:
        raise ExternalIdentityError("firebase is not configured")

    claims = jwt.decode(
        token,
        _signing_key(FIREBASE_JWKS_URL, token),
        algorithms=["RS256"],
        audience=project_id,
        issuer=f"https://securetoken.google.com/{project_id}",
        options={"require": ["exp", "iat", "sub"]},
    )
    if claims.get("email_verified") is not True:
        raise ExternalIdentityError("firebase email is not verified")
    return _identity("firebase", claims.get("email"), claims.get("name"))


def _verify_supabase(token: str, config: IdentityConfig) -> VerifiedIdentity:
    base_url = config.supabase_url.rstrip("/")
    if not base_url:
        raise ExternalIdentityError("supabase is not configured")

    # The algorithm is chosen from what is configured, then pinned, so a token can't
    # select HS256 and be checked against a public key.
    if jwt.get_unverified_header(token).get("alg") == "HS256":
        if not config.supabase_jwt_secret:
            raise ExternalIdentityError("supabase HS256 secret is not configured")
        key, algorithms = config.supabase_jwt_secret, ["HS256"]
    else:
        key = _signing_key(f"{base_url}/auth/v1/.well-known/jwks.json", token)
        algorithms = _ASYMMETRIC_SUPABASE_ALGORITHMS

    claims = jwt.decode(
        token,
        key,
        algorithms=algorithms,
        audience="authenticated",
        issuer=f"{base_url}/auth/v1",
        options={"require": ["exp", "sub"]},
    )
    metadata = claims.get("user_metadata") or {}
    if metadata.get("email_verified") is not True:
        raise ExternalIdentityError("supabase email is not verified")
    return _identity("supabase", claims.get("email"), metadata.get("full_name") or metadata.get("name"))


_VERIFIERS = {"firebase": _verify_firebase, "supabase": _verify_supabase}


async def verify_external_token(provider: str, token: str, config: Optional[IdentityConfig] = None) -> VerifiedIdentity:
    verifier = _VERIFIERS.get(provider)
    if verifier is None:
        raise ExternalIdentityError(f"unknown provider {provider}")
    try:
        # Fetching signing keys is blocking network I/O.
        return await asyncio.to_thread(verifier, token, config or _config_from_environment())
    except jwt.PyJWTError as exc:
        raise ExternalIdentityError(f"{provider} token rejected: {type(exc).__name__}") from exc
