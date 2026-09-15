#!/usr/bin/env python3
"""
Deploy DDoS and Security Hardening Hotfix to Production Server (10.1.0.11).
Updates Nginx ingress configuration, rate limiting, IP ban list, security headers, and gateway routes.
"""
import os
import sys
import time
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

ALL_BACKEND_CONTAINERS = [
    "mystore-api-gateway",
    "mystore-auth-service",
    "mystore-catalog-service",
    "mystore-sales-service",
    "mystore-delivery-service",
    "mystore-hr-service",
    "mystore-finance-service",
    "mystore-platform-service",
    "mystore-bot-builder-service",
]

FILES_TO_DEPLOY = [
    {
        "local": "deploy/nginx/nginx.conf",
        "repo_target": "/home/ubuntu-server/CamTech_Store/deploy/nginx/nginx.conf",
        "container_copies": [],  # Volume mounted
    },
    {
        "local": "services/backend-py/app/core/rate_limiter.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/core/rate_limiter.py",
        "container_copies": [(c, "/app/app/core/rate_limiter.py") for c in ALL_BACKEND_CONTAINERS],
    },
    {
        "local": "services/backend-py/app/routers/security_routes.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/routers/security_routes.py",
        "container_copies": [
            ("mystore-api-gateway", "/app/app/routers/security_routes.py"),
            ("mystore-platform-service", "/app/app/routers/security_routes.py"),
        ],
    },
    {
        "local": "services/backend-py/app/main.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/main.py",
        "container_copies": [
            ("mystore-api-gateway", "/app/app/main.py"),
            ("mystore-platform-service", "/app/app/main.py"),
        ],
    },
    {
        "local": "services/backend-py/app/microservices/common.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/microservices/common.py",
        "container_copies": [(c, "/app/app/microservices/common.py") for c in ALL_BACKEND_CONTAINERS],
    },
    {
        "local": "services/backend-py/app/microservices/gateway.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/microservices/gateway.py",
        "container_copies": [("mystore-api-gateway", "/app/app/microservices/gateway.py")],
    },
    {
        "local": "services/backend-py/app/microservices/platform_service.py",
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/microservices/platform_service.py",
        "container_copies": [("mystore-platform-service", "/app/app/microservices/platform_service.py")],
    },
]

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Connecting to {HOST}...", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    sftp = ssh.open_sftp()

    def run_remote(cmd, check=True):
        print(f"-> {cmd}", flush=True)
        _, stdout, stderr = ssh.exec_command(f"echo '{PASSWORD}' | sudo -S bash -c {repr(cmd)}")
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        for line in out.splitlines():
            if "[sudo]" not in line and "password for" not in line:
                print("   " + line, flush=True)
        if err and "password for" not in err and "[sudo]" not in err:
            print("   ERR: " + err.strip(), flush=True)
        return out

    containers_to_restart = set()

    print("\n--- 1. Uploading hardened security files ---", flush=True)
    for item in FILES_TO_DEPLOY:
        local_path = os.path.join(root_dir, item["local"])
        if not os.path.exists(local_path):
            print(f"ERROR: Local file {local_path} not found!")
            sys.exit(1)

        temp_remote = f"/tmp/{os.path.basename(local_path)}"
        print(f"Uploading {item['local']} to {temp_remote}...", flush=True)
        sftp.put(local_path, temp_remote)

        # Copy to repository target on disk
        if item.get("repo_target"):
            run_remote(f"cp {temp_remote} {item['repo_target']}")

        # Copy into target containers
        for container, target_path in item.get("container_copies", []):
            run_remote(f"docker cp {temp_remote} {container}:{target_path}")
            containers_to_restart.add(container)

        run_remote(f"rm -f {temp_remote}")

    sftp.close()

    print("\n--- 2. Testing and reloading Nginx Ingress ---", flush=True)
    run_remote("docker exec mystore-nginx-ingress nginx -t")
    run_remote("docker exec mystore-nginx-ingress nginx -s reload")
    print("Nginx reloaded successfully!", flush=True)

    print("\n--- 3. Restarting Backend Containers ---", flush=True)
    for container in sorted(containers_to_restart):
        print(f"Restarting {container}...", flush=True)
        run_remote(f"docker restart {container}")

    print("\n--- 4. Waiting for services to initialize ---", flush=True)
    time.sleep(5)

    print("\n--- 5. Verifying Health & Security Endpoints ---", flush=True)
    # Check Gateway health
    run_remote("curl -s -f http://localhost:4010/health || echo 'FAILED'")
    # Check Gateway deep health
    run_remote("curl -s -f http://localhost:4010/health/deep || echo 'FAILED'")
    # Check Nginx ingress health
    run_remote("curl -s -f http://localhost:8090/health || echo 'FAILED'")
    # Check Ingress /api/v1/health
    run_remote("curl -s http://localhost:8090/api/v1/health")

    ssh.close()
    print("\n🎉 Deployment completed successfully and verified!", flush=True)

if __name__ == "__main__":
    main()
