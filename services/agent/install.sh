#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  ICP Agent Installer — One-liner install on any Ubuntu/Debian server
#
#  Usage:
#    curl -sSL https://raw.githubusercontent.com/hashira779/CamTech_Store/main/services/agent/install.sh | \
#      ICP_API_KEY="your-secret-key" \
#      ICP_CONTROL_CENTER_URL="http://10.1.0.11:4000" \
#      bash
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

INSTALL_DIR="/opt/icp-agent"
CONFIG_DIR="/etc/icp-agent"
SERVICE_NAME="icp-agent"
PYTHON_MIN="3.10"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Installing ICP Agent (Infrastructure Control Platform)"
echo "═══════════════════════════════════════════════════════════"

# ── 1. Validate required environment variables ────────────────────────────────
if [ -z "${ICP_API_KEY:-}" ]; then
    echo "❌ Error: ICP_API_KEY environment variable is required."
    echo "   Set it before running: ICP_API_KEY='your-key' bash install.sh"
    exit 1
fi

ICP_CONTROL_CENTER_URL="${ICP_CONTROL_CENTER_URL:-http://localhost:4000}"
ICP_BIND_HOST="${ICP_BIND_HOST:-0.0.0.0}"
ICP_BIND_PORT="${ICP_BIND_PORT:-9100}"
ICP_AGENT_ID="${ICP_AGENT_ID:-$(hostname)}"
ICP_HOSTNAME="${ICP_HOSTNAME:-$(hostname)}"

# ── 2. Install system dependencies ───────────────────────────────────────────
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv curl

# ── 3. Create installation directory ─────────────────────────────────────────
echo "📁 Creating $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"

# ── 4. Create virtual environment ────────────────────────────────────────────
echo "🐍 Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"
source "$INSTALL_DIR/venv/bin/activate"

# ── 5. Install Python dependencies ───────────────────────────────────────────
echo "📦 Installing Python packages..."
pip install --quiet --upgrade pip
pip install --quiet fastapi uvicorn[standard] psutil httpx docker pydantic python-multipart

# ── 6. Copy agent code ───────────────────────────────────────────────────────
echo "📝 Setting up agent source..."
if [ -d "./icp_agent" ]; then
    cp -r ./icp_agent "$INSTALL_DIR/"
elif [ -d "/home/ubuntu-server/CamTech_Store/services/agent/icp_agent" ]; then
    cp -r /home/ubuntu-server/CamTech_Store/services/agent/icp_agent "$INSTALL_DIR/"
elif [ -d "/root/CamTech_Store/services/agent/icp_agent" ]; then
    cp -r /root/CamTech_Store/services/agent/icp_agent "$INSTALL_DIR/"
else
    echo "📥 Downloading agent files from GitHub repository..."
    mkdir -p "$INSTALL_DIR/icp_agent"
    TMP_DIR=$(mktemp -d)
    if git clone --depth 1 https://github.com/hashira779/CamTech_Store.git "$TMP_DIR/repo" 2>/dev/null; then
        cp -r "$TMP_DIR/repo/services/agent/icp_agent" "$INSTALL_DIR/"
        rm -rf "$TMP_DIR"
    else
        echo "❌ Could not clone repository to fetch icp_agent."
        exit 1
    fi
fi

# Ensure Docker socket permissions if present
if [ -S "/var/run/docker.sock" ]; then
    echo "🐳 Found /var/run/docker.sock — socket verified."
    chmod 660 /var/run/docker.sock 2>/dev/null || true
fi

# ── 7. Write configuration ───────────────────────────────────────────────────
echo "⚙️ Writing configuration to $CONFIG_DIR/config.env..."
cat > "$CONFIG_DIR/config.env" << EOF
# ICP Agent Configuration — Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
ICP_AGENT_ID=$ICP_AGENT_ID
ICP_HOSTNAME=$ICP_HOSTNAME
ICP_BIND_HOST=$ICP_BIND_HOST
ICP_BIND_PORT=$ICP_BIND_PORT
ICP_API_KEY=$ICP_API_KEY
ICP_CONTROL_CENTER_URL=$ICP_CONTROL_CENTER_URL
ICP_HEARTBEAT_INTERVAL=30
EOF
chmod 600 "$CONFIG_DIR/config.env"

# ── 8. Install systemd service ───────────────────────────────────────────────
echo "🔧 Installing systemd service..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=ICP Agent — Infrastructure Control Platform
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
EnvironmentFile=$CONFIG_DIR/config.env
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/python -m uvicorn icp_agent.main:app --host \${ICP_BIND_HOST} --port \${ICP_BIND_PORT}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# ── 9. Enable and start the service ──────────────────────────────────────────
echo "🚀 Starting ICP Agent..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# ── 10. Verify ────────────────────────────────────────────────────────────────
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  ✅ ICP Agent installed and running!"
    echo "═══════════════════════════════════════════════════════════"
    echo "  • Agent URL:     http://$ICP_BIND_HOST:$ICP_BIND_PORT"
    echo "  • Config:        $CONFIG_DIR/config.env"
    echo "  • Service:       systemctl status $SERVICE_NAME"
    echo "  • Logs:          journalctl -u $SERVICE_NAME -f"
    echo "  • Control Center: $ICP_CONTROL_CENTER_URL"
    echo "═══════════════════════════════════════════════════════════"
else
    echo "❌ Agent failed to start. Check: journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
