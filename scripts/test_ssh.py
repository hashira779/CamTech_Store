import paramiko
import sys

cmd = sys.argv[1] if len(sys.argv) > 1 else "echo 'pTT!CT01' | sudo -S docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(
        "10.1.0.11",
        username="ubuntu-server",
        password="pTT!CT01",
        timeout=30,
        banner_timeout=90,
        auth_timeout=90,
    )
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    for line in out.splitlines():
        if "[sudo]" not in line and "password for" not in line:
            print(line, flush=True)
    if err.strip():
        for line in err.splitlines():
            if "[sudo]" not in line and "password for" not in line:
                print(f"[err] {line}", file=sys.stderr, flush=True)
    client.close()
except Exception as e:
    print(f"Failed: {type(e).__name__}: {e}", flush=True)
    sys.exit(1)
