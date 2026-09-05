#!/usr/bin/env python3
import sys
import paramiko
from pathlib import Path

def load_env():
    env = {}
    p = Path.home() / ".camtech_env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    return env

def exec_remote(cmd: str):
    env = load_env()
    host = env.get("CAMTECH_HOST", "10.1.0.11")
    user = env.get("CAMTECH_USER", "ubuntu-server")
    password = env.get("CAMTECH_PASS", "pTT!CT01")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        host,
        username=user,
        password=password,
        timeout=30,
        banner_timeout=60,
        auth_timeout=60,
    )
    
    # We write command to a temporary remote script or execute via bash
    sftp = client.open_sftp()
    remote_script = "/tmp/_agent_cmd.sh"
    with sftp.open(remote_script, "w") as f:
        f.write("#!/bin/bash\nset -e\n" + cmd + "\n")
    sftp.chmod(remote_script, 0o755)
    sftp.close()
    
    stdin, stdout, stderr = client.exec_command(f"echo '{password}' | sudo -S bash {remote_script}")
    stdin.close()
    
    for line in iter(stdout.readline, ""):
        print(line, end="", flush=True)
    
    err = stderr.read().decode(errors="replace")
    client.exec_command(f"rm -f {remote_script}")
    client.close()
    
    if err and "password for" not in err and "Warning:" not in err:
        print("[stderr]", err, file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = " ".join(sys.argv[1:])
    else:
        cmd = sys.stdin.read()
    exec_remote(cmd)
