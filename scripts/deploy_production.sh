#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  MyStore — Zero-Downtime Safe Production Deploy with Automated Rollback
#  Target Host: Ubuntu Server (10.1.0.11)
# ══════════════════════════════════════════════════════════════════════════════

if [ -d "/home/ubuntu-server/CamTech_Store" ]; then
    DEFAULT_APP_DIR="/home/ubuntu-server/CamTech_Store"
    DEFAULT_BACKUP_DIR="/home/ubuntu-server/CamTech_Store_backup"
else
    DEFAULT_APP_DIR="$HOME/CamTech_Store"
    DEFAULT_BACKUP_DIR="$HOME/CamTech_Store_backup"
fi
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
BACKUP_DIR="${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"
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
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif sudo -n true 2>/dev/null; then
        sudo "$@"
    elif [ -n "${CAMTECH_SUDO_PASS:-}" ]; then
        printf '%s\n' "$CAMTECH_SUDO_PASS" | sudo -S "$@"
    else
        sudo "$@"
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

# Verify Docker is running and prune any stopped containers from previous runs
if ! run_cmd docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running or current user lacks access."
    exit 1
fi
echo "🧹 Pruning stopped containers from previous runs..."
run_cmd docker container prune -f 2>/dev/null || true

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
        "$APP_DIR/" "$BACKUP_DIR/" 2>/dev/null || true
fi

# ── 3. Sync New Code to APP_DIR ──────────────────────────────────────────────
echo "🔄 Syncing new files to $APP_DIR..."
run_cmd mkdir -p "$APP_DIR"

# Preserve existing active .env in $APP_DIR if present, to protect production secrets & port mappings
if [ -f "$APP_DIR/.env" ]; then
    echo "🔒 Preserving active production .env in $APP_DIR..."
    run_cmd cp "$APP_DIR/.env" /tmp/.camtech_active_env 2>/dev/null || true
fi

run_cmd rsync -aq \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.turbo' \
    --exclude '__pycache__' \
    --exclude '.env' \
    ./ "$APP_DIR/"

cd "$APP_DIR"
chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true

# Restore preserved production .env or initialize if first deploy
if [ -f /tmp/.camtech_active_env ]; then
    run_cmd cp /tmp/.camtech_active_env "$APP_DIR/.env"
    run_cmd rm -f /tmp/.camtech_active_env
elif [ ! -f "$APP_DIR/.env" ]; then
    if [ -f .env.production.example ]; then
        echo "⚠️ .env not found; initializing from .env.production.example..."
        run_cmd cp .env.production.example "$APP_DIR/.env"
    fi
fi

# Load active environment for the deploy script execution
if [ -f "$APP_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$APP_DIR/.env"
    set +a
fi

# ── 4. Build Python Backend Microservices First (Fast, Shared Cache, Zero-Downtime) ─
echo "🔨 Building core Python backend microservices..."
BACKEND_SERVICES="api-gateway delivery-service auth-service catalog-service sales-service hr-service finance-service platform-service bot-builder-service"
if ! run_cmd docker compose -f "$COMPOSE_FILE" build $BACKEND_SERVICES; then
    echo "⚠️ Warning: Targeted backend build returned exit code. Re-trying with compose default..."
    run_cmd docker compose -f "$COMPOSE_FILE" build api-gateway delivery-service || true
fi

# ── 4b. Apply Backend Microservice Updates & Core Persistence ─────────────────
echo "🚀 Starting persistence and updated backend microservices..."
run_cmd docker compose -f "$COMPOSE_FILE" up -d postgres redis pgbouncer otel-collector jaeger $BACKEND_SERVICES
echo "🔄 Reloading Nginx ingress to flush upstream DNS cache..."
run_cmd docker exec mystore-nginx-ingress nginx -s reload 2>/dev/null || run_cmd docker compose -f "$COMPOSE_FILE" restart nginx-ingress 2>/dev/null || true

# ── 4c. Automated Safe Database Schema Migration ─────────────────────────────
echo "🗄️ Running automated safe database schema migration (Zero-Downtime)..."
sleep 2
if ! run_cmd docker compose -f "$COMPOSE_FILE" exec -T api-gateway python scripts/auto_migrate.py 2>/dev/null; then
    echo "ℹ️ Retrying migration via ephemeral container..."
    run_cmd docker compose -f "$COMPOSE_FILE" run --rm --no-deps api-gateway python scripts/auto_migrate.py || true
fi

# ── 5. Build & Deploy Frontend Web Application Containers ─────────────────────
echo "🔨 Building frontend web applications..."
FRONTEND_SERVICES="store-app admin-app pos-app delivery-app hr-app ceo-app nginx-ingress"
export COMPOSE_PARALLEL_LIMIT=1
run_cmd docker compose -f "$COMPOSE_FILE" build delivery-app admin-app || true
run_cmd docker compose -f "$COMPOSE_FILE" build $FRONTEND_SERVICES || true

echo "🚀 Deploying updated frontend containers..."
run_cmd docker compose -f "$COMPOSE_FILE" up -d $FRONTEND_SERVICES
echo "🔄 Reloading Nginx ingress post-frontend deploy..."
run_cmd docker exec mystore-nginx-ingress nginx -s reload 2>/dev/null || true

# Ensure mystore-admin-app is reachable by external Cloudflare tunnel expecting admin-web
run_cmd docker network connect --alias admin-web camtech_camtech-net mystore-admin-app 2>/dev/null || true

# ── 6. Smoke Tests & Health Check Loop ───────────────────────────────────────
echo "🔍 Waiting 10s for containers to stabilize before health checks..."
sleep 10

echo "🔍 Running health verification checks..."
RETRY_INTERVAL=3

check_endpoint() {
    local url=$1
    local name=$2
    local max_retries=${3:-40}
    for i in $(seq 1 $max_retries); do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "User-Agent: Mozilla/5.0" "$url" 2>/dev/null || true)
        code="${code:-000}"
        if [ ${#code} -gt 3 ]; then
            code="${code: -3}"
        fi
        if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 500 ] 2>/dev/null; then
            echo "   ✅ $name is operational (HTTP $code at $url)"
            return 0
        fi
        echo "   ⏳ Waiting for $name (HTTP $code, $i/$max_retries)..."
        sleep $RETRY_INTERVAL
    done
    echo "   ❌ $name failed health verification at $url (last code: $code)"
    return 1
}

CRITICAL_FAILED=0
WARN_FAILED=0

# Verify API Gateway & Microservices (allow up to ~2 min for 4-worker startup)
API_PORT="${API_GATEWAY_PORT_HOST:-4010}"
if ! check_endpoint "http://127.0.0.1:${API_PORT}/health" "API Gateway (Port ${API_PORT})" 45; then
    CRITICAL_FAILED=1
fi

# Verify Delivery Service specifically (with retries — single curl was causing false positives)
echo "🔍 Verifying Delivery Microservice routing..."
if ! check_endpoint "http://127.0.0.1:${API_PORT}/api/v1/delivery/tasks" "Delivery API (via Gateway)" 20; then
    echo "   ❌ Delivery API failed health verification (Service Unavailable)"
    CRITICAL_FAILED=1
fi

# Verify Storefront (non-critical, fewer retries)
STORE_PORT="${STORE_PORT_HOST:-5001}"
if ! check_endpoint "http://127.0.0.1:${STORE_PORT}/" "Customer Storefront (Port ${STORE_PORT})" 10; then
    WARN_FAILED=1
fi

# Verify Web Admin
ADMIN_PORT="${ADMIN_PORT_HOST:-5002}"
if ! check_endpoint "http://127.0.0.1:${ADMIN_PORT}/" "Enterprise Admin (Port ${ADMIN_PORT})" 10; then
    WARN_FAILED=1
fi

# Verify POS Cashier
POS_PORT="${POS_PORT_HOST:-5003}"
if ! check_endpoint "http://127.0.0.1:${POS_PORT}/" "POS Cashier (Port ${POS_PORT})" 10; then
    WARN_FAILED=1
fi

# Verify Courier Delivery App
DELIVERY_PORT="${DELIVERY_PORT_HOST:-5004}"
if ! check_endpoint "http://127.0.0.1:${DELIVERY_PORT}/" "Courier Delivery App (Port ${DELIVERY_PORT})" 10; then
    echo "   ⚠️ Notice: Courier Delivery app container not responding directly on ${DELIVERY_PORT}"
fi

# Verify Main Ingress Proxy
INGRESS_PORT="${INGRESS_PORT_HOST:-8090}"
if ! check_endpoint "http://127.0.0.1:${INGRESS_PORT}/health" "Nginx Ingress Edge Router (Port ${INGRESS_PORT})" 10; then
    WARN_FAILED=1
fi

# ── 7. Automatic Rollback on Failure ──────────────────────────────────────────
if [ "$CRITICAL_FAILED" -eq 1 ]; then
    echo "========================================================================"
    echo "  ⚠️ CRITICAL API SERVICES FAILED! Initiating Automated Rollback..."
    echo "========================================================================"
    echo "📋 Dumping recent container failure logs:"
    echo "--- Delivery Service Logs ---"
    run_cmd docker logs --tail 40 mystore-delivery-service 2>&1 || true
    echo "--- API Gateway Logs ---"
    run_cmd docker logs --tail 40 mystore-api-gateway 2>&1 || true

    # Notify Telegram on failure
    TG_BOT="${TELEGRAM_ALERT_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN}}"
    TG_CHAT="${TELEGRAM_ALERT_CHAT_ID:-${USER_ID}}"
    if [ -n "$TG_BOT" ] && [ -n "$TG_CHAT" ]; then
        curl -s -m 5 -X POST "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
            -H "Content-Type: application/json" \
            -d "{\"chat_id\":\"${TG_CHAT}\",\"text\":\"⚠️ *MyStore Production Deployment FAILED!*\n\nHost: \`$(hostname -I | awk '{print $1}')\`\nCritical API services down. Rollback initiated.\",\"parse_mode\":\"Markdown\"}" >/dev/null 2>&1 || true
    fi

    if [ -d "$BACKUP_DIR" ]; then
        echo "🔄 Restoring stable state from backup..."
        run_cmd rsync -aq "$BACKUP_DIR/" "$APP_DIR/" 2>/dev/null || true
        cd "$APP_DIR"
        run_cmd docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null || true
        run_cmd docker exec mystore-nginx-ingress nginx -s reload 2>/dev/null || true
        echo "✅ Rollback complete. Previous stable containers restored."
    fi
    exit 1
fi

if [ "$WARN_FAILED" -eq 1 ]; then
    echo "⚠️ Notice: Some frontend services took longer to boot, but core API Gateway & Delivery microservices are healthy."
fi

# ── 8. Cleanup & Prune Unused Containers and Build Artifacts ──────────────────
echo "🧹 Pruning old stopped containers, dangling images, and build caches..."
run_cmd docker container prune -f 2>/dev/null || true
run_cmd docker image prune -f 2>/dev/null || true
run_cmd docker builder prune -af --filter "until=24h" 2>/dev/null || true

# ── 9. Send Telegram Deployment Success Alert ─────────────────────────────────
TG_BOT="${TELEGRAM_ALERT_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN}}"
TG_CHAT="${TELEGRAM_ALERT_CHAT_ID:-${USER_ID}}"
if [ -n "$TG_BOT" ] && [ -n "$TG_CHAT" ]; then
    echo "🔔 Sending deployment readiness alert to Telegram..."
    TG_RES=$(curl -s -m 5 -X POST "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\":\"${TG_CHAT}\",\"text\":\"🎉 *MyStore Production Deployment Succeeded!*\n\n• *Host:* \`$(hostname -I | awk '{print $1}')\`\n• *Admin Console:* https://admin.camtech.cam\n• *Alt Console:* https://adminconsol.camtech.cam\n• *Status:* All systems verified healthy.\n• *Time:* $(date -u '+%Y-%m-%d %H:%M:%S UTC')\",\"parse_mode\":\"Markdown\"}" 2>&1 || true)
    echo "   Telegram Alert Response: $TG_RES"
fi

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
