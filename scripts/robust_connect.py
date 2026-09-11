import paramiko
import time
import sys

def connect_with_retry(max_retries=5, delay=2):
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Connecting (attempt {attempt})...", flush=True)
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                "10.1.0.11",
                username="ubuntu-server",
                password="pTT!CT01",
                timeout=20,
                banner_timeout=60,
                auth_timeout=60,
            )
            print("Connected!", flush=True)
            return client
        except Exception as e:
            print(f"  Attempt {attempt} error: {e}", flush=True)
            if attempt < max_retries:
                time.sleep(delay)
    return None

def run_cmd(command):
    client = connect_with_retry()
    if not client:
        print("Failed to connect.")
        sys.exit(1)
    
    # We execute directly
    full = f"echo 'pTT!CT01' | sudo -S bash -c {repr(command)}"
    _, stdout, stderr = client.exec_command(full, get_pty=True)
    out = stdout.read().decode(errors="replace")
    client.close()
    
    for line in out.splitlines():
        if "[sudo]" not in line and "password for" not in line:
            print(line, flush=True)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "docker ps"
    run_cmd(cmd)
