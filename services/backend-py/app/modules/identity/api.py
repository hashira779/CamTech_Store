import json
import time
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limiter import auth_rate_limiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    verify_password, hash_password, create_access_token, create_refresh_token,
    decode_refresh_token, generate_totp_secret, verify_totp_code,
    get_totp_uri
)
from app.core.dependencies import get_current_user, TenantUser
from app.domain.registration_worker import dispatch_user_registered_event

from .models import User
from .schemas import (
    LoginRequest, LoginResponse, RefreshTokenRequest, TokenResponse,
    RegisterRequest, RegisterResponse, UserDto
)

router = APIRouter(tags=["Auth"])

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    auth_rate_limiter.check(request)
    """
    Ultra-Low Latency Non-Blocking Registration:
    1. Fast DB check & async threadpool bcrypt hash (never blocks event loop)
    2. Drops UserRegistered event into Redis Queue
    3. Returns 201 Created in ~10-15ms while workers provision loyalty & coupons asynchronously!
    """
    t0 = time.time()
    # 1. Check existing user
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )

    # 2. Async non-blocking password hash
    password_hash = await asyncio.to_thread(hash_password, req.password)
    user_id = f"usr_{uuid.uuid4().hex[:10]}"
    
    # Get active organization id
    org_res = await db.execute(select(User.organization_id).limit(1))
    org_id = org_res.scalar_one_or_none() or "cmtk8h18o0000vkd0etmdacgw"
    roles = [req.role.upper()] if req.role else ["CUSTOMER"]

    # 3. Create user record
    new_user = User(
        id=user_id,
        organization_id=org_id,
        email=req.email,
        name=req.name,
        password_hash=password_hash,
        roles=json.dumps(roles),
        is_active=True
    )
    db.add(new_user)
    await db.commit()

    # 4. Asynchronous Event-Driven Decoupling: Drop event into Redis & Queue
    event_id = await dispatch_user_registered_event({
        "id": user_id,
        "email": req.email,
        "name": req.name,
        "organizationId": org_id,
        "roles": roles
    })

    # 5. Issue immediate access token
    access_token = create_access_token({"sub": user_id, "orgId": org_id, "roles": roles})
    latency_ms = (time.time() - t0) * 1000

    return RegisterResponse(
        id=user_id,
        email=req.email,
        name=req.name,
        organizationId=org_id,
        roles=roles,
        accessToken=access_token,
        status="PROVISIONED",
        message="User registered successfully. Welcome coupon & loyalty points queued in Redis.",
        latencyMs=round(latency_ms, 2),
        queuedEventId=event_id
    )


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    auth_rate_limiter.check(request)
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    roles = json.loads(user.roles) if isinstance(user.roles, str) else (user.roles or ["CASHIER"])
    token = create_access_token({"sub": user.id, "orgId": user.organization_id, "roles": roles})
    refresh_token = create_refresh_token({"sub": user.id, "orgId": user.organization_id})

    permissions = [
        "products.read", "products.write", "customers.read", "customers.write",
        "sales.read", "sales.write", "sales.void", "sales.refund",
        "inventory.read", "inventory.adjust", "locations.read", "locations.write",
        "organizations.read", "organizations.write", "procurement.read", "procurement.write",
        "promotions.read", "promotions.write", "pricing.read", "pricing.write",
        "payments.read", "taxes.read", "taxes.write", "loyalty.read", "loyalty.write",
        "storage.read", "storage.write", "notifications.read", "notifications.write",
        "reports.read", "reports.export", "finance.read", "finance.write", "journal.post",
        "workflow.read", "workflow.manage", "workflow.approve", "hr.read", "hr.write",
        "payroll.run", "assets.read", "assets.write", "projects.read", "projects.write",
        "tickets.read", "tickets.write", "developer.read", "developer.write",
        "webhooks.manage", "telegram.manage", "automation.read", "automation.write", "automation.execute"
    ]

    return LoginResponse(
        accessToken=token,
        refreshToken=refresh_token,
        user=UserDto(
            id=user.id,
            organizationId=user.organization_id,
            email=user.email,
            name=user.name,
            roles=roles,
            permissions=permissions,
            locationId=user.location_id
        )
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_refresh_token(req.refreshToken)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    roles = json.loads(user.roles) if isinstance(user.roles, str) else (user.roles or ["CASHIER"])
    new_access_token = create_access_token({"sub": user.id, "orgId": user.organization_id, "roles": roles})
    new_refresh_token = create_refresh_token({"sub": user.id, "orgId": user.organization_id})

    return TokenResponse(
        accessToken=new_access_token,
        refreshToken=new_refresh_token,
        tokenType="bearer"
    )

@router.post("/mfa/setup")
async def mfa_setup(user: TenantUser = Depends(get_current_user)):
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user.email, issuer="MyStore")
    return {
        "secret": secret,
        "otpauthUri": uri,
        "instructions": "Scan QR code or enter secret in Google Authenticator or 1Password"
    }

@router.post("/mfa/verify")
async def mfa_verify(
    payload: dict,
    user: TenantUser = Depends(get_current_user)
):
    secret = payload.get("secret", "")
    code = payload.get("code", "")
    if not secret or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both secret and code are required",
        )
    is_valid = verify_totp_code(secret, code)
    return {"valid": is_valid}

@router.get("/me", response_model=UserDto)
async def get_me(user: TenantUser = Depends(get_current_user)):
    permissions = [
        "products.read", "products.write", "customers.read", "customers.write",
        "sales.read", "sales.write", "inventory.read", "inventory.adjust",
        "locations.read", "reports.read", "automation.read", "automation.write"
    ]
    return UserDto(
        id=user.id,
        organizationId=user.organization_id,
        email=user.email,
        name=user.name,
        roles=user.roles,
        permissions=permissions,
        locationId=user.location_id
    )
