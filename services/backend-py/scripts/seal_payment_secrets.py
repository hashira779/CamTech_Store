"""
One-off data migration: move plaintext merchant payment secrets into the key vault.

  - organizations.settings.bakong.token      -> bakong.tokenSealed   (plaintext removed)
  - payway_configs.publicKey / rsaPrivateKey -> vault envelope JSON  (in place)

Requires PAYMENT_KEK. Idempotent: already-sealed values are skipped. Default is a dry run;
pass --apply to write. Writes one audit_logs row per store changed.

    PAYMENT_KEK=... DATABASE_URL=... python services/backend-py/scripts/seal_payment_secrets.py [--apply]
"""
import asyncio
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select  # noqa: E402

from app.core import key_vault  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.datetime_utils import utc_now  # noqa: E402
from app.models import entities  # noqa: E402,F401  full model registry
from app.models.entities import AuditLog  # noqa: E402
from app.modules.organizations.models import Organization, PaywayConfig  # noqa: E402
from app.modules.organizations.payment_config import parse_sealed_column  # noqa: E402


def _is_envelope(value) -> bool:
    if isinstance(value, dict):
        return value.get("v") == key_vault.ENVELOPE_VERSION
    try:
        return isinstance(value, str) and json.loads(value).get("v") == key_vault.ENVELOPE_VERSION
    except Exception:
        return False


async def main(apply: bool):
    if not key_vault.is_configured():
        sys.exit("PAYMENT_KEK is not configured; nothing can be sealed.")
    changed_orgs = 0
    async with AsyncSessionLocal() as db:
        for org in (await db.execute(select(Organization))).scalars():
            try:
                settings = json.loads(org.settings) if isinstance(org.settings, str) else (org.settings or {})
            except Exception:
                continue
            bakong = settings.get("bakong") if isinstance(settings, dict) else None
            fields = []
            if isinstance(bakong, dict) and bakong.get("token") and not bakong.get("tokenSealed"):
                bakong["tokenSealed"] = key_vault.seal(bakong["token"], org.id)
                fields.append("bakong.token")
            if isinstance(bakong, dict) and "token" in bakong:
                bakong.pop("token")
                settings["bakong"] = bakong
                org.settings = json.dumps(settings)

            pw = (await db.execute(select(PaywayConfig).where(PaywayConfig.organization_id == org.id))).scalar_one_or_none()
            if pw and pw.public_key and not _is_envelope(pw.public_key):
                pw.public_key = json.dumps(key_vault.seal(pw.public_key, org.id))
                fields.append("payway.apiKey")
            if pw and pw.rsa_private_key and not _is_envelope(pw.rsa_private_key):
                pw.rsa_private_key = json.dumps(key_vault.seal(pw.rsa_private_key, org.id))
                fields.append("payway.rsaPrivateKey")
            if pw and pw.public_key:
                assert parse_sealed_column(pw.public_key) is not None

            if fields:
                changed_orgs += 1
                print(f"{'SEAL' if apply else 'would seal'} {org.id} ({org.name}): {', '.join(fields)}")
                db.add(AuditLog(
                    id=str(uuid.uuid4()), organization_id=org.id, actor_id=None,
                    action="PAYMENT_CREDENTIAL_SEALED", resource_type="PaymentSecrets", resource_id=org.id,
                    metadata_=json.dumps({"fields": fields, "branchId": org.id, "by": "scripts/seal_payment_secrets.py"}),
                    ip=None, result="SUCCESS", created_at=utc_now(),
                ))
        if apply:
            await db.commit()
        else:
            await db.rollback()
    print(f"{changed_orgs} store(s) {'sealed' if apply else 'to seal (dry run; pass --apply)'}.")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
