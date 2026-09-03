import json
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.entities import User

security_scheme = HTTPBearer(auto_error=False)

class TenantUser:
    def __init__(self, user: User, roles: List[str]):
        self.id: str = user.id
        self.organization_id: str = user.organization_id
        self.email: str = user.email
        self.name: str = user.name
        self.roles: List[str] = roles
        self.location_id: Optional[str] = user.location_id

    def has_role(self, role: str) -> bool:
        return role in self.roles or "ORG_ADMIN" in self.roles

async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db),
) -> TenantUser:
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
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        roles_list = json.loads(user.roles) if isinstance(user.roles, str) else user.roles
    except Exception:
        roles_list = [user.roles] if user.roles else ["CASHIER"]

    return TenantUser(user=user, roles=roles_list)
