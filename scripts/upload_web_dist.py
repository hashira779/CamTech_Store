import os
import sys
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

def upload_and_extract():
    tar_path = os.path.join(os.path.dirname(__file__), "..", "web_dist.tar.gz")
    if not os.path.exists(tar_path):
        print(f"Error: {tar_path} does not exist!")
        sys.exit(1)
        
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    
    print("Uploading web_dist.tar.gz via SFTP...")
    sftp = ssh.open_sftp()
    remote_tar = "/home/ubuntu-server/web_dist.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    print("Upload complete.")
    
    cmds = [
        "rm -rf /home/ubuntu-server/web_dist && mkdir -p /home/ubuntu-server/web_dist",
        "tar -xzf /home/ubuntu-server/web_dist.tar.gz -C /home/ubuntu-server/web_dist",
        "docker exec mystore-admin-app rm -rf /usr/share/nginx/html/*",
        "docker cp /home/ubuntu-server/web_dist/. mystore-admin-app:/usr/share/nginx/html/",
        "docker exec mystore-admin-app ls -la /usr/share/nginx/html",
        "rm -f /home/ubuntu-server/web_dist.tar.gz"
    ]
    
    for cmd in cmds:
        print(f"Running: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(f"echo '{PASSWORD}' | sudo -S bash -c \"{cmd}\"")
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        if out:
            print(out)
        if err and "password for" not in err:
            print(err, file=sys.stderr)
            
    ssh.close()
    print("Deploy to mystore-admin-app completed successfully!")

if __name__ == "__main__":
    upload_and_extract()
