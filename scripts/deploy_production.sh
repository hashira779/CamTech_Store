#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  MyStore — Zero-Downtime Safe Production Deploy with Automated Rollback
#  Target Host: Ubuntu Server (10.1.0.11)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/CamTech_Store}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/CamTech_Store_backup}"
COMPOSE_FILE="docker-compose.prod.yml"

# ── Credentials & Environment Setup ──────────────────────────────────────────
if [ -f "$HOME/.camtech_env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$HOME/.camtech_env"
    set +a
fi

SUDO_CMD=""
if [ "$(id -u)" -ne 0 ]; then
    if [ -n "${CAMTECH_SUDO_PASS:-}" ]; then
        SUDO_CMD="echo $CAMTECH_SUDO_PASS | sudo -S"
    else
        SUDO_CMD="sudo"
    fi
fi

run_cmd() {
    if [ -n "$SUDO_CMD" ]; then
        eval "$SUDO_CMD $@"
    else
        "$@"
    fi
}

echo "========================================================================"
echo "  🚀 Starting Safe Production Deployment for MyStore on $(hostname -I | awk '{print $1}')"
echo "========================================================================"

# ── 1. Pre-flight Resource Verification ──────────────────────────────────────
echo "📊 Checking System Resources..."
echo "--- Memory ---"
free -h
echo "--- Disk Space ---"
df -h /

# Verify Docker is running
if ! run_cmd docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running or current user lacks access."
    exit 1
fi

# ── 2. Create Safety Snapshot / Backup of Current State ───────────────────────
if [ -d "$APP_DIR" ]; then
    echo "📦 Creating snapshot backup of current deployment..."
    mkdir -p "$BACKUP_DIR"
    run_cmd rsync -aq --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude 'dist' \
        --exclude '.turbo' \
        --exclude '__pycache__' \
        "$APP_DIR/" "$BACKUP_DIR/"
fi

# ── 3. Sync New Code to APP_DIR ──────────────────────────────────────────────
echo "🔄 Syncing new files to $APP_DIR..."
run_cmd mkdir -p "$APP_DIR"
run_cmd rsync -aq --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude 'dist' \
    --exclude '.turbo' \
    --exclude '__pycache__' \
    ./ "$APP_DIR/"

cd "$APP_DIR"
chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true

# Ensure production environment variables exist
if [ ! -f .env ]; then
    if [ -f .env.production.example ]; then
        echo "⚠️ .env not found; initializing from .env.production.example..."
        cp .env.production.example .env
    else
        echo "⚠️ .env file missing in $APP_DIR!"
    fi
fi

# ── 4. Build Images First (WITHOUT Stopping Active Containers) ────────────────
echo "🔨 Pre-building Docker images for zero-downtime transition..."
if ! run_cmd docker compose -f "$COMPOSE_FILE" build; then
    echo "========================================================================"
    echo "❌ Docker build failed! Aborting without affecting live services."
    echo "--- System Diagnostics ---"
    dmesg | tail -n 20 || true
    df -h /
    echo "========================================================================"

    if [ -d "$BACKUP_DIR" ]; then
        echo "🔄 Restoring files from backup..."
        run_cmd rsync -aq --delete "$BACKUP_DIR/" "$APP_DIR/"
    fi
    exit 1
fi

# ── 5. Gracefully Apply Container Updates ─────────────────────────────────────
echo "🚀 Deploying updated containers..."
run_cmd docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# ── 6. Smoke Tests & Health Check Loop ───────────────────────────────────────
echo "🔍 Running health verification checks..."
MAX_RETRIES=30
RETRY_INTERVAL=2

check_endpoint() {
    local url=$1
    local name=$2
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f -s -m 4 "$url" > /dev/null 2>&1; then
            echo "   ✅ $name is operational ($url)"
            return 0
        fi
        echo "   ⏳ Waiting for $name ($i/$MAX_RETRIES)..."
        sleep $RETRY_INTERVAL
    done
    echo "   ❌ $name failed health verification at $url"
    return 1
}

DEPLOY_FAILED=0

# Verify API Gateway & Microservices
API_PORT="${API_GATEWAY_PORT_HOST:-4010}"
if ! check_endpoint "http://localhost:${API_PORT}/health" "API Gateway (Port ${API_PORT})"; then
    DEPLOY_FAILED=1
fi

# Verify Storefront
if ! check_endpoint "http://localhost:5001/" "Customer Storefront (Port 5001)"; then
    DEPLOY_FAILED=1
fi

# Verify Web Admin
if ! check_endpoint "http://localhost:5002/" "Enterprise Admin (Port 5002)"; then
    DEPLOY_FAILED=1
fi

# Verify POS Cashier
if ! check_endpoint "http://localhost:5003/" "POS Cashier (Port 5003)"; then
    DEPLOY_FAILED=1
fi

# Verify Main Ingress Proxy
INGRESS_PORT="${INGRESS_PORT_HOST:-8090}"
if ! check_endpoint "http://localhost:${INGRESS_PORT}/health" "Nginx Ingress Edge Router (Port ${INGRESS_PORT})"; then
    DEPLOY_FAILED=1
fi

# ── 7. Automatic Rollback on Failure ──────────────────────────────────────────
if [ "$DEPLOY_FAILED" -eq 1 ]; then
    echo "========================================================================"
    echo "  ⚠️ DEPLOYMENT VERIFICATION FAILED! Initiating Automated Rollback..."
    echo "========================================================================"
    echo "📋 Dumping recent container failure logs:"
    run_cmd docker compose -f "$COMPOSE_FILE" logs --tail=40 || true

    if [ -d "$BACKUP_DIR" ]; then
        echo "🔄 Restoring stable state from backup..."
        run_cmd rsync -aq --delete "$BACKUP_DIR/" "$APP_DIR/"
        cd "$APP_DIR"
        run_cmd docker compose -f "$COMPOSE_FILE" up -d
        echo "✅ Rollback complete. Previous stable containers restored."
    fi
    exit 1
fi

# ── 8. Cleanup & Prune Dangling Build Artifacts ───────────────────────────────
echo "🧹 Pruning old dangling Docker images..."
run_cmd docker image prune -f 2>/dev/null || true

echo "========================================================================"
echo "  🎉 Deployment Succeeded & Verified! MyStore Production is LIVE."
echo "========================================================================"
echo "Available Service Endpoints on 10.1.0.11:"
echo "  • Nginx Ingress:       http://10.1.0.11:${INGRESS_PORT:-8090}"
echo "  • API Gateway:         http://10.1.0.11:${API_PORT:-4010}"
echo "  • Storefront:          http://10.1.0.11:5001"
echo "  • Enterprise Admin:    http://10.1.0.11:5002"
echo "  • Cashier POS:         http://10.1.0.11:5003"
echo "  • Courier Delivery:    http://10.1.0.11:5004"
echo "  • HR Workforce:        http://10.1.0.11:5005"
echo "  • CEO Command:         http://10.1.0.11:5008"
echo "========================================================================"
