#!/usr/bin/env python3
"""
Deploy delivery service fix to production (10.1.0.11)
"""
import paramiko
import os
import time

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

local_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "backend-py", "app", "modules", "delivery", "service.py"))
remote_repo = "/home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/delivery/service.py"
temp_file = "/tmp/delivery_service.py"

print(f"Connecting to {HOST}...", flush=True)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

sftp = ssh.open_sftp()
print(f"Uploading {local_file} -> {temp_file}...", flush=True)
sftp.put(local_file, temp_file)
sftp.close()

def run(cmd):
    print(f"-> {cmd}", flush=True)
    _, stdout, stderr = ssh.exec_command(f'echo "{PASSWORD}" | sudo -S bash -c {repr(cmd)}')
    out = stdout.read().decode(errors="replace")
    for line in out.splitlines():
        if "[sudo]" not in line and "password for" not in line:
            print("   " + line, flush=True)
    return out

print("Updating repository on host...", flush=True)
run(f"cp {temp_file} {remote_repo}")

print("Updating mystore-delivery-service container...", flush=True)
run(f"docker cp {temp_file} mystore-delivery-service:/app/app/modules/delivery/service.py")
run(f"rm -f {temp_file}")

print("Restarting mystore-delivery-service...", flush=True)
run("docker restart mystore-delivery-service")

time.sleep(3)

print("Verifying code inside container...", flush=True)
run("docker exec mystore-delivery-service sed -n '480,490p' /app/app/modules/delivery/service.py")

print("Checking delivery service import in container...", flush=True)
run('docker exec mystore-delivery-service python -c "import app.modules.delivery.service; print(\'OK\')"')

print("Checking Gateway route to delivery service...", flush=True)
run("curl -s http://localhost:4010/api/v1/deliveries/orders | head -c 120")

ssh.close()
print("\n🎉 Delivery service fix successfully deployed to production!", flush=True)
