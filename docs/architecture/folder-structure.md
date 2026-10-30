# Folder Structure

Where new code goes. `services/backend-py/tests/test_structure.py` enforces the backend module rules.

```
apps/
  web/                 Canonical multi-experience SPA
    app/<route>/       Route pages
    src/apps/<shell>/  One shell per experience (admin, pos, infra, ...)
    src/experiences.ts Which experience serves which host or path
    components/        Shared components (components/ui = primitives)
    lib/               API client, stores, hooks without UI
    e2e/               Playwright
  cashier, ceo, delivery, hr, mini, store/   Standalone build targets
packages/
  contracts/           Shared DTOs and enums
  ui/                  Shared components for the standalone apps
services/
  backend-py/          Canonical backend (see below)
  backend/             Retired NestJS backend. Do not develop.
deploy/                Nginx configuration
infra/                 Kubernetes and telemetry configuration
scripts/               See below
docs/
  architecture/        How the system works and how to build on it
  deployment/          Server setup and operations guides
  audits/              Dated session logs and findings
  archive/             Superseded plans
```

## Backend (`services/backend-py`)

```
app/
  core/          Cross-cutting: config, database, auth, access policy, HTTP edge
  modules/<x>/   One business domain each
  domain/        Engines shared across modules
  models/        Registry that imports every module's models
  microservices/ Service entry points, gateway, service registry
scripts/         Migrations, audits and maintenance run from services/backend-py
tests/
```

Every module has `__init__.py` and `api.py`, plus these when it needs them:

| File | Holds |
|---|---|
| `models.py` | SQLAlchemy models, registered in `app/models/entities.py` |
| `schemas.py` | Pydantic request and response shapes |
| `service.py` | Business logic that doesn't belong in a route |
| `controllers/` | Route logic, once `api.py` has grown too large to read |

Routers belong in a module; there is no top-level `app/routers`.

## Scripts (`scripts/`)

| Location | Holds |
|---|---|
| `deploy_production.sh`, `camtech.py`, `backup_db.py` | Stable entry points. CI, the server's auto-deploy service and the deployment guides call these paths, so don't move them. |
| `run_remote.py` | Remote execution helper shared by `ops/` |
| `deploy/` | Manual and hotfix deploys. CI is the normal route to production. |
| `ops/` | Server setup and production inspection |
| `dev/` | Local development only |

Scripts that change production data need explicit instruction from the owner (AGENTS.md rules 10 and 11).
