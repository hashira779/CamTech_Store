import os
import sys
import paramiko

HOST = "10.1.0.11"
USER = "ubuntu-server"
PASSWORD = "pTT!CT01"

FILES_TO_DEPLOY = [
    {
        "local": "services/backend-py/app/modules/delivery/api_auth.py",
        "container_targets": [
            ("mystore-delivery-service", "/app/app/modules/delivery/api_auth.py")
        ],
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/delivery/api_auth.py",
    },
    {
        "local": "services/backend-py/app/services/delivery_service.py",
        "container_targets": [
            ("mystore-delivery-service", "/app/app/services/delivery_service.py")
        ],
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/services/delivery_service.py",
    },
    {
        "local": "services/backend-py/app/modules/automations/controllers/telegram_controller.py",
        "container_targets": [
            ("mystore-platform-service", "/app/app/modules/automations/controllers/telegram_controller.py")
        ],
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/automations/controllers/telegram_controller.py",
    },
    {
        "local": "services/backend-py/app/modules/bot_builder/engine/state_manager.py",
        "container_targets": [
            ("mystore-bot-builder-service", "/app/app/modules/bot_builder/engine/state_manager.py")
        ],
        "repo_target": "/home/ubuntu-server/CamTech_Store/services/backend-py/app/modules/bot_builder/engine/state_manager.py",
    }
]

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Connecting to {HOST}...", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    sftp = ssh.open_sftp()

    def run_remote(cmd):
        print(f"-> {cmd}", flush=True)
        _, stdout, stderr = ssh.exec_command(f"echo '{PASSWORD}' | sudo -S bash -c {repr(cmd)}")
        out = stdout.read().decode(errors="replace")
        for line in out.splitlines():
            if "[sudo]" not in line and "password for" not in line:
                print("   " + line, flush=True)

    containers_to_restart = set()

    for item in FILES_TO_DEPLOY:
        local_path = os.path.join(root_dir, item["local"])
        if not os.path.exists(local_path):
            print(f"ERROR: Local file {local_path} not found!")
            continue

        temp_remote = f"/tmp/{os.path.basename(local_path)}"
        print(f"Uploading {item['local']} to {temp_remote}...", flush=True)
        sftp.put(local_path, temp_remote)

        # Copy to container targets
        for container, target_path in item["container_targets"]:
            run_remote(f"docker cp {temp_remote} {container}:{target_path}")
            containers_to_restart.add(container)

        # Copy to repo target
        if item.get("repo_target"):
            run_remote(f"cp {temp_remote} {item['repo_target']}")

        run_remote(f"rm -f {temp_remote}")

    sftp.close()

    # Restart affected containers
    for container in containers_to_restart:
        print(f"Restarting {container}...", flush=True)
        run_remote(f"docker restart {container}")

    # Verify delivery service code
    print("Verifying delivery service code...", flush=True)
    run_remote("docker exec mystore-delivery-service sed -n '202,208p' /app/app/modules/delivery/api_auth.py")

    ssh.close()
    print("Hotfix deployment completed successfully!", flush=True)

if __name__ == "__main__":
    main()
