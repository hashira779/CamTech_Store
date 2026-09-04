# AGENTS.md — Working & Scaling Playbook for MyStore

This file is for the next contributor — human or AI — who will **extend, fix, or scale** this platform.
It captures the conventions that are easy to violate, the repeatable flows for adding features, and the
long-term scaling path. Read it before changing code. Keep it up to date when a convention changes.

> Orientation first: [`README.md`](README.md) · [`docs/architecture/current-state.md`](docs/architecture/current-state.md) ·
> [`docs/architecture/microservices-and-docker-guide.md`](docs/architecture/microservices-and-docker-guide.md) ·
> latest change log [`docs/audits/session-2026-09-04.md`](docs/audits/session-2026-09-04.md).

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

## 4. Long-term scaling roadmap (do these in order of leverage)

1. **CI gates (cheapest, highest value):** run `scripts/schema_audit.py` (fail on drift), an "every module imports" check,
   `pnpm typecheck`, and `pnpm py:test` on every PR. This alone prevents the whole class of bugs fixed on 2026-09-04.
2. **Remove the two real single points of failure:**
   - Run **2+ gateway replicas** behind a load balancer (the in-process fallback protects against a *service* dying,
     not the gateway host dying).
   - Give **PostgreSQL HA** (primary + read replica, PgBouncer for pooling).
3. **Observability:** a `traceparent` is already minted per request — export spans to an OpenTelemetry collector so a call
   can be followed gateway → service → DB. Add structured logs keyed by `X-Request-Id`.
4. **True service independence (when a domain needs to scale alone):** split its tables into a **per-service database**
   and replace cross-service FK reads with API calls or events (the Redis outbox/saga engine already exists for this).
   Until then it is a "distributed monolith" (shared DB) — which is fine and simpler at current scale.
5. **Auth hardening:** migrate `User.roles` (JSON string) to relational RBAC tables; move rate-limiting from in-memory to Redis.
6. **Deployment:** the `docker-compose.yml` maps 1:1 to Kubernetes Deployments/Services — add Helm charts + HPA (autoscale on CPU;
   the async-registration design already keeps hashing off the event loop for burst load).
7. **Test depth:** spin an ephemeral Postgres in CI and run the integration tests that currently need a live DB.

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
- **This is a live DB.** Delete any rows you create while testing. If you inject a fault to test isolation, **revert it**
  in the same session and confirm the revert.
- **Don't develop `services/backend` (NestJS)** — it's legacy/retired.
- **Keep this file and `docs/audits/session-*.md` current** when you make structural changes, so the next agent inherits the truth.
