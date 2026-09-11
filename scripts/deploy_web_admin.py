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
    web_dist = os.path.join(root_dir, "apps", "web", "dist")
    if not os.path.exists(os.path.join(web_dist, "index.html")):
        print(f"Error: {web_dist} does not have index.html")
        sys.exit(1)

    web_tar = os.path.join(root_dir, "web_dist.tar.gz")
    create_tar(web_dist, web_tar)

    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected to SSH.")

    def run_cmd(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            print(f"[OUT] {out}")
        if err:
            print(f"[ERR] {err}")
        return out

    sftp = ssh.open_sftp()
    print("Uploading web_dist.tar.gz...")
    sftp.put(web_tar, "/tmp/web_dist.tar.gz")
    sftp.close()

    run_cmd("rm -rf /tmp/web_dist && mkdir -p /tmp/web_dist")
    run_cmd("tar -xzf /tmp/web_dist.tar.gz -C /tmp/web_dist")
    
    # Check if mystore-admin-app is running
    ps = run_cmd("docker ps --filter name=mystore-admin-app -q")
    if ps:
        print("Deploying to mystore-admin-app...")
        run_cmd("docker exec mystore-admin-app rm -rf /usr/share/nginx/html/*")
        run_cmd("docker cp /tmp/web_dist/. mystore-admin-app:/usr/share/nginx/html/")
        print("mystore-admin-app updated successfully!")
    else:
        print("mystore-admin-app container not found running.")

    run_cmd("rm -rf /tmp/web_dist /tmp/web_dist.tar.gz")
    if os.path.exists(web_tar):
        os.remove(web_tar)

    ssh.close()
    print("Done!")

if __name__ == "__main__":
    main()
