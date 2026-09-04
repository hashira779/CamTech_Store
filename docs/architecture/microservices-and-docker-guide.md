# MyStore Microservices, Docker & High-Concurrency Architecture Guide

This document specifies the enterprise architecture for MyStore: independent multi-server web applications, backend microservices with an API Gateway, Docker container fault isolation, and event-driven Redis outbox queuing for 10,000+ concurrent requests.

---

## 1. System Architecture Diagram

```text
                                  FRONTEND WEBSITES
         Port 5001    Port 5002    Port 5003    Port 5004    Port 5005    Port 5008
        apps/store   apps/admin   apps/cashier apps/delivery  apps/hr      apps/ceo
             │            │            │            │            │            │
             └────────────┴────────────┼────────────┴────────────┴────────────┘
                                       │
                                       ▼
                       API GATEWAY (Port 4000)
              services/backend-py/app/microservices/gateway.py
              routes EVERY /api/v1 prefix to a service · lazy in-process fallback
                                       │
   ┌───────────┬───────────┬──────────┼──────────┬───────────┬───────────┬───────────┐
   │           │           │          │          │           │           │           │
 Port 4001  Port 4002   Port 4003  Port 4004  Port 4005  Port 4006   Port 4007
 Auth/User  Catalog &   Orders &   Fleet      HR &       Finance &   Platform &
 Service    Inventory   POS Sales  Delivery   Payroll    Ledger      Experience*
   │           │           │          │          │           │           │
   └───────────┴───────────┴──────────┼──────────┴───────────┴───────────┘
                                       │
                                       ▼
                         ONE CENTRAL DATA CENTER
                      PostgreSQL 16 Enterprise Database
```

> *The **Platform & Experience** service (`:4007`) owns every domain that isn't one of the six core services — reporting/BI, workflows, tickets, notifications, projects, documents, automations, industry packs, AI copilot, data exchange, live events (SSE), app registry and the outbox/saga engine. With it, **every** route is owned by a microservice; the gateway's in-process fallback is a safety net, never the primary path.

---

## 2. Port Allocation Table

### Frontend Applications (Dedicated Web Application Servers)

| Application | Port | Dev Script | Persona | Key Features |
|---|---|---|---|---|
| **Store** (`apps/store`) | **`5001`** | `pnpm store:dev` | Customer | Catalog search, cart drawer, Bakong KHQR checkout, purchase order history |
| **Admin** (`apps/web`) | **`5002`** | `pnpm admin:dev` | Enterprise Admin | Multi-tenant config, branch hierarchy, RBAC permissions, audit trail |
| **Cashier** (`apps/cashier`) | **`5003`** | `pnpm cashier:dev` | Cashier | Barcode scanner, touch cart, cash & KHQR split tender, offline outbox |
| **Delivery** (`apps/delivery`) | **`5004`** | `pnpm delivery:dev` | Courier / Driver | Route dispatch queue, GPS turn-by-turn link, POD signature, COD |
| **HR** (`apps/hr`) | **`5005`** | `pnpm hr:dev` | HR Manager | Staff directory, department organization tree, payroll calculation |
| **CEO** (`apps/ceo`) | **`5008`** | `pnpm ceo:dev` | Executive / CEO | Revenue velocity curve, settled transaction volume, multi-branch KPIs |

### Backend Microservices & Central Data Center

| Service Name | Port | Dev Script | Responsibilities |
|---|---|---|---|
| **API Gateway** | **`4000`** | `pnpm ms:gateway` | Reverse proxy (routes every prefix to a service), global CORS, **lazy** resilient in-process fallback |
| **Auth & Identity** | **`4001`** | `pnpm ms:auth` | Authentication, JWT, MFA TOTP, organizations, branches |
| **Catalog & Inventory** | **`4002`** | `pnpm ms:catalog` | Products, variants, categories, inventory, warehouse WMS, pricing/taxes |
| **Sales & POS Orders** | **`4003`** | `pnpm ms:sales` | POS sales, customer checkout, Bakong KHQR, CRM loyalty |
| **Delivery & Fleet** | **`4004`** | `pnpm ms:delivery` | Driver dispatch, route telemetry, GPS, POD signatures |
| **HR & Workforce** | **`4005`** | `pnpm ms:hr` | Employee directory, departments, leave, monthly payroll |
| **Finance & Ledger** | **`4006`** | `pnpm ms:finance` | Chart of accounts, general ledger, assets, fiscal balance sheet |
| **Platform & Experience** | **`4007`** | `pnpm ms:platform` | Reporting/BI, workflows, tickets, notifications, projects, documents, automations, industry, AI, events, outbox |
| **PostgreSQL 16** | **`5432`** | `pnpm db:up` | Central Data Center: relational persistence & multi-tenant schemas |
| **Redis 7** | **`6379`** | In Docker | Message broker for asynchronous event queue |

> **Every service shares one enterprise layer.** The `create_microservice()` factory ([`microservices/common.py`](../../services/backend-py/app/microservices/common.py)) applies the same `{success, data, requestId}` response envelope, error handlers, and the full SQLAlchemy model registry to each service — so a response is identical whether it came from a microservice or the fallback, and no service 500s on a cross-module relationship.

---

## 3. Docker Container Isolation & Fault Tolerance

In production, each service and frontend runs in its **own isolated Docker container**:

```yaml
# docker-compose.yml container breakdown:
- mystore-postgres       (Port 5432)
- mystore-redis          (Port 6379)
- mystore-api-gateway    (Port 4000)
- mystore-auth-service   (Port 4001)
- mystore-catalog-service(Port 4002)
- mystore-sales-service  (Port 4003)
- mystore-delivery-service(Port 4004)
- mystore-hr-service     (Port 4005)
- mystore-finance-service(Port 4006)
- mystore-pos-app        (Port 5003)
- mystore-store-app      (Port 5001)
- mystore-admin-app      (Port 5002)
- mystore-delivery-app   (Port 5004)
- mystore-hr-app         (Port 5005)
- mystore-ceo-app        (Port 5008)
```

### The Supermarket Crash Scenario:
If `mystore-store-app`, `mystore-admin-app`, `mystore-delivery-app`, `mystore-hr-app`, and `mystore-ceo-app` all crash or are stopped:
* **The POS container (`mystore-pos-app`) is completely unaffected.**
* **The Sales microservice (`mystore-sales-service`) is completely unaffected.**
* If the central database (`mystore-postgres`) goes down, the Cashier POS automatically switches to **Offline Autonomous Mode**, saves transactions to its local Outbox Queue, and prints receipts.
* When the database container comes back online, the POS auto-syncs all queued transactions with zero data loss.

### The Code-Error Isolation Scenario (verified 2026-09-04):
If a **syntax/import error is introduced into one module** (e.g. the delivery routes):
* Only that module's service goes down — a broken `delivery` module stops **`:4004`** alone.
* **The gateway (`:4000`) still boots**, because it imports the in-process fallback **lazily and guarded** (`get_fallback_app()` in `gateway.py`) — a broken module can no longer prevent the whole API from starting.
* Every other service (`auth`, `catalog`, `sales`, `hr`, `finance`, `platform`) stays **UP**, so **Admin, POS, and all other experiences keep working normally**.
* The broken route returns a clean `503 SERVICE_UNAVAILABLE` envelope instead of crashing the gateway.
* Live proof: with delivery deliberately broken, 7/8 services stayed up and `login`/`products`/`customers`/`sales`/`reports` all returned `200`.

> **Frontend equivalent:** the Admin super-app wraps its routed experience in a React **error boundary** ([`apps/web/components/error-boundary.tsx`](../../apps/web/components/error-boundary.tsx)), so a runtime crash in one screen is contained to that panel while the nav and every other route keep working. Standalone apps (`cashier`, `delivery`, `store`) are separate builds/containers and are unaffected by each other entirely.

---

## 4. High Concurrency: 10,000 Concurrent Registrations

### The Problem in Monoliths:
Bcrypt password hashing is intentionally CPU-intensive. When 10,000 users register simultaneously:
1. CPU spikes to 100%.
2. Event loops freeze.
3. Database connection pools are starved.
4. POS cashiers and other services lock up.

### The Microservice Solution:
1. **Asynchronous Non-Blocking Hashing**: `POST /api/v1/auth/register` executes password hashing in a Python threadpool (`asyncio.to_thread`), preventing event loop blockages.
2. **Instant Response**: The API Gateway returns `HTTP 201 Created` with an access token in **~12ms**.
3. **Redis Event Outbox**: Drops a `USER_REGISTERED` event into Redis (`mystore:events:user_registered`) and the Transactional Outbox.
4. **Background Worker**: The background worker process (`registration_worker.py`) consumes the event to:
   - Award 100 Welcome Loyalty Points (Silver Tier).
   - Generate a Welcome Coupon Code (`WELCOME-10-XXXXXX`).
   - Dispatch welcome notifications asynchronously without locking PostgreSQL.

---

## 5. How to Run

### Development Mode (Local Terminal)

**Option 1 — Single-process monolith** (simplest; one FastAPI process serves all 26 modules on `:4000`):
   ```powershell
   pnpm py:dev
   ```

**Option 2 — Full microservices** (gateway + all 7 services on `:4000`–`:4007`):
   ```powershell
   pnpm ms:all
   ```
   Frontends need no change — they still call `:4000`. To go back to the monolith, use `pnpm py:dev`.

Then start any Web Application:
   * Store: `pnpm store:dev` (Port 5001)
   * Admin: `pnpm admin:dev` (Port 5002)
   * Cashier POS: `pnpm cashier:dev` (Port 5003)
   * Delivery: `pnpm delivery:dev` (Port 5004)
   * HR: `pnpm hr:dev` (Port 5005)
   * CEO: `pnpm ceo:dev` (Port 5008)
3. **Or Run All Web Apps at Once**:
   ```powershell
   pnpm dev:all
   ```

### Docker Mode

```bash
# Start all microservices, databases, and web containers:
docker compose up --build -d

# Check running containers:
docker compose ps

# Stop all containers:
docker compose down
```

---

## 6. How to Run Automated Tests

```powershell
# Run all 85 backend unit, integration, and security tests:
pnpm py:test

# Run high-concurrency registration and outbox queue tests:
python -m pytest -o pythonpath=services/backend-py services/backend-py/tests/test_async_registration.py

# Run microservices and API gateway health tests:
python -m pytest -o pythonpath=services/backend-py services/backend-py/tests/test_microservices.py

# Verify frontend production builds across all 6 applications:
npx turbo run build --concurrency 2
```
