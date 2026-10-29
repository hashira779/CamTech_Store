"""
Per-store payment configuration — the single source of truth for which online payment
methods a store can accept.

A store accepts ABA PayWay / NBC Bakong only with its OWN credentials. There is deliberately
no platform-level fallback merchant: an unconfigured store is COD-only, so a customer's
money can never land in an account that does not belong to the store.
"""
import json
import logging
from dataclasses import dataclass
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import key_vault
from .models import Organization, PaywayConfig

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaywayCredentials:
    merchant_id: str
    api_key: str
    is_production: bool


@dataclass(frozen=True)
class BakongCredentials:
    account_id: str
    account_type: str
    merchant_id: Optional[str]
    acquiring_bank: Optional[str]
    merchant_name: str
    merchant_city: str
    currency: str
    token: Optional[str]
    webhook_secret: Optional[str]


@dataclass(frozen=True)
class StorePaymentConfig:
    payway: Optional[PaywayCredentials]
    bakong: Optional[BakongCredentials]

    @property
    def methods(self) -> List[str]:
        """Payment methods a storefront may offer, in display order."""
        out = []
        if self.payway:
            out.append("ABA_PAYWAY")
        if self.bakong:
            out.append("BAKONG")
        out.append("COD")
        return out


def read_bakong_settings(org: Optional[Organization]) -> dict:
    """Returns the raw `settings.bakong` dict of an organization (empty when absent or malformed)."""
    if not org or not org.settings:
        return {}
    try:
        s_data = json.loads(org.settings) if isinstance(org.settings, str) else org.settings
    except Exception:
        return {}
    if not isinstance(s_data, dict):
        return {}
    cfg = s_data.get("bakong") or {}
    if not cfg and s_data.get("bakongAccountId"):
        cfg = {"accountId": s_data["bakongAccountId"]}
    return cfg if isinstance(cfg, dict) else {}


async def resolve_store_payment_config(db: AsyncSession, org_id: str) -> StorePaymentConfig:
    pw = (
        await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == org_id))
    ).scalar_one_or_none()
    payway = None
    if pw and pw.merchant_id and pw.merchant_id != "unconfigured":
        api_key = _open(parse_sealed_column(pw.public_key), "PayWay API key", org_id)
        if api_key:
            payway = PaywayCredentials(pw.merchant_id, api_key, bool(pw.is_production))

    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    b = read_bakong_settings(org)
    bakong = None
    if b.get("accountId") and b.get("enabled", True):
        bakong = BakongCredentials(
            account_id=b["accountId"],
            account_type=(b.get("accountType") or "INDIVIDUAL").upper(),
            merchant_id=b.get("merchantId") or None,
            acquiring_bank=b.get("acquiringBank") or None,
            merchant_name=b.get("merchantName") or (org.name if org else "") or "Store",
            merchant_city=b.get("merchantCity") or "Phnom Penh",
            currency=(b.get("currency") or "USD").upper(),
            token=open_store_secret(b, "token", org_id),
            webhook_secret=open_store_secret(b, "webhookSecret", org_id),
        )
    return StorePaymentConfig(payway=payway, bakong=bakong)


def open_store_secret(cfg: dict, name: str, org_id: str) -> Optional[str]:
    """
    Returns a store secret decrypted from its vault envelope (`<name>Sealed`).
    A secret that cannot be opened (no KEK, tampered, or sealed for another org) is treated as absent —
    the caller then fails closed. Legacy plaintext values are no longer honoured.
    """
    sealed = cfg.get(f"{name}Sealed")
    if not sealed and cfg.get(name):
        logger.warning("Ignoring legacy plaintext Bakong %s for org %s; run scripts/seal_payment_secrets.py", name, org_id)
    return _open(sealed, f"Bakong {name}", org_id)


def parse_sealed_column(value: Optional[str]) -> Optional[dict]:
    """A vault envelope stored as JSON text in a string column, or None for empty/legacy plaintext."""
    if not value:
        return None
    try:
        env = json.loads(value)
    except (TypeError, ValueError):
        logger.warning("Ignoring legacy plaintext payment secret; run scripts/seal_payment_secrets.py")
        return None
    return env if isinstance(env, dict) else None


def _open(sealed: Optional[dict], label: str, org_id: str) -> Optional[str]:
    if not sealed:
        return None
    try:
        return key_vault.open_sealed(sealed, org_id)
    except (key_vault.VaultUnavailable, key_vault.VaultIntegrityError) as e:
        logger.error("Cannot open %s for org %s: %s", label, org_id, e)
        return None
