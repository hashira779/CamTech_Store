import pytest
import pytest_asyncio
from sqlalchemy import text
from app.core.database import engine, Base
from app.core.db_enums import ENUM_LABELS

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

            # 3. Ensure primary test organization exists
            await conn.execute(text("""
                INSERT INTO organizations (id, name, slug, "isActive", "createdAt", "updatedAt")
                VALUES ('cmtn25rqc0000vk64wgyfvaov', 'Global Enterprise Group', 'enterprise-group', true, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """))
    except Exception as exc:
        print(f"[conftest] Note: Test database initialization skipped or already present: {exc}")

    yield

    try:
        await engine.dispose()
    except Exception:
        pass
