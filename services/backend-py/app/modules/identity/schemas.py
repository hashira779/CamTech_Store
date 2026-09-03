from pydantic import BaseModel
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

