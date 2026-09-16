# ==============================================================================
# Observability Query Service  (spec §28 tenancy, §34 fail closed)
# ==============================================================================
# Thin layer over the storage adapter. Its job is the things that must not be
# decided in the API handler or the SQL: which tenant's data the caller may see,
# and whether a window is answerable at all.
# ==============================================================================

from __future__ import annotations

import datetime
from typing import Any, Dict, Optional, Tuple

from app.core.dependencies import TenantUser

from .repository import PostgresTelemetryRepository

# Only this role reads across tenant boundaries. §28 requires platform-level
# access to be explicit, so the list is deliberately one entry long rather than
# "any admin" — an ORG_ADMIN administers one organization, not the platform.
PLATFORM_SCOPE_ROLES: frozenset[str] = frozenset({"SUPER_ADMIN"})

SCOPE_PLATFORM = "PLATFORM"
SCOPE_ORGANIZATION = "ORGANIZATION"


def resolve_scope(user: TenantUser) -> Tuple[Optional[str], str]:
    """Return (organization_id_filter, scope_label) for this caller.

    A None filter means "all tenants" and is returned only for platform roles.
    Everyone else is pinned to their own organization, so a missing or empty
    organization on the token yields a filter that matches nothing rather than
    one that matches everything — the failure direction matters here (§34).
    """
    roles = {str(role).upper() for role in (user.roles or [])}
    if roles & PLATFORM_SCOPE_ROLES:
        return None, SCOPE_PLATFORM

    organization_id = getattr(user, "organization_id", None)
    if not organization_id:
        # Fail closed: an unscoped non-platform caller sees nothing.
        return "__no_organization__", SCOPE_ORGANIZATION
    return organization_id, SCOPE_ORGANIZATION


class ObservabilityQueryService:
    def __init__(self, repository: PostgresTelemetryRepository):
        self._repository = repository

    async def traffic_summary(
        self,
        *,
        since: datetime.datetime,
        until: datetime.datetime,
        organization_id: Optional[str],
        service: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._repository.traffic_summary(
            since=since, until=until, organization_id=organization_id, service=service
        )
