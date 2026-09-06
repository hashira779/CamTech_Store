# AGENTS.md — Working & Scaling Playbook for MyStore

This file is for the next contributor — human or AI — who will **extend, fix, or scale** this platform.
It captures the conventions that are easy to violate, the repeatable flows for adding features, and the
long-term scaling path. Read it before changing code. Keep it up to date when a convention changes.

> Orientation first: [`README.md`](README.md) · [`docs/architecture/current-state.md`](docs/architecture/current-state.md) ·
> [`docs/architecture/microservices-and-docker-guide.md`](docs/architecture/microservices-and-docker-guide.md) ·
> [`docs/architecture/90-engineering-principles.md`](docs/architecture/90-engineering-principles.md) ·
> latest change log [`docs/audits/session-2026-09-06.md`](docs/audits/session-2026-09-06.md).

---

## 0. The shape of the system (30 seconds)

- **Backend** = `services/backend-py` (FastAPI + SQLAlchemy 2.0 async + asyncpg). It is a **modular monolith**
  (`app/modules/<domain>/`) that ALSO runs as **7 microservices** (`app/microservices/`) behind a gateway on `:4000`.
  Same code, two deployment shapes. `services/backend` (NestJS) is **legacy — do not develop it**.
- **Frontend** = `apps/web` is the canonical multi-experience SPA (Vite 6 + React 19). `apps/{store,cashier,delivery,hr,ceo}`
  are standalone build targets. All frontends call `http://localhost:4000/api/v1`.
- **Contracts** = `packages/contracts` — shared TypeScript DTO/enum definitions used by the frontend.
- **Data** = PostgreSQL 16 (`camtechStore`, native ENUM types, 62 tables) + Redis 7 (event queue / outbox).

---

## 1. Golden rules (violating these breaks things silently)

1. **Enum columns MUST bind to the native Postgres type.** Never `Column(String)` for an enum column — use
   `Column(pg_enum("TypeName"))` from [`app/core/db_enums.py`](services/backend-py/app/core/db_enums.py). A bare
   varchar makes asyncpg 500 with `DatatypeMismatchError` on insert. New enum type? Add its labels to `ENUM_LABELS`.
2. **Every JSON response is auto-wrapped** as `{ success, data, requestId }` by middleware (monolith: `app/main.py`;
   microservices: `app/microservices/common.py`). The frontend api-client does `if (!body.success) throw; return body.data`.
   If you add a new FastAPI app, it MUST apply that same envelope, or the frontend breaks on every call.
3. **Tenant scoping is not optional.** Every query filters `where organization_id == user.organization_id`, taken from the
   JWT (`get_current_user`) — **never** from the request body/query. New endpoints follow this.
4. **No hardcoded/mock data.** Compute responses from the database. (The reporting module was hardcoded and was replaced —
   don't reintroduce that pattern.)
5. **DB column names are camelCase; Python attributes are snake_case.** Map them explicitly:
   `created_at = Column("createdAt", DateTime, ...)`. Match the existing Prisma-created column names exactly.
6. **Keep contracts in sync.** If you change a DTO shape the frontend consumes, update `packages/contracts` and the
   backend Pydantic schema together.
7. **A microservice must load the full model registry.** `create_microservice()` imports `app.models.entities` so every
   service can resolve cross-module relationships. If you build services a new way, keep that import or you get
   `KeyError: '<Model>'` 500s.
8. **The gateway must boot even if a module is broken.** Its fallback import is lazy/guarded (`get_fallback_app()`).
   Don't move `from app.main import app` back to module top level — that recouples gateway health to every file compiling.
9. **Strictly adhere to the 90 Engineering & Architecture Principles Playbook ([`docs/architecture/90-engineering-principles.md`](docs/architecture/90-engineering-principles.md)).**
   All contributions must satisfy core flow, OOP/DDD invariants, DRY/KISS, native enum data integrity, tenant isolation,
   statelessness, security-by-design, observability, and backward-compatible contract evolution.
10. **Strict prohibition on auto-seeding or mock data scripts in production.** Never write or execute scripts that
    generate mock data, dummy sales, fake customers, or automated test records against the remote production database.
    Automated seeding and test fixtures are **STRICTLY CONFINED TO LOCAL DEVELOPMENT (`localhost`) ON YOUR PC**.
    Production data may only be altered via verified DDL migrations or explicit, direct user instructions.

---

## 2. Run & verify

```bash
# Backend — pick ONE:
pnpm py:dev          # single-process monolith on :4000
pnpm ms:all          # gateway + 7 services on :4000–:4007

# Frontend (each its own port; all call :4000):
pnpm admin:dev       # :5002   (also store:dev/cashier:dev/delivery:dev/hr:dev/ceo:dev)

# Checks:
pnpm py:test                        # backend tests
pnpm --filter @mystore/web typecheck
```

Demo logins: `admin@demo.test / Admin123!` (ORG_ADMIN), `cashier@demo.test / Cashier123!`.
DB: `postgresql://camtech:camtech123@localhost:5432/camtechStore`.

**Definition of done for any change:** it imports clean, it typechecks, and you exercised the real endpoint/screen
(a `200/201` with the expected data, or the UI rendering it) — not just "the code looks right".

---

## 3. Repeatable flows

### Flow A — Add a new backend domain module
1. Create `app/modules/<domain>/{models.py, schemas.py, api.py, __init__.py}`.
2. In `models.py`: subclass `Base`; snake_case attrs mapped to camelCase columns; **enum cols via `pg_enum(...)`**;
   include `organization_id` FK.
3. In `api.py`: `router = APIRouter(tags=[...])`; every route takes `user = Depends(get_current_user)` and
   `db = Depends(get_db)`; filter by `user.organization_id`.
4. Register the model in [`app/models/entities.py`](services/backend-py/app/models/entities.py) (import it) so it joins the registry.
5. Mount the router in [`app/main.py`](services/backend-py/app/main.py) with `prefix="/api/v1"`.
6. Verify: `POST`/`GET` return `200/201` and persist.

### Flow B — Put a module behind a microservice
1. Add its router to the right service file in `app/microservices/` (or the catch-all
   [`platform_service.py`](services/backend-py/app/microservices/platform_service.py)).
2. If it needs its own service, copy an existing `*_service.py`, pick a new port, add `ms:<name>` to `package.json`,
   include it in `ms:all`, and add a container to `docker-compose.yml`.
3. Add its URL prefix(es) to `ROUTING_MAP` in [`gateway.py`](services/backend-py/app/microservices/gateway.py)
   (or rely on the platform catch-all).
4. Verify through the gateway: `curl :4000/api/v1/<route>` returns an **enveloped** `200`.

### Flow C — Add a new frontend route/experience
1. Add the page under `apps/web/app/<route>/page.tsx` and a `<Route>` in the owning shell
   (`apps/web/src/apps/<shell>/*App.tsx`).
2. If it's a new top-level experience, add a branch in [`apps/web/src/App.tsx`](apps/web/src/App.tsx) — use a
   **path-boundary match** (`p === '/x' || p.startsWith('/x/')`), never a bare `startsWith('/x')` (that swallows siblings,
   which is exactly the bug that sent `/customers` to the customer portal).
3. Call the backend only through `apps/web/lib/api-client.ts`.
4. Wrap risky subtrees in `<ErrorBoundary>` if they can crash independently.

### Flow D — Verify end-to-end (the loop that catches real bugs)
1. Log in via `POST /api/v1/auth/login` → get token.
2. Hit the endpoint with a realistic payload; assert `200/201` and the persisted shape.
3. Open the screen in the browser; confirm it renders real data and the network call is `200`.
4. **Clean up any test rows you created** (this is a real DB).

---

## 4. Long-term scaling roadmap (Status & Execution State)

1. **CI gates (cheapest, highest value):** [✅ DELIVERED]
   - Unified `"audit:check"` gate in `package.json` (`schema_audit.py`, `py:test`, `typecheck`).
   - Installed `.git/hooks/pre-push` actively blocking drift, test breaks, or type errors locally before push.
2. **Remove the two real single points of failure:** [✅ DELIVERED]
   - **PostgreSQL HA & Connection Resilience:** Added `pgbouncer` container (`edoburu/pgbouncer:latest`, port 6432, 2,000 clients). Added `postgres-replica` container (port 5434). Implemented `get_read_db` in [`app/core/database.py`](services/backend-py/app/core/database.py) routing BI reporting reads to the replica.
   - **Multi-Replica Gateway:** Gateway runs with `--workers 4` in production and scales horizontally via K8s HPA.
3. **Observability:** [✅ DELIVERED]
   - Implemented [`app/core/telemetry.py`](services/backend-py/app/core/telemetry.py) extracting/minting W3C `traceparent` headers (`00-{traceId}-{spanId}-01`).
   - Structured JSON logging with `requestId`, `traceId`, and `spanId`. Configured `otel-collector` (ports 4317/4318) and Jaeger UI (port 16686) in Docker Compose. Verified via `test_telemetry.py`.
4. **True service independence (when a domain needs to scale alone):** [✅ BLUEPRINT DELIVERED]
   - Authored [`docs/architecture/microservices-per-service-database.md`](docs/architecture/microservices-per-service-database.md) detailing schema isolation for `camtechDelivery` and `camtechHr`, transactional outbox events, saga compensation, and DLQ policies.
5. **Auth hardening:** [✅ DELIVERED]
   - Migrated `User.roles` to normalized relational `user_roles` table, backfilled 853 users with 876 assignments (`scripts/backfill_user_roles.py`). Implemented dual-write and dual-read via `selectinload`.
   - Hardened rate-limiting in [`app/core/rate_limiter.py`](services/backend-py/app/core/rate_limiter.py) using Redis atomic sliding-window operations (`ZREMRANGEBYSCORE`, `ZCARD`, `ZADD`, `EXPIRE`).
6. **Deployment & Autoscaling:** [✅ DELIVERED]
   - Created Kubernetes manifests in `infra/k8s/` (`namespace.yaml`, `gateway-hpa.yaml`, `microservices-hpa.yaml`) with HorizontalPodAutoscalers scaling between 2 and 12 replicas on 70% CPU / 80% Memory utilization.
7. **Test depth:** [✅ DELIVERED]
   - Automated Pytest suite expanded to **97/97 passing tests** with 0 warnings.
   - Established Playwright automated E2E browser regression test harness (`apps/web/e2e/`, `apps/web/playwright.config.ts`) integrated into `.github/workflows/ci.yml`.

---

## 5. Where things live

| Concern | Path |
|---|---|
| Enum bindings | `services/backend-py/app/core/db_enums.py` |
| DB session / Base | `services/backend-py/app/core/database.py` |
| Auth / tenant dependency | `services/backend-py/app/core/dependencies.py` |
| Monolith app + envelope | `services/backend-py/app/main.py` |
| Microservices + gateway | `services/backend-py/app/microservices/` |
| Model registry aggregator | `services/backend-py/app/models/entities.py` |
| Frontend API client | `apps/web/lib/api-client.ts` |
| Frontend shell routing | `apps/web/src/App.tsx` |
| Shared DTOs/enums | `packages/contracts/src/` |
| Run scripts | root `package.json` (`py:dev`, `ms:all`, `*:dev`) |

---

## 6. Guardrails for AI agents

- **Verify before claiming done** (Flow D). "Imports clean" is necessary, not sufficient.
- **Never hardcode data** to make an endpoint "work" — compute it, or say it's not implemented.
- **STRICT RESTRICTION: No automated data scripts in production.** You are NEVER permitted to write or execute
  automated data generation, auto-seeding, mock insertion, or test transaction scripts against the remote production
  database (`10.1.0.11` / `adminconsol.camtech.cam`). Automated data scripts can **ONLY** be run locally on the user's PC (`localhost`).
- **This is a live DB.** When testing locally or fixing bugs, delete any rows you create while testing. If you inject a fault
  to test isolation, **revert it** in the same session and confirm the revert.
- **Don't develop `services/backend` (NestJS)** — it's legacy/retired.
- **Keep this file and `docs/audits/session-*.md` current** when you make structural changes, so the next agent inherits the truth.

---

## 7. The 90 Engineering & Architecture Principles Matrix

All contributions must strictly comply with the authoritative standard in [`docs/architecture/90-engineering-principles.md`](docs/architecture/90-engineering-principles.md).

### Part I: Core Software Design, Paradigms & Clean Code (1–20)
1. **Core System Flow:** Unidirectional request → gateway → domain engine → storage → event bus pipeline.
2. **OOP Principles:** Domain nouns modeled with encapsulated behavior and state lifecycles.
3. **SOLID Principles:** Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion.
4. **DRY Principles:** Single source of truth across contracts (`packages/contracts`) and schemas.
5. **KISS Principles:** Simplest maintainable solution; avoid premature distributed complexity.
6. **YAGNI Principles:** Implement verified requirements only; no speculative abstractions.
7. **Clean Code Principles:** Intent-revealing names, small functions, side-effect-aware routines.
8. **Clean Architecture Principles:** Framework-independent domain core; peripheral transport/DB adapters.
9. **Separation of Concerns:** Distinct presentation, routing, domain logic, persistence, and telemetry.
10. **Modularity Principles:** 18 decoupled domain modules with explicit public interfaces.
11. **Reusability Principles:** Reusable UI components, token verifiers, and native enum helpers.
12. **Extensibility Principles:** Event hooks and workflow engine for non-invasive feature additions.
13. **Maintainability Principles:** Full TypeScript & Python typecheck compliance with regression tests.
14. **Scalability Principles:** Async I/O, connection pooling (`asyncpg`), and Redis background queues.
15. **Flexibility Principles:** Dual-deployment: unified monolith on `:4000` or 7 microservices on `:4000–:4007`.
16. **Loose Coupling:** Services communicate via contracts, gateway routes, and Redis pub/sub.
17. **High Cohesion:** Co-locate domain operations and entities within bounded module directories.
18. **Composition Over Inheritance:** Modular composition of services and UI components over deep class trees.
19. **Dependency Inversion:** Depend on abstractions injected via FastAPI `Depends(...)`.
20. **Interface Segregation:** Specialized, lightweight client contracts per frontend app target.

### Part II: Domain Modeling, State & API Architecture (21–30)
21. **Domain-Driven Design (DDD):** Ubiquitous language, bounded contexts, aggregate roots.
22. **Design Pattern Principles:** Judicious use of factory, outbox, strategy, and adapter patterns.
23. **Encapsulation Principles:** Hide internal state; mutate through verified domain methods.
24. **Abstraction Principles:** Clean contract interfaces hiding low-level protocol complexities.
25. **Immutability Principles:** Immutable audit trails, ledger transactions, and event payloads.
26. **Stateless Design:** Stateless application containers; session state verified via JWT tokens.
27. **API-First Principles:** Define endpoints, contracts, and envelopes before writing client UI.
28. **Contract-First Principles:** Canonical TypeScript DTOs in `packages/contracts` drive schemas.
29. **Backward Compatibility:** Additive schema evolution without breaking existing client apps.
30. **Versioning Principles:** Explicit URI versioning (`/api/v1`) and event topic versioning.

### Part III: Data Integrity, Persistence & Distributed Systems (31–42)
31. **Database Evolution:** Explicit camelCase column mappings; native PostgreSQL enum bindings.
32. **Schema Migration:** Verified Alembic migrations preserving foreign keys and constraints.
33. **Data Ownership:** Strict tenant isolation (`where organization_id == user.organization_id`).
34. **Transaction Integrity:** Atomicity across operations; double-entry balance in financial ledgers.
35. **Event-Driven Architecture:** SSE + WebSocket realtime streaming with Redis Pub/Sub backend.
36. **Asynchronous Processing:** Non-blocking async hashing and queue-based event dispatch.
37. **Idempotency Principles:** Unique transaction/order keys prevent duplicate processing on retries.
38. **Fault-Tolerance:** Process crashes isolated; gateway fallback preserves system availability.
39. **Resilience Principles:** Circuit breakers and timeouts protect external network dependencies.
40. **Retry & Recovery:** Exponential backoff on transient network and webhook deliveries.
41. **Error Handling Principles:** Enveloped error responses (`{ success: false, code, message }`).
42. **Validation Principles:** Client-side Zod and server-side Pydantic validation on all inputs.

### Part IV: Security, Reliability, Observability & Performance (43–52)
43. **Security-by-Design:** Encrypted bot tokens, authenticated requests, secure headers.
44: **Least Privilege:** Granular RBAC (`SUPER_ADMIN`, `ORG_ADMIN`, `MANAGER`, `CASHIER`, etc.).
45. **Zero-Trust Principles:** Never trust incoming client prices or tenant IDs; derive from JWT.
46. **Auditability Principles:** Immutable logs in `stock_movements`, `journal_entries`, and audits.
47. **Observability Principles:** W3C `traceparent` headers propagate through gateway to DB.
48. **Logging Principles:** Structured JSON logs correlated by `requestId`.
49. **Monitoring Principles:** Deep health probes (`/health/deep`) measuring database ping latency.
50. **Performance Principles:** Sub-50ms API responses through asyncpg and indexed queries.
51. **Caching Principles:** Cache static lookups and invalidate reactively on mutation events.
52. **Concurrency Principles:** Async event loops without blocking synchronous CPU calls.

### Part V: Quality Assurance, DevOps & Infrastructure (53–70)
53. **Testing Principles:** Unit tests, integration tests, and live DB verification loops.
54. **Testability Principles:** Injectable database sessions and decoupled mockable interfaces.
55. **CI/CD Principles:** Automated gates running schema audits, typecheck, and pytests.
56. **Infrastructure-as-Code:** Docker Compose and container manifests mirroring Kubernetes.
57. **Configuration Management:** Centralized Pydantic `BaseSettings` reading environment variables.
58. **Environment Separation:** Strict isolation of development, staging, and production databases.
59. **Feature Flag Principles:** Decouple code deployment from feature exposure via runtime flags.
60. **Progressive Rollout:** Canary and staged deployments for major architecture transitions.
61. **Documentation Principles:** Self-documenting code with comprehensive guides in `docs/architecture/`.
62. **Code Ownership:** Clear playbooks (`AGENTS.md`) preventing architectural regressions.
63. **Standardization Principles:** Consistent naming conventions, casing, and folder structures.
64. **Convention-over-Configuration:** Predictable module paths (`models.py`, `schemas.py`, `api.py`).
65. **Backward-Compatible Changes:** Add optional fields; never delete or rename active columns.
66. **Graceful Degradation:** Offline-first caching in POS shells when network drops.
67. **Disaster Recovery:** Automated PostgreSQL backup procedures and point-in-time recovery.
68. **High Availability:** Multi-replica gateway containers and PgBouncer connection pooling.
69. **Horizontal Scaling:** Stateless worker processes scaling out behind reverse proxies.
70. **Migration-Friendly Architecture:** Smooth incremental refactoring without full-system freezes.

### Part VI: Microservices, Integration & Evolution (71–86)
71. **Vendor Independence:** Standard PostgreSQL, Redis, Docker, and Linux VPS compatibility.
72. **Technology-Agnostic Domain:** Core business rules expressed in standard Python logic.
73. **Microservices Evolution:** Modular monolith decomposes into 7 standalone microservices.
74. **Service Boundaries:** Service slicing aligned with business domains (Auth, Catalog, Sales, etc.).
75. **Domain Isolation:** Cross-domain data access mediated through public interfaces or events.
76. **Shared Kernel:** Minimal shared contracts library in `packages/contracts`.
77. **Anti-Corruption Layer:** External Telegram and payment webhooks translated to domain DTOs.
78. **Integration Boundary:** Single entrypoint via gateway on port `:4000`.
79. **Message Contracts:** Strictly typed event schemas with standard envelope metadata.
80. **Event Versioning:** Additive event evolutions supporting multiple consumer versions.
81. **Dependency Management:** Pinned versions, workspace overrides, and Dependabot security scans.
82. **Technical Debt Management:** Continuous tracking and elimination of retired legacy code.
83. **Refactoring Principles:** Safe refactoring governed by automated test coverage.
84. **Incremental Development:** Small, verifiable end-to-end increments tested on live DB.
85. **Progressive Architecture:** Evolution from single database to read-replicas as load demands.
86. **Future-Proofing Principles:** Durable standards: PostgreSQL 16, React 19, FastAPI, TypeScript.

### Part VII: User Experience, Internationalization & Global Reach (87–90)
87. **UX/UI Consistency:** Unified `EnterpriseShell`, Inter typography, and Radix design tokens.
88. **Accessibility Principles:** Semantic HTML, ARIA attributes, keyboard navigation, and focus rings.
89. **Internationalization (i18n):** Multi-currency support (USD, KHR), UTC storage, localized formats.
90. **Localization (l10n):** Locale-aware currency formatting, date formatting, and regional phone codes.

