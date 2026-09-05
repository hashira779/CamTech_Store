"""Read-only audit of drift between SQLAlchemy models and the Postgres public schema.

Usage (from services/backend-py):
    PYTHONPATH=. python scripts/schema_audit.py

Makes NO changes to the database. Exit code is non-zero when critical drift is
found, so it can be wired into CI as a guard against model/DB divergence.
"""
import asyncio
import os
import sys

# Ensure services/backend-py root is in sys.path when run as a standalone script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg

from app.core.config import settings
from app.core.database import Base
import app.models.entities  # noqa: F401  (import populates Base.metadata)


def dsn() -> str:
    u = settings.DATABASE_URL
    u = u.replace("postgresql+asyncpg://", "postgresql://", 1)
    return u.split("?")[0]


async def main() -> int:
    conn = await asyncpg.connect(dsn())
    rows = await conn.fetch(
        """
        select table_name, column_name, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public'
        order by table_name, ordinal_position
        """
    )
    await conn.close()

    db: dict[str, dict[str, dict]] = {}
    for r in rows:
        db.setdefault(r["table_name"], {})[r["column_name"]] = {
            "nullable": r["is_nullable"] == "YES",
            "default": r["column_default"],
        }

    models = {t.name: t for t in Base.metadata.tables.values()}
    print(f"DB public tables: {len(db)} | SQLAlchemy models: {len(models)}\n")

    critical = []
    warn = []

    for tname in sorted(models):
        mcols = {c.name: c for c in models[tname].columns}
        if tname not in db:
            critical.append(tname)
            print(f"### {tname}: !! TABLE MISSING IN DB (model exists, no table)")
            continue
        dcols = db[tname]
        model_only = [c for c in mcols if c not in dcols]
        db_only = [c for c in dcols if c not in mcols]
        insert_breaking = [
            c for c in db_only if not dcols[c]["nullable"] and dcols[c]["default"] is None
        ]
        if not model_only and not insert_breaking:
            if db_only:
                warn.append(tname)
            continue
        print(f"### {tname}  -> CRITICAL (writes broken)")
        if model_only:
            print(f"    model has, DB lacks (any read/write touching these 500s): {model_only}")
        if insert_breaking:
            print(f"    DB requires (NOT NULL, no default) but model omits (inserts fail): {insert_breaking}")
        nullable_only = [c for c in db_only if c not in insert_breaking]
        if nullable_only:
            print(f"    DB has, model ignores (nullable/defaulted - OK for now): {nullable_only}")
        print()
        critical.append(tname)

    print("\n================ SUMMARY ================")
    print(f"CRITICAL (write paths broken): {len(critical)} tables")
    for t in critical:
        print(f"   - {t}")
    print(f"WARN (extra nullable DB cols only): {len(warn)} tables")
    db_only_tables = [t for t in db if t not in models]
    print(f"DB tables with NO SQLAlchemy model ({len(db_only_tables)}): {sorted(db_only_tables)}")

    return 1 if critical else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
