# ==============================================================================
# Authoritative Permission Catalogue
# ==============================================================================
# One source of truth for "what permissions exist on this platform".
#
# Why this file exists: the permission vocabulary had drifted into three
# disagreeing copies.
#
#   1. `SYSTEM_PERMISSIONS` — 18 strings hardcoded in apps/web/app/users/page.tsx,
#      which is what the Create Custom Role dialog rendered. Eight of them gate
#      nothing, and five permissions that ARE enforced were absent, so no custom
#      role could be granted Control Center access at all.
#   2. The strings actually passed to RequirePermissions across the backend.
#   3. A 53-entry dot-notation list hardcoded in the login response, which
#      overlaps the enforced set by exactly zero.
#
# A role editor built from a hardcoded frontend array cannot stay correct: every
# new guarded endpoint silently becomes ungrantable. The catalogue is therefore
# served to the UI (GET /api/v1/auth/permissions) and validated against what the
# code really enforces by a test, so the two cannot drift apart again.
#
# NOTE ON NAMING: both `domain:action` and `domain.action.sub` forms are in use
# and BOTH are enforced today, so both appear here. Unifying them is a data
# migration over stored `roles.permissions` values and is deliberately left as a
# separate decision rather than silently breaking existing roles.
# ==============================================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class PermissionDef:
    key: str
    label: str
    description: str
    category: str
    # True when a guarded endpoint actually checks this string today. A
    # permission that gates nothing is worse than a missing one: it looks like
    # a control and silently is not.
    enforced: bool = True
    # Platform-level permissions are not normally granted to tenant roles.
    platform_scope: bool = False


CATALOG: List[PermissionDef] = [
    # ── Sales & commerce ────────────────────────────────────────────────────
    PermissionDef("sales:read", "View sales", "Read orders, receipts and sales history.", "Sales"),
    PermissionDef("sales:write", "Create & edit sales", "Create orders and record payments.", "Sales"),
    PermissionDef(
        "sales:refund", "Refund sales", "Issue refunds against completed sales.", "Sales",
        enforced=False,
    ),
    # ── Catalog & stock ─────────────────────────────────────────────────────
    PermissionDef("catalog:read", "View catalog", "Read products, variants and categories.", "Catalog", enforced=False),
    PermissionDef("catalog:write", "Manage catalog", "Create and edit products and pricing.", "Catalog", enforced=False),
    PermissionDef("inventory:read", "View inventory", "Read stock levels and movements.", "Inventory", enforced=False),
    PermissionDef("inventory:write", "Adjust inventory", "Adjust stock and record movements.", "Inventory", enforced=False),
    # ── People ──────────────────────────────────────────────────────────────
    PermissionDef("users:read", "View users", "Read the user directory and role assignments.", "People"),
    PermissionDef("users:write", "Manage users", "Create, edit and deactivate users.", "People"),
    # ── Delivery ────────────────────────────────────────────────────────────
    PermissionDef("delivery:read", "View deliveries", "Read delivery orders and driver status.", "Delivery"),
    PermissionDef("delivery:manage", "Manage deliveries", "Assign drivers and change delivery status.", "Delivery"),
    PermissionDef(
        "delivery:update_own", "Update own deliveries",
        "Couriers updating only the deliveries assigned to them.", "Delivery",
    ),
    # ── Reporting ───────────────────────────────────────────────────────────
    PermissionDef("reports:read", "View reports", "Read operational and financial reports.", "Reporting", enforced=False),
    # ── Developer platform ──────────────────────────────────────────────────
    PermissionDef("apps:read", "View API credentials", "List developer apps, API keys and webhooks.", "Developer"),
    PermissionDef("apps:write", "Manage API credentials", "Create and revoke API keys and webhooks.", "Developer"),
    PermissionDef(
        "apps:delete", "Permanently delete API keys",
        "Erase a revoked API key and its audit record. Destructive.", "Developer",
    ),
    PermissionDef("telegram:read", "View Telegram bots", "Read bot configuration and bindings.", "Automations", enforced=False),
    PermissionDef("telegram:write", "Manage Telegram bots", "Create and edit bots and flows.", "Automations", enforced=False),
    # ── Infra & Security Control Center (platform scope) ────────────────────
    # These were enforced but absent from the role editor, which meant Control
    # Center access could not be granted to a custom role at all.
    PermissionDef(
        "infra.services.read", "View service health",
        "Read observed service inventory, topology and pipeline health.",
        "Infra & Security", platform_scope=True,
    ),
    PermissionDef(
        "infra.metrics.read", "View traffic metrics",
        "Read request rate, error rate, latency percentiles and source activity.",
        "Infra & Security", platform_scope=True,
    ),
    PermissionDef(
        "infra.logs.read", "Search logs & requests",
        "Search structured logs and the live request stream. May expose request metadata.",
        "Infra & Security", platform_scope=True,
    ),
    PermissionDef(
        "infra.traces.read", "View distributed traces",
        "Read trace waterfalls across services.",
        "Infra & Security", platform_scope=True,
    ),
    PermissionDef(
        "security.events.read", "View security detections",
        "Read security events, detection rules and source dossiers.",
        "Infra & Security", platform_scope=True,
    ),
]

# Granting every permission. Held by SUPER_ADMIN and ORG_ADMIN; `has_permission`
# short-circuits on it.
WILDCARD = "*"


def catalog_keys() -> List[str]:
    return [p.key for p in CATALOG]


def enforced_keys() -> List[str]:
    return [p.key for p in CATALOG if p.enforced]


def grouped() -> Dict[str, List[PermissionDef]]:
    """Catalogue grouped by category, preserving declaration order."""
    out: Dict[str, List[PermissionDef]] = {}
    for perm in CATALOG:
        out.setdefault(perm.category, []).append(perm)
    return out


def as_payload() -> Dict[str, object]:
    """Shape served to the role editor."""
    return {
        "wildcard": WILDCARD,
        "categories": [
            {
                "name": category,
                "permissions": [
                    {
                        "key": p.key,
                        "label": p.label,
                        "description": p.description,
                        "enforced": p.enforced,
                        "platformScope": p.platform_scope,
                    }
                    for p in perms
                ],
            }
            for category, perms in grouped().items()
        ],
        "notes": {
            "unenforced": (
                "Permissions marked enforced=false are defined but not yet checked by any "
                "endpoint. They are shown so roles can be prepared, and flagged so nobody "
                "mistakes them for an active control."
            ),
            "platformScope": (
                "Platform-scope permissions expose cross-tenant operational data and should "
                "not normally be granted to tenant roles."
            ),
            "naming": (
                "Both domain:action and domain.action.sub forms are currently enforced. "
                "Unifying them requires migrating stored role permissions."
            ),
        },
    }
