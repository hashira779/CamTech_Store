# Enterprise Platform Engineering & Operational Guidelines

This document provides definitive guidelines for developers, operators, and administrators working with the **MyStore Universal Enterprise Business Platform**.

---

## 1. Developer Setup & Environment Guidelines

### 1.1 Technology Stack & Monorepo Layout
- **Monorepo Manager**: Turborepo + pnpm (`pnpm@11.24.0`)
- **Backend API (Canonical)**: Python 3.12+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16
- **Backend API (Legacy)**: NestJS 10, Prisma ORM 6 — retained for reference, **not actively developed**
- **Frontend Console**: Vite 6, React 19, react-router-dom 7, Tailwind CSS, TanStack Query, Lucide Icons
- **Shared Contracts**: `@mystore/contracts` with TypeScript types and Zod schemas (consumed by the web app)

```
MyStore/
├── packages/
│   └── contracts/          # Pure TypeScript types, Zod schemas, permissions
├── services/
│   ├── backend-py/         # ⭐ CANONICAL — FastAPI + SQLAlchemy backend
│   │   ├── app/            # Routers, models, services
│   │   ├── scripts/        # Schema audit and utilities
│   │   └── tests/          # pytest test suites
│   └── backend/            # ⚠️ LEGACY — NestJS modular monolith (retained for reference)
│       ├── prisma/         # Database schema that created the current tables
│       ├── src/modules/    # 28 Domain Vertical Slices
│       └── test/           # E2E multi-tenancy and security suites
├── apps/
│   └── web/                # Vite + React 19 enterprise management dashboard
│       ├── app/            # Route pages (/sales, /finance, /automations, etc.)
│       ├── components/     # Reusable UI shell, tables, modals
│       └── lib/            # Typed API client, auth stores
└── docs/                   # Architecture maps, ADRs, and guidelines
```

> [!WARNING]
> **Schema Drift:** The PostgreSQL database was created by the legacy NestJS/Prisma stack. The Python SQLAlchemy models have drifted from it — see [`docs/audits/python-backend-schema-drift.md`](audits/python-backend-schema-drift.md) for the full audit. Write endpoints in the Python backend are broadly broken until the schema reconciliation (Option A or B) is completed.

### 1.2 Step-by-Step Initial Setup
1. **Clone repository and install dependencies**:
   ```powershell
   pnpm install
   ```
2. **Build the shared contracts package** (for the web frontend):
   ```powershell
   pnpm --filter @mystore/contracts build
   ```
3. **Initialize Database & Seed Data**:
   Ensure PostgreSQL is running on `localhost:5432` with database `camtechStore`.

   *Current state (using legacy Prisma schema — until Python migration completes):*
   ```powershell
   pnpm --filter backend exec prisma db push
   pnpm --filter backend exec prisma generate
   pnpm --filter backend exec npx tsx prisma/seed.ts
   ```

   *Target state (after schema reconciliation — Option A):*
   ```bash
   cd services/backend-py
   alembic upgrade head
   python app/seed.py
   ```
4. **Launch Development Servers**:
   ```powershell
   pnpm dev
   ```
   - **Web UI**: [http://localhost:3000](http://localhost:3000)
   - **Python Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Health & Metrics**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 2. Architecture & Code Quality Guidelines

### 2.1 Multi-Tenancy & Isolation (Non-Negotiable)
- **Mandatory Tenant Filtering**: Every database query must scope to `where organization_id = :org_id`. Never rely on client-supplied organization IDs in request bodies; always extract `user.organization_id` from the verified JWT.
- **Foreign Key Integrity**: All models must include `organization_id` as a foreign key with proper cascading constraints.

### 2.2 Security & Permissions
- **Endpoint Protection**: Every mutation or query endpoint (except public webhooks/health) must verify JWT and check permissions.
- **Public Endpoints**: Endpoints that must be accessible without JWT authorization (e.g. `/health`, `/metrics`, `/telegram/webhook`, `/flows/:id/webhook`) must be explicitly exempted.
- **SSRF Defense**: Outbound HTTP requests (e.g. webhooks, automation flow nodes) must pass URL safety checks to reject local loopback (`127.0.0.1`, `localhost`), link-local metadata IPs (`169.254.169.254`), and private subnets (`10.0.0.0/8`, `192.168.0.0/16`).
- **Cryptographic Key Safety**: Never store raw API secrets. Persist only SHA-256 hashes (`keyHash`) with prefix indexing (`keyPrefix`). Compute HMAC-SHA256 signatures for webhook payloads.

### 2.3 Pure Domain Logic Segregation
- Complex business logic (financial statement generation, depreciation schedules, FEFO batch allocation, payroll calculation, flow graph traversal) must live in **pure, framework-free domain classes**.
- Domain engines must have comprehensive test coverage isolated from database mocks.

---

## 3. Operational Guidelines for Core Domains

### 3.1 Point of Sale (POS) & Checkout (`/sales/new`)
- **Fast Cashier Workflow**: Use the barcode scanner search bar to add items to cart.
- **Split Tenders**: Supports split payments across Cash, Bakong KHQR, and Card.
- **Offline Resilience**: Offline transactions are staged in IndexedDB/LocalStorage and automatically synchronized upon reconnecting.

### 3.2 Finance & General Ledger (`/finance`, `/assets`)
- **Double-Entry Principle**: Every transaction creates balanced journal entry lines ($\sum \text{Debits} = \sum \text{Credits}$).
- **Fixed Assets**: Capitalize assets under `/assets`, configure useful life (months) and salvage value, and trigger monthly depreciation using Straight-Line or Declining-Balance methods.

### 3.3 Flow Automation Engine (`/automations`)
- **Graph Builder (n8n-style)**:
  - **Triggers**: Manual runs, inbound webhooks (`/api/v1/flows/:id/webhook`), system events (order created, low stock).
  - **Conditions**: Set comparison rules (`field`, `operator`, `value`). Flow branches to `true` or `false` target nodes.
  - **Actions**: Trigger Telegram broadcast, open Service Desk incident ticket, send In-App alert, or post HTTP webhook.
- **Execution Tracing**: Inspect the execution trace drawer to debug step-by-step input/output payloads and execution durations in milliseconds.

### 3.4 Telegram Operations Platform (`/telegram`)
- **Chat Linking**: Bind group or manager Telegram chat IDs with specific operational roles (`OPERATOR`, `BRANCH_MANAGER`).
- **Slash Commands**:
  - `/sales`: Daily sales revenue and order counts.
  - `/stock`: Depleted and low inventory list.
  - `/orders`: Transaction and pending workflow counts.
  - `/approve <id>`: Sign off workflow approval requests.
  - `/help`: Command directory.
- **Emergency Broadcast**: Use "Broadcast Alert" to dispatch notifications to all active bound chats.

### 3.5 Developer & Partner Platform (`/developers`)
- **Scoped API Keys**: Generate API keys with restricted permissions (`products:read`, `sales:write`, etc.) and rate limits. The raw token is revealed only once.
- **Webhooks**: Register HTTPS endpoints to subscribe to real-time events (`order.created`, `inventory.low_stock`, etc.).

---

## 4. Verification & Testing Checklist

Before opening a pull request or deploying to production, execute the standard verification pipeline:

```powershell
# 1. Run Python backend tests
cd services/backend-py && python -m pytest

# 2. Build the web frontend
pnpm --filter @mystore/web build

# 3. Run TypeScript typecheck across web & contracts
pnpm --filter @mystore/web typecheck
pnpm --filter @mystore/contracts build
```

> [!NOTE]
> The legacy NestJS backend tests can still be run with `pnpm --filter backend test` for reference, but they are no longer part of the primary verification pipeline.
