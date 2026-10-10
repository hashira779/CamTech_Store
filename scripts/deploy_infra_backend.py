import os
import pathlib
import paramiko

p = pathlib.Path.home() / '.camtech_env'
env = dict(l.strip().split('=', 1) for l in p.read_text().splitlines() if '=' in l and not l.startswith('#'))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(env['CAMTECH_HOST'], username=env['CAMTECH_USER'], password=env['CAMTECH_PASS'])
sftp = ssh.open_sftp()

files = [
    ("services/backend-py/app/modules/infra/db_migration_service.py", "/app/app/modules/infra/db_migration_service.py"),
    ("services/backend-py/app/modules/infra/api.py", "/app/app/modules/infra/api.py"),
    ("services/backend-py/app/modules/infra/schemas.py", "/app/app/modules/infra/schemas.py"),
]

root_dir = pathlib.Path(__file__).resolve().parent.parent

for local_rel, container_target in files:
    local_path = root_dir / local_rel
    tmp_remote = f"/tmp/{local_path.name}"
    print(f"Uploading {local_path.name} to {tmp_remote}...")
    sftp.put(str(local_path), tmp_remote)
    
    # Copy to mystore-infra-service
    cmd = f"docker cp {tmp_remote} mystore-infra-service:{container_target}"
    print(f"Executing: {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd)
    stdout.read()
    
    # Also update repo on host
    host_target = f"/home/ubuntu-server/CamTech_Store/{local_rel}"
    cmd_host = f"cp {tmp_remote} {host_target}"
    ssh.exec_command(cmd_host)

# Restart mystore-infra-service
print("Restarting mystore-infra-service...")
_, stdout, stderr = ssh.exec_command("docker restart mystore-infra-service")
print("Restart output:", stdout.read().decode())

sftp.close()
ssh.close()
print("Infra backend deployed and restarted successfully!")
