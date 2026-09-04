#!/usr/bin/env python3
import sys
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

def run_cmd(command: str):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    
    # Prepend sudo if needed
    if "sudo" in command and USER != "root":
        command = f"echo '{PASSWORD}' | sudo -S {command.replace('sudo ', '')}"
        
    stdin, stdout, stderr = ssh.exec_command(command, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    ssh.close()
    
    if out:
        print(out, end="")
    if err and "password for" not in err:
        print(err, end="", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = " ".join(sys.argv[1:])
        run_cmd(cmd)
    else:
        print("Usage: python execute_on_server.py '<command>'")
