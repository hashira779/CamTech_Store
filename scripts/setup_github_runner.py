#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import run_remote as r

token = "BSGAGAXQVZYLK5FJVGRN6ALKTMS56"
repo_url = "https://github.com/hashira779/CamTech_Store"

setup_script = f"""
set -e

# 1. Ensure the other runner for Tools_Auto_Post is active
systemctl start actions.runner.hashira779-Tools_Auto_Post.ubuntuserver-virtual-machine.service 2>/dev/null || true

# 2. Fresh clean directory for CamTech_Store runner
RUNNER_DIR="/home/ubuntu-server/actions-runner-camtech"
rm -rf "$RUNNER_DIR"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

# 3. Download fresh runner package
echo "⬇️ Downloading fresh GitHub Runner package..."
curl -s -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-linux-x64-2.337.0.tar.gz
tar xzf runner.tar.gz
rm -f runner.tar.gz
chown -R ubuntu-server:ubuntu-server "$RUNNER_DIR"

# 4. Configure runner as ubuntu-server user
echo "⚙️ Configuring GitHub Runner for CamTech_Store..."
su - ubuntu-server -c "cd $RUNNER_DIR && ./config.sh --url {repo_url} --token {token} --name 'camtech-store-runner' --work _work --unattended --replace"

# 5. Install and start as systemd service
echo "🚀 Installing systemd service for camtech-store-runner..."
cd "$RUNNER_DIR"
./svc.sh install ubuntu-server
./svc.sh start
./svc.sh status
"""

print("=== Setting up fresh GitHub Runner ===")
r.exec_remote(setup_script)
