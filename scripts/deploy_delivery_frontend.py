import os
import sys
from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.camtech import get_config, ssh_run

def deploy_frontend():
    class DummyArgs:
        host = None
    cfg = get_config(DummyArgs())
    host, user, password, key = cfg

    print(f"📦 Connecting to {host} via SFTP...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=20)
    sftp = client.open_sftp()

    def upload_dir(local_path: Path, remote_path: str):
        print(f"🚀 Uploading {local_path} -> {remote_path}...", flush=True)
        count = 0
        for root, dirs, files in os.walk(local_path):
            rel = os.path.relpath(root, local_path)
            r_dir = remote_path if rel == "." else f"{remote_path}/{rel.replace(os.sep, '/')}"

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
        print(f"✅ Uploaded {count} files to {remote_path}!", flush=True)

    # 1. Sync Delivery App dist
    local_delivery = ROOT / "apps" / "delivery" / "dist"
    remote_delivery = "/home/ubuntu-server/CamTech_Store/apps/delivery/dist"
    upload_dir(local_delivery, remote_delivery)

    # 2. Sync Web App dist
    local_web = ROOT / "apps" / "web" / "dist"
    remote_web = "/home/ubuntu-server/CamTech_Store/apps/web/dist"
    upload_dir(local_web, remote_web)

    sftp.close()
    client.close()

    # 3. Copy into live containers
    print("🔄 Deploying into mystore-delivery-app and mystore-admin-app containers...", flush=True)
    ssh_run(host, user, password, key, [
        "docker cp /home/ubuntu-server/CamTech_Store/apps/delivery/dist/. mystore-delivery-app:/usr/share/nginx/html/",
        "docker cp /home/ubuntu-server/CamTech_Store/apps/web/dist/. mystore-admin-app:/usr/share/nginx/html/",
        "docker restart mystore-delivery-app mystore-admin-app",
    ])

    print("🎉 Both delivery.camtech.cam and adminconsol.camtech.cam successfully updated!", flush=True)

if __name__ == "__main__":
    deploy_frontend()
