import sys
from pathlib import Path
import paramiko
sys.path.append(str(Path("scripts").resolve()))
from camtech import get_config

class DummyArgs:
    pass

host, user, password, key = get_config(DummyArgs())

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
if key:
    client.connect(host, username=user, key_filename=key, timeout=15)
else:
    client.connect(host, username=user, password=password, timeout=15)

sftp = client.open_sftp()
local_path = "dist.tar.gz"
remote_path = "/home/ubuntu-server/CamTech_Store/dist.tar.gz"

print(f"Uploading {local_path} to {remote_path}...")
sftp.put(local_path, remote_path)
print("Upload complete!")
sftp.close()
client.close()
