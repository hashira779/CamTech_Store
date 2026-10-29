"""
Merchant secret vault — envelope encryption for per-store payment credentials.

Each secret is sealed with its own random 256-bit data key (DEK) under AES-256-GCM; the DEK is
then wrapped by the master key (KEK) with AES-256-GCM. Only the wrapped DEK, IVs, auth tags and
ciphertext are stored. The organization id is bound as additional authenticated data (AAD) on both
layers, so a sealed secret copied into another store's record fails authentication: branch A can
never open branch B's keys.

The KEK comes from the environment only (`PAYMENT_KEK`, base64 of 32 random bytes), or from a
KMS/Vault agent that injects it there. With no KEK configured the vault fails closed.
"""
import base64
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENVELOPE_VERSION = 1
_TAG_LEN = 16


class VaultUnavailable(RuntimeError):
    """No usable master key: secrets can be neither sealed nor opened."""


class VaultIntegrityError(ValueError):
    """A sealed secret failed authentication (tampered, or bound to another organization)."""


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _unb64(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def _kek() -> bytes:
    from app.core.config import settings

    raw = (getattr(settings, "PAYMENT_KEK", "") or os.getenv("PAYMENT_KEK", "")).strip()
    if not raw:
        raise VaultUnavailable("PAYMENT_KEK is not configured")
    try:
        key = base64.b64decode(raw, validate=True)
    except Exception as e:
        raise VaultUnavailable("PAYMENT_KEK must be base64 of 32 random bytes") from e
    if len(key) != 32:
        raise VaultUnavailable("PAYMENT_KEK must decode to exactly 32 bytes (AES-256)")
    return key


def is_configured() -> bool:
    try:
        _kek()
        return True
    except VaultUnavailable:
        return False


def _split(sealed: bytes):
    return sealed[:-_TAG_LEN], sealed[-_TAG_LEN:]


def seal(plaintext: str, organization_id: str) -> dict:
    """Encrypts a secret for one organization. Returns a JSON-safe envelope."""
    if not plaintext:
        raise ValueError("Nothing to seal")
    aad = organization_id.encode("utf-8")
    dek = AESGCM.generate_key(bit_length=256)

    iv = os.urandom(12)
    ct, tag = _split(AESGCM(dek).encrypt(iv, plaintext.encode("utf-8"), aad))

    dek_iv = os.urandom(12)
    wrapped, dek_tag = _split(AESGCM(_kek()).encrypt(dek_iv, dek, aad))

    return {
        "v": ENVELOPE_VERSION,
        "alg": "AES-256-GCM",
        "encryptedKey": _b64(ct),
        "iv": _b64(iv),
        "authTag": _b64(tag),
        "wrappedDek": _b64(wrapped),
        "dekIv": _b64(dek_iv),
        "dekAuthTag": _b64(dek_tag),
        "last4": plaintext[-4:] if len(plaintext) >= 8 else "",
    }


def open_sealed(envelope: dict, organization_id: str) -> str:
    """Decrypts an envelope produced by `seal` for the same organization."""
    if not isinstance(envelope, dict) or envelope.get("v") != ENVELOPE_VERSION:
        raise VaultIntegrityError("Unsupported or missing secret envelope")
    aad = organization_id.encode("utf-8")
    try:
        dek = AESGCM(_kek()).decrypt(
            _unb64(envelope["dekIv"]), _unb64(envelope["wrappedDek"]) + _unb64(envelope["dekAuthTag"]), aad
        )
        pt = AESGCM(dek).decrypt(
            _unb64(envelope["iv"]), _unb64(envelope["encryptedKey"]) + _unb64(envelope["authTag"]), aad
        )
    except VaultUnavailable:
        raise
    except Exception as e:
        raise VaultIntegrityError("Secret failed authentication") from e
    return pt.decode("utf-8")


def mask(envelope: Optional[dict], prefix: str = "bk_live_") -> Optional[str]:
    """Display-safe placeholder for a stored secret (never the secret itself)."""
    if not envelope:
        return None
    tail = envelope.get("last4") if isinstance(envelope, dict) else ""
    return f"{prefix}••••••••{tail or ''}"
