# Current State — Universal Enterprise Business Platform

> **Document Version:** 5.0.0  
> **Last Verified:** 2026-09-06  
> **Status:** Python canonical backend — **Enterprise Architecture Modernization Complete**. 97/97 tests passing (0 warnings). Relational RBAC normalized, God-routers decomposed, OpenTelemetry distributed tracing integrated, PgBouncer deployed, automated pre-push gate active.

> [!NOTE]
> **What changed in 5.0.0 (2026-09-06):**
> 1. **Datetime Deprecation Swept:** Migrated `datetime.utcnow()` across 25 files to `utc_now()`, eliminating all 58 Pytest deprecation warnings.
> 2. **REST Auth Hardened:** Isolated `?token=` parameter strictly to SSE and WebSocket streaming; standard REST mandates `Authorization: Bearer <token>`.
> 3. **Relational RBAC Normalization:** Populated `user_roles` table across 853 users with 876 assignments; added dual-write and dual-read via `selectinload`.
> 4. **God-Router Decomposition:** Decomposed 1,007-line `automations/api.py` (4 sub-controllers) and 867-line `sales/api.py` (3 sub-controllers + helpers).
> 5. **Distributed Observability:** Implemented OpenTelemetry W3C traceparent propagation and structured JSON logging (`app/core/telemetry.py`), verified via `test_telemetry.py`.
> 6. **Infrastructure Resilience:** Added PgBouncer connection pooling, OTLP Collector, and Jaeger to Docker Compose.
> 7. **CI/CD Quality Gate:** Installed `pnpm audit:check` and `.git/hooks/pre-push` blocking schema drift, test failures, or typecheck errors. Full detail: [`docs/audits/session-2026-09-06.md`](../audits/session-2026-09-06.md).

---

## 1. Monorepo Structure (Spec §6, §99)

The project is structured as a TypeScript + Python monorepo using **pnpm workspaces** (pnpm v11) and **Turborepo v2.3+**:

```
d:\Project\MyStore/
├── apps/
│   ├── web/                     # ⭐ Vite 6 + React 19 Enterprise Multi-Experience SPA
│   ├── cashier/                 # Retail POS Terminal
│   ├── delivery/                # Driver Delivery Dispatch
│   ├── store/                   # Public Online Storefront
│   ├── hr/                      # HR & Workforce Management
│   └── ceo/                     # CEO Executive Command Center
├── services/
│   ├── backend-py/              # ⭐ CANONICAL — FastAPI + SQLAlchemy 2.0 backend (97 tests)
│   └── backend/                 # ⚠️ LEGACY — NestJS 10 (retained for reference)
├── packages/
│   └── contracts/               # Shared Zod schemas, DTOs, and Permission constants
├── infra/                       # OpenTelemetry Collector & telemetry configurations
├── docs/                        # Architectural blueprints, playbooks, audits
├── docker-compose.yml           # Dev infrastructure (Postgres 16, Redis 7, PgBouncer, Jaeger)
├── package.json                 # Root package manager & workspace orchestrator
├── pnpm-workspace.yaml          # Workspace packages configuration
└── turbo.json                   # Pipeline caching & task definitions
```

### Monorepo Layer Status

| Component | Path | Technology | Status | Notes |
|---|---|---|---|---|
| **Root Workspace** | `/` | pnpm 11, Turbo 2.3 | ✅ Active | Scripts: `dev`, `build`, `test`, `typecheck`, `lint` |
| **Web Application** | `apps/web/` | Vite 6, React 19, react-router-dom 7, Tailwind, TanStack Query | ✅ Active | 28 routes via react-router, enterprise UI with design system |
| **Backend (Canonical)** | `services/backend-py/` | FastAPI, SQLAlchemy 2.0, Python 3.12+ | ✅ Active | 68 tables mapped, 0 schema drift, 97/97 tests passing (0 warnings). See [audit](../audits/session-2026-09-06.md). |
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

- **68 database tables are mapped to SQLAlchemy models** in `app/models/entities.py`
- **0 critical write-breaking mismatches**; **0 warnings**
- Automated schema audit guard tool: `python services/backend-py/scripts/schema_audit.py`
- Automated quality gate: `pnpm audit:check`
- Automated pytest test suite: **97/97 tests passing (0 warnings)**
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

### Automated Multi-Tier Quality Gate (`pnpm audit:check`)
- **Schema Drift Guard:** Executed automatically (`scripts/schema_audit.py`); enforces 0 schema drift between PostgreSQL 16 and SQLAlchemy models.
- **Python Backend Suite:** **97/97 tests pass (100% passing, 0 warnings)** across all domain modules, workflows, order alerts, security, and telemetry.
- **TypeScript Workspace Typecheck:** 8/8 packages pass cleanly (`contracts`, `web`, `store`, `cashier`, `delivery`, `hr`, `ceo`, `ui`).
- **Turborepo Production Build:** 8/8 packages build with zero compilation errors.
- **Git Pre-Push Hook:** `.git/hooks/pre-push` actively blocks non-compliant commits before push.

### Web Frontend & E2E Testing
- **E2E Browser Regression Suite:** Playwright test suite (`apps/web/playwright.config.ts`, `apps/web/e2e/auth-flow.spec.ts`, `apps/web/e2e/catalog-checkout.spec.ts`).
- **CI Workflow Integration:** GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, pytests, build, and Playwright E2E tests.

---

## 7. Modernization & Scaling Status (Completed)

1. **✅ RESOLVED — Schema Drift & Native Enums:**
   - 68 PostgreSQL tables mapped 1:1 to SQLAlchemy models with native `pg_enum` bindings. 0 drift, 0 warnings.
2. **✅ RESOLVED — Relational RBAC Normalization:**
   - Backfilled 853 users into normalized `user_roles` table with 876 assignments. Dual-write and dual-read via `selectinload` active in `identity/models.py` and `dependencies.py`.
3. **✅ RESOLVED — Distributed Sliding-Window Rate Limiting:**
   - Upgraded `app/core/rate_limiter.py` to Redis atomic ZSET sliding windows with fallback.
4. **✅ RESOLVED — Distributed Tracing & Observability:**
   - W3C `traceparent` propagation and structured JSON logging (`app/core/telemetry.py`) integrated into Gateway and microservices. Configured with OTLP Collector and Jaeger.
5. **✅ RESOLVED — Database Connection Resilience:**
   - Deployed PgBouncer transaction pooling (port 6432, 2,000 max clients) in Docker Compose.
6. **✅ RESOLVED — Read-Replica BI Query Routing:**
   - Implemented `get_read_db` in `app/core/database.py` routing heavy reporting queries to `postgres-replica` (port 5434).
7. **✅ RESOLVED — Kubernetes Autoscaling (HPA):**
   - Created production K8s manifests in `infra/k8s/` (`namespace.yaml`, `gateway-hpa.yaml`, `microservices-hpa.yaml`) scaling 2–12 pods based on CPU/memory load.
8. **✅ DELIVERED — Per-Service Database Saga Blueprint:**
   - Authored `docs/architecture/microservices-per-service-database.md` outlining schema isolation and saga compensation for team-level scaling.
