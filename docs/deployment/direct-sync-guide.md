# Direct Deployment Guide for AI Agents

This guide explains how to deploy critical hotfixes directly from the local Windows PC to the Ubuntu production server (`10.1.0.11`) without relying on the GitHub CI/CD auto-deploy pipeline.

> [!WARNING]
> This method bypasses the automated GitHub Actions pipeline. It should be used exclusively for hotfixes, rapid iteration, or when the CI/CD pipeline is unavailable or delayed.

## Prerequisites

The unified operations CLI `scripts/camtech.py` is configured to handle deployment and remote execution automatically. It uses built-in credentials (e.g. `ubuntu-server` / `$CAMTECH_PASS`) and requires `paramiko` to be installed in your Python environment.

## Workflow

To perform a direct deployment, follow these exact steps:

### 1. Sync Files via SFTP

Sync all local changes directly to the remote server directory `/home/ubuntu-server/CamTech_Store`. This subcommand recursively copies files, ignoring unnecessary directories like `node_modules`.

```bash
# Run this from the root of the workspace:
python scripts/camtech.py sync
```

### 2. Restart Target Docker Containers

Since the files were just hot-swapped into the remote server, the Python applications must be restarted to load the new modules into memory. Use the `exec` command to run the restart directly.

```bash
# To restart the FastAPI backend (and apply backend changes):
python scripts/camtech.py exec "docker compose -f /home/ubuntu-server/CamTech_Store/docker-compose.prod.yml restart backend-py"
```

If you made changes to other microservices or the frontend, adjust the container name accordingly (e.g. `gateway`, `storefront`, `admin-app`).

### 3. Verify Health

Once the container has restarted, verify the production endpoints to ensure the application is healthy and the changes did not cause a crash:

```bash
python scripts/camtech.py health
```

### 4. Check Remote Logs (Optional)

If the health check fails or you need to verify specific outputs (such as a 500 error being resolved), you can tail the container logs remotely:

```bash
python scripts/camtech.py logs
```
*(Or use `python scripts/camtech.py exec "docker compose logs backend-py --tail 50"` for targeted logging).*

---

## When to Use This Guide

- **Critical 500 Errors in Production**: When an error is actively blocking users (e.g., passkey authentication failing) and waiting 5-10 minutes for the CI/CD pipeline is unacceptable.
- **Git Hook Failures**: When the local `pre-push` hook is blocking a deployment because of non-critical test failures, but the hotfix must be deployed immediately.
- **Testing in Production**: When rapid iteration is required to debug an environment-specific issue on `10.1.0.11` that cannot be reproduced locally.
