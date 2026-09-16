from typing import List, Dict, Set, Tuple

# The 6 Standard Enterprise Roles
ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ORG_ADMIN = "ORG_ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_DISPATCHER = "DISPATCHER"
ROLE_CASHIER = "CASHIER"
ROLE_DELIVERY_DRIVER = "DELIVERY_DRIVER"

VALID_ROLES: Set[str] = {
    ROLE_SUPER_ADMIN,
    ROLE_ORG_ADMIN,
    ROLE_MANAGER,
    ROLE_DISPATCHER,
    ROLE_CASHIER,
    ROLE_DELIVERY_DRIVER
}

# ─── Admin-only by construction ────────────────────────────────────────────────
# A permission string that appears in NO role row below is admin-only: the only
# thing that grants it is the "*" wildcard held by SUPER_ADMIN / ORG_ADMIN. That
# is how `apps:delete` gates permanent API-key deletion without inventing a
# seventh role, and the same trick is reused here for every destructive or
# tenant-wide operation.
#
# This tuple is documentation *and* a test fixture: tests/test_rbac_matrix.py
# asserts every entry is absent from every non-wildcard role row, so accidentally
# granting one to MANAGER fails the suite instead of silently widening access.
ADMIN_ONLY_PERMISSIONS: Tuple[str, ...] = (
    # Permanent deletes (hard DELETE, no soft-delete/restore path)
    "apps:delete",           # developer apps, API keys, webhooks
    "catalog:delete",        # categories
    "locations:delete",      # locations
    "pricing:delete",        # promotions
    "telegram:delete",       # telegram bots + chat bindings
    "automations:delete",    # automation flows
    "bots:delete",           # bot-builder bots, workflows, commands
    # NB: DELETE /users only flips isActive=false (reversible), so it stays on
    # users:write rather than an admin-only users:delete.
    # Ledger integrity — posting/voiding mutates immutable accounting state
    "finance:post",
    "finance:void",
    # Tenant-wide configuration
    "org:write",             # organization profile + settings
    "org:domains",           # custom domain routing
    "industry:setup",        # switches the tenant's industry vertical
    "notifications:config",  # holds provider credentials (telegram bot token)
    # Platform / infrastructure plumbing
    "platform:admin",        # outbox, saga, consumers
    "security:manage",       # IP ban list
    "data:import",           # bulk upsert of arbitrary entities
    "hr:payroll",            # payroll calculation
)

# ─── Fine-Grained Permissions Matrix ──────────────────────────────────────────
PERMISSIONS_MATRIX: Dict[str, List[str]] = {
    ROLE_SUPER_ADMIN: ["*"],
    ROLE_ORG_ADMIN: ["*"],

    # Store / department operational manager: full day-to-day running of the
    # business, but no ledger posting, no tenant config, no permanent deletes.
    ROLE_MANAGER: [
        "sales:read", "sales:write", "sales:refund",
        "catalog:read", "catalog:write",
        "inventory:read", "inventory:write",
        "customers:read", "customers:write",
        "users:read", "users:write",
        "locations:read", "locations:write",
        "org:read",
        "finance:read",
        "hr:read", "hr:write", "hr:approve",
        "pricing:read", "pricing:write",
        "reports:read", "reports:export",
        "documents:read", "documents:write",
        "warehouse:read", "warehouse:write",
        "workflows:read", "workflows:write", "workflows:approve",
        "projects:read",
        "tickets:read",
        "notifications:read", "notifications:send",
        "delivery:read", "delivery:manage",
        "apps:read", "apps:write",
        "telegram:read", "telegram:write", "telegram:broadcast",
        "automations:read", "automations:write", "automations:execute",
        "bots:read", "bots:write", "bots:publish",
        "industry:read", "industry:write",
        "copilot:use",
        "events:read",
        "data:export",
    ],

    # Delivery dispatch desk: routes and tracks orders, reads the context needed
    # to do so, but does not edit the catalog, pricing or staff records.
    ROLE_DISPATCHER: [
        "sales:read",
        "delivery:read", "delivery:manage",
        "inventory:read",
        "catalog:read",
        "customers:read",
        "locations:read",
        "warehouse:read",
        "tickets:read",
        "notifications:read", "notifications:send",
        "industry:read",
        "events:read",
    ],

    # Point of sale operator: rings up sales, registers walk-in customers, reads
    # the catalog/pricing needed to do so.
    ROLE_CASHIER: [
        "sales:read", "sales:write",
        "catalog:read",
        "inventory:read",
        "customers:read", "customers:write",
        "pricing:read",
        "locations:read",
        "delivery:read",
        "notifications:read",
        # Restaurant vertical: table state + kitchen display tickets are
        # front-of-house work performed from the POS.
        "industry:read", "industry:write",
    ],

    # Driver: sees their delivery work and updates only their own assignments.
    ROLE_DELIVERY_DRIVER: [
        "delivery:read", "delivery:update_own"
    ]
}

def get_permissions_for_roles(roles: List[str]) -> Set[str]:
    """Resolve a list of roles into a flat set of unique permissions."""
    permissions = set()
    for role in roles:
        r = role.upper()
        if r in PERMISSIONS_MATRIX:
            permissions.update(PERMISSIONS_MATRIX[r])
    return permissions

def has_permission(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if the user's roles grant all the required permissions."""
    normalized_roles = [r.upper() for r in user_roles]
    if "SUPER_ADMIN" in normalized_roles or "ORG_ADMIN" in normalized_roles:
        return True

    granted = get_permissions_for_roles(normalized_roles)
    if "*" in granted:
        return True

    for req in required_permissions:
        if req not in granted:
            return False
    return True

def has_any_permission(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if the user's roles grant ANY of the required permissions."""
    normalized_roles = [r.upper() for r in user_roles]
    if "SUPER_ADMIN" in normalized_roles or "ORG_ADMIN" in normalized_roles:
        return True

    granted = get_permissions_for_roles(normalized_roles)
    if "*" in granted:
        return True

    for req in required_permissions:
        if req in granted:
            return True
    return False
