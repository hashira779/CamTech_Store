"""
Migration: Add world-class e-commerce category columns.
Adds slug, icon, imageUrl, level, sortOrder, isActive, seoTitle, seoDescription, productCount
to the categories table. Also adds parentId FK constraint.

Run with: python scripts/migrate_category_columns.py
"""
import os
import psycopg2

raw_url = os.getenv("DATABASE_URL", "postgresql://camtech:camtech123@localhost:5432/camtechStore")
DB_URL = raw_url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

MIGRATION_SQL = """
-- Add new category columns (all nullable or defaulted — backward compatible)
DO $$
BEGIN
    -- slug
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'slug') THEN
        ALTER TABLE categories ADD COLUMN slug VARCHAR(120);
    END IF;
    -- icon
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'icon') THEN
        ALTER TABLE categories ADD COLUMN icon VARCHAR(64);
    END IF;
    -- imageUrl
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'imageUrl') THEN
        ALTER TABLE categories ADD COLUMN "imageUrl" VARCHAR(500);
    END IF;
    -- level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'level') THEN
        ALTER TABLE categories ADD COLUMN level INTEGER NOT NULL DEFAULT 0;
    END IF;
    -- sortOrder
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'sortOrder') THEN
        ALTER TABLE categories ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
    END IF;
    -- isActive
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'isActive') THEN
        ALTER TABLE categories ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    -- seoTitle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'seoTitle') THEN
        ALTER TABLE categories ADD COLUMN "seoTitle" VARCHAR(200);
    END IF;
    -- seoDescription
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'seoDescription') THEN
        ALTER TABLE categories ADD COLUMN "seoDescription" TEXT;
    END IF;
    -- productCount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'productCount') THEN
        ALTER TABLE categories ADD COLUMN "productCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add self-referential FK on parentId if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'categories_parentId_fkey'
          AND table_name = 'categories'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT "categories_parentId_fkey"
            FOREIGN KEY ("parentId") REFERENCES categories(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Backfill slugs from name for existing categories
UPDATE categories
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^\\w\\s-]', '', 'g'), '[\\s_]+', '-', 'g'))
WHERE slug IS NULL;

-- Backfill product counts
UPDATE categories c
SET "productCount" = (
    SELECT COUNT(*) FROM products p WHERE p."categoryId" = c.id
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug_org ON categories (slug, "organizationId");
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories ("parentId");
"""


def run_migration():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Running category schema migration...")
    cur.execute(MIGRATION_SQL)
    print("✅ Migration complete.")

    # Verify
    cur.execute('SELECT id, name, slug, level, "sortOrder", "isActive", "productCount" FROM categories ORDER BY name')
    rows = cur.fetchall()
    print(f"\nCategories after migration ({len(rows)} total):")
    for r in rows:
        print(f"  {r[1]:30s}  slug={r[2]}  level={r[3]}  sort={r[4]}  active={r[5]}  products={r[6]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
