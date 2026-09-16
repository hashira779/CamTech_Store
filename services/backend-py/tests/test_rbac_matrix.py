"""RBAC coverage tests.

Three layers:
  1. Matrix invariants — the admin-only-by-construction convention holds.
  2. Route coverage — no endpoint silently falls back to authentication-only.
  3. Integration — a real low-privilege user is actually refused.
"""
import re
import pathlib

import httpx
import pytest

from app.main import app
from app.core.permissions import (
    ADMIN_ONLY_PERMISSIONS,
    PERMISSIONS_MATRIX,
    ROLE_CASHIER,
    ROLE_DELIVERY_DRIVER,
    ROLE_MANAGER,
    ROLE_ORG_ADMIN,
    ROLE_SUPER_ADMIN,
    has_permission,
)

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]

# Endpoints that are deliberately authentication-only (no permission gate).
# Each entry is (module path, handler name, justification).
AUTH_ONLY_ALLOWLIST = {
    ("app/modules/identity/api.py", "mfa_setup"),
    ("app/modules/identity/api.py", "mfa_verify"),
    ("app/modules/identity/api.py", "get_me"),
    ("app/routers/app_registry_routes.py", "check_application_access"),
    ("app/routers/app_registry_routes.py", "list_my_applications"),
}


# ─── 1. Matrix invariants ─────────────────────────────────────────────────────

def test_admin_only_permissions_are_granted_by_no_role():
    """Admin-only permissions must only ever be reachable via the "*" wildcard."""
    offenders = []
    for role, granted in PERMISSIONS_MATRIX.items():
        if granted == ["*"]:
            continue
        for perm in ADMIN_ONLY_PERMISSIONS:
            if perm in granted:
                offenders.append(f"{role} grants admin-only permission {perm!r}")
    assert not offenders, "\n".join(offenders)


def test_admin_roles_hold_every_admin_only_permission():
    for role in (ROLE_SUPER_ADMIN, ROLE_ORG_ADMIN):
        for perm in ADMIN_ONLY_PERMISSIONS:
            assert has_permission([role], [perm]), f"{role} should satisfy {perm}"


def test_admin_only_permissions_have_no_duplicates():
    assert len(set(ADMIN_ONLY_PERMISSIONS)) == len(ADMIN_ONLY_PERMISSIONS)


@pytest.mark.parametrize(
    "role,permission,expected",
    [
        # The non-admin apps must keep working.
        (ROLE_CASHIER, "sales:write", True),       # apps/cashier POST /sales
        (ROLE_CASHIER, "catalog:read", True),
        (ROLE_CASHIER, "pricing:read", True),
        (ROLE_DELIVERY_DRIVER, "delivery:read", True),      # apps/delivery GET /orders
        (ROLE_DELIVERY_DRIVER, "delivery:update_own", True),  # PATCH /orders/{id}/status
        (ROLE_MANAGER, "hr:read", True),           # apps/hr GET /hr/employees
        (ROLE_MANAGER, "reports:read", True),      # apps/ceo dashboard
        # ...and must not reach past their station.
        (ROLE_CASHIER, "finance:read", False),
        (ROLE_CASHIER, "users:read", False),
        (ROLE_CASHIER, "catalog:write", False),
        (ROLE_DELIVERY_DRIVER, "delivery:manage", False),
        (ROLE_DELIVERY_DRIVER, "sales:read", False),
        (ROLE_MANAGER, "finance:post", False),
        (ROLE_MANAGER, "org:write", False),
        (ROLE_MANAGER, "platform:admin", False),
        (ROLE_MANAGER, "security:manage", False),
        (ROLE_MANAGER, "hr:payroll", False),
    ],
)
def test_role_permission_expectations(role, permission, expected):
    assert has_permission([role], [permission]) is expected


# ─── 2. Route coverage ────────────────────────────────────────────────────────

def _handlers_using_bare_auth():
    """Yield (relative path, handler name) for endpoints with no permission gate."""
    rx_route = re.compile(r"@\w+\.(get|post|put|patch|delete)\(")
    rx_def = re.compile(r"\s*(?:async\s+)?def\s+(\w+)\s*\(")
    rx_bare = re.compile(r"Depends\(\s*(get_current_user|get_streaming_user)\s*\)")

    for folder in ("app/modules", "app/routers"):
        for path in sorted((BACKEND_ROOT / folder).rglob("*.py")):
            lines = path.read_text(encoding="utf-8").split("\n")
            rel = path.relative_to(BACKEND_ROOT).as_posix()
            for i, line in enumerate(lines):
                if not rx_route.search(line):
                    continue
                # Walk to the handler signature, then scan it for a bare dep.
                for j in range(i + 1, min(i + 8, len(lines))):
                    m = rx_def.match(lines[j])
                    if not m:
                        continue
                    depth = lines[j].count("(") - lines[j].count(")")
                    k = j
                    while depth > 0 and k + 1 < len(lines):
                        k += 1
                        depth += lines[k].count("(") - lines[k].count(")")
                    if any(rx_bare.search(lines[n]) for n in range(j, k + 1)):
                        yield rel, m.group(1)
                    break


def test_no_endpoint_is_authentication_only_without_justification():
    """
    Regression guard for the 2026-09-09 P0 audit finding: `get_current_user`
    authenticates but does not authorize. Any endpoint added with a bare
    `get_current_user` must either gain a permission or be added to
    AUTH_ONLY_ALLOWLIST with a reason.
    """
    found = set(_handlers_using_bare_auth())
    unjustified = found - AUTH_ONLY_ALLOWLIST
    assert not unjustified, (
        "Endpoints authenticate but do not authorize:\n"
        + "\n".join(f"  {p}::{fn}" for p, fn in sorted(unjustified))
    )


def test_allowlist_has_no_stale_entries():
    """Keep the allowlist honest as endpoints get gated or removed."""
    found = set(_handlers_using_bare_auth())
    stale = AUTH_ONLY_ALLOWLIST - found
    assert not stale, (
        "Allowlisted endpoints no longer use bare authentication:\n"
        + "\n".join(f"  {p}::{fn}" for p, fn in sorted(stale))
    )


# ─── 3. Integration ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_low_privilege_user_is_refused_across_modules():
    """A CASHIER may ring up sales but must not reach finance/HR/admin surfaces."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@demo.test", "password": "Admin123!"},
        )
        assert admin_login.status_code == 200
        admin_headers = {
            "Authorization": f"Bearer {admin_login.json()['data']['accessToken']}"
        }

        import uuid

        email = f"rbac_cashier_{uuid.uuid4().hex[:8]}@camtech.cam"
        created = await client.post(
            "/api/v1/auth/users",
            json={
                "name": "RBAC Probe Cashier",
                "email": email,
                "password": "Password123!",
                "roles": ["CASHIER"],
            },
            headers=admin_headers,
        )
        assert created.status_code == 201
        user_id = created.json()["data"]["id"]

        try:
            login = await client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "Password123!"},
            )
            assert login.status_code == 200
            headers = {
                "Authorization": f"Bearer {login.json()['data']['accessToken']}"
            }

            # Granted to CASHIER — must not be 403.
            for method, url in [
                ("GET", "/api/v1/sales"),
                ("GET", "/api/v1/products"),
                ("GET", "/api/v1/inventory"),
                ("GET", "/api/v1/taxes"),
            ]:
                res = await client.request(method, url, headers=headers)
                assert res.status_code != 403, f"CASHIER wrongly denied {method} {url}"

            # Not granted to CASHIER — must be 403.
            for method, url in [
                ("GET", "/api/v1/finance/accounts"),
                ("GET", "/api/v1/hr/employees"),
                ("GET", "/api/v1/auth/users"),
                ("GET", "/api/v1/reports/summary"),
                ("GET", "/api/v1/notifications/config"),
                ("GET", "/api/v1/security/bans"),
                ("GET", "/api/v1/outbox/status"),
                ("POST", "/api/v1/hr/payroll/calculate"),
            ]:
                res = await client.request(method, url, headers=headers)
                assert res.status_code == 403, (
                    f"CASHIER wrongly allowed {method} {url} -> {res.status_code}"
                )
        finally:
            from sqlalchemy import delete

            from app.core.database import AsyncSessionLocal
            from app.modules.identity.models import User, UserRole

            async with AsyncSessionLocal() as session:
                await session.execute(delete(UserRole).where(UserRole.user_id == user_id))
                await session.execute(delete(User).where(User.id == user_id))
                await session.commit()


@pytest.mark.asyncio
async def test_delivery_task_endpoints_reject_anonymous_callers():
    """
    These three used to run on get_optional_user, i.e. anonymous callers got the
    default org's delivery book and could move any order to DELIVERED.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        for method, url in [
            ("GET", "/api/v1/delivery/tasks"),
            ("GET", "/api/v1/delivery/drivers/public"),
        ]:
            res = await client.request(method, url)
            assert res.status_code == 401, f"{method} {url} -> {res.status_code}"

        res = await client.patch(
            "/api/v1/delivery/tasks/some-order-id/status",
            json={"status": "DELIVERED"},
        )
        assert res.status_code == 401, res.status_code
