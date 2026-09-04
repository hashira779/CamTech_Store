#!/usr/bin/env python3
"""
Remote Deployment & Configuration Runner for Ubuntu Server (10.1.0.11)
Connects via SSH using Paramiko, pulls the latest code, sets up production
environment variables, launches the Docker stack with Cloudflare tunnel,
and configures the firewall.
"""

import sys
import time
import argparse
import paramiko

def run_remote_commands(host: str, user: str, password: str = None, key_file: str = None, port: int = 22):
    print(f"[*] Connecting to {user}@{host}:{port}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": 15,
        "banner_timeout": 15,
    }
    if password:
        connect_kwargs["password"] = password
    if key_file:
        connect_kwargs["key_filename"] = key_file

    try:
        client.connect(**connect_kwargs)
        print(f"[+] Successfully connected to {host}!")
    except Exception as e:
        print(f"[-] Connection failed: {e}")
        return False

    def exec_cmd(cmd: str, sudo: bool = False):
        full_cmd = f"echo '{password}' | sudo -S {cmd}" if (sudo and password and user != 'root') else cmd
        print(f"\n[>] Executing: {cmd}")
        stdin, stdout, stderr = client.exec_command(full_cmd, get_pty=True)
        
        while not stdout.channel.exit_status_ready():
            if stdout.channel.recv_ready():
                data = stdout.channel.recv(1024).decode(errors='replace')
                sys.stdout.write(data)
                sys.stdout.flush()
            time.sleep(0.1)
        
        remaining = stdout.read().decode(errors='replace')
        if remaining:
            sys.stdout.write(remaining)
            sys.stdout.flush()
            
        status = stdout.channel.recv_exit_status()
        if status != 0:
            err = stderr.read().decode(errors='replace')
            if err:
                print(f"[!] Error: {err}")
        return status == 0

    commands = [
        ("mkdir -p /home/$USER/CamTech_Store", False),
        ("if [ -d /home/$USER/CamTech_Store/.git ]; then cd /home/$USER/CamTech_Store && git pull origin main; else git clone https://github.com/hashira779/CamTech_Store.git /home/$USER/CamTech_Store; fi", False),
        ("cd /home/$USER/CamTech_Store && if [ ! -f .env ]; then cp .env.production.example .env; fi", False),
        ("sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 5432/tcp && sudo ufw allow 4000:4007/tcp && sudo ufw allow 5001:5008/tcp && sudo ufw --force enable", True),
        ("cd /home/$USER/CamTech_Store && docker compose -f docker-compose.prod.yml up -d --build", True),
        ("sleep 5 && docker compose -f /home/$USER/CamTech_Store/docker-compose.prod.yml ps", True),
        ("curl -s -I http://localhost:80 || true", False),
        ("curl -s http://localhost:4000/health || true", False),
    ]

    for cmd, is_sudo in commands:
        success = exec_cmd(cmd, sudo=is_sudo)
        if not success:
            print(f"[-] Command failed: {cmd}")

    client.close()
    print("\n[+] Remote execution completed!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy MyStore to Ubuntu server")
    parser.add_argument("--host", default="10.1.0.11", help="Target host IP")
    parser.add_argument("--user", required=True, help="SSH username")
    parser.add_argument("--password", help="SSH password")
    parser.add_argument("--key", help="SSH private key path")
    parser.add_argument("--port", type=int, default=22, help="SSH port")
    args = parser.parse_args()

    run_remote_commands(args.host, args.user, args.password, args.key, args.port)
