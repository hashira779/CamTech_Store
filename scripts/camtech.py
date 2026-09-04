#!/usr/bin/env python3
"""
camtech — Unified Operations CLI for MyStore Platform & Production Server.

Adapted from CamTech Enterprise Standards.
Credentials come from environment variables or ~/.camtech_env.

Usage:
    python scripts/camtech.py status             # Show running containers, disk, memory, uptime
    python scripts/camtech.py logs <service>     # Tail logs (e.g. gateway, auth, admin, store, pos)
    python scripts/camtech.py health             # Test all production HTTP/API endpoints
    python scripts/camtech.py deploy             # Trigger remote zero-downtime deployment
    python scripts/camtech.py sync               # Ultra-fast local-to-remote file sync via SFTP
    python scripts/camtech.py exec "<command>"   # Run arbitrary remote bash command
"""

import argparse
import os
import sys
from pathlib import Path

# --- Configuration Loader ---

def load_env_file():
    """Load ~/.camtech_env if present."""
    env_file = Path.home() / ".camtech_env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))

def get_config(args):
    load_env_file()
    host = getattr(args, "host", None) or os.environ.get("CAMTECH_HOST", "10.1.0.11")
    user = os.environ.get("CAMTECH_USER", "ubuntu-server")
    password = os.environ.get("CAMTECH_PASS", "pTT!CT01")
    key_path = os.environ.get("CAMTECH_KEY")
    return host, user, password, key_path

# --- SSH Execution Helper ---

def ssh_run(host, user, password, key_path, commands, timeout=30, max_output=8000):
    try:
        import paramiko
    except ImportError:
        print("❌ paramiko not installed: run `pip install paramiko`")
        sys.exit(2)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {"username": user, "timeout": timeout}
    if key_path:
        connect_kwargs["key_filename"] = os.path.expanduser(key_path)
    else:
        connect_kwargs["password"] = password

    try:
        client.connect(host, **connect_kwargs)
        for cmd in commands:
            header = f"─── [{host}] {cmd} "
            print(f"\n{header}{'─' * max(0, 60 - len(header))}")
            full_cmd = f"echo '{password}' | sudo -S bash -c {repr(cmd)}" if password else f"bash -c {repr(cmd)}"
            _, stdout, stderr = client.exec_command(full_cmd, timeout=timeout, get_pty=True)
            out = stdout.read().decode(errors="replace").strip()
            err = stderr.read().decode(errors="replace").strip()
            if out:
                filtered_out = "\n".join(l for l in out.splitlines() if "[sudo]" not in l and "password for" not in l)
                if filtered_out:
                    print(filtered_out[:max_output])
            if err:
                filtered_err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password for" not in l)
                if filtered_err:
                    print("[stderr]", filtered_err[:1000])
    finally:
        client.close()

# --- Commands ---

def cmd_status(cfg, _args):
    host, user, password, key = cfg
    ssh_run(host, user, password, key, [
        "docker ps --filter name=mystore --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
        "df -h / | tail -1",
        "free -m | head -2",
        "uptime",
    ])

def cmd_logs(cfg, args):
    host, user, password, key = cfg
    target = args.service.lower()
    aliases = {
        "gateway": "mystore-api-gateway",
        "auth": "mystore-auth-service",
        "catalog": "mystore-catalog-service",
        "sales": "mystore-sales-service",
        "delivery": "mystore-delivery-service",
        "hr": "mystore-hr-service",
        "finance": "mystore-finance-service",
        "platform": "mystore-platform-service",
        "store": "mystore-store-app",
        "admin": "mystore-admin-app",
        "pos": "mystore-pos-app",
        "postgres": "mystore-postgres",
        "db": "mystore-postgres",
        "redis": "mystore-redis",
        "ingress": "mystore-nginx-ingress",
    }
    target = aliases.get(target, target)
    if not target.startswith("mystore-") and not target.startswith("camtech-"):
        target = f"mystore-{target}"
    n = args.lines
    ssh_run(host, user, password, key, [
        f"docker logs --tail {n} {target}"
    ])

def cmd_deploy(cfg, _args):
    host, user, password, key = cfg
    print("🚀 Triggering Zero-Downtime Production Deployment on Ubuntu...")
    ssh_run(host, user, password, key, [
        "cd /home/ubuntu-server/CamTech_Store && git pull origin main && chmod +x ./scripts/*.sh ./scripts/*.py 2>/dev/null || true && ./scripts/deploy_production.sh"
    ], timeout=300)

def cmd_health(cfg, _args):
    host, user, password, key = cfg
    import urllib.request
    print(f"\n🔍 Checking live service endpoints on http://{host}...")
    endpoints = [
        ("Nginx Ingress", f"http://{host}:8090/"),
        ("API Gateway", f"http://{host}:4010/health"),
        ("Storefront App", f"http://{host}:5001/"),
        ("Enterprise Admin", f"http://{host}:5002/"),
        ("POS Cashier Terminal", f"http://{host}:5003/"),
        ("Delivery Dispatch", f"http://{host}:5004/"),
        ("HR Console", f"http://{host}:5005/"),
        ("CEO Dashboard", f"http://{host}:5008/"),
    ]
    for name, url in endpoints:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MyStore-Ops-Check/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                print(f"  ✅ {name:<22} -> HTTP {resp.status} ({url})")
        except Exception as exc:
            print(f"  ❌ {name:<22} -> {exc} ({url})")

def cmd_exec(cfg, args):
    host, user, password, key = cfg
    ssh_run(host, user, password, key, [args.command])

def cmd_sync(cfg, _args):
    host, user, password, key = cfg
    print("⚡ Fast syncing local code to Ubuntu server via SFTP...")
    try:
        import paramiko
    except ImportError:
        print("❌ paramiko not installed")
        return

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=15)
    sftp = client.open_sftp()
    
    local_dir = Path(__file__).resolve().parent.parent
    remote_dir = "/home/ubuntu-server/CamTech_Store"
    
    ignore = {".git", ".venv", "node_modules", "dist", ".turbo", "__pycache__", ".next"}
    
    count = 0
    for root, dirs, files in os.walk(local_dir):
        dirs[:] = [d for d in dirs if d not in ignore]
        rel = os.path.relpath(root, local_dir)
        r_path = remote_dir if rel == "." else f"{remote_dir}/{rel.replace(os.sep, '/')}"
        
        # Ensure remote dir
        try:
            sftp.stat(r_path)
        except IOError:
            try:
                sftp.mkdir(r_path)
            except IOError:
                pass

        for f in files:
            if f.endswith((".pyc", ".log", ".tsbuildinfo")):
                continue
            l_file = os.path.join(root, f)
            r_file = f"{r_path}/{f}"
            sftp.put(l_file, r_file)
            count += 1
            if count % 20 == 0:
                print(f"  Synced {count} files...", end="\r")

    sftp.close()
    client.close()
    print(f"\n✅ Synced {count} files to {host}:{remote_dir} successfully!")

def main():
    parser = argparse.ArgumentParser(description="MyStore Unified Operations CLI")
    parser.add_argument("--host", help="Target server IP (default: 10.1.0.11)")
    sub = parser.add_subparsers(dest="action", required=True)

    sub.add_parser("status", help="Show container status, disk, memory")
    
    p_logs = sub.add_parser("logs", help="Tail container logs")
    p_logs.add_argument("service", help="Service name (e.g. gateway, auth, admin, store, pos)")
    p_logs.add_argument("-n", "--lines", type=int, default=50, help="Number of lines")

    sub.add_parser("deploy", help="Run zero-downtime production deployment")
    sub.add_parser("health", help="Check HTTP status of all production endpoints")
    sub.add_parser("sync", help="Direct fast SFTP file sync from local PC")

    p_exec = sub.add_parser("exec", help="Run remote command")
    p_exec.add_argument("command", help="Command string")

    args = parser.parse_args()
    cfg = get_config(args)

    cmds = {
        "status": cmd_status,
        "logs": cmd_logs,
        "deploy": cmd_deploy,
        "health": cmd_health,
        "sync": cmd_sync,
        "exec": cmd_exec,
    }
    cmds[args.action](cfg, args)

if __name__ == "__main__":
    main()
