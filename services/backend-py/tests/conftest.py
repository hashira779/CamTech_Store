import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from app.core import database
from app.core.database import engine, Base
from app.core.db_enums import ENUM_LABELS

# Replace engine pool with NullPool for tests so asyncpg connections never cross event loops
database.engine.sync_engine.pool = NullPool(database.engine.sync_engine.pool._creator)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_database():
    """Initializes PostgreSQL enums, tables, and default organization for integration tests."""
    try:
        import app.models.entities  # Ensure all models are registered in Base.metadata

        async with engine.begin() as conn:
            # 1. Create native PostgreSQL enums if they do not exist
            for name, labels in ENUM_LABELS.items():
                quoted_labels = ", ".join(f"'{l}'" for l in labels)
                sql = f"""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                        CREATE TYPE "{name}" AS ENUM ({quoted_labels});
                    END IF;
                END $$;
                """
                await conn.execute(text(sql))

            # 2. Create tables
            await conn.run_sync(Base.metadata.create_all)

            # 3. Ensure primary test organizations exist
            await conn.execute(text("""
                INSERT INTO organizations (id, name, slug, "createdAt", "updatedAt")
                VALUES 
                    ('cmtn25rqc0000vk64wgyfvaov', 'Global Enterprise Group', 'enterprise-group', NOW(), NOW()),
                    ('cmtk8h18o0000vkd0etmdacgw', 'CamTech Enterprise Org', 'camtech-enterprise', NOW(), NOW())
                ON CONFLICT DO NOTHING;
            """))

        # 4. Seed test database with initial products, locations, and users
        try:
            from scripts.seed_data import seed
            await seed()
        except Exception as seed_err:
            print(f"[conftest] Seed notice: {seed_err}")
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise exc

    yield

    try:
        await engine.dispose()
    except Exception:
        pass
