from pydantic import BaseModel, validator
from typing import List, Optional

class UserDto(BaseModel):
    id: str
    organizationId: str
    email: str
    name: str
    roles: List[str]
    permissions: List[str] = []
    locationId: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    accessToken: str
    refreshToken: Optional[str] = None
    user: UserDto

class RefreshTokenRequest(BaseModel):
    refreshToken: str

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    organizationName: Optional[str] = "CamTech Retail"
    role: Optional[str] = "CUSTOMER"

class RegisterResponse(BaseModel):
    id: str
    email: str
    name: str
    organizationId: str
    roles: List[str]
    accessToken: str
    status: str = "PROVISIONED"
    message: str = "User registered successfully. Welcome coupon & loyalty points queued in Redis."
    latencyMs: float
    queuedEventId: str

class OAuthSyncRequest(BaseModel):
    email: str
    name: Optional[str] = None
    provider: Optional[str] = "google"
    providerId: Optional[str] = None
    avatarUrl: Optional[str] = None

from app.core.permissions import VALID_ROLES

class CreateUserInput(BaseModel):
    name: str
    email: str
    password: str
    roles: List[str] = ["CASHIER"]
    locationId: Optional[str] = None

    @validator('roles')
    def validate_roles(cls, v):
        for role in v:
            if role.upper() not in VALID_ROLES:
                raise ValueError(f"Invalid role: {role}. Must be one of {VALID_ROLES}")
        return [r.upper() for r in v]

class UpdateUserInput(BaseModel):
    name: Optional[str] = None
    roles: Optional[List[str]] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None
    locationId: Optional[str] = None

    @validator('roles')
    def validate_roles(cls, v):
        if v is None:
            return v
        for role in v:
            if role.upper() not in VALID_ROLES:
                raise ValueError(f"Invalid role: {role}. Must be one of {VALID_ROLES}")
        return [r.upper() for r in v]

class UserDetailDto(BaseModel):
    id: str
    organizationId: str
    email: str
    name: str
    roles: List[str]
    isActive: bool = True
    locationId: Optional[str] = None
    createdAt: Optional[str] = None


