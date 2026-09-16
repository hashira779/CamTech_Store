# ==============================================================================
# Passkey (WebAuthn) Relying Party configuration
# ==============================================================================
# A passkey is permanently bound to the Relying Party ID it was created under,
# and an RP ID must be a registrable suffix of the page's origin. The platform
# runs on sibling subdomains, so the RP ID choice decides which apps a single
# passkey can unlock:
#
#   STAFF      rp_id "camtech.cam"       — one passkey for adminconsol, pos,
#                                          cashier, delivery, hr and ceo. Staff
#                                          register once and sign in anywhere.
#   STOREFRONT rp_id "store.camtech.cam" — customers get their own RP, so a
#                                          shopper credential can never satisfy
#                                          a staff ceremony.
#
# The storefront deliberately does NOT use the camtech.cam apex even though it
# is served there: the apex is the staff RP, and reusing it would collapse the
# customer/staff separation this split exists to enforce. Passkey login on the
# storefront therefore only works via store.camtech.cam.
#
# Which RP a ceremony uses is derived from the caller's Origin header rather
# than a client-supplied field, so a caller cannot pick its own RP.
# ==============================================================================

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urlparse


@dataclass(frozen=True)
class RelyingParty:
    key: str
    rp_id: str
    name: str
    # Exact origins (scheme + host + port) permitted to run a ceremony for this
    # RP. WebAuthn requires the verifier to pin the origin; a suffix match is
    # not good enough, so these are compared literally.
    origins: List[str] = field(default_factory=list)


def _split_env(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


_ROOT_DOMAIN = os.getenv("PASSKEY_ROOT_DOMAIN", "camtech.cam")
_RP_NAME = os.getenv("PASSKEY_RP_NAME", "CamTech Store")

STAFF = RelyingParty(
    key="staff",
    rp_id=os.getenv("PASSKEY_RP_ID_STAFF", _ROOT_DOMAIN),
    name=f"{_RP_NAME} (Staff)",
    origins=_split_env(
        "PASSKEY_ORIGINS_STAFF",
        ",".join(
            [
                f"https://adminconsol.{_ROOT_DOMAIN}",
                f"https://pos.{_ROOT_DOMAIN}",
                f"https://cashier.{_ROOT_DOMAIN}",
                f"https://delivery.{_ROOT_DOMAIN}",
                f"https://driver.{_ROOT_DOMAIN}",
                f"https://hr.{_ROOT_DOMAIN}",
                f"https://ceo.{_ROOT_DOMAIN}",
            ]
        ),
    ),
)

STOREFRONT = RelyingParty(
    key="storefront",
    rp_id=os.getenv("PASSKEY_RP_ID_STOREFRONT", f"store.{_ROOT_DOMAIN}"),
    name=f"{_RP_NAME}",
    origins=_split_env("PASSKEY_ORIGINS_STOREFRONT", f"https://store.{_ROOT_DOMAIN}"),
)

# Local development: browsers treat http://localhost as a secure context, and
# "localhost" is a valid RP ID. Every dev port shares one RP so a passkey
# registered on the admin console dev server also works on the others.
_DEV_ORIGINS = _split_env(
    "PASSKEY_ORIGINS_DEV",
    ",".join(
        [
            "http://localhost:5001",
            "http://localhost:5002",
            "http://localhost:5003",
            "http://localhost:5004",
            "http://localhost:5005",
            "http://localhost:5008",
            "http://localhost:4000",
            "http://127.0.0.1:5002",
        ]
    ),
)

DEV = RelyingParty(
    key="dev",
    rp_id=os.getenv("PASSKEY_RP_ID_DEV", "localhost"),
    name=f"{_RP_NAME} (Dev)",
    origins=_DEV_ORIGINS,
)


def _registry() -> Dict[str, RelyingParty]:
    parties = {STAFF.key: STAFF, STOREFRONT.key: STOREFRONT}
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        parties[DEV.key] = DEV
    return parties


def resolve_relying_party(origin: Optional[str]) -> Optional[RelyingParty]:
    """Map a request's Origin header to the RP that owns it.

    Returns None for an unknown or missing origin, which callers must treat as
    a rejected ceremony — falling back to a default RP would let an unlisted
    origin mint credentials under the staff RP.
    """
    if not origin:
        return None

    normalized = origin.strip().rstrip("/")
    for party in _registry().values():
        if normalized in party.origins:
            return party

    # Accept any localhost port outside production: dev servers move around and
    # enumerating every port in config is a losing game.
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        try:
            host = (urlparse(normalized).hostname or "").lower()
        except ValueError:
            return None
        if host in ("localhost", "127.0.0.1"):
            return DEV

    return None


def relying_party_by_key(key: str) -> Optional[RelyingParty]:
    return _registry().get(key)
