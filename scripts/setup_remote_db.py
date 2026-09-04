import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import run_remote as r

script = """
cat << 'SQL' > /tmp/setup_store_user.sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'camtech_store') THEN
        CREATE USER camtech_store WITH PASSWORD 'camtech123';
    ELSE
        ALTER USER camtech_store WITH PASSWORD 'camtech123';
    END IF;
END
$$;
GRANT ALL PRIVILEGES ON DATABASE "camtechStore" TO camtech_store;
ALTER USER camtech_store WITH SUPERUSER;
SQL
docker cp /tmp/setup_store_user.sql camtech-postgres:/tmp/setup_store_user.sql
docker exec camtech-postgres psql -U camtech -d postgres -f /tmp/setup_store_user.sql
docker exec camtech-postgres psql -U camtech -d postgres -c '\du'
"""

r.exec_remote(script)
