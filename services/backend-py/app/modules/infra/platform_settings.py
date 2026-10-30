# ==============================================================================
# Platform Settings — sign-in configuration editable from the Infra console
# ==============================================================================
# A saved value overrides the environment; clearing it falls back to the
# environment again. Only the settings declared here can be stored.
#
# JWT_SECRET, database passwords and PAYMENT_KEK are deliberately absent: a stolen
# admin login must not be able to replace the keys that protect the platform.
# ==============================================================================

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import key_vault
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.core.external_identity import IdentityConfig
from app.core.telemetry import get_logger

from .models import InfraPlatformSetting

logger = get_logger("mystore.platform_settings")

# Seals secrets to this store: an envelope copied from a merchant row won't open here.
_VAULT_SCOPE = "platform-settings"
_CACHE_SECONDS = 30.0

_HOSTNAME = r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}"


@dataclass(frozen=True)
class SettingDefinition:
    env_name: str
    pattern: str
    secret: bool = False
    # Safe to hand to any browser. Firebase web config is public by design.
    public_name: Optional[str] = None


DEFINITIONS: Dict[str, SettingDefinition] = {
    "FIREBASE_API_KEY": SettingDefinition("FIREBASE_API_KEY", r"AIza[0-9A-Za-z_-]{20,60}", public_name="apiKey"),
    "FIREBASE_AUTH_DOMAIN": SettingDefinition("FIREBASE_AUTH_DOMAIN", _HOSTNAME, public_name="authDomain"),
    "FIREBASE_PROJECT_ID": SettingDefinition("FIREBASE_PROJECT_ID", r"[a-z0-9][a-z0-9-]{3,62}", public_name="projectId"),
    "FIREBASE_STORAGE_BUCKET": SettingDefinition("FIREBASE_STORAGE_BUCKET", _HOSTNAME, public_name="storageBucket"),
    "FIREBASE_MESSAGING_SENDER_ID": SettingDefinition("FIREBASE_MESSAGING_SENDER_ID", r"[0-9]{5,20}", public_name="messagingSenderId"),
    "FIREBASE_APP_ID": SettingDefinition("FIREBASE_APP_ID", r"[0-9]:[0-9]+:web:[0-9a-f]+", public_name="appId"),
    "FIREBASE_MEASUREMENT_ID": SettingDefinition("FIREBASE_MEASUREMENT_ID", r"G-[A-Z0-9]{4,20}", public_name="measurementId"),
    "SUPABASE_URL": SettingDefinition("SUPABASE_URL", rf"https://{_HOSTNAME}"),
    "SUPABASE_JWT_SECRET": SettingDefinition("SUPABASE_JWT_SECRET", r"\S{32,512}", secret=True),
}

_cache: Optional[Dict[str, InfraPlatformSetting]] = None
_cache_loaded_at = 0.0


class InvalidSetting(ValueError):
    """A submitted key or value was refused. The message never contains the value."""


def _reset_cache() -> None:
    global _cache
    _cache = None


async def _stored(db: AsyncSession) -> Dict[str, InfraPlatformSetting]:
    global _cache, _cache_loaded_at
    if _cache is not None and time.monotonic() - _cache_loaded_at < _CACHE_SECONDS:
        return _cache
    rows = (await db.execute(select(InfraPlatformSetting))).scalars().all()
    for row in rows:
        db.expunge(row)
    _cache = {row.key: row for row in rows if row.key in DEFINITIONS}
    _cache_loaded_at = time.monotonic()
    return _cache


def _env_value(definition: SettingDefinition) -> str:
    return str(getattr(settings, definition.env_name, "") or "")


def _open(row: InfraPlatformSetting, definition: SettingDefinition) -> str:
    if not definition.secret:
        return row.value
    try:
        return key_vault.open_sealed(json.loads(row.value), _VAULT_SCOPE)
    except Exception as exc:
        logger.error(f"Stored setting {row.key} could not be opened: {type(exc).__name__}")
        return ""


async def _effective(db: AsyncSession) -> Dict[str, str]:
    stored = await _stored(db)
    return {
        key: _open(stored[key], definition) if key in stored else _env_value(definition)
        for key, definition in DEFINITIONS.items()
    }


async def load_identity_config(db: AsyncSession) -> IdentityConfig:
    values = await _effective(db)
    return IdentityConfig(
        firebase_project_id=values["FIREBASE_PROJECT_ID"],
        supabase_url=values["SUPABASE_URL"],
        supabase_jwt_secret=values["SUPABASE_JWT_SECRET"],
    )


async def public_auth_config(db: AsyncSession) -> Dict[str, str]:
    values = await _effective(db)
    return {
        definition.public_name: values[key]
        for key, definition in DEFINITIONS.items()
        if definition.public_name and values[key]
    }


def _describe(key: str, definition: SettingDefinition, row: Optional[InfraPlatformSetting]) -> dict:
    env_value = _env_value(definition)
    source = "console" if row else ("environment" if env_value else "unset")
    item = {"key": key, "secret": definition.secret, "source": source, "configured": source != "unset"}
    if row:
        item["updatedAt"] = row.updated_at.isoformat() if row.updated_at else None
    if not definition.secret:
        item["value"] = row.value if row else env_value
    return item


async def describe_settings(db: AsyncSession) -> dict:
    rows = {r.key: r for r in (await db.execute(select(InfraPlatformSetting))).scalars().all()}
    return {
        "vaultReady": key_vault.is_configured(),
        "settings": [_describe(key, definition, rows.get(key)) for key, definition in DEFINITIONS.items()],
    }


def _validated(key: str, value: str) -> str:
    definition = DEFINITIONS.get(key)
    if definition is None:
        raise InvalidSetting(f"{key} cannot be changed here")
    cleaned = value.strip()
    if not re.fullmatch(definition.pattern, cleaned):
        raise InvalidSetting(f"{key} is not in the expected format")
    return cleaned


async def update_settings(db: AsyncSession, values: Dict[str, Optional[str]], actor_id: str, ip: str) -> dict:
    """Apply changes all or nothing. A null value clears the override."""
    from app.modules.infra.service import AuditLog

    # Validate everything before touching a row, so one bad field changes nothing.
    prepared: Dict[str, Optional[str]] = {}
    for key, value in values.items():
        if key not in DEFINITIONS:
            raise InvalidSetting(f"{key} cannot be changed here")
        if value is None:
            prepared[key] = None
            continue
        cleaned = _validated(key, value)
        if DEFINITIONS[key].secret:
            if not key_vault.is_configured():
                raise InvalidSetting("The key vault is not configured, so secrets can't be saved")
            cleaned = json.dumps(key_vault.seal(cleaned, _VAULT_SCOPE))
        prepared[key] = cleaned

    for key, value in prepared.items():
        row = await db.get(InfraPlatformSetting, key)
        if value is None:
            if row:
                await db.delete(row)
        elif row:
            row.value = value
            row.updated_by = actor_id
            row.updated_at = utc_now()
        else:
            db.add(InfraPlatformSetting(key=key, value=value, updated_by=actor_id, updated_at=utc_now()))

    db.add(AuditLog(
        actor_id=actor_id,
        action="PLATFORM_SETTINGS_UPDATED",
        resource_type="INFRA_SETTINGS",
        resource_id="sign-in",
        # Names only: values, secret or not, stay out of the audit trail.
        metadata_=json.dumps({"changed": sorted(k for k, v in prepared.items() if v is not None),
                              "cleared": sorted(k for k, v in prepared.items() if v is None)}),
        ip=ip,
        result="SUCCESS",
    ))
    await db.commit()
    _reset_cache()
    return await describe_settings(db)
