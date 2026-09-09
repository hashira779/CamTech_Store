# Master Audit — UI/UX, Data Consistency & Role Experience

**Date:** 2026-09-09
**Scope:** Full platform — frontend (6 apps + web micro-frontends), backend-py, APIs, schema/models, auth/roles, design system, delivery module.
**Mode:** Read-only discovery + audit. **No business logic was changed to produce this report.**
**Method:** Direct source reading with file:line evidence, cross-checked against existing docs in `docs/audits/` and `docs/architecture/`.

> **Headline:** The platform is broad and well-structured on paper, but it does **not** currently behave as one product because **the Delivery domain runs on an in-memory demo service that is completely disconnected from the real database**, and **role-based authorization is not enforced at the API layer**. The two existing "green" audits (`enterprise-project-audit-report.md`: *"9.2/10, 0 critical"*) describe the **intended** architecture, not the running code. This report corrects that record with evidence.

---

## 1. WHAT WAS FOUND — System Discovery Map

```
SYSTEM: MyStore Enterprise Platform (pnpm monorepo + modular-monolith FastAPI)
├── FRONTEND (apps/*)
│   ├── ceo        :5008  Executive control tower      → reads GET /api/v1/sales, /hr/employees, /public/products, /apps/registry
│   ├── hr         :5005  Workforce/payroll            → GET /api/v1/hr/employees
│   ├── cashier    :5003  POS terminal (glass UI)      → sales/checkout
│   ├── store      :5001  Customer storefront          → checkout → Sale (+ delivery dispatch)
│   ├── delivery   :5004  Courier PWA (mobile)         → GET /api/v1/delivery/tasks  (IN-MEMORY)
│   └── web        :5002  ERP shell + 10 micro-frontends (shadcn design system, hostname/path routed)
│        └── apps/{admin,pos,hr,delivery,warehouse,finance,customer,ceo,support,partner}
├── SHARED: packages/contracts (TS DTOs), packages/ui (@mystore/ui — added this session)
├── BACKEND: services/backend-py (canonical, :4000) + services/backend (legacy Prisma/TS)
│   ├── modules/*  (identity, sales, delivery, customers, catalog, inventory, finance, hr, …) — modular monolith
│   ├── routers/*  (delivery_routes, app_registry, …)
│   ├── services/delivery_service.py  ← IN-MEMORY singleton (root cause)
│   ├── domain/delivery_engine.py     ← math helpers (used)
│   ├── microservices/delivery_service.py ← DEAD CODE (imported nowhere)
│   └── models/entities.py + modules/*/models.py  (SQLAlchemy, Prisma-camelCase columns)
└── DB: PostgreSQL "camtechStore" — 62 tables; known schema drift (see python-backend-schema-drift.md)
```

**Canonical business objects (DB):** `Sale` + `SaleLineItem` + `SalePayment` (this is the real "Order"), `Customer` + `CustomerAddress`, `Employee`, `Product`/`ProductVariant`, `User`/`Role`/`UserRole`. **`DeliveryOrder`/`DeliveryDriver` tables exist but are never written.**

---

## 2. ROOT CAUSES (the "why", not the symptoms)

| # | Root cause | Evidence | Consequence |
|---|-----------|----------|-------------|
| **RC-1** | **Delivery is an in-memory stub, not a DB-backed domain.** `DeliveryService` stores drivers/orders in Python dicts on a module singleton and seeds fake demo data per org. | `app/services/delivery_service.py` — `self._drivers/_orders` dicts (L18-24), `_ensure_org_seed` seeds "Sokha Chan"/"Vannak Meas" (L26-139), `delivery_service = DeliveryService()` singleton (L372). Nothing writes `delivery_orders`/`delivery_drivers`. | Delivery shows data that exists nowhere else; real Store orders don't appear in the DB delivery table; status never persists; lost on restart; not shared across workers. **This is the single biggest driver of "Delivery feels like a different product."** |
| **RC-2** | **Same entity, different API shapes.** `GET /delivery/tasks` hand-builds a payload that renames + fabricates fields; `GET /delivery/orders` returns the real DTO. | `delivery_routes.py:44-50` emits `destinationAddress` + a **fabricated** `paymentMethod` (`"PAID_KHQR"`/`"CASH_ON_DELIVERY"` derived from `codAmount`), vs `dto.py:334` `deliveryAddress`. | Field-name divergence + payment status that is a guess, not the real `SalePayment`. |
| **RC-3** | **Authorization ≈ authentication.** No permission system; `has_role` is referenced **0 times** across modules/routers; `get_current_user` (auth-only) is used **201 times**. `ORG_ADMIN` is hard-coded god-mode. | `app/core/dependencies.py:23-24`; grep `has_role` → 0 hits in `app/modules` + `app/routers`. | Any authenticated user (e.g. a CASHIER token) can call finance/HR/reporting endpoints. Frontend menu-hiding is the only "RBAC". |
| **RC-4** | **Two design systems + duplicated modules.** Standalone apps use `@mystore/ui` (added this session); `web` uses a shadcn token system; Delivery UI is triplicated. | `apps/web/app/globals.css` (shadcn tokens) vs `packages/ui/styles.css`; delivery UI in `apps/delivery`, `apps/web/app/delivery/page.tsx`, `apps/web/src/apps/delivery/DeliveryApp.tsx`. | Divergent look/feel & behavior; three code paths to keep in sync. |
| **RC-5** | **Schema ownership unresolved (Prisma legacy ↔ Python).** `entities.py` is littered with `# FIXED: was …` port markers; two backends coexist. | `docs/audits/python-backend-schema-drift.md` (self-reported 31 critical drift tables, 6 models-without-table, 28 tables-without-model); `services/backend` vs `services/backend-py`. | Silent field mismatches; features backed by tables with no model and vice-versa. |

---

## 3. DELIVERY DEEP-DIVE (as requested — Section 3)

**Diagnosis (per your 5 hypotheses): it is #1, #2, #3 AND #4 simultaneously.**

1. **Using different data — YES (primary).** apps/delivery reads the in-memory service (`/delivery/tasks`); Admin/Reports/Customer read `Sale` from Postgres; the bot-builder reads the DB `delivery_orders` table (`app/modules/bot_builder/engine/node_handlers/business_handlers.py:18`) which is **always empty**. Three readers, three different datasets for "a delivery."
2. **Transforming the same data incorrectly — YES.** `paymentMethod` is fabricated from `codAmount` (`delivery_routes.py:48`); it is not the real payment method/status from `SalePayment`. A card-paid order can display "CASH_ON_DELIVERY"/"PAID_KHQR" incorrectly.
3. **Outdated / parallel API — YES.** `/delivery/tasks` (custom shape) vs `/delivery/orders` (DTO) vs the DB table — three representations of one concept.
4. **Duplicating business logic — YES.** `microservices/delivery_service.py` is dead; delivery UI is triplicated (see RC-4).
5. Displaying same data differently — also true at the UI layer, but that is a **symptom**, not the cause. **Do not fix the UI alone.**

**Data / linkage reality at checkout:** `checkout_controller.py:318-334` DOES create a linked delivery task (`saleId=sale_id`) — but via the **in-memory** `delivery_service.create_order(...)`, and writes a DB `NotificationRecord` (L338-357). So in a single dev process the new order appears live in apps/delivery, but it is **never persisted** to `delivery_orders`, never visible to any DB query, and evaporates on restart / is invisible to other workers.

**Delivery contact/address/COD are duplicated columns**, not references: `delivery/models.py:50-56` stores `recipientName/recipientPhone/deliveryAddress/codAmount` instead of pointing at `Customer`/`CustomerAddress`/`SalePayment`. Even once persisted, this invites drift from the Sale's own customer/address.

**Security:** `/delivery/tasks`, `/delivery/drivers/public`, `POST /tasks`, and **`PATCH /tasks/{id}/status`** use `get_optional_user` (`delivery_routes.py:26-96`) → a courier can **list orders and change delivery status with no authentication**. The app's login gate is cosmetic.

---

## 4. DATA CONSISTENCY MATRIX

### 4a. "Order" across modules (the core inconsistency)

| Concern | Store / Cashier / Admin / Reports | Delivery (apps/delivery) | Verdict |
|---|---|---|---|
| Underlying object | `Sale` (DB) | `DeliveryOrder` dict (in-memory) | **Two different objects** |
| Source of truth | Postgres `sales` | Python singleton dict | **Divergent** |
| Read endpoint | `GET /sales`, `/sales/customer-orders` → `SaleDto` | `GET /delivery/tasks` → custom dict | **Divergent shape** |
| Address field | (customer/address on sale) | `destinationAddress` (renamed from `deliveryAddress`) | **Field name mismatch** |
| Payment | real `SalePayment.method/status` (`CASH/CARD/QR…`, `PENDING/COMPLETED/…`) | `paymentMethod` fabricated from `codAmount` | **Incorrect transform** |
| Status vocabulary | `SaleStatus`: DRAFT/COMPLETED/VOIDED/REFUNDED/PARTIALLY_REFUNDED | free string: PENDING/DISPATCHED/IN_TRANSIT/DELIVERED | **No canonical model, no link** |
| Persistence | durable | lost on restart | **Divergent** |

### 4b. Status inventory (no canonical model — Section 9)

| Domain | Values | Type | Location |
|---|---|---|---|
| Sale | DRAFT, COMPLETED, VOIDED, REFUNDED, PARTIALLY_REFUNDED | PG enum `SaleStatus` | `sales/models.py:22` |
| Payment | PENDING, COMPLETED, FAILED, REFUNDED | PG enum `PaymentStatus` | `sales/models.py:30` |
| Delivery order | PENDING, DISPATCHED, IN_TRANSIT, DELIVERED (+ EN_ROUTE/IDLE for drivers) | **free string** | `delivery/models.py:49`, `delivery_service.py` |
| Delivery UI labels | "Assigned", "Out for Delivery", "Delivered", … | UI strings | `apps/delivery/src/App.tsx` |

**Problem:** delivery status is an unconstrained string with no backend enum and no defined relationship to `SaleStatus`. Business status and UI label are not separated.

### 4c. Entities with a defined canonical DB source (good) vs. divergent

| Entity | Canonical source | Consistent? |
|---|---|---|
| User / Role | `identity` models, `user_roles` (relational) + legacy `User.roles` JSON | ⚠️ dual-read (`dependencies.py:26-33`) |
| Customer / Address | `customers` models | ✅ (but delivery duplicates contact fields) |
| Employee | `hr` `employees` | ✅ |
| Product / Variant | `catalog` | ✅ |
| Sale / LineItem / Payment | `sales` | ✅ canonical |
| **Delivery / Driver** | **in-memory (DB tables unused)** | ❌ **primary defect** |
| Notification | `notification_records` | ✅ |

---

## 5. AUDIT FINDINGS (A–M) with severity

> Fields per finding: location · current · expected · **severity** · root cause · fix · affected · risk.

### A. Architecture
- **A1 (P0)** Delivery domain is an in-memory singleton. *Loc:* `services/delivery_service.py`. *Current:* dict storage + seeded demo data; DB models unused. *Expected:* DB-backed repository writing `delivery_orders`/`delivery_drivers`, derived from `Sale`. *Root:* RC-1. *Fix:* implement a `DeliveryRepository` on SQLAlchemy; make `create_order` persist and link `saleId`; back all reads with the DB. *Affected:* delivery, sales/checkout, bot-builder, reports, admin. *Risk of fix:* medium (touches checkout) — do behind a flag with parity tests.
- **A2 (P2)** Dead/duplicate delivery implementations. *Loc:* `microservices/delivery_service.py` (unused), triplicated UI. *Fix:* delete dead module; converge on one delivery UI consumed by web + standalone.
- **A3 (P1)** Two backends coexist (`backend` Prisma legacy vs `backend-py`). *Fix:* confirm `backend-py` is sole runtime; archive/remove legacy to stop schema ambiguity. *Ref:* RC-5.

### B. Data
- **B1 (P0)** Delivery data source ≠ Sales source of truth (Section 4a). *Fix:* Delivery reads/writes the same DB and references `Sale`.
- **B2 (P1)** `DeliveryOrder` duplicates recipient/phone/address/COD instead of referencing `Customer`/`CustomerAddress`/`SalePayment`. *Loc:* `delivery/models.py:50-56`. *Fix:* keep `saleId` as the join; snapshot only what legally must be immutable (e.g. address at dispatch), reference the rest.
- **B3 (P1)** Schema drift (31 critical per `python-backend-schema-drift.md`). *Fix:* pick one schema owner (recommend SQLAlchemy + Alembic), reconcile, delete `# FIXED: was…` debt.

### C. API
- **C1 (P1)** Same entity, two shapes + fabricated field (RC-2). *Fix:* one `DeliveryOrderDto`; drop `/tasks` custom dict or make it an alias of the DTO; compute `paymentMethod` from the real payment.
- **C2 (P2)** Route duplication: `POST /orders/public` == `POST /tasks`; `PATCH /tasks/{id}/status` == `PATCH /orders/{id}/status`. *Loc:* `delivery_routes.py:67-96`. *Fix:* one canonical route per action; keep at most one documented alias.
- **C3 (P2)** Contracts are TS-only (`packages/contracts`) while backend is Python — no enforced cross-language contract. *Fix:* generate DTOs/enums from one source (OpenAPI → TS) so field names can't drift.

### D. Role / Permission
- **D1 (P0)** No API-layer RBAC on business data (RC-3). *Fix:* add a `require_roles(...)`/permission dependency and apply per router (sales, finance, hr, inventory, reporting, delivery-admin). Enforce tenant + resource ownership.
- **D2 (P1)** Dual role storage (relational `user_roles` + legacy JSON `User.roles`). *Loc:* `dependencies.py:26-33`. *Fix:* finish migration to relational, remove JSON fallback, add a permission table (the docs already describe the intended role→app matrix in `multi-experience-ux.md`).
- **D3 (P1)** `ORG_ADMIN` hard-coded as universal override. *Loc:* `dependencies.py:24`. *Fix:* make it an explicit permission grant, not a string check.

### E. Delivery — see Section 3 (P0/P1). Root: RC-1/RC-2 + unauth status writes.

### F. Navigation / Login
- **F1 — CORRECTED 2026-09-09 (was P1, now P3).** *Original claim (inaccurate):* "web always lands on the exec AdminApp regardless of role." *Reality after deeper reading:* role-aware landing **is implemented** — `app/login/page.tsx:35-38` calls `resolveDefaultExperience(user.roles)` → `setExperience()` → navigates to that experience's `defaultRoute` (HR→`/hr`, cashier→`/sales/new`, driver→`/driver`, …), and `components/enterprise-shell.tsx:171-176` scopes the sidebar by the active experience's `allowedSections` (`lib/experience-store.ts`). The earlier claim was inferred from `apps/web/src/App.tsx`'s hostname/path default without accounting for the login wiring. **Remaining real gap (fixed 2026-09-09):** the `/dashboard` header was hard-coded "Executive Command Center" for every role; now bound to the active `EXPERIENCE_CONFIGS` title/badge. **Still open:** this scoping is presentation-only — see D1/L2, the backend enforces no RBAC, so the scoped nav is not a security boundary.
- **F2 (P2)** Standalone apps and web use different nav paradigms (subdomain apps vs in-shell routing). *Fix:* one navigation contract (workspace → primary nav → sections) shared via the design system.

### G. UI/UX
- **G1 (P2)** Emojis used as UI/status icons (👑 CEO bar, 🎉 payroll toast, 🚚/👔 delivery, notification titles). *Loc:* `apps/ceo`, `apps/hr/src/App.tsx:91`, `apps/delivery`, `checkout_controller.py:344`. *Fix:* replace with the approved `lucide-react` icon set; reserve emoji for non-UI content.
- **G2 (P2)** Inconsistent status colors/labels between modules (no shared `StatusBadge`). *Fix:* one `StatusBadge` mapping canonical status → color + label.
- **G3 (P3)** Superficial polish already applied this session (unified control-tower theme) — good, but it is presentation only; do not let it mask B1/D1.

### H. Design System
- **H1 (P1)** Two systems: `@mystore/ui` (standalone) + shadcn tokens (web). *Fix:* pick one token source of truth; this session aligned the palettes, but the component libraries still differ. Recommend: shadcn primitives in `web` consume the same token values as `@mystore/ui` (already aligned), then promote shared primitives (Button/Table/Badge/Form) into `@mystore/ui`.
- **H2 (P2)** No canonical tokens doc for color **semantics**, spacing scale, radius, elevation. *Fix:* publish `design-tokens.md`; enforce via the preset + lint.

### I. Component Duplication
- **I1 (P1)** Delivery UI ×3; per-app re-implemented headers, tables, empty/loading states, `getAuthHeaders`/`API_BASE_URL` copied into every app. *Fix:* promote `AppShell`, `DataTable`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `api` helper into `@mystore/ui`/a shared lib.

### J. Performance
- **J1 (P2)** `web` main bundle + `vendor-charts` (~395 kB) large; store bundle >500 kB warning. *Fix:* code-split charts, route-level lazy (web already lazy-loads shells — extend to heavy vendors).
- **J2 (P3)** Every app polls independently with its own React Query config; no shared cache/stale policy. *Fix:* shared query client defaults.

### K. Accessibility
- **K1 (P2)** Not yet audited for keyboard/focus/contrast/labels; icon-only buttons (refresh, logout) lack consistent `aria-label`; emoji-as-status fails SR semantics. *Fix:* a11y pass with the shared components (focus rings, labels, contrast tokens).

### L. Security
- **L1 (P0)** Unauthenticated delivery status writes (`PATCH /delivery/tasks/{id}/status`, `get_optional_user`). *Fix:* require auth + `COURIER`/`DISPATCHER` role; verify org + assignment ownership.
- **L2 (P0)** No backend RBAC on business endpoints (D1). *Fix:* per-endpoint role/permission enforcement.
- **L3 (P2)** SSE/WebSocket accept token via query param (`get_streaming_user`, `dependencies.py:82-118`) — token can land in logs. *Fix:* short-lived stream tokens; scrub from access logs.

### M. Testing
- **M1 (P1)** Backend tests validate the **in-memory** delivery stub (`test_delivery_api.py`, `test_delivery_engine.py`), giving false confidence that delivery "works". *Fix:* rewrite delivery tests against the DB repository + a Sale→Delivery integration test.
- **M2 (P2)** Standalone frontends (ceo/hr/cashier/store/delivery) have **no tests**; only `web` has 2 Playwright specs. *Fix:* add component + a cross-module "one order, many views" E2E (Section 28).

---

## 6. PRIORITY SUMMARY

| Priority | Count | Items |
|---|---|---|
| **P0** | 5 | A1, B1, D1/L2, E (delivery data), L1 |
| **P1** | 9 | A3, B2, B3, C1, D2, D3, F1, H1, I1, M1 |
| **P2** | 9 | A2, C2, C3, F2, G1, G2, H2, J1, K1, L3, M2 |
| **P3** | 3 | G3, J2 |

**Do not** polish P3 visuals while P0 data/security remain. The UI unification done earlier this session is real value but is **presentation-tier**; the product will still "feel like two systems" until A1/B1/D1 land.

---

## 7. RECOMMENDED REMEDIATION ORDER (maps to your Phases 1–12)

1. **P3 Canonical contracts (Phase 3):** define one `Order` view = `Sale` + fulfillment; define `DeliveryStatus` enum + business-status↔UI-label map; generate shared DTOs/enums.
2. **P0 Delivery persistence (Phase 8, but do early):** `DeliveryRepository` on the DB; checkout persists + links `saleId`; all readers (apps/delivery, web, bot-builder) use it. Add Sale→Delivery integration test.
3. **P0 Backend RBAC + delivery auth (Phase 4):** `require_roles`/permissions dependency; secure delivery status writes; finish relational roles.
4. **P1 Login→workspace resolver (Phase 7):** role-based landing; one navigation contract.
5. **P1 Design-system convergence (Phases 5–6):** one token source; promote shared primitives (`AppShell`, `DataTable`, `StatusBadge`, states, `api` helper); replace emoji icons.
6. **Phase 9–12:** roll to remaining modules, regression + cross-module data QA, visual QA per role, final review.

---

## 8. FINAL DELIVERABLE (your Section 33)

1. **What was found:** a broad, well-documented platform whose Delivery domain is a disconnected in-memory demo and whose RBAC is frontend-only; two design systems; documented-but-unreconciled schema drift.
2. **What was wrong:** RC-1…RC-5 above.
3. **Root causes:** in-memory delivery service; no API RBAC; dual schema ownership; duplicated modules/design systems; fabricated/renamed delivery fields.
4. **What was fixed (this engagement):** discovery + audit only; **no business logic changed.** (Earlier this session, a UI theme unification across the 6 apps was applied — presentation-tier, does not address the data root causes.)
5. **What remains:** all P0/P1 items in Section 6.
6. **Data consistency results:** one canonical `Sale`; Delivery diverges (Section 4) — **fails** consistency until A1/B1.
7. **Delivery results:** in-memory, unauthenticated writes, fabricated payment, triplicated UI — **fails** (Section 3).
8. **UI/UX results:** now visually unified (this session); structurally still two systems + emoji icons + no shared table/badge — **partial**.
9. **Design-system results:** `@mystore/ui` established; palettes aligned with web/shadcn; components not yet converged — **partial**.
10. **Role/permission results:** intended model documented; **not enforced** at API — **fails** (D1/L2).
11. **Test results:** backend suite exists but validates the stub; frontends largely untested — **misleading green**.
12. **Performance results:** acceptable; large web/store bundles to code-split — **minor**.
13. **Security results:** two P0s (unauth delivery writes, no API RBAC) — **fails**.
14. **Remaining risks:** changing checkout to persist delivery could regress the live storefront demo; schema reconciliation risks write breakage; RBAC rollout could lock out under-permissioned users — all need flags + parity tests.
15. **Recommended next phase:** execute Section 7 order, starting with canonical contracts + delivery persistence behind a feature flag, with a Sale→Delivery→Admin→Reports parity test as the acceptance gate.

---

*Evidence is cited inline as `path:line`. This audit intentionally contradicts the "9.2/10 / 0 critical" claim in `enterprise-project-audit-report.md`; that document describes the target architecture, this one describes the running code as of 2026-09-09.*
