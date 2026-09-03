# MyStore Platform — Universal Enterprise Business Platform (2026–2027)

> **Platform Status:** All 27 Enterprise Vertical Slices Active & Verified (Commerce, Supply Chain, Finance & GL, HR & Payroll, Fixed Assets, Projects, Service Desk, Developer Platform, Telegram Bot, Flow Automations)  
> **Comprehensive Guidelines:** [docs/GUIDELINES.md](docs/GUIDELINES.md)  
> **Architecture Reference:** [docs/architecture/module-map.md](docs/architecture/module-map.md) · [docs/architecture/current-state.md](docs/architecture/current-state.md)

---

## What Works Today

| Layer | Implemented & Verified Capabilities |
|---|---|
| **Backend (NestJS)** | 27 vertical slices across `/api/v1/*` (Products, WMS, Sales, Finance, Assets, HR, Projects, Tickets, Developers, Telegram, Flows) |
| **Architecture** | Clean Architecture / DDD: Controller → Application Service → Domain Entity / Calculators → Prisma Adapter |
| **Database** | PostgreSQL 16 with Prisma 6: 28+ relational models, high-precision monetary math (`Decimal(14, 4)`), tenant isolation |
| **Cross-Cutting** | JWT auth, RBAC permissions, SSRF protection, strict tenant isolation, audit logging, Swagger at `/api/docs` |
| **Enterprise Ops** | Security headers (Helmet), rate limiting (Throttler), `/health` · `/ready` · `/metrics` (Prometheus) |
| **Web Frontend** | Next.js 15 App Router: 31 prerendered management pages including POS Terminal (`/sales/new`), General Ledger (`/finance`), and n8n-style Flow Automations (`/automations`) |
| **Shared Contracts** | `@mystore/contracts`: Single source of truth for DTOs, Zod schemas, and permission constants |
| **Tests** | **44 automated unit test suites (181 tests passing 100%)** + **7 e2e security tests** |

---

## Tech Stack

- **Monorepo:** pnpm 11 Workspaces + Turborepo 2.3+
- **Backend:** NestJS 10, TypeScript 5.7, Prisma 6, Express, Helmet, Prometheus client
- **Database:** PostgreSQL 16/18
- **Dev Infrastructure:** Docker Compose (PostgreSQL 16, Redis 7, MinIO S3)
- **Web Client:** Next.js 15.5 App Router, React 19, Tailwind CSS, TanStack Query, React Hook Form, Zustand, Lucide Icons
- **Shared Package:** Zod 3.24, TypeScript

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL 16+ running locally (or via `docker compose up -d`)

### 2. Install & Build Contracts
```bash
# Install monorepo dependencies
pnpm install

# Build shared contracts package
pnpm --filter @mystore/contracts build
```

### 3. Database Setup & Seed
```bash
# Push schema and seed enterprise test data
pnpm --filter @mystore/backend db:setup
```

### 4. Start Services
```bash
# Start backend API (runs on http://localhost:4000)
pnpm backend:dev

# Start web client (runs on http://localhost:3000)
pnpm web:dev

# Or run both concurrently via Turborepo:
pnpm dev
```

---

## Demo Credentials (Seeded)

| Email | Password | Role | Access Scope |
|---|---|---|---|
| `admin@demo.test` | `Admin123!` | `ORG_ADMIN` | Full unrestricted enterprise access |
| `cashier@demo.test` | `Cashier123!` | `CASHIER` | Scoped to Central Cafe branch; read-only on catalog, access to POS terminal |

Sign in as `cashier@demo.test` to observe RBAC: product creation forms disappear and `POST /products` is rejected with `403 INSUFFICIENT_PERMISSIONS`.

---

## Automated Quality Verification

```bash
# Run all unit tests across the monorepo (21 tests)
pnpm test

# Run the end-to-end security & multi-tenancy suite (7 tests)
pnpm --filter @mystore/backend test:e2e

# Run strict typecheck across all packages
pnpm typecheck

# Run monorepo linting
pnpm lint

# Run full production build
pnpm build
```

---

## Canonical Architecture Documentation

Complete specifications are maintained in the [`docs/architecture/`](docs/architecture/) directory:

- [**Target State Blueprint**](docs/architecture/target-state.md): Long-term architectural design for multi-tenancy, domain engines, offline POS, event bus, and AI platform.
- [**Current State Audit**](docs/architecture/current-state.md): Detailed verification of the active codebase, schema, and API surface.
- [**Module Map**](docs/architecture/module-map.md): Capability and readiness matrix across all 28 enterprise modules.
- [**Dependency Map**](docs/architecture/dependency-map.md): Data ownership boundaries, synchronous/asynchronous flows, and checkout sequence diagrams.
- [**Implementation Roadmap**](docs/architecture/implementation-roadmap.md): Phased execution roadmap from Phase 0 to Phase 6 with quality gates.
