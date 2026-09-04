#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import run_remote as r

script = """
cat << 'EOF' > /home/ubuntu-server/mystore-autoupdate.sh
#!/bin/bash
set -eo pipefail

APP_DIR="/home/ubuntu-server/CamTech_Store"
LOCK_FILE="/tmp/mystore_autoupdate.lock"

# Avoid concurrent runs
if [ -f "$LOCK_FILE" ]; then
    # If lock is older than 20 minutes, clean it up
    if [ $(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0))) -gt 1200 ]; then
        rm -f "$LOCK_FILE"
    else
        exit 0
    fi
fi

touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$APP_DIR"
git fetch origin main >/dev/null 2>&1 || exit 0

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "========================================================================"
    echo "🚀 [$(date)] New commit detected! $LOCAL -> $REMOTE"
    echo "========================================================================"
    git pull origin main
    chmod +x ./scripts/*.sh ./scripts/*.py 2>/dev/null || true
    ./scripts/deploy_production.sh >> /var/log/mystore-autodeploy.log 2>&1
    echo "✅ [$(date)] Auto-deployment completed for commit $REMOTE"
fi
EOF

chmod +x /home/ubuntu-server/mystore-autoupdate.sh
chown ubuntu-server:ubuntu-server /home/ubuntu-server/mystore-autoupdate.sh

# Create systemd service
cat << 'EOF' > /etc/systemd/system/mystore-autoupdate.service
[Unit]
Description=MyStore Production Automatic Sync and Zero-Downtime Deploy
After=network.target docker.service

[Service]
Type=oneshot
User=ubuntu-server
WorkingDirectory=/home/ubuntu-server/CamTech_Store
ExecStart=/bin/bash /home/ubuntu-server/mystore-autoupdate.sh
EOF

# Create systemd timer (checks every 60 seconds)
cat << 'EOF' > /etc/systemd/system/mystore-autoupdate.timer
[Unit]
Description=Run MyStore auto-sync every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=mystore-autoupdate.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now mystore-autoupdate.timer
systemctl status mystore-autoupdate.timer --no-pager
"""

print("=== Installing Auto-Deployment Service on Ubuntu Server ===")
r.exec_remote(script)
