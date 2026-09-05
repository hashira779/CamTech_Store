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

            # 3b. Ensure baseline admin users exist for integration tests
            org_row = (await conn.execute(text("SELECT id FROM organizations LIMIT 1;"))).fetchone()
            org_id = org_row[0] if org_row else "cmtk8h18o0000vkd0etmdacgw"

            from app.core.security import hash_password
            demo_hash = hash_password("Admin123!")
            
            # Ensure roles exist
            await conn.execute(text("""
                INSERT INTO roles (name) VALUES ('SUPER_ADMIN'), ('ORG_ADMIN') ON CONFLICT DO NOTHING;
            """))
            
            await conn.execute(text("""
                INSERT INTO users (id, "organizationId", email, name, "passwordHash", roles, "isActive", "createdAt", "updatedAt")
                VALUES 
                    ('cmtn25sfi000avk64ixp9mumd', :org_id, 'admin@demo.test', 'Enterprise Admin', :demo_hash, '["SUPER_ADMIN", "ORG_ADMIN"]', true, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET 
                    "passwordHash" = EXCLUDED."passwordHash",
                    "organizationId" = EXCLUDED."organizationId",
                    "isActive" = true;
            """), {"org_id": org_id, "demo_hash": demo_hash})
            
            user_row = (await conn.execute(text("SELECT id FROM users WHERE email = 'admin@demo.test';"))).fetchone()
            actual_user_id = user_row[0]
            
            await conn.execute(text("""
                INSERT INTO user_roles ("userId", "roleName") VALUES 
                    (:user_id, 'SUPER_ADMIN'),
                    (:user_id, 'ORG_ADMIN')
                ON CONFLICT DO NOTHING;
            """), {"user_id": actual_user_id})

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
