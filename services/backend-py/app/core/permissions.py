from typing import List, Set

def get_permissions_for_roles(roles: List[str]) -> Set[str]:
    # Deprecated: permissions are now dynamic and fetched from the database
    return set()

def has_permission(user_permissions: List[str], required_permissions: List[str]) -> bool:
    """Check if the user's permissions grant all the required permissions."""
    if "*" in user_permissions:
        return True
        
    for req in required_permissions:
        if req not in user_permissions:
            return False
    return True

def has_any_permission(user_permissions: List[str], required_permissions: List[str]) -> bool:
    """Check if the user's permissions grant ANY of the required permissions."""
    if "*" in user_permissions:
        return True
        
    for req in required_permissions:
        if req in user_permissions:
            return True
    return False
