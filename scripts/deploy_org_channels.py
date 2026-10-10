#!/usr/bin/env python3
"""
Deploy updated organizations/api.py to remote auth service and api gateway.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import paramiko
from scripts.camtech import get_config, ssh_run

def deploy():
    class DummyArgs:
        host = None
    cfg = get_config(DummyArgs())
    host, user, password, key = cfg

    print(f"Connecting to {host} via SFTP...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=30)
    sftp = client.open_sftp()

    org_dir = ROOT / "services" / "backend-py" / "app" / "modules" / "organizations"
    for fname in ["api.py", "schemas.py", "models.py"]:
        local_file = org_dir / fname
        remote_tmp = f"/home/ubuntu-server/{fname}"
        sftp.put(str(local_file), remote_tmp)

    sftp.close()
    client.close()

    print("Deploying into containers and restarting auth service...")
    cmds = [
        "docker cp /home/ubuntu-server/api.py mystore-auth-service:/app/app/modules/organizations/api.py",
        "docker cp /home/ubuntu-server/schemas.py mystore-auth-service:/app/app/modules/organizations/schemas.py",
        "docker cp /home/ubuntu-server/models.py mystore-auth-service:/app/app/modules/organizations/models.py",
        "docker cp /home/ubuntu-server/api.py mystore-api-gateway:/app/app/modules/organizations/api.py",
        "docker cp /home/ubuntu-server/schemas.py mystore-api-gateway:/app/app/modules/organizations/schemas.py",
        "cp -f /home/ubuntu-server/api.py /home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/organizations/api.py",
        "cp -f /home/ubuntu-server/schemas.py /home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/organizations/schemas.py",
        "cp -f /home/ubuntu-server/models.py /home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/organizations/models.py",
        "rm -f /home/ubuntu-server/api.py /home/ubuntu-server/schemas.py /home/ubuntu-server/models.py",
        "docker restart mystore-auth-service mystore-api-gateway",
        "sleep 3",
        "docker ps --filter name=mystore-auth --format 'Container: {{.Names}} | Status: {{.Status}}'",
    ]
    ssh_run(host, user, password, key, cmds)
    print("Deployment completed!")

if __name__ == "__main__":
    deploy()
