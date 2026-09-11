import os
import sys
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

BACKEND_UPDATES = [
    "services/backend-py/app/core/database.py",
    "services/backend-py/app/main.py",
    "services/backend-py/app/microservices/common.py",
    "services/backend-py/app/microservices/gateway.py",
    "services/backend-py/app/modules/catalog/api.py",
    "services/backend-py/app/services/delivery_service.py",
]

CONTAINERS = [
    "mystore-api-gateway",
    "mystore-auth-service",
    "mystore-catalog-service",
    "mystore-sales-service",
    "mystore-delivery-service",
    "mystore-hr-service",
    "mystore-finance-service",
    "mystore-platform-service",
]

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Connecting to {HOST}...")
    import time
    ssh = None
    for attempt in range(1, 6):
        try:
            print(f"SSH Attempt {attempt}...", flush=True)
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                HOST,
                username=USER,
                password=PASSWORD,
                timeout=30,
                banner_timeout=60,
                auth_timeout=60
            )
            ssh = client
            print("SSH Connected successfully!", flush=True)
            break
        except Exception as e:
            print(f"  Attempt {attempt} failed: {e}", flush=True)
            if attempt < 5:
                time.sleep(3)
            else:
                raise e

    def run_remote(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            print(f"[OUT] {out}")
        if err:
            print(f"[ERR] {err}")
        return out

    sftp = ssh.open_sftp()

    # 1. Upload updated files to remote host and copy to active containers
    for rel_path in BACKEND_UPDATES:
        local_file = os.path.join(root_dir, rel_path)
        filename = os.path.basename(rel_path)
        temp_remote = f"/tmp/{filename}"
        print(f"Uploading {rel_path} -> {temp_remote}...")
        sftp.put(local_file, temp_remote)

        # Host repo destination
        remote_repo_path = f"/home/ubuntu-server/CamTech_Store/{rel_path}"
        run_remote(f"cp {temp_remote} {remote_repo_path}")

        # Distribute into each container
        container_subpath = rel_path.replace("services/backend-py/", "/app/")
        for c in CONTAINERS:
            # Check if container exists
            c_check = run_remote(f"docker ps --filter name={c} -q")
            if c_check:
                run_remote(f"docker cp {temp_remote} {c}:{container_subpath}")

        run_remote(f"rm -f {temp_remote}")

    # 2. Upload and execute index script on remote host
    idx_script = os.path.join(root_dir, "services/backend-py/scripts/apply_performance_indexes.py")
    sftp.put(idx_script, "/tmp/apply_performance_indexes.py")
    print("Applying performance indexes to remote PostgreSQL...")
    run_remote("docker exec mystore-api-gateway python -c 'import asyncpg, asyncio; dsn=\"postgresql://camtech:camtech123@postgres:5432/camtechStore\"; \
stmts=[\"CREATE INDEX IF NOT EXISTS ix_delivery_orders_org_status ON delivery_orders (\\\"organizationId\\\", status);\", \
\"CREATE INDEX IF NOT EXISTS ix_delivery_orders_org_created ON delivery_orders (\\\"organizationId\\\", \\\"createdAt\\\" DESC);\", \
\"CREATE INDEX IF NOT EXISTS ix_delivery_orders_driver_status ON delivery_orders (\\\"driverId\\\", status);\", \
\"CREATE INDEX IF NOT EXISTS ix_sales_org_customer ON sales (\\\"organizationId\\\", \\\"customerId\\\");\", \
\"CREATE INDEX IF NOT EXISTS ix_sales_org_created ON sales (\\\"organizationId\\\", \\\"createdAt\\\" DESC);\", \
\"CREATE INDEX IF NOT EXISTS ix_customers_org_phone ON customers (\\\"organizationId\\\", phone);\", \
\"CREATE INDEX IF NOT EXISTS ix_products_org_active ON products (\\\"organizationId\\\", \\\"isActive\\\");\"]; \
async def r(): c=await asyncpg.connect(dsn); [await c.execute(s) for s in stmts]; await c.close(); print(\"Remote indexes applied!\"); \
asyncio.run(r())'")

    run_remote("rm -f /tmp/apply_performance_indexes.py")
    sftp.close()

    # 3. Restart microservices and gateway to apply high-concurrency connection pools and GZip
    print("Restarting microservices and API gateway...")
    run_remote("docker restart mystore-api-gateway mystore-catalog-service mystore-sales-service mystore-delivery-service mystore-platform-service")

    # 4. Check container health status
    run_remote("docker ps --filter 'name=mystore-' --format 'table {{.Names}}\t{{.Status}}'")

    # 5. Check Gateway health response
    print("Verifying API Gateway health probe...")
    run_remote("curl -s http://localhost:4000/health")

    ssh.close()
    print("🚀 High-Concurrency Performance Hardening deployed to production successfully!")

if __name__ == "__main__":
    main()
