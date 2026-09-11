import os
import sys
import tarfile
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

def create_tar(source_dir, output_filename):
    print(f"Archiving {source_dir} -> {output_filename}...")
    with tarfile.open(output_filename, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir)
                tar.add(full_path, arcname=rel_path)

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # 1. Archive apps/store/dist and apps/delivery/dist
    store_dist = os.path.join(root_dir, "apps", "store", "dist")
    delivery_dist = os.path.join(root_dir, "apps", "delivery", "dist")
    
    if not os.path.exists(os.path.join(store_dist, "index.html")):
        print(f"Error: {store_dist} does not have index.html. Run build first!")
        sys.exit(1)
        
    if not os.path.exists(os.path.join(delivery_dist, "index.html")):
        print(f"Error: {delivery_dist} does not have index.html. Run build first!")
        sys.exit(1)
        
    store_tar = os.path.join(root_dir, "store_dist.tar.gz")
    delivery_tar = os.path.join(root_dir, "delivery_dist.tar.gz")
    create_tar(store_dist, store_tar)
    create_tar(delivery_dist, delivery_tar)

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
                time.sleep(2)

    if not ssh:
        print("Failed to connect to server after 5 attempts.")
        sys.exit(1)

    sftp = ssh.open_sftp()

    def run_remote(cmd):
        print(f"-> {cmd}", flush=True)
        stdin, stdout, stderr = ssh.exec_command(f"echo '{PASSWORD}' | sudo -S bash -c {repr(cmd)}")
        out = stdout.read().decode(errors="replace")
        for line in out.splitlines():
            if "[sudo]" not in line and "password for" not in line:
                print("   " + line, flush=True)

    # 2. Upload backend files
    backend_files = [
        (
            "services/backend-py/app/modules/sales/controllers/orders_controller.py",
            [("mystore-sales-service", "/app/app/modules/sales/controllers/orders_controller.py")],
            "/home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/sales/controllers/orders_controller.py"
        ),
        (
            "services/backend-py/app/routers/delivery_routes.py",
            [("mystore-delivery-service", "/app/app/routers/delivery_routes.py")],
            "/home/ubuntu-server/CamTech_Store/services/backend-py/app/routers/delivery_routes.py"
        ),
    ]

    for local_rel, targets, repo_dest in backend_files:
        local_path = os.path.join(root_dir, local_rel)
        temp_remote = f"/tmp/{os.path.basename(local_path)}"
        print(f"Uploading {local_rel} -> {temp_remote}...")
        sftp.put(local_path, temp_remote)
        for container, c_dest in targets:
            run_remote(f"docker cp {temp_remote} {container}:{c_dest}")
        if repo_dest:
            run_remote(f"cp {temp_remote} {repo_dest}")
        run_remote(f"rm -f {temp_remote}")

    # 3. Upload and extract store app dist
    print("Uploading store_dist.tar.gz...")
    sftp.put(store_tar, "/tmp/store_dist.tar.gz")
    run_remote("rm -rf /tmp/store_dist && mkdir -p /tmp/store_dist")
    run_remote("tar -xzf /tmp/store_dist.tar.gz -C /tmp/store_dist")
    run_remote("docker exec mystore-store-app rm -rf /usr/share/nginx/html/*")
    run_remote("docker cp /tmp/store_dist/. mystore-store-app:/usr/share/nginx/html/")
    run_remote("rm -rf /tmp/store_dist /tmp/store_dist.tar.gz")

    # 4. Upload and extract delivery app dist
    print("Uploading delivery_dist.tar.gz...")
    sftp.put(delivery_tar, "/tmp/delivery_dist.tar.gz")
    run_remote("rm -rf /tmp/delivery_dist && mkdir -p /tmp/delivery_dist")
    run_remote("tar -xzf /tmp/delivery_dist.tar.gz -C /tmp/delivery_dist")
    run_remote("docker exec mystore-delivery-app rm -rf /usr/share/nginx/html/*")
    run_remote("docker cp /tmp/delivery_dist/. mystore-delivery-app:/usr/share/nginx/html/")
    run_remote("rm -rf /tmp/delivery_dist /tmp/delivery_dist.tar.gz")

    sftp.close()

    # 5. Restart backend services
    run_remote("docker restart mystore-sales-service mystore-delivery-service")

    # 6. Verify container status
    run_remote("docker ps --filter 'name=mystore-' --format 'table {{.Names}}\t{{.Status}}'")

    # Cleanup local tarballs
    if os.path.exists(store_tar):
        os.remove(store_tar)
    if os.path.exists(delivery_tar):
        os.remove(delivery_tar)

    ssh.close()
    print("🚀 Deployment of Order History and Delivery Alerts completed successfully!")

if __name__ == "__main__":
    main()
