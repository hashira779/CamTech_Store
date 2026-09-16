"""dynamic_rbac_primary_key

Revision ID: 4bb1163328b1
Revises: 211a671f4cb5
Create Date: 2026-09-16 23:53:31.346607

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4bb1163328b1'
down_revision: Union[str, Sequence[str], None] = '211a671f4cb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    
    # Safely ensure columns exist (auto_migrate might have added them without NOT NULL)
    op.execute('ALTER TABLE roles ADD COLUMN IF NOT EXISTS id VARCHAR;')
    op.execute('ALTER TABLE roles ADD COLUMN IF NOT EXISTS "organizationId" VARCHAR;')
    op.execute('ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB;')
    op.execute('ALTER TABLE roles ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN;')
    op.execute('ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS "roleId" VARCHAR;')
    
    # Generate UUIDs for existing roles
    op.execute('UPDATE roles SET id = md5(random()::text || clock_timestamp()::text)::uuid::varchar WHERE id IS NULL;')
    
    # Backfill permissions based on old hardcoded PERMISSIONS_MATRIX
    op.execute("""
        UPDATE roles SET permissions = '["*"]' WHERE name IN ('SUPER_ADMIN', 'ORG_ADMIN');
    """)
    op.execute("""
        UPDATE roles SET permissions = '["sales:read", "sales:write", "sales:refund", "catalog:read", "catalog:write", "inventory:read", "inventory:write", "users:read", "users:write", "reports:read", "delivery:read", "delivery:manage", "apps:read", "apps:write", "telegram:read", "telegram:write"]' WHERE name = 'MANAGER';
    """)
    op.execute("""
        UPDATE roles SET permissions = '["sales:read", "delivery:read", "delivery:manage", "inventory:read"]' WHERE name = 'DISPATCHER';
    """)
    op.execute("""
        UPDATE roles SET permissions = '["sales:read", "sales:write", "catalog:read", "inventory:read", "delivery:read"]' WHERE name = 'CASHIER';
    """)
    op.execute("""
        UPDATE roles SET permissions = '["delivery:read", "delivery:update_own"]' WHERE name = 'DELIVERY_DRIVER';
    """)
    op.execute("UPDATE roles SET permissions = '[]' WHERE permissions IS NULL;")
    op.execute('UPDATE roles SET "isSystem" = TRUE WHERE "isSystem" IS NULL;')
    
    # Backfill roleId in user_roles
    op.execute("""
        UPDATE user_roles SET "roleId" = roles.id 
        FROM roles WHERE user_roles."roleName" = roles.name;
    """)
    
    # Clean up constraints if they exist
    # (Since we are dropping old PKs and foreign keys, we use CASCADE to avoid constraint name issues)
    op.execute('ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_roleName_fkey;')
    op.execute('ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey CASCADE;')
    op.execute('ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_pkey CASCADE;')
    
    # Create new Primary Keys
    op.execute('ALTER TABLE roles ADD PRIMARY KEY (id);')
    op.execute('ALTER TABLE user_roles ADD PRIMARY KEY ("userId", "roleId");')
    
    # Re-add foreign keys
    op.execute('ALTER TABLE user_roles ADD CONSTRAINT user_roles_roleId_fkey FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE CASCADE;')
    
    # Drop old roleName column
    op.execute('ALTER TABLE user_roles DROP COLUMN IF EXISTS "roleName";')

def downgrade() -> None:
    """Downgrade schema."""
    pass
