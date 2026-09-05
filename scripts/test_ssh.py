import paramiko
import sys

print("Connecting to 10.1.0.11...", flush=True)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(
        "10.1.0.11",
        username="ubuntu-server",
        password="pTT!CT01",
        timeout=15,
        banner_timeout=30,
        auth_timeout=30,
    )
    print("SSH Connected successfully!", flush=True)
    _, stdout, stderr = client.exec_command("echo 'pTT!CT01' | sudo -S docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    out = stdout.read().decode(errors="replace")
    for line in out.splitlines():
        if "[sudo]" not in line and "password for" not in line:
            print(line, flush=True)
    client.close()
    print("Done.", flush=True)
except Exception as e:
    print(f"Failed: {type(e).__name__}: {e}", flush=True)
    sys.exit(1)
