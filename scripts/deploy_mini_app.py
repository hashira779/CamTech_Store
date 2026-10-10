#!/usr/bin/env python3
"""
Deploy Standalone Telegram Mini App Storefront to Production VPS (10.1.0.11).
Safely uploads apps/mini/dist, builds/starts the dedicated mystore-mini-app container
on port 5007, updates Nginx configuration, and tests endpoints.
"""

import os
import sys
import tarfile
from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.camtech import get_config, ssh_run

def deploy():
    mini_dist = ROOT / "apps" / "mini" / "dist"
    if not mini_dist.exists() or not (mini_dist / "index.html").exists():
        print("❌ Error: apps/mini/dist does not exist or missing index.html. Run `pnpm --filter @mystore/mini build` first.")
        sys.exit(1)

    class DummyArgs:
        host = None

    cfg = get_config(DummyArgs())
    host, user, password, key = cfg

    if not password and not key:
        print("❌ Error: No CAMTECH_PASS or CAMTECH_KEY configured.")
        sys.exit(1)

    print(f"📦 Packaging apps/mini/dist into tarball...", flush=True)
    tar_path = ROOT / "mini_dist.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(mini_dist, arcname="dist")

    print(f"🚀 Connecting to {host} via SFTP...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=30)
    sftp = client.open_sftp()

    # Upload tarball and configs to staging directory owned by ubuntu-server
    print("Uploading tarball and config files to staging directory...", flush=True)
    staging_dir = "/home/ubuntu-server/mini_staging"
    try:
        sftp.mkdir(staging_dir)
    except Exception:
        pass

    remote_tar = f"{staging_dir}/mini_dist.tar.gz"
    sftp.put(str(tar_path), remote_tar)
    sftp.put(str(ROOT / "deploy" / "nginx" / "tma.conf"), f"{staging_dir}/tma.conf")
    sftp.put(str(ROOT / "deploy" / "nginx" / "nginx.conf"), f"{staging_dir}/nginx.conf")
    sftp.put(str(ROOT / "apps" / "Dockerfile.prod"), f"{staging_dir}/Dockerfile.prod")
    sftp.put(str(ROOT / "docker-compose.prod.yml"), f"{staging_dir}/docker-compose.prod.yml")

    sftp.close()
    client.close()

    # Clean local tar
    if tar_path.exists():
        tar_path.unlink()

    # Execute remote deployment (runs with sudo via ssh_run)
    print("🔄 Deploying mystore-mini-app container on server...", flush=True)
    remote_script = [
        "mkdir -p /home/ubuntu-server/CamTech_Store/apps/mini",
        "rm -rf /home/ubuntu-server/CamTech_Store/apps/mini/dist",
        "tar -xzf /home/ubuntu-server/mini_staging/mini_dist.tar.gz -C /home/ubuntu-server/CamTech_Store/apps/mini",
        "cp -f /home/ubuntu-server/mini_staging/tma.conf /home/ubuntu-server/CamTech_Store/deploy/nginx/tma.conf",
        "cp -f /home/ubuntu-server/mini_staging/nginx.conf /home/ubuntu-server/CamTech_Store/deploy/nginx/nginx.conf",
        "cp -f /home/ubuntu-server/mini_staging/Dockerfile.prod /home/ubuntu-server/CamTech_Store/apps/Dockerfile.prod",
        "cp -f /home/ubuntu-server/mini_staging/docker-compose.prod.yml /home/ubuntu-server/CamTech_Store/docker-compose.prod.yml",
        "rm -rf /home/ubuntu-server/mini_staging",
        "cd /home/ubuntu-server/CamTech_Store && docker compose -f docker-compose.prod.yml up -d --build --no-deps --force-recreate mini-app",
        "docker exec mystore-nginx-ingress nginx -t && docker exec mystore-nginx-ingress nginx -s reload || true",
        "sleep 2",
        "curl -sI http://127.0.0.1:5007 | head -n 5 || true",
        "docker ps --filter name=mystore-mini-app --format 'Container: {{.Names}} | Status: {{.Status}} | Ports: {{.Ports}}'",
    ]

    ssh_run(host, user, password, key, remote_script)
    print("🎉 Standalone Telegram Mini App Storefront deployed successfully!", flush=True)

if __name__ == "__main__":
    deploy()
