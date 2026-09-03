# Implementation Roadmap — Universal Enterprise Business Platform (2026–2027)

> **Document Version:** 2.0.0  
> **Last Updated:** September 2026  
> **Status:** Authoritative Phased Development Roadmap  
> **Canonical Backend:** Python/FastAPI (NestJS legacy, retained for reference)

---

## Strategic Phasing Overview (Spec §102)

The platform is evolved incrementally following the phased lifecycle:
```
PHASE 0 ──► PHASE 1 ──► PHASE 2 ──► PHASE 3 ──► PHASE 4 ──► PHASE 5 ──► PHASE 6
Discovery   Foundation  Core        Enterprise  Omnichannel Advanced    Scale
& Audit     & Security  Commerce    Operations  & Partners  & AI        & Cloud
```

> [!IMPORTANT]
> **Backend Stack Decision:** Python/FastAPI has been designated as the canonical backend. All phases below that reference "backend implementation" now refer to the Python stack. The NestJS implementations serve as **reference implementations** for porting.

---

## Phase 0: Discovery, Audit & Build Hygiene
> **Current Status:** ✅ Completed (September 2026)

### Key Deliverables
- [x] Comprehensive repository audit covering directories, dependencies, DB schema, APIs, frontend, tests, and infra.
- [x] Resolution of compiler & typecheck blockers (`api-client.ts` query parameters and `backend/tsconfig.json` paths).
- [x] Elimination of stale build artifacts in `@mystore/contracts`.
- [x] Verification of automated unit tests across domain entities and application services.
- [x] Authoring of the 5 canonical architecture documents in `docs/architecture/`.
- [x] Python backend schema drift audit completed (`docs/audits/python-backend-schema-drift.md`).

---

## Phase 0.5: Backend Schema Reconciliation (**NEW — BLOCKING**)
> **Current Status:** ⛔ Decision Required

### Context
The Python backend cannot write to the database due to schema drift (31/40 tables broken). This phase must be completed before any further backend development.

### Deliverables
- [ ] **Decide**: Option A (SQLAlchemy owns schema — recommended) or Option B (align Python to DB).
- [ ] **If Option A:**
  - [ ] Add Alembic to `services/backend-py/`.
  - [ ] Generate initial migration from Python SQLAlchemy models.
  - [ ] Run `alembic upgrade head` against a fresh database.
  - [ ] Write `app/seed.py` (org + users + sample products).
  - [ ] Drop stale `test_e2e_*` PostgreSQL schemas.
  - [ ] Verify `POST /sales` end-to-end.
- [ ] **If Option B:**
  - [ ] Align `sales`, `sale_line_items`, `sale_payments`, `product_variants`, `inventory_items` models + routers first.
  - [ ] Proceed table by table.
- [ ] Add CI step that detects model/DB drift using `scripts/schema_audit.py`.

---

## Phase 1: Foundation & Security Hardening
> **Current Status:** ✅ Completed in NestJS (legacy) · 🔶 Pending port to Python

### NestJS Reference (Completed)
- [x] Locations module with full CRUD API and tree traversal.
- [x] Organization management API.
- [x] Health/readiness/metrics endpoints.

### Python Port (Pending)
- [ ] Port locations CRUD and tree traversal to FastAPI.
- [ ] Port organization settings API to FastAPI.
- [ ] Business configuration engine: business hours, base currency, tax defaults.
- [ ] Migration from JSON `User.roles` to relational RBAC tables.
- [ ] Connect Redis 7 for distributed rate limiting.
- [ ] Implement distributed locking helper for high-concurrency operations.
- [ ] Automated health checks for Redis and MinIO on `/ready`.

---

## Phase 2: Core Commerce & Supply Chain
> **Current Status:** ✅ Completed in NestJS (legacy) · 🔶 Pending port to Python

### NestJS Reference (Completed)
- [x] Products & Catalog with server-side margin calculations.
- [x] Customers & CRM with account types.
- [x] Sales engine with server-side pricing and idempotency.
- [x] POS terminal with offline sync queue and batch sync API.
- [x] Inventory ledger with stock movements.
- [x] Payment engine with KHQR support.
- [x] Procurement with PO, GRN, and suppliers.
- [x] Warehouse management with zones, bins, batches, and transfers.
- [x] Pricing engine with price lists and quantity breaks.
- [x] Promotion engine with evaluator.
- [x] Tax engine with multi-jurisdiction support.
- [x] Loyalty engine with points and store credit.

### Python Port (Pending — blocked on Phase 0.5)
- [ ] Port sales engine (critical path — unblocks POS).
- [ ] Port products and inventory modules.
- [ ] Port customer management.
- [ ] Port remaining commerce modules.

---

## Phase 3: Enterprise Operations & Governance
> **Current Status:** ✅ Completed in NestJS (legacy) · 🔶 Pending port to Python

### NestJS Reference (Completed)
- [x] Finance & Accounting with double-entry GL and financial statements.
- [x] Workflow & Approvals with state machine.
- [x] Storage & Documents with S3/local drivers.
- [x] Notifications platform with multi-channel delivery.
- [x] Reporting & BI with aggregation engine.
- [x] HR & Payroll with payroll calculator.
- [x] Projects & Billing with timesheets.
- [x] Service Management with ticket lifecycle.
- [x] Fixed Assets with depreciation engine.

### Python Port (Pending)
- [ ] Port finance module with double-entry enforcement.
- [ ] Port workflow/approvals state machine.
- [ ] Port remaining enterprise modules.

---

## Phase 4: Omnichannel & Partner Ecosystem
> **Current Status:** ✅ Completed in NestJS (legacy) · 🔶 Pending port to Python

### NestJS Reference (Completed)
- [x] Developer Platform with API keys, webhooks, HMAC signatures.
- [x] Telegram Platform with bot commands and chat bindings.
- [x] Flow Automation with DAG execution engine.

### Python Port (Pending)
- [ ] Port developer platform with API key management.
- [ ] Port Telegram bot integration.
- [ ] Port flow automation engine.

### Deferred
- [ ] Flutter mobile client (deferred for budget reasons).
- [ ] Telegram Mini App.

---

## Phase 5: Advanced Intelligence & Automation
> **Current Status:** ❌ Scheduled

### Work Streams & Deliverables
- [ ] AI Platform & Gateway (unified AI gateway supporting multiple providers).
- [ ] Enterprise context retrieval and permission-gated tool execution.
- [ ] Autonomous AI Agents (inventory forecasting, replenishment recommendations).
- [ ] High-risk actions strictly require human approval via the Workflow Engine.

---

## Phase 6: Cloud Scale & Enterprise Infrastructure
> **Current Status:** ❌ Scheduled (As Justified by Scale)

### Objectives
Introduce distributed infrastructure components only when traffic or organizational scale warrants:
- Distributed event streaming via Apache Kafka.
- Complex long-running workflow orchestration via Temporal.
- Full-text and vector search acceleration via OpenSearch / Elasticsearch.
- Kubernetes deployment with Helm charts and zero-downtime rolling updates.

---

## Quality Gate Checklist for Every Vertical Slice (Spec §104)

No feature or milestone is marked complete unless all gates pass:

- [ ] **Architecture:** Clean layering adhered to (Router → Service → Domain → Repository).
- [ ] **Domain Logic:** Business rules and invariants encapsulated in pure domain classes.
- [ ] **Database Integrity:** PostgreSQL schema with foreign keys, indexes, and decimal precision.
- [ ] **API Standards:** Versioned REST endpoints with `{ success, data, requestId }` envelope.
- [ ] **Validation:** Input validation with proper error responses.
- [ ] **Authorization:** Server-side RBAC and strict tenant isolation (`organizationId`).
- [ ] **Audit Trail:** Append-only audit logging for state-mutating actions.
- [ ] **UI Implementation:** Responsive, accessible, permission-aware views using design system tokens.
- [ ] **Automated Testing:** Unit tests for domain logic and integration tests for API endpoints.
- [ ] **Documentation:** Accurate updates to `module-map.md` and related architecture specs.
