import json
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.identity.models import User, Role

security_scheme = HTTPBearer(auto_error=False)

class TenantUser:
    def __init__(self, user: Any, roles: List[str]):
        self.id: str = user.id
        self.organization_id: str = user.organization_id
        self.email: str = getattr(user, "email", getattr(user, "phone", ""))
        self.name: str = user.name
        self.roles: List[str] = roles
        self.location_id: Optional[str] = getattr(user, "location_id", None)

    def has_role(self, role: str) -> bool:
        return role in self.roles or "ORG_ADMIN" in self.roles or "SUPER_ADMIN" in self.roles


def extract_user_roles(user: User) -> List[str]:
    """Strictly use relational user_roles table."""
    if getattr(user, "user_roles", None):
        return [ur.role_name for ur in user.user_roles]
    return ["CASHIER"]

async def _fetch_user_with_roles(db: AsyncSession, user_id: str) -> Optional[User]:
    try:
        result = await db.execute(
            select(User).options(selectinload(User.user_roles)).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user:
            return user
    except Exception:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user:
            return user
    return None


from app.core.permissions import has_permission, has_any_permission

def get_permissions(user: User) -> List[str]:
    # Placeholder for backward compatibility if needed, but we'll use `has_permission` 
    pass



async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> TenantUser:
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = auth.credentials
    payload = decode_access_token(raw_token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    token_type = payload.get("type")
    
    if token_type == "delivery":
        from app.modules.delivery.models import DeliveryDriver
        result = await db.execute(select(DeliveryDriver).where(DeliveryDriver.id == user_id))
        driver = result.scalar_one_or_none()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Driver not found",
            )
        return TenantUser(user=driver, roles=payload.get("roles", ["DELIVERY_DRIVER"]))
    else:
        user = await _fetch_user_with_roles(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        roles_list = extract_user_roles(user)
        return TenantUser(user=user, roles=roles_list)


async def get_streaming_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db),
) -> TenantUser:
    """
    Specifically for SSE (Server-Sent Events) and WebSocket connections where
    standard browser APIs cannot set custom Authorization headers.
    """
    raw_token = auth.credentials if auth and auth.credentials else token_query
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(raw_token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    token_type = payload.get("type")
    
    if token_type == "delivery":
        from app.modules.delivery.models import DeliveryDriver
        result = await db.execute(select(DeliveryDriver).where(DeliveryDriver.id == user_id))
        driver = result.scalar_one_or_none()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Driver not found",
            )
        return TenantUser(user=driver, roles=payload.get("roles", ["DELIVERY_DRIVER"]))
    else:
        user = await _fetch_user_with_roles(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        roles_list = extract_user_roles(user)
        return TenantUser(user=user, roles=roles_list)


async def get_optional_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[TenantUser]:
    if not auth or not auth.credentials:
        return None
    raw_token = auth.credentials
    try:
        payload = decode_access_token(raw_token)
        if not payload or "sub" not in payload:
            return None
        user_id = payload["sub"]
        token_type = payload.get("type")
        
        if token_type == "delivery":
            from app.modules.delivery.models import DeliveryDriver
            result = await db.execute(select(DeliveryDriver).where(DeliveryDriver.id == user_id))
            driver = result.scalar_one_or_none()
            if not driver:
                return None
            return TenantUser(user=driver, roles=payload.get("roles", ["DELIVERY_DRIVER"]))
        else:
            user = await _fetch_user_with_roles(db, user_id)
            if not user:
                return None
            roles_list = extract_user_roles(user)
            return TenantUser(user=user, roles=roles_list)
    except Exception:
        return None



class RequirePermissions:
    """
    FastAPI dependency for granular RBAC (Requires ALL).
    Usage: @router.get("/", dependencies=[Depends(RequirePermissions(["sales:read"]))])
    """
    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions

    def __call__(self, current_user: TenantUser = Depends(get_current_user)):
        if not has_permission(current_user.roles, self.required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires permissions {self.required_permissions}",
            )
        return current_user

class RequireAnyPermission:
    """
    FastAPI dependency for granular RBAC (Requires ANY ONE).
    """
    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions

    def __call__(self, current_user: TenantUser = Depends(get_current_user)):
        if not has_any_permission(current_user.roles, self.required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires at least one of these permissions: {self.required_permissions}",
            )
        return current_user

