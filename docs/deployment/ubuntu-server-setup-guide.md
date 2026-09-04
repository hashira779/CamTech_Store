# Ubuntu Server (10.1.0.11) Production Deployment & CI/CD Guide

This guide details how to set up, configure, and automatically deploy the **CamTech MyStore Enterprise Platform** to your Ubuntu production server at **`10.1.0.11`** with GitHub Actions auto-deployment, Docker container isolation, and automated rollback.

---

## 1. Production Architecture on `10.1.0.11`

```text
                               INTERNET / LOCAL NETWORK
                                          │
                                          ▼
                   UBUNTU SERVER 10.1.0.11 (Ports 80 & 443)
                         Nginx Ingress Edge Router
               (deploy/nginx/nginx.conf · Host & Path Routing)
                                          │
    ┌────────────────┬────────────────────┼───────────────────┬────────────────┐
    │                │                    │                   │                │
    ▼                ▼                    ▼                   ▼                ▼
Port 5001        Port 5002            Port 5003           Port 5004        Port 5005 & 5008
Storefront       Enterprise Admin     Cashier POS         Courier Fleet    HR & CEO Apps
(Static Nginx)   (Static Nginx)       (Static Nginx)      (Static Nginx)   (Static Nginx)
    │                │                    │                   │                │
    └────────────────┴────────────────────┼───────────────────┴────────────────┘
                                          │
                                          ▼
                               API GATEWAY (Port 4000)
                     FastAPI ASGI Multi-Worker · app.microservices.gateway
                                          │
              ┌───────────┬───────────────┼───────────────┬───────────┐
              ▼           ▼               ▼               ▼           ▼
          Port 4001   Port 4002       Port 4003       Port 4004   Port 4005-4007
          Auth & Org  Catalog & WMS   Sales & POS     Fleet & GPS HR, Finance, Platform
              │           │               │               │           │
              └───────────┴───────────────┼───────────────┴───────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
              PostgreSQL 16 (Port 5432)          Redis 7 AOF (Port 6379)
              camtechStore Relational DB         Event Queue & Outbox Broker
```

---

## 2. Server Prerequisites Setup on `10.1.0.11`

Connect to your Ubuntu server via SSH:
```bash
ssh ubuntu-server@10.1.0.11
```

### Step 2.1: Install System Dependencies & Docker
```bash
# Update system repositories
sudo apt-get update && sudo apt-get upgrade -y

# Install core packages
sudo apt-get install -y curl git rsync ufw htop ca-certificates gnupg lsb-release

# Install Docker CE & Docker Compose Plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow current user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2.2: Configure Firewall (`ufw`)
```bash
# Allow SSH first (prevent lockout)
sudo ufw allow 22/tcp

# Allow Web & Ingress
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Direct Microservices & App Ports for local network access
sudo ufw allow 4000:4007/tcp
sudo ufw allow 5001:5008/tcp

# Enable Firewall
sudo ufw --force enable
sudo ufw status verbose
```

---

## 3. GitHub Actions Self-Hosted Runner Setup

The CI/CD pipeline runs on the server via a lightweight GitHub Actions runner.

### Step 3.1: Create Runner Directory
```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
```

### Step 3.2: Download & Configure Runner
1. Go to your GitHub repository: `https://github.com/hashira779/CamTech_Store`
2. Navigate to **Settings** ➔ **Actions** ➔ **Runners** ➔ **New self-hosted runner** ➔ Select **Linux**.
3. Run the commands provided by GitHub (example):
```bash
# Download latest runner package
curl -o actions-runner-linux-x64-2.322.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.322.0.tar.gz

# Configure runner with your token from GitHub Settings
./config.sh --url https://github.com/hashira779/CamTech_Store --token YOUR_GITHUB_RUNNER_TOKEN
```

### Step 3.3: Install Runner as a Systemd Service (Auto-Start on Boot)
```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The runner is now active and will automatically listen for `git push` events to `main`.

---

## 4. Production Environment Configuration (`.env`)

On the Ubuntu server `10.1.0.11`:
```bash
mkdir -p /home/ubuntu-server/CamTech_Store
cd /home/ubuntu-server/CamTech_Store

# Create production .env file
nano .env
```

Paste your production secrets:
```ini
POSTGRES_USER=camtech
POSTGRES_PASSWORD=camtech123
POSTGRES_DB=camtechStore
POSTGRES_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/0

JWT_SECRET=camtech_production_secret_key_2026_super_secure_enterprise_grade
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

API_BASE_URL=http://10.1.0.11
NEXT_PUBLIC_API_URL=http://10.1.0.11
VITE_API_URL=http://10.1.0.11
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 5. Automated CI/CD Deployment Flow

Every time you commit and push to `main`:
```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

1. **GitHub Actions Trigger**: `.github/workflows/deploy.yml` fires immediately.
2. **Self-Hosted Runner Pickup**: The runner on `10.1.0.11` accepts the job.
3. **Disk Optimization**: Prunes dangling Docker images and old journals.
4. **Safety Snapshot**: Backs up current files to `/home/ubuntu-server/CamTech_Store_backup`.
5. **Zero-Downtime Image Build**: Compiles all frontend SPAs and Python containers while live containers continue serving traffic.
6. **Container Switch**: Gracefully starts updated containers (`docker compose -f docker-compose.prod.yml up -d`).
7. **Automated Smoke Tests**: Polls ports `4000`, `5001`, `5002`, `5003`, and `80`.
8. **Automated Rollback**: If health checks fail within 60s, the runner automatically restores the backup and re-launches the stable containers.

---

## 6. Manual Deployment & Management Commands

If you need to deploy manually or manage containers directly on `10.1.0.11`:

### Manual Deploy:
```bash
cd /home/ubuntu-server/CamTech_Store
git pull origin main
./scripts/deploy_production.sh
```

### View Live Container Status:
```bash
docker compose -f docker-compose.prod.yml ps
```

### View Container Logs:
```bash
# All containers
docker compose -f docker-compose.prod.yml logs -f --tail=50

# API Gateway only
docker compose -f docker-compose.prod.yml logs -f mystore-api-gateway

# Nginx Ingress only
docker compose -f docker-compose.prod.yml logs -f mystore-nginx-ingress
```

### Restart All Services:
```bash
docker compose -f docker-compose.prod.yml restart
```

### Perform Database Backup:
```bash
python3 scripts/backup_db.py --retention 14 --out-dir /home/ubuntu-server/db_backups
```

---

## 7. Remote Database Connection & Management Guide

### 7.1 Production Database Credentials
Configure your secure production credentials in `/home/ubuntu-server/CamTech_Store/.env`:

```ini
# PostgreSQL Production Settings
POSTGRES_USER=camtech_admin
POSTGRES_PASSWORD=YourStrongGeneratedPassword2026!
POSTGRES_DB=camtechStore
POSTGRES_PORT=5432
POSTGRES_BIND=0.0.0.0
```

> [!TIP]
> Setting `POSTGRES_BIND=0.0.0.0` exposes PostgreSQL port `5432` on the network so you can connect from remote GUI clients (DBeaver, TablePlus, pgAdmin).

Apply the new credentials:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### 7.2 Remote GUI Connection (DBeaver, pgAdmin, TablePlus, Navicat)

#### Option A: Direct LAN Connection (from any PC on `10.1.0.x`)
1. Open port `5432` in Ubuntu firewall:
   ```bash
   sudo ufw allow from 10.1.0.0/24 to any port 5432 proto tcp
   # Or allow all LAN connections:
   # sudo ufw allow 5432/tcp
   ```
2. In DBeaver / pgAdmin / TablePlus, create a new PostgreSQL connection:
   - **Host / Server**: `10.1.0.11`
   - **Port**: `5432`
   - **Database**: `camtechStore` (or your custom `POSTGRES_DB`)
   - **Username**: `camtech_admin` (or your `POSTGRES_USER`)
   - **Password**: `YourStrongGeneratedPassword2026!` (or your `POSTGRES_PASSWORD`)
   - **SSL Mode**: `Prefer` or `Disable`
3. Click **Test Connection** -> **Connect**.

#### Option B: Secure SSH Tunnel (Works from anywhere, most secure)
If you prefer to keep port 5432 closed to the outside internet:
1. Open an SSH tunnel on your local computer:
   ```bash
   ssh -L 5432:localhost:5432 ubuntu-server@10.1.0.11
   ```
2. In your database tool (DBeaver / TablePlus):
   - **Host**: `127.0.0.1` (or `localhost`)
   - **Port**: `5432`
   - **Database**: `camtechStore`
   - **Username**: `camtech_admin`
   - **Password**: your database password

#### Option C: Remote CLI Test via `psql`
Test connection directly from terminal:
```bash
# Connect to production database from remote terminal:
psql "postgresql://camtech_admin:YourStrongGeneratedPassword2026!@10.1.0.11:5432/camtechStore"
```

