import paramiko
import time
import sys

def connect_with_retry(max_retries=10, delay=3):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Attempt {attempt}/{max_retries}: Connecting to 10.1.0.11...", flush=True)
            client.connect(
                "10.1.0.11",
                username="ubuntu-server",
                password="pTT!CT01",
                timeout=10,
                banner_timeout=30,
                auth_timeout=30,
            )
            print("Connected successfully!", flush=True)
            return client
        except Exception as e:
            print(f"  Attempt {attempt} failed: {type(e).__name__}: {e}", flush=True)
            if attempt < max_retries:
                time.sleep(delay)
    return None

if __name__ == "__main__":
    client = connect_with_retry()
    if not client:
        print("Could not establish SSH session after retries.")
        sys.exit(1)
        
    _, stdout, stderr = client.exec_command("echo 'pTT!CT01' | sudo -S docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    out = stdout.read().decode(errors="replace")
    for line in out.splitlines():
        if "[sudo]" not in line and "password for" not in line:
            print(line, flush=True)
    client.close()
