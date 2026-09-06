# MyStore Platform — Universal Enterprise Business Platform (2026–2030)

> **Platform Status:** All Enterprise Specifications (§1–§116, §151–§197, §198–§199, §228–§258) Implemented & Verified  
> **Canonical Backend:** Python/FastAPI (`services/backend-py`) — Modular Monolith with 18 Decoupled Domain Modules (**97/97 Tests Passing 100%**)  
> **Canonical Frontend:** Multi-Experience Vite 6 SPA (`apps/web`) — 11 Subdomain Experiences & Dedicated Shells  
> **Architecture Guides:** [docs/architecture/module-map.md](docs/architecture/module-map.md) · [docs/architecture/multi-experience-ux.md](docs/architecture/multi-experience-ux.md) · [docs/audits/session-2026-09-06.md](docs/audits/session-2026-09-06.md)

---

## Monorepo Folder Structure

```text
MyStore/
├── apps/
│   ├── web/            # ⭐ CANONICAL MULTI-EXPERIENCE SPA (Powers all 11 subdomains dynamically)
│   ├── cashier/        # Standalone terminal build target (Retail POS)
│   ├── delivery/       # Standalone terminal build target (Driver Dispatch)
│   ├── store/          # Standalone terminal build target (Public Storefront)
│   ├── hr/             # Standalone terminal build target (HR Workforce)
│   └── ceo/            # Standalone terminal build target (CEO Command Center)
├── services/
│   ├── backend-py/     # ⭐ CANONICAL PYTHON/FASTAPI BACKEND (18 modular domains, 97 tests)
│   └── backend/        # Legacy NestJS backend (retained for architectural reference)
├── packages/
│   └── contracts/      # TypeScript DTOs, interfaces, and App Registry (@mystore/contracts)
├── infra/              # OpenTelemetry Collector configs, telemetry pipelines
├── docs/               # Architecture specs, compliance audits, ADRs, and playbooks
└── scripts/            # Database backups, schema audits, and management CLI
```

---

> 📖 **Architecture & Operations Guide**: See the [Microservices, Docker & High-Concurrency Architecture Guide](docs/architecture/microservices-and-docker-guide.md) for full port mappings, container fault isolation diagrams, and high-concurrency benchmarks.
>
> 🤖 **Extending / scaling this platform** (human or AI): start with [`AGENTS.md`](AGENTS.md) — conventions, step-by-step flows for adding modules/services/screens, and the long-term scaling roadmap.

---

## Multi-Domain Experience Ecosystem (Spec §228–§258)

The platform supports multiple independent web experiences based on the incoming domain/subdomain:

| Subdomain | Target Persona | Application Shell | Purpose & Experience |
|---|---|---|---|
| `store.camtech.cam` | Public Consumer | `PublicStoreShell` | Fast product discovery, cart, Bakong KHQR checkout |
| `cashier.camtech.cam` | Cashier / Retail Staff | `POSShell` | Fast register, barcode scanning, split payments, cash drawer |
| `delivery.camtech.cam` | Courier / Driver | `DeliveryShell` | Mobile-first route map, GPS telemetry, proof of delivery (POD), COD |
| `warehouse.camtech.cam` | WMS Clerk | `WarehouseShell` | Stock receiving, bin barcode scanning, transfer dispatch, lot quarantine |
| `hr.camtech.cam` | HR Manager | `HRShell` | People directory, department trees, leave approvals, payroll runs |
| `finance.camtech.cam` | Accountant / CFO | `FinanceShell` | General ledger, chart of accounts, journal entries, fiscal tax calculation |
| `customer.camtech.cam` | Registered Customer | `CustomerShell` | Self-service portal: past orders, invoice PDFs, shipment tracking |
| `partner.camtech.cam` | Developer / Partner | `PartnerShell` | Developer hub: API key generation, HMAC webhooks, automations |
| `support.camtech.cam` | Service Desk Agent | `SupportShell` | Incident ticketing queue, SLA priority timers, resolution comments |
| `ceo.camtech.cam` | CEO / Executive | `ExecutiveShell` | Executive decision support: revenue velocity, cash, branch drill-downs |
| `admin.camtech.cam` | Enterprise Administrator | `AdminShell` | Enterprise control center: multi-tenant provisioning, RBAC, audit |

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Python ≥ 3.12 (Python 3.14 recommended)
- PostgreSQL 16+ running locally (or via `docker compose up -d`)

### 2. Install Monorepo Dependencies
```bash
# Install root and package dependencies
pnpm install

# Build shared contracts package
pnpm --filter @mystore/contracts build
```

### 3. Start Canonical Python Backend

The backend runs the **same code** two ways — pick one:

```bash
# Option A — single-process modular monolith on http://localhost:4000
pnpm py:dev

# Option B — full microservices: gateway + 7 services on :4000–:4007
#   (auth 4001 · catalog 4002 · sales 4003 · delivery 4004 · hr 4005 · finance 4006 · platform 4007)
pnpm ms:all

# Run automated backend test suite
pnpm py:test
```

Frontends always call `http://localhost:4000`, so they work unchanged in either mode. In microservices mode the gateway routes every `/api/v1` prefix to a service and falls back in-process only if one is down. See the [Microservices, Docker & High-Concurrency Guide](docs/architecture/microservices-and-docker-guide.md).

### 4. Independent Multi-Server Web Applications

Each business role runs on its own dedicated server/port, all connected to the **Central Data Center API** (`http://localhost:4000`):

| Role / Application | Port | Dev Command | Description |
|---|---|---|---|
| **Store** (`apps/store`) | **`http://localhost:5001`** | `pnpm store:dev` | Customer Online Store: live catalog, cart, Bakong KHQR checkout, order history |
| **Admin** (`apps/web`) | **`http://localhost:5002`** | `pnpm admin:dev` | Enterprise Admin Control Hub: tenants, users, branches, audit |
| **Cashier** (`apps/cashier`) | **`http://localhost:5003`** | `pnpm cashier:dev` | Retail POS Terminal: barcode scan, touch catalog, split tender |
| **Delivery** (`apps/delivery`) | **`http://localhost:5004`** | `pnpm delivery:dev` | Courier Driver App: live dispatch route, GPS navigation, POD signature |
| **HR** (`apps/hr`) | **`http://localhost:5005`** | `pnpm hr:dev` | HR & Workforce: employee directory, department tree, payroll runner |
| **CEO** (`apps/ceo`) | **`http://localhost:5008`** | `pnpm ceo:dev` | Executive Command Center: revenue velocity curves, KPI analytics |
| **Data Center** (`services/backend-py`) | **`http://localhost:4000`** | `pnpm py:dev` | Central Data Center API (FastAPI + PostgreSQL) |

To run all applications together:
```bash
pnpm dev:all
```

---

### 5. Run Full Microservice Stack with Docker

You can launch the entire ecosystem (Data Center, All Microservices, and Web Apps) in isolated Docker containers:

```bash
# Build and start all microservices and database containers
docker compose up --build -d

# View live logs across all containers
docker compose logs -f

# Check container status
docker compose ps

# Stop all containers
docker compose down
```

---

## Quality Verification & CI/CD Gates

```bash
# Run unified quality gate (schema drift audit, 97 pytests, monorepo typecheck)
pnpm audit:check

# Run backend test suite (97 tests passed, 0 warnings)
pnpm py:test

# Run full monorepo typecheck across all 8 packages (Turborepo)
pnpm typecheck

# Build canonical multi-experience frontend (Vite 6)
pnpm --filter @mystore/web build
```

> 🛡️ **Automated Pre-Push Gate**: Installed via `.git/hooks/pre-push`. Any attempt to push code with database drift, test regressions, or TypeScript errors is automatically caught and blocked locally before reaching remote repositories.

---

## Distributed Observability & Telemetry

- **W3C Traceparent (`traceparent: 00-{traceId}-{spanId}-01`):** Propagated from edge Gateway through domain microservices to database queries.
- **Structured JSON Logging:** Emits JSON log lines correlated with `requestId`, `traceId`, and `spanId`.
- **OpenTelemetry Collector & Jaeger:** Runs locally via Docker Compose (`otel-collector` on `:4317/:4318`, Jaeger UI on `http://localhost:16686`).
- **Connection Resilience (PgBouncer):** Transaction pooling proxy on port `6432` guarding PostgreSQL connection limits under high concurrency.
