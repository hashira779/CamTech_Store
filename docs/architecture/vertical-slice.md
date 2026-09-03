# Vertical Slice — Architecture & Spec Mapping

> [!CAUTION]
> **Historical Document (Phase 0 Snapshot — September 2026)**  
> This document records the initial vertical slice that established architectural patterns. It references state that has since changed (SQLite dev DB, 11 unit tests, missing endpoints). The patterns described remain valid as reference. For current state, see [`current-state.md`](current-state.md) and [`module-map.md`](module-map.md).
>
> **Backend Note:** This document describes NestJS patterns. The canonical backend is now Python/FastAPI. The architectural principles (clean layering, tenant isolation, server-side pricing, audit trail) still apply.

This document explains the first vertical slice (auth + product catalog) and how
it establishes the patterns the rest of the Universal Enterprise Business
Platform will follow. It is the reference every future module should imitate.

## Why a vertical slice first

The master spec describes a multi-year platform (POS, inventory, finance, HR,
CRM, workflow, AI, partner APIs, 5 client apps, …). Building it breadth-first
produces a shallow, broken skeleton. Instead we built **one feature end-to-end
through every architectural layer**, so the layering, multi-tenancy, security,
and shared-contract patterns are proven and repeatable before we scale out
(spec §108 Phase 1, §110–§111 "inspect → map → plan → implement → test").

## The layering (spec §2, §4)

```
HTTP request
  → Controller            interface/       (HTTP, validation, guards, Swagger)
    → Application Service  application/     (use-cases, tenant scope, audit, orchestration)
      → Domain             domain/          (entities, invariants, server-derived values)
      → Repository (port)  domain/*.repository.ts   (interface + DI token)
        → Prisma adapter   infrastructure/  (the ONLY code that touches the DB)
```

Rules enforced:

- Controllers contain **no business logic** (spec §2).
- Services never import Prisma; they depend on the **repository port** (spec §4).
- The domain entity is pure TypeScript — no NestJS, no Prisma — so it is unit
  testable and portable when a module is later extracted to its own service
  (spec §74–§75).
- Critical values are computed **server-side and never trusted from the client**
  (`Product.marginPct`, `organizationId` from the token) — spec §106, §66.

Concrete files for the products module:

| Layer | File |
|-------|------|
| Controller | `modules/products/interface/products.controller.ts` |
| Application service | `modules/products/application/products.service.ts` |
| Domain entity | `modules/products/domain/product.entity.ts` |
| Repository port | `modules/products/domain/product.repository.ts` |
| Prisma adapter | `modules/products/infrastructure/prisma-product.repository.ts` |

## Cross-cutting concerns (the reusable platform spine)

| Concern | Implementation | Spec |
|---------|----------------|------|
| Response envelope | `common/http/response.interceptor.ts` → `{success,data,requestId}` | §102 |
| Error envelope | `common/http/all-exceptions.filter.ts` → stable `code`, no stack leaks | §102, §66 |
| Request correlation id | `common/context/request-id.middleware.ts` (`x-request-id`) | §70 |
| Authentication | `common/auth/jwt-auth.guard.ts` (global, `@Public()` opt-out) | §66 |
| Authorization (RBAC) | `common/auth/permissions.guard.ts` + `@RequirePermissions()` | §66, §68 |
| Multi-tenancy | org id taken from signed JWT; repository applies a hard tenant filter | §67 |
| Audit trail | `modules/audit/audit.service.ts` (append-only) | §69 |
| Validation | class-validator DTOs + global `ValidationPipe` (whitelist + forbid unknown) | §8 |
| Pagination | `page`/`limit`/`search` → `PageMeta` | §103 |
| OpenAPI | Swagger UI at `/api/docs`, URI versioning `/api/v1` | §8, §89 |

## Shared contracts (spec §94, §99 `packages/`)

`@mystore/contracts` holds the DTO types, Zod schemas, permission constants, and
the response-envelope types. **Both** the backend and the web app import it, so
there is a single source of truth for the API surface and no duplicated business
shapes across clients — the core requirement of "build a platform, not an app".

## Verification performed

- **11 unit tests** pass: domain margin math + invariants; service create/list,
  tenant scoping, duplicate-SKU conflict, error typing.
- **Live HTTP** (curl) confirmed: 401 unauth · login envelope · authenticated
  list · create with server-derived margin · **403 for cashier write** · 400
  validation with field details · 409 duplicate SKU · audit rows written.
- **Browser**: admin logs in, sees the catalog with a server-computed Margin
  column and the permission-gated create form.

## Enterprise-readiness scorecard (honest)

What in this foundation is genuinely enterprise-grade **now**, vs. what is still
missing before the platform could be called enterprise-ready.

| Enterprise concern (spec) | Status | Notes |
|---------------------------|--------|-------|
| Clean layering / DDD (§2,§4) | ✅ done | Controller→Service→Domain→Repository, enforced |
| Multi-tenancy isolation (§67) | ✅ done | org from signed token; hard repo filter; **e2e-proven** |
| RBAC / least privilege (§68) | ✅ done | permission guard; cashier-write blocked in tests |
| AuthN + brute-force defence (§66) | ✅ done | JWT + login rate limit; uniform credential errors |
| Security headers (§66) | ✅ done | helmet (CSP, HSTS, nosniff, frame-options) |
| Rate limiting (§8,§66) | ✅ done | global + stricter login; returns 429 |
| Audit trail (§69) | ✅ done | append-only; login + product events |
| Standard errors, no stack leaks (§102) | ✅ done | envelope + request id |
| Health / readiness / metrics (§70,§71) | ✅ done | `/health` `/ready` `/metrics` |
| Security tests (§107) | ✅ partial | cross-tenant, priv-esc, token abuse covered; SQLi/XSS/path-traversal suites pending |
| Graceful shutdown | ✅ done | shutdown hooks + Prisma disconnect |
| PostgreSQL + transactions (§3,§105) | ⚠️ pending | SQLite for dev; Postgres switch documented |
| Redis: cache / locks / queues (§5,§6) | ⚠️ planned | Redis container active; BullMQ & distributed locks |
| Idempotency keys (§104) | ✅ done | IdempotencyKey support on `POST /sales` & `Sale` entity |
| Refresh tokens / MFA (§66) | ✅ done | Refresh token rotation (`/auth/refresh`) + RFC 6238 TOTP MFA (`/auth/mfa/setup`, `/auth/mfa/verify`) |
| Observability tracing (OpenTelemetry §70) | ✅ done | W3C `traceparent` header propagation + `X-Trace-Id` + `/metrics` |
| CI/CD, Docker compose, backups (§72,§73,§81) | ✅ done | GitHub Actions CI (`.github/workflows/ci.yml`), `docker-compose.yml`, automated DB backup script (`scripts/backup_db.py`) |
| Secrets management, encryption at rest (§66) | ✅ done | AES-256-GCM authenticated field encryption service (`app/core/crypto.py`) + strict `.env` exclusion |


The pattern is enterprise-grade; the **breadth** (infra, Redis, idempotency,
tracing, CI, DR) is the remaining work, sequenced in the roadmap below.

## Deliberate simplifications (flagged, to revisit)

| Simplification | Why | Production direction |
|----------------|-----|----------------------|
| SQLite dev DB | zero-infra runnable slice; Docker not required | PostgreSQL (§3) + docker-compose |
| Money as `Float` | SQLite has no Decimal | integer minor units or `Decimal(14,4)` (§106) |
| Token in `localStorage` | simplest for the slice | httpOnly cookie / refresh tokens |
| class-validator on API, Zod on web | idiomatic per side | optionally unify on Zod via `nestjs-zod` |
| Role→permission map in code | small & explicit | DB-backed policy table (§68) |
| Audit written inline | synchronous simplicity | event-driven consumer (§7) |
| No `/health` `/ready` yet | not needed to prove the slice | add terminus endpoints (§71) |

## The §110 checklist, answered for this slice

1. Exists? No — greenfield. 2. Owner module: `products`. 3. Data owner:
`products` table via its repository. 4. API: `/api/v1/products`. 5. Clients: web
(POS/mobile/Telegram later reuse the same API). 6–8. POS/Mobile/Telegram: not in
this slice, but the shared-API design means they consume the same endpoints. 9.
Partners: a future `products.read` scope maps cleanly to the existing permission.
10. Permissions: `products.read` / `products.write`. 11. Audit: `PRODUCT_CREATED`,
`LOGIN`. 12–17. Notifications/workflow/analytics/AI/automation/offline: not yet;
the event points are identified. 18. Service failure: errors normalized to the
envelope; audit failures never break the operation. 19. Scale: repository +
pagination + tenant index. 20. Extend: module boundary allows extraction to a
`product-service` (§75) without touching callers.

## Roadmap (next increments, each a full slice)

1. **Infra**: `docker-compose.yml` (Postgres + Redis + MinIO); switch Prisma to
   Postgres; `/health` `/ready` `/metrics` (§71).
2. **Identity hardening**: refresh tokens, MFA hooks, users/orgs CRUD, org-scoped
   user management (§66, §68).
3. **Customers** module (same pattern) → then **Sales/Orders** → **Inventory**,
   introducing the event bus (§7) between Sales and Inventory.
4. **POS** offline-first sync with idempotency keys (§30–§31, §104).
5. Then finance, workflow, notifications per spec §108 phases.
