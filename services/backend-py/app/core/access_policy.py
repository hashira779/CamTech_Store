# ==============================================================================
# Access Policy — which staff roles may use which API areas
# ==============================================================================
# Enforced inside get_current_user, so it covers every authenticated route in both
# deployment shapes, while public routes and inbound webhooks (which never call
# get_current_user) cannot be locked out by it. Tenant scoping is separate: this
# decides what a role may do, not whose data it sees.
#
# ACCESS_POLICY_MODE=report logs would-be denials instead of refusing them, as a
# rollback while checking a role that was missed here. Anything else enforces.
# ==============================================================================

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable, Optional

from fastapi import HTTPException, Request, status

from app.core.permissions import has_any_permission
from app.core.telemetry import get_logger

logger = get_logger("mystore.access_policy")

ADMIN = frozenset({"SUPER_ADMIN", "ORG_ADMIN", "COMPANY_ADMIN", "PLATFORM_ADMIN"})
MANAGER = frozenset({"MANAGER", "STORE_MANAGER", "BRANCH_MANAGER"})
FINANCE = frozenset({"ACCOUNTANT", "FINANCE"})
HR = frozenset({"HR_MANAGER", "HR_STAFF"})
STOCK = frozenset({"WAREHOUSE", "WAREHOUSE_MANAGER", "WAREHOUSE_STAFF", "STOCK_CLERK"})

_READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


@dataclass(frozen=True)
class AccessRule:
    prefix: str
    write_roles: frozenset[str]
    # None leaves reads open to any authenticated user in the tenant.
    read_roles: Optional[frozenset[str]] = None
    # A custom role passes by holding one of these instead of a listed role name.
    write_permissions: tuple[str, ...] = ()


_FINANCE_READERS = ADMIN | FINANCE | MANAGER

ACCESS_RULES: tuple[AccessRule, ...] = (
    AccessRule("finance", ADMIN | FINANCE, _FINANCE_READERS, ("finance:write",)),
    AccessRule("assets", ADMIN | FINANCE, _FINANCE_READERS, ("finance:write",)),
    AccessRule("hr", ADMIN | HR, ADMIN | HR | MANAGER, ("hr:write",)),
    AccessRule("products", ADMIN | MANAGER | STOCK, write_permissions=("catalog:write",)),
    AccessRule("categories", ADMIN | MANAGER | STOCK, write_permissions=("catalog:write",)),
    AccessRule("pricing", ADMIN | MANAGER, write_permissions=("pricing:write",)),
    AccessRule("taxes", ADMIN | MANAGER, write_permissions=("pricing:write",)),
    AccessRule("promotions", ADMIN | MANAGER, write_permissions=("pricing:write",)),
    AccessRule("inventory", ADMIN | MANAGER | STOCK, write_permissions=("inventory:write",)),
    AccessRule("wms", ADMIN | MANAGER | STOCK, write_permissions=("inventory:write",)),
    AccessRule("locations", ADMIN | MANAGER),
    AccessRule("notifications/send", ADMIN | MANAGER),
    AccessRule("storage/providers", ADMIN),
    AccessRule("storage/policies", ADMIN),
    AccessRule("industry/setup", ADMIN),
    AccessRule("events/broadcast", ADMIN),
    AccessRule("outbox", ADMIN),
    AccessRule("exchange", ADMIN),
    AccessRule("apps", ADMIN),
    AccessRule("flows", ADMIN),
    AccessRule("bot-builder", ADMIN),
    AccessRule("telegram", ADMIN),
)

# Anyone with a Google account can become a CUSTOMER, so that role is allow-listed:
# a new staff endpoint is closed to customers unless it is added here.
_CUSTOMER_ONLY_ROLES = frozenset({"CUSTOMER"})
_CUSTOMER_AREAS = (
    "auth/me",
    "customers/sync",
    "customers/public-sync",
    "customers/profile",
    "customers/cart",
    "sales/customer-orders",
    "sales/store-checkout",
    "sales/public-checkout",
    "sales/payment-methods",
    "sales/orders",
    "delivery/track",
    "public",
)

# Any employee may file their own leave request; approving one stays with HR.
_SELF_SERVICE = frozenset({("POST", "hr/leaves")})


def _find_rule(area: str) -> Optional[AccessRule]:
    for rule in ACCESS_RULES:
        if area == rule.prefix or area.startswith(f"{rule.prefix}/"):
            return rule
    return None


def is_allowed(method: str, path: str, roles: Iterable[str], permissions: Iterable[str]) -> bool:
    area = path.removeprefix("/api/v1/").rstrip("/")
    held = set(roles)
    if held and held <= _CUSTOMER_ONLY_ROLES:
        return any(area == allowed or area.startswith(f"{allowed}/") for allowed in _CUSTOMER_AREAS)

    rule = _find_rule(area)
    if rule is None or (method, area) in _SELF_SERVICE:
        return True

    if method in _READ_METHODS:
        return rule.read_roles is None or bool(held & rule.read_roles)
    return bool(held & rule.write_roles) or has_any_permission(list(permissions), list(rule.write_permissions))


def enforce_access(request: Request, user) -> None:
    if is_allowed(request.method, request.url.path, user.roles, user.permissions):
        return

    logger.warning(f"[ACCESS] {user.id} roles={user.roles} denied {request.method} {request.url.path}")
    if os.getenv("ACCESS_POLICY_MODE", "enforce").lower() == "report":
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"message": "Your role does not have access to this area.", "roles": list(user.roles)},
    )
