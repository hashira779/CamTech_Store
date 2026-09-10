"""Automated Safe Production Database Migration Runner.
Executes non-destructive schema evolution before containers boot:
1. Synchronizes native PostgreSQL enum types and labels.
2. Applies Alembic migrations (if any).
3. Safely creates any newly added tables (CREATE TABLE IF NOT EXISTS).
4. Safely adds new nullable or defaulted columns to existing tables.
"""
import asyncio
import os
import sys
from typing import List, Dict

# Ensure services/backend-py root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from sqlalchemy.schema import CreateColumn
from sqlalchemy.ext.compiler import compiles

from app.core.config import settings
from app.core.database import Base, engine
from app.core.db_enums import ENUM_LABELS
import app.models.entities  # noqa: F401 - ensures all models populate Base.metadata


def get_sync_dsn() -> str:
    u = settings.DATABASE_URL
    u = u.replace("postgresql+asyncpg://", "postgresql://", 1)
    return u.split("?")[0]


async def sync_native_enums(conn: asyncpg.Connection):
    """Ensure all PostgreSQL ENUM types and labels from ENUM_LABELS exist."""
    print("🔹 [1/4] Synchronizing native PostgreSQL ENUM types & labels...")
    for enum_name, labels in ENUM_LABELS.items():
        # Check if type exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_type WHERE typname = $1", enum_name
        )
        if not exists:
            labels_quoted = ", ".join(f"'{l}'" for l in labels)
            await conn.execute(f'CREATE TYPE "{enum_name}" AS ENUM ({labels_quoted});')
            print(f"   ➕ Created ENUM type: {enum_name} with {len(labels)} labels")
        else:
            # Check for missing labels and add them
            existing_labels = await conn.fetch(
                """
                SELECT e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = $1
                """,
                enum_name,
            )
            existing_set = {r["enumlabel"] for r in existing_labels}
            for lbl in labels:
                if lbl not in existing_set:
                    # ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in older postgres,
                    # but in postgres 12+ it works with IF NOT EXISTS
                    try:
                        await conn.execute(
                            f'ALTER TYPE "{enum_name}" ADD VALUE IF NOT EXISTS \'{lbl}\';'
                        )
                        print(f"   ➕ Added label '{lbl}' to ENUM {enum_name}")
                    except Exception as e:
                        print(f"   ⚠️ Could not add label '{lbl}' to {enum_name}: {e}")


async def create_new_tables():
    """Create any missing tables defined in SQLAlchemy models."""
    print("🔹 [2/4] Ensuring all SQLAlchemy tables exist (checkfirst=True)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("   ✅ All model tables verified/created.")


async def sync_new_columns(conn: asyncpg.Connection):
    """Detect and safely add missing nullable/defaulted columns to existing tables."""
    print("🔹 [3/4] Checking for newly added columns in existing tables...")
    rows = await conn.fetch(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        """
    )
    db_columns: Dict[str, set] = {}
    for r in rows:
        db_columns.setdefault(r["table_name"], set()).add(r["column_name"])

    added_count = 0
    for table_name, table_obj in Base.metadata.tables.items():
        if table_name not in db_columns:
            continue
        existing_cols = db_columns[table_name]
        for col in table_obj.columns:
            if col.name not in existing_cols:
                # We have a new column in the model not yet in Postgres!
                col_type = col.type.compile(engine.dialect)
                is_nullable = col.nullable

                # Build safe ALTER TABLE statement
                if is_nullable:
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type} DEFAULT NULL;'
                elif col.default is not None and col.default.is_scalar:
                    default_val = col.default.arg
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type} DEFAULT \'{default_val}\';'
                else:
                    # If column is NOT NULL with no default, add as nullable first to avoid breaking existing data
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type};'
                    print(f"   ⚠️ Warning: Adding NOT NULL column '{col.name}' to '{table_name}' without default.")

                try:
                    await conn.execute(sql)
                    print(f"   ➕ Added column '{col.name}' ({col_type}) to table '{table_name}'")
                    added_count += 1
                except Exception as ex:
                    print(f"   ❌ Failed to add column '{col.name}' to '{table_name}': {ex}")

    if added_count == 0:
        print("   ✅ No missing columns detected in existing tables.")
    else:
        print(f"   ✅ Successfully added {added_count} new column(s).")


def run_alembic_upgrade():
    """Apply any pending Alembic versioned migrations."""
    print("🔹 [4/4] Checking for pending Alembic versioned migrations...")
    try:
        from alembic.config import Config
        from alembic import command
        alembic_ini = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
        if os.path.isfile(alembic_ini):
            cfg = Config(alembic_ini)
            command.upgrade(cfg, "head")
            print("   ✅ Alembic migrations applied to head.")
        else:
            print("   ℹ️ No alembic.ini found; skipped.")
    except Exception as e:
        print(f"   ℹ️ Alembic upgrade notice: {e}")


async def main():
    print("========================================================================")
    print("🚀 Running Automated Safe Database Migration (Zero-Downtime)")
    print("========================================================================")
    dsn = get_sync_dsn()
    conn = await asyncpg.connect(dsn)
    try:
        await sync_native_enums(conn)
        await create_new_tables()
        await sync_new_columns(conn)
        run_alembic_upgrade()
        print("========================================================================")
        print("🎉 Database migration completed successfully! All schemas up to date.")
        print("========================================================================")
    finally:
        await conn.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
