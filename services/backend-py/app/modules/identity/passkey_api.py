# ==============================================================================
# Passkey (WebAuthn) registration and login
# ==============================================================================
# Passkeys are an *alternative* primary login: password auth is untouched, so
# losing a device can never lock a user out of their account.
#
# The relying party is resolved from the caller's Origin header (see
# app/core/passkey_config.py), which keeps staff and storefront credentials in
# separate trust domains. Every credential records the RP it was born under and
# that is re-checked on each assertion.
# ==============================================================================

import json
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import TenantUser, get_current_user
from app.core.passkey_config import RelyingParty, resolve_relying_party
from app.core.rate_limiter import auth_rate_limiter
from app.core.security import create_access_token, create_refresh_token

from .models import User, UserPasskey
from .passkey_challenges import challenge_store
from .schemas import LoginResponse, UserDto

router = APIRouter(tags=["Auth — Passkeys"])


# ─── Request bodies ─────────────────────────────────────────────────────────

class RegisterOptionsRequest(BaseModel):
    name: Optional[str] = None


class RegisterVerifyRequest(BaseModel):
    handle: str
    credential: Dict[str, Any]
    name: Optional[str] = None


class LoginOptionsRequest(BaseModel):
    # Optional: with discoverable credentials the authenticator supplies the
    # user, so the client never has to reveal who is signing in up front.
    email: Optional[str] = None


class LoginVerifyRequest(BaseModel):
    handle: str
    credential: Dict[str, Any]


class RenamePasskeyRequest(BaseModel):
    name: str


# ─── Helpers ────────────────────────────────────────────────────────────────

def _require_relying_party(request: Request) -> tuple[RelyingParty, str]:
    """Resolve the RP for this ceremony or refuse, returning the validated origin.

    Deliberately no default: an unrecognised origin must not be able to mint or
    use credentials under the staff RP.

    The origin is returned alongside the party and used as WebAuthn's
    expected_origin. Pinning to the RP's static list instead would break dev
    servers on a port that isn't enumerated in config: resolve_relying_party
    accepts any localhost port outside production, so the ceremony would start
    happily and then fail verification. Returning the origin that already
    passed the allowlist keeps the two steps consistent.
    """
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    party = resolve_relying_party(origin)
    if not party:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Passkeys are not enabled for this origin.",
        )
    return party, origin


def _descriptors(passkeys: List[UserPasskey]) -> List[PublicKeyCredentialDescriptor]:
    descriptors: List[PublicKeyCredentialDescriptor] = []
    for pk in passkeys:
        try:
            descriptors.append(
                PublicKeyCredentialDescriptor(id=base64url_to_bytes(pk.credential_id))
            )
        except Exception:
            # A malformed stored ID should not break the whole ceremony.
            continue
    return descriptors


def _passkey_dto(pk: UserPasskey) -> Dict[str, Any]:
    return {
        "id": pk.id,
        "name": pk.name,
        "rpId": pk.rp_id,
        "backedUp": pk.backed_up,
        "transports": json.loads(pk.transports) if pk.transports else [],
        "createdAt": pk.created_at.isoformat() if pk.created_at else None,
        "lastUsedAt": pk.last_used_at.isoformat() if pk.last_used_at else None,
    }


def _roles_of(user: User) -> List[str]:
    if getattr(user, "user_roles", None):
        return [ur.role_name for ur in user.user_roles]
    try:
        parsed = json.loads(user.roles) if isinstance(user.roles, str) else user.roles
    except (TypeError, ValueError):
        return ["CASHIER"]
    return parsed or ["CASHIER"]


# ─── Registration (authenticated) ───────────────────────────────────────────

@router.post("/passkeys/register/options")
async def passkey_register_options(
    body: RegisterOptionsRequest,
    request: Request,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    party, origin = _require_relying_party(request)

    existing = (
        await db.execute(
            select(UserPasskey).where(
                UserPasskey.user_id == user.id,
                UserPasskey.rp_id == party.rp_id,
            )
        )
    ).scalars().all()

    options = generate_registration_options(
        rp_id=party.rp_id,
        rp_name=party.name,
        user_id=user.id.encode("utf-8"),
        user_name=user.email or user.name,
        user_display_name=user.name or user.email,
        # Discoverable ("resident") credentials let the user sign in without
        # typing an email first, which is the point of passkey login.
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        # Stops the same authenticator silently registering twice.
        exclude_credentials=_descriptors(existing),
    )

    handle = secrets.token_urlsafe(32)
    await challenge_store.put(
        handle,
        {
            "kind": "registration",
            "challenge": options.challenge.hex(),
            "userId": user.id,
            "organizationId": user.organization_id,
            "rpKey": party.key,
            "name": (body.name or "").strip()[:60],
        },
    )

    return {"handle": handle, "options": json.loads(options_to_json(options))}


@router.post("/passkeys/register/verify", status_code=status.HTTP_201_CREATED)
async def passkey_register_verify(
    body: RegisterVerifyRequest,
    request: Request,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    party, origin = _require_relying_party(request)
    stored = await challenge_store.take(body.handle)

    if not stored or stored.get("kind") != "registration":
        raise HTTPException(status_code=400, detail="Challenge expired or already used.")
    # The ceremony must finish as the same user, on the same RP, that began it.
    if stored.get("userId") != user.id or stored.get("rpKey") != party.key:
        raise HTTPException(status_code=400, detail="Challenge does not match this session.")

    try:
        verified = verify_registration_response(
            credential=body.credential,
            expected_challenge=bytes.fromhex(stored["challenge"]),
            expected_rp_id=party.rp_id,
            expected_origin=origin,
            require_user_verification=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Passkey registration failed: {exc}")

    from webauthn.helpers import bytes_to_base64url

    credential_id = bytes_to_base64url(verified.credential_id)

    clash = (
        await db.execute(select(UserPasskey).where(UserPasskey.credential_id == credential_id))
    ).scalar_one_or_none()
    if clash:
        raise HTTPException(status_code=409, detail="This passkey is already registered.")

    label = (body.name or stored.get("name") or "").strip()[:60] or "Passkey"
    transports = body.credential.get("response", {}).get("transports") or []

    record = UserPasskey(
        user_id=user.id,
        organization_id=user.organization_id,
        credential_id=credential_id,
        public_key=verified.credential_public_key,
        sign_count=verified.sign_count or 0,
        rp_id=party.rp_id,
        name=label,
        transports=json.dumps(transports) if transports else None,
        aaguid=verified.aaguid,
        backed_up=bool(verified.credential_backed_up),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return _passkey_dto(record)


# ─── Login (public) ─────────────────────────────────────────────────────────

@router.post("/passkeys/login/options")
async def passkey_login_options(
    body: LoginOptionsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await auth_rate_limiter.check(request)
    party, origin = _require_relying_party(request)

    allow: List[PublicKeyCredentialDescriptor] = []
    if body.email:
        from sqlalchemy import func as sa_func

        user = (
            await db.execute(
                select(User).where(sa_func.lower(User.email) == body.email.strip().lower())
            )
        ).scalar_one_or_none()
        if user:
            passkeys = (
                await db.execute(
                    select(UserPasskey).where(
                        UserPasskey.user_id == user.id,
                        UserPasskey.rp_id == party.rp_id,
                    )
                )
            ).scalars().all()
            allow = _descriptors(passkeys)
        # An unknown email still gets options back: replying "no such user"
        # here would turn this endpoint into an account enumeration oracle.

    options = generate_authentication_options(
        rp_id=party.rp_id,
        allow_credentials=allow or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    handle = secrets.token_urlsafe(32)
    await challenge_store.put(
        handle,
        {
            "kind": "authentication",
            "challenge": options.challenge.hex(),
            "rpKey": party.key,
        },
    )

    return {"handle": handle, "options": json.loads(options_to_json(options))}


@router.post("/passkeys/login/verify", response_model=LoginResponse)
async def passkey_login_verify(
    body: LoginVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await auth_rate_limiter.check(request)
    party, origin = _require_relying_party(request)

    stored = await challenge_store.take(body.handle)
    if not stored or stored.get("kind") != "authentication" or stored.get("rpKey") != party.key:
        raise HTTPException(status_code=400, detail="Challenge expired or already used.")

    raw_id = body.credential.get("rawId") or body.credential.get("id")
    if not raw_id:
        raise HTTPException(status_code=400, detail="Malformed passkey assertion.")

    # The RP filter is what enforces the staff/storefront split: a storefront
    # credential is simply not found when a staff origin runs the ceremony.
    record = (
        await db.execute(
            select(UserPasskey).where(
                UserPasskey.credential_id == raw_id,
                UserPasskey.rp_id == party.rp_id,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=401, detail="Unrecognised passkey.")

    try:
        verified = verify_authentication_response(
            credential=body.credential,
            expected_challenge=bytes.fromhex(stored["challenge"]),
            expected_rp_id=party.rp_id,
            expected_origin=origin,
            credential_public_key=record.public_key,
            credential_current_sign_count=record.sign_count or 0,
            require_user_verification=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Passkey authentication failed: {exc}")

    # Cloned-authenticator check. Many platform authenticators always report 0,
    # so only a decrease from a previously non-zero counter is treated as proof
    # of cloning; 0 -> 0 is normal and must stay allowed.
    if record.sign_count and verified.new_sign_count and verified.new_sign_count <= record.sign_count:
        raise HTTPException(status_code=401, detail="Passkey signature counter regressed.")

    from sqlalchemy.orm import selectinload

    user = (
        await db.execute(
            select(User).options(selectinload(User.user_roles)).where(User.id == record.user_id)
        )
    ).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is not active.")

    record.sign_count = verified.new_sign_count or record.sign_count
    record.backed_up = bool(verified.credential_backed_up)
    record.last_used_at = utc_now()
    await db.commit()

    roles = _roles_of(user)
    token = create_access_token({"sub": user.id, "orgId": user.organization_id, "roles": roles})
    refresh_token = create_refresh_token({"sub": user.id, "orgId": user.organization_id})

    return LoginResponse(
        accessToken=token,
        refreshToken=refresh_token,
        user=UserDto(
            id=user.id,
            organizationId=user.organization_id,
            email=user.email,
            name=user.name,
            roles=roles,
            permissions=[],
            locationId=user.location_id,
        ),
    )


# ─── Management (authenticated, own credentials only) ───────────────────────

@router.get("/passkeys")
async def list_my_passkeys(
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    passkeys = (
        await db.execute(
            select(UserPasskey)
            .where(UserPasskey.user_id == user.id)
            .order_by(UserPasskey.created_at.desc())
        )
    ).scalars().all()
    return [_passkey_dto(pk) for pk in passkeys]


@router.patch("/passkeys/{passkey_id}")
async def rename_my_passkey(
    passkey_id: str,
    body: RenamePasskeyRequest,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = (
        await db.execute(
            select(UserPasskey).where(
                UserPasskey.id == passkey_id,
                UserPasskey.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Passkey not found")

    label = body.name.strip()[:60]
    if not label:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    record.name = label
    await db.commit()
    await db.refresh(record)
    return _passkey_dto(record)


@router.delete("/passkeys/{passkey_id}")
async def delete_my_passkey(
    passkey_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Scoped to the caller's own rows: a user may remove their own devices
    # without any admin permission, but never someone else's.
    record = (
        await db.execute(
            select(UserPasskey).where(
                UserPasskey.id == passkey_id,
                UserPasskey.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Passkey not found")

    await db.delete(record)
    await db.commit()
    return {"deleted": True, "id": passkey_id}
