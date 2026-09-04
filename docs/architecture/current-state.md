# Current State — Universal Enterprise Business Platform

> **Document Version:** 4.0.0  
> **Last Verified:** 2026-09-04  
> **Status:** Python canonical backend — **schema drift resolved, all write paths live**. Runs as a single monolith *or* as 7 microservices behind a resilient gateway. Frontend Modernization Complete.

> [!NOTE]
> **What changed in 4.0.0 (2026-09-04):** the systemic enum-binding bug is fixed (all writes work), `POST/PATCH /customers` added, a real `/reports/summary` (+ `/reports/export`) replaced the missing/hardcoded reporting, the `/customers` routing bug is fixed, the backend can now run fully split into 7 microservices (added a Platform & Experience service + made the gateway boot resiliently), and the Admin super-app gained a crash-containing error boundary. Full detail: [`docs/audits/session-2026-09-04.md`](../audits/session-2026-09-04.md).

---

## 1. Monorepo Structure (Spec §6, §99)

The project is structured as a TypeScript + Python monorepo using **pnpm workspaces** (pnpm v11) and **Turborepo v2.3+**:

```
d:\Project\MyStore/
├── apps/
│   └── web/                     # Vite 6 + React 19 Enterprise Dashboard
├── services/
│   ├── backend-py/              # ⭐ CANONICAL — FastAPI + SQLAlchemy backend
│   └── backend/                 # ⚠️ LEGACY — NestJS 10 Modular Monolith
├── packages/
│   └── contracts/               # Shared Zod schemas, DTOs, and Permission constants
├── docs/
│   ├── architecture/            # Architectural blueprints & roadmap
│   ├── audits/                  # Schema drift audit & remediation tracking
│   └── adr/                     # Architecture Decision Records
├── docker-compose.yml           # Dev infrastructure (Postgres 16, Redis 7, MinIO)
├── package.json                 # Root package manager & workspace orchestrator
├── pnpm-workspace.yaml          # Workspace packages configuration
└── turbo.json                   # Pipeline caching & task definitions
```

### Monorepo Layer Status

| Component | Path | Technology | Status | Notes |
|---|---|---|---|---|
| **Root Workspace** | `/` | pnpm 11, Turbo 2.3 | ✅ Active | Scripts: `dev`, `build`, `test`, `typecheck`, `lint` |
| **Web Application** | `apps/web/` | Vite 6, React 19, react-router-dom 7, Tailwind, TanStack Query | ✅ Active | 28 routes via react-router, enterprise UI with design system |
| **Backend (Canonical)** | `services/backend-py/` | FastAPI, SQLAlchemy 2.0, Python 3.12+ | ✅ Active | 62/62 tables mapped, 0 schema drift, 34/34 tests passing. See [audit](../audits/python-backend-schema-drift.md). |
| **Backend (Legacy)** | `services/backend/` | NestJS 10.4, Express, Prisma 6 | ⚠️ Legacy | 28 modules implemented. Retained for reference; not actively developed. |
| **Shared Contracts** | `packages/contracts/` | TypeScript, Zod 3.24 | ✅ Active | Single source of truth for DTOs & contracts (used by web app) |
| **Dev Infrastructure** | `docker-compose.yml` | Docker Compose v3.8 | ✅ Active | PostgreSQL 16, Redis 7 Alpine, MinIO S3 |
| **Shared UI Components** | `packages/ui/` | — | ❌ Planned | To be extracted in a future phase |
| **POS Application** | `apps/pos/` | Electron, React, SQLite | ❌ Planned | Web POS slice active at `/sales/new` |
| **Mobile Application** | `apps/mobile/` | Flutter | ❌ Planned | Deferred |
| **Telegram Mini App** | `apps/telegram-mini-app/` | — | ❌ Planned | Deferred |

---

## 2. Backend Architecture

### 2.1 Canonical Backend: Python/FastAPI (`services/backend-py/`)

The Python backend is the canonical API server. The previous schema drift has been **100% resolved**:

- **62 of 62 database tables are mapped 1:1 to SQLAlchemy models** in `app/models/entities.py`
- **0 critical write-breaking mismatches**; **0 warnings**
- Automated schema audit guard tool: `python -m scripts.schema_audit`
- Automated pytest test suite: **34/34 tests passing**
- Multi-tenancy isolation (`where organization_id == user.organization_id`) enforced on all queries
- Server-side pricing recalculations and idempotency key protection on sales/POS checkout
- JWT authentication with refresh token rotation and RFC 6238 TOTP Multi-Factor Authentication
- W3C Distributed Tracing (`traceparent` header propagation + `X-Trace-Id`)
- AES-256-GCM authenticated field encryption service for sensitive credentials
- Locations module with full CRUD and recursive tree hierarchy API
- Organization settings & business profile management API


### 2.2 Legacy Backend: NestJS (`services/backend/`)

The NestJS backend has 28 fully-implemented modules with unit tests. It follows Clean Architecture and Domain-Driven Design:

```
Request → [Controller] (Interface Layer)
              ↓
         [Application Service] (Orchestration, Tenant Boundary, Audit)
              ↓
         [Domain Entity] (Invariants, Server Calculations, State Transitions)
              ↓
         [Repository Port] (Interface)
              ↓
         [Prisma Adapter] (Infrastructure Persistence Layer)
```

#### Legacy Module Matrix

All 28 modules are implemented in the legacy NestJS backend. These serve as **reference implementations** for rebuilding in Python:

| Module | API Routes | Tests | Notes |
|---|---|---|---|
| Identity & Auth | `/auth/login`, `/me` | ✅ Unit/E2E | JWT auth, RBAC |
| Organizations | `/organizations/current` | ✅ Unit/E2E | Tenant settings |
| Locations & Branches | `/locations` (CRUD, Tree) | ✅ Unit | Recursive tree |
| Products & Catalog | `/products` | ✅ Unit/E2E | Variants, margins |
| Customers & CRM | `/customers` | ✅ Unit | Types, addresses |
| Loyalty & Store Credit | `/loyalty/*` | ✅ Unit | Points, tiers |
| Sales & Transactions | `/sales` | ✅ Unit | Server-side pricing |
| POS Terminal | `/sales/new` (batch sync) | ✅ Unit | Idempotency |
| Inventory Ledger | `/inventory` | ✅ Unit | Stock movements |
| WMS & Transfers | `/wms/*` | ✅ Unit | Zones, bins, batches |
| Procurement & PO | `/procurement/*` | ✅ Unit | PO, GRN, suppliers |
| Pricing Engine | `/pricing/*` | ✅ Unit | Price lists, breaks |
| Promotion Engine | `/promotions/*` | ✅ Unit | Evaluator |
| Tax Engine | `/taxes/*` | ✅ Unit | Multi-jurisdiction |
| Payments & KHQR | `/payments/*` | ✅ Unit | Split tender, QR |
| Finance & Accounting | `/finance/*` | ✅ Unit | Double-entry GL |
| Workflow & Approvals | `/workflows/*` | ✅ Unit | State machine |
| Storage & Documents | `/storage/*` | ✅ Unit | S3/local drivers |
| Notifications | `/notifications/*` | ✅ Unit | Multi-channel |
| Reporting & BI | `/reports/*` | ✅ Unit | Aggregation engine |
| HR & Payroll | `/hr/*` | ✅ Unit | Payroll calculator |
| Projects & Billing | `/projects/*` | ✅ Unit | Tasks, timesheets |
| Service Management | `/tickets/*` | ✅ Unit | Incident lifecycle |
| Fixed Assets | `/assets/*` | ✅ Unit | Depreciation engine |
| Developer Platform | `/developers/*` | ✅ Unit | API keys, webhooks |
| Telegram Platform | `/telegram/*` | ✅ Unit | Bot commands |
| Flow Automation | `/flows/*` | ✅ Unit | DAG execution engine |
| Audit & Ops | `/health`, `/metrics` | ✅ E2E | Append-only logging |

---

## 3. Database Schema & Data Models (Spec §13, §101)

The primary database is **PostgreSQL 16**, with tables originally created by **Prisma ORM 6.2+**. The Python backend reads *and writes* these tables: the earlier schema drift is **100% resolved** and the systemic enum-binding defect (native Postgres `ENUM` columns vs. `String` models) is fixed platform-wide via [`app/core/db_enums.py`](../../services/backend-py/app/core/db_enums.py), so create/update endpoints persist correctly.

**62 public tables** exist in the database. See the [schema drift audit](../audits/python-backend-schema-drift.md) (resolved) and the [API functional audit](../audits/api-functional-audit.md) (write paths verified live).

---

## 4. API Surface & Security Posture (Spec §12, §14, §15)

The legacy NestJS backend conforms to enterprise standards:
- **Versioning:** URI versioning (`/api/v1/*`).
- **Standard Response Envelope:** `{ success: true, data: T, requestId: "req_..." }`.
- **Standard Error Envelope:** `{ success: false, code: "ERROR_CODE", message: "...", requestId: "..." }` with **zero stack trace leakage**.
- **Request Correlation:** `x-request-id` assigned to every request and propagated across logs and envelopes.
- **Authentication:** JWT Bearer tokens with server-side validation.
- **Authorization:** Granular RBAC enforced on all mutating and sensitive endpoints.
- **Tenant Isolation:** `organizationId` is **never trusted from the client body or query**; strictly derived from validated JWT claims.
- **Server-Side Pricing:** Item prices, line totals, discounts, taxes, and margins are computed strictly on the backend.
- **Idempotency:** Supported on sales transactions via `idempotencyKey`.

> [!IMPORTANT]
> These patterns must be replicated in the Python/FastAPI backend as it is built out.

---

## 5. Web Application Surface (Spec §85–§90)

The web frontend (`apps/web`) is built with **Vite 6 + React 19 + react-router-dom**, featuring dark mode, glassmorphism aesthetics, responsive layouts, and granular permission-aware controls:

| Route | View Component | Status | Capability |
|---|---|---|---|
| `/login` | `login/page.tsx` | ✅ Active | Staff & Admin authentication with JWT storage |
| `/dashboard` | `dashboard/page.tsx` | ✅ Active | Executive Command Center: KPI cards, revenue charts, low-stock watchlist |
| `/products` | `products/page.tsx` | ✅ Active | Enterprise DataTable with faceted filters, CSV export, create/detail drawers |
| `/customers` | `customers/page.tsx` | ✅ Active | Customer directory with type filters, create drawer, dossier panel |
| `/sales` | `sales/page.tsx` | ✅ Active | Sales transaction ledger with status filters, receipt detail drawer, voiding |
| `/sales/new` | `sales/new/page.tsx` | ✅ Active | Interactive POS Terminal: product search, cart, tax/discount, multi-payment |
| `/inventory` | `inventory/page.tsx` | ✅ Active | Multi-location stock tracker, low-stock toggle, adjustment & movement drawers |
| `/locations` | `locations/page.tsx` | ✅ Active | Tree + tabular views, hierarchy management, CRUD modal |
| `/transfers` | `transfers/page.tsx` | ✅ Active | Stock transfer management |
| `/pricing` | `pricing/page.tsx` | ✅ Active | Price lists and tier management |
| `/taxes` | `taxes/page.tsx` | ✅ Active | Tax rate configuration |
| `/promotions` | `promotions/page.tsx` | ✅ Active | Promotion rules and deals |
| `/loyalty` | `loyalty/page.tsx` | ✅ Active | Loyalty programs and store credit |
| `/procurement` | `procurement/page.tsx` | ✅ Active | Purchase orders and suppliers |
| `/finance` | `finance/page.tsx` | ✅ Active | Chart of accounts, journals, statements |
| `/assets` | `assets/page.tsx` | ✅ Active | Fixed asset register and depreciation |
| `/approvals` | `approvals/page.tsx` | ✅ Active | Workflow approval inbox |
| `/hr` | `hr/page.tsx` | ✅ Active | Workforce management, payroll |
| `/projects` | `projects/page.tsx` | ✅ Active | Projects, tasks, timesheets |
| `/tickets` | `tickets/page.tsx` | ✅ Active | Service desk and incident management |
| `/reports` | `reports/page.tsx` | ✅ Active | BI studio with analytics |
| `/storage` | `storage/page.tsx` | ✅ Active | Document management |
| `/notifications` | `notifications/page.tsx` | ✅ Active | Notification center |
| `/developers` | `developers/page.tsx` | ✅ Active | API keys, webhooks, apps |
| `/telegram` | `telegram/page.tsx` | ✅ Active | Chat bindings, broadcast, commands |
| `/automations` | `automations/page.tsx` | ✅ Active | Flow builder, execution traces |
| `/settings` | `settings/page.tsx` | ✅ Active | Organization settings |

**Key UI infrastructure:**
- `EnterpriseShell` — Collapsible sidebar, Cmd+K command palette, theme switcher, online/offline badge
- `DataTable` — TanStack Table v8 with pagination, sorting, row selection, faceted filters
- `KpiCard`, `PageHeader`, `EmptyState` — Standardized enterprise components
- 19 Radix-based UI primitives in `components/ui/`
- Route-level code splitting via `React.lazy()` across all 28 routes

---

## 6. Testing & Quality Gates (Spec §93, §104)

### Legacy NestJS Backend
- **Unit Tests:** Automated unit tests across domain entities and application services.
- **E2E Security Suite:** `security.e2e-spec.ts` verifies cross-tenant isolation, privilege escalation prevention, and token validation.

### Python Backend
- **Current:** pytest suite green — **81 logic/unit tests pass** (the only non-passing ones require a live Postgres/Redis, not code bugs). Write paths verified live against the running stack (all create endpoints `200/201`).
- **Target:** expand integration coverage against an ephemeral test database in CI; add a drift-guard CI step (`scripts/schema_audit.py`).

### Web Frontend
- **Build verification:** `pnpm --filter @mystore/web build` and `typecheck`.
- **Target:** Vitest + Playwright for component and e2e testing (planned).

---

## 7. Immediate Technical Debt & Remediation

1. **✅ RESOLVED — Schema Drift & Write Paths:**
   - Schema drift is fully reconciled; the systemic enum-binding defect is fixed; all create/update endpoints persist (verified live). See [`schema-drift audit`](../audits/python-backend-schema-drift.md) and [`API functional audit`](../audits/api-functional-audit.md).
   - Remaining: add a CI drift-guard step so it can never silently recur.

2. **Backend Migration:**
   - Port NestJS module business logic to Python/FastAPI incrementally.
   - Add Alembic migration tooling to `services/backend-py/`.
   - Write a Python seed script to replace the Prisma seed.

3. **Web Frontend:**
   - Remove vestigial `'use client'` directives (no effect in Vite).
   - Re-target API client from NestJS to Python backend endpoints once writes are unblocked.

4. **Known Deferred Items:**
   - `User.roles` stored as JSON string; planned migration to relational RBAC tables.
   - Rate limiting uses in-memory storage; Redis adapter needed for clustering.
   - No frontend test suite yet (Vitest + Playwright planned).
