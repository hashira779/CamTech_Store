"""
ICP Agent Authentication Middleware — validates API key on every request.
"""
import secrets
import logging
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from icp_agent.config import AgentConfig

logger = logging.getLogger("icp.agent.auth")

# Paths that bypass authentication (health probes, metrics for local Prometheus)
PUBLIC_PATHS = {"/health", "/ready"}


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Validates the X-ICP-Agent-Key header against the configured API key."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow health checks without auth
        if path in PUBLIC_PATHS:
            return await call_next(request)

        # Validate API key
        provided_key = request.headers.get("X-ICP-Agent-Key", "")
        expected_key = AgentConfig.API_KEY

        if not expected_key:
            logger.error("ICP_API_KEY is not configured — rejecting all requests")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agent API key not configured. Set ICP_API_KEY in config.",
            )

        # Use constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(provided_key, expected_key):
            client_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "[SECURITY] Invalid API key from %s for %s %s",
                client_ip, request.method, path,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing agent API key.",
            )

        return await call_next(request)
