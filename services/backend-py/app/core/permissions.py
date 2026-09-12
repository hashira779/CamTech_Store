from typing import List, Dict, Set

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

# Fine-Grained Permissions Matrix
PERMISSIONS_MATRIX: Dict[str, List[str]] = {
    ROLE_SUPER_ADMIN: ["*"],
    ROLE_ORG_ADMIN: ["*"],
    ROLE_MANAGER: [
        "sales:read", "sales:write", "sales:refund",
        "catalog:read", "catalog:write",
        "inventory:read", "inventory:write",
        "users:read", "users:write",
        "reports:read",
        "delivery:read", "delivery:manage",
        "apps:read", "apps:write",
        "telegram:read", "telegram:write"
    ],
    ROLE_DISPATCHER: [
        "sales:read",
        "delivery:read", "delivery:manage",
        "inventory:read"
    ],
    ROLE_CASHIER: [
        "sales:read", "sales:write",
        "catalog:read",
        "inventory:read",
        "delivery:read"
    ],
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
