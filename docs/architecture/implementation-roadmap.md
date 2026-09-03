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

## Phase 0.5: Backend Schema Reconciliation
> **Current Status:** ✅ Completed (September 2026)

### Deliverables
- [x] **Executed Option B**: Aligned 100% of SQLAlchemy models to the PostgreSQL database schema.
- [x] 62/62 PostgreSQL public tables mapped 1:1 to models in `app/models/entities.py`.
- [x] 0 critical write-breaking mismatches; 0 warnings.
- [x] Automated schema audit guard tool (`python -m scripts.schema_audit`).
- [x] Verified `POST /sales` with server-side pricing, multi-payments, and DB persistence.

---

## Phase 1: Foundation & Security Hardening
> **Current Status:** ✅ Completed in Python (Canonical) & NestJS (Legacy)

### Key Deliverables
- [x] Locations module with full CRUD API and recursive tree traversal (`/api/v1/locations`, `/api/v1/locations/tree`).
- [x] Organization management & settings API (`GET /organizations/current`, `PUT /organizations/current`).
- [x] Idempotency keys support on mutation endpoints (§104).
- [x] Refresh token rotation (`/auth/refresh`) with separate expiration (§66).
- [x] Multi-Factor Authentication: RFC 6238 TOTP engine (`/auth/mfa/setup`, `/auth/mfa/verify`) (§66).
- [x] Field-level encryption at rest via AES-256-GCM (`app/core/crypto.py`) (§66).
- [x] W3C distributed tracing (`traceparent` header + `X-Trace-Id`) & OpenTelemetry-ready middleware (§70).
- [x] Continuous Integration: GitHub Actions workflow (`.github/workflows/ci.yml`) (§72).
- [x] Automated PostgreSQL database backup & retention utility (`scripts/backup_db.py`) (§73, §81).
- [x] Health, readiness, and Prometheus metrics endpoints (`/health`, `/ready`, `/metrics`) (§70, §71).

---

## Phase 2: Core Commerce & Supply Chain
> **Current Status:** ✅ Completed in Python (Canonical) & NestJS (Legacy)

### Key Deliverables
- [x] Products & Catalog with server-side margin calculations (`/products`).
- [x] Customers & CRM with account types and credit balance tracking (`/customers`).
- [x] Sales engine with server-side pricing, tax calculation, and idempotency (`/sales`).
- [x] Multi-payment processing including Bakong KHQR EMVCo generation (`/payments/khqr`).
- [x] Multi-location inventory tracking and low-stock queries (`/inventory`).
- [x] Tiered pricing engine with quantity break resolution (`/pricing`).
- [x] Promotions & discount evaluator (`/promotions`).
- [x] Tax calculation engine with inclusive/exclusive rates (`/taxes`).
- [x] Loyalty transaction recording and store credit engine (`/loyalty`).


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
