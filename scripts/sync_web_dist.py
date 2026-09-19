import os
import sys
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.camtech import get_config, ssh_run
import paramiko

def sync_dist():
    class DummyArgs:
        host = None
    cfg = get_config(DummyArgs())
    host, user, password, key = cfg

    print(f"📦 Connecting to {host} via SFTP...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=15)
    sftp = client.open_sftp()

    local_dist = ROOT / "apps" / "web" / "dist"
    remote_dist = "/home/ubuntu-server/CamTech_Store/apps/web/dist"

    print(f"🚀 Syncing {local_dist} to {remote_dist}...")
    count = 0
    for root, dirs, files in os.walk(local_dist):
        rel = os.path.relpath(root, local_dist)
        r_dir = remote_dist if rel == "." else f"{remote_dist}/{rel.replace(os.sep, '/')}"
        
        # Ensure remote directory exists
        parts = r_dir.split('/')
        accum = ""
        for p in parts:
            if not p:
                continue
            accum += f"/{p}"
            try:
                sftp.stat(accum)
            except IOError:
                try:
                    sftp.mkdir(accum)
                except IOError:
                    pass

        for f in files:
            l_file = os.path.join(root, f)
            r_file = f"{r_dir}/{f}"
            sftp.put(l_file, r_file)
            count += 1
            if count % 10 == 0:
                print(f"  Uploaded {count} files...", end="\r")

    sftp.close()
    client.close()
    print(f"\n✅ Uploaded {count} files to {remote_dist}!")

    print("🔄 Copying built assets into mystore-infra-app and mystore-admin-app...")
    ssh_run(host, user, password, key, [
        "docker cp /home/ubuntu-server/CamTech_Store/apps/web/dist/. mystore-infra-app:/usr/share/nginx/html/",
        "docker cp /home/ubuntu-server/CamTech_Store/apps/web/dist/. mystore-admin-app:/usr/share/nginx/html/",
    ])
    print("🎉 Production frontend updated successfully!")

if __name__ == "__main__":
    sync_dist()
