# Python Backend ↔ Database Schema Drift Audit

**Date:** 2026-09-03
**Scope:** `services/backend-py` (FastAPI + SQLAlchemy) vs the live PostgreSQL database (`camtechStore`)
**Status:** ⛔ Canonical Python backend cannot reliably write to the current database. Decision required.

---

## 1. Executive summary

You chose the **Python/FastAPI + Vite** stack as canonical and retired the NestJS/Next.js stack. However, the PostgreSQL database it runs against was **created by the retired stack's Prisma schema**, and the Python **SQLAlchemy models have drifted from it**. The result:

- **31 of 40 model tables have write‑breaking drift** — most `POST`/`PUT` endpoints fail with HTTP 500.
- **6 models have no table at all** in the database.
- **28 database tables have no Python model** — those features are unreachable from the Python backend.
- The Python backend has **no schema ownership and no migration tooling** (`core/database.py` has no `create_all`, and there is no Alembic setup). It simply assumes the tables already exist.

**Bottom line:** reads work only where the two schemas happen to agree; writes broadly fail. This is the primary reason the platform is "still not ok." No code or database changes were made pending your decision (see §7).

---

## 2. What was already fixed this session (safe, schema‑independent)

These three are genuine bugs, verified, and do **not** depend on the schema decision:

| Fix | File | Evidence |
|---|---|---|
| `/ready` crashed — SQLAlchemy 2.0 needs `text("SELECT 1")` | `app/main.py` | Now returns `{"status":"ready","database":"connected"}` (live‑verified) |
| **`POST /sales` 500'd for everyone** — `secrets` used but never imported (`NameError`) | `app/routers/api_v1.py` | Added `import secrets`; endpoint now reaches its logic |
| **Sales trusted client prices** (§66/§106) — used client `unitPrice`/`taxRatePct`/`sku`/`name` | `app/routers/api_v1.py` | Rewrote to load authoritative price from DB, org‑scoped; unknown/cross‑tenant variant → `400` (live‑verified). *Cannot fully persist until the `sales` table drift below is resolved.* |

> The earlier NestJS/contracts fixes made before you chose Python are now moot (that stack is retired) but were left in place, not reverted.

---

## 3. The core problem: schema ownership

```
   Prisma (NestJS, RETIRED)  ──creates──▶  PostgreSQL tables  ◀──reads/writes──  SQLAlchemy models (Python, CANONICAL)
        schema owner                          (62 tables)                             drifted, no migrations
```

The database's column names, nullability, and table set are defined by Prisma. The Python models were written against a *different* mental schema. Nobody reconciled them. Because Python has no `create_all`/Alembic, it can never bring the DB into line on its own.

---

## 4. Drift audit — how it was measured

A read‑only introspection script (`scripts/schema_audit.py`, see Appendix) compared, for every SQLAlchemy table in `Base.metadata`, its column set against `information_schema.columns` for the `public` schema, classifying each table:

- **model has / DB lacks** → any read or write touching that attribute raises `UndefinedColumnError` (HTTP 500).
- **DB requires (NOT NULL, no default) / model omits** → model inserts leave the column unset → insert rejected.
- **DB has / model ignores (nullable or defaulted)** → tolerated for now (reads/writes still work).

Totals: **40 SQLAlchemy models · 62 public tables · 31 CRITICAL · 6 model‑without‑table · 28 table‑without‑model.**

---

## 5. CRITICAL table‑by‑table drift (writes broken)

| Table | Model has, DB lacks (read/write 500) | DB requires but model omits (insert fails) |
|---|---|---|
| accounts | `category` | — |
| api_keys | `status`, `updatedAt` | — |
| audit_logs | `userId`, `resource`, `details` | `resourceType` |
| customers | `creditBalance` | — |
| departments | — | `updatedAt` |
| depreciation_records | `depreciationAmount` | `amount` |
| developer_apps | `status` | — |
| employees | — | `position`, `updatedAt` |
| fixed_assets | `assetNumber`, `accumulatedDepreciation`, `bookValue` | `assetCode`, `currentBookValue` |
| inventory_items | `variantId`, `createdAt` | `productVariantId` |
| journal_entries | `date`, `memo` | `description` |
| locations | `isActive` | — |
| loyalty_transactions | `reference` | `balanceAfter` |
| price_lists | — | `updatedAt` |
| projects | — | `updatedAt` |
| promotions | `value`, `minSpend` | `discountValue`, `updatedAt` |
| sale_line_items | `variantId`, `name` | `productVariantId`, `productName` |
| sale_payments | `createdAt` | — |
| **sales** | `itemCount`, `customerName`, `paymentStatus` | `userId` |
| stock_movements | `variantId`, `locationId`, `reference` | `inventoryItemId`, `balanceAfter`, `userId` |
| stock_transfers | `fromLocationId`, `toLocationId` | `sourceLocationId`, `destinationLocationId`, `requestedById`, `updatedAt` |
| tax_rates | — | `code`, `updatedAt` |
| telegram_chat_bindings | `boundById` | — |
| ticket_comments | `content` | `comment` |
| webhook_subscriptions | `appId`, `status` | — |

**Naming‑philosophy conflicts** (the deepest issue — same data, different names): `variantId` vs `productVariantId`, `name` vs `productName`, `value`/`minSpend` vs `discountValue`/`minOrderAmount`, `fromLocationId`/`toLocationId` vs `sourceLocationId`/`destinationLocationId`, `content` vs `comment`, `date`/`memo` vs `description`. These cannot be resolved by adding columns — they require renaming in the models (and every router/DTO that references them) **or** recreating the tables from the models.

## 5b. Models with NO database table (6)

`approval_requests`, `documents`, `journal_lines`, `notifications`, `payroll_records`, `timesheets` — any endpoint using these fails entirely.

## 5c. Database tables with NO Python model (28) — unreachable features

`accounting_periods`, `customer_addresses`, `document_records`, `goods_receipt_line_items`, `goods_receipts`, `journal_line_items`, `leave_requests`, `loyalty_program_configs`, `notification_configs`, `notification_records`, `payroll_items`, `payroll_runs`, `price_list_items`, `product_batches`, `project_tasks`, `purchase_order_line_items`, `purchase_orders`, `stock_transfer_lines`, `store_credit_transactions`, `suppliers`, `timesheet_entries`, `warehouse_bins`, `warehouse_zones`, `webhook_deliveries`, `workflow_definitions`, `workflow_instances`, `workflow_logs`, `workflow_steps`.

## 5d. Housekeeping

Several stale `test_e2e_*` Postgres schemas remain from the retired NestJS e2e runs (they duplicate every table across schemas). They should be dropped during cleanup.

---

## 6. Endpoint impact (representative)

| Endpoint | Status |
|---|---|
| `POST /api/v1/sales` | ❌ `sales.userId` NOT NULL omitted + `itemCount`/`customerName`/`paymentStatus` absent |
| `POST /api/v1/products` | ⚠️ depends on `product_variants`/`inventory_items` drift (`variantId` vs `productVariantId`) |
| `GET /api/v1/*` list endpoints | 🟡 mostly work where column names coincide; 500 where a listed column is model‑only |
| `POST /flows/*`, tickets, promotions, finance writes | ❌ broken per the table above |
| `GET /health`, `/ready`, `/metrics`, `/auth/login`, `/auth/me` | ✅ working |

---

## 7. Options to reconcile (decision required)

### Option A — SQLAlchemy owns the schema *(recommended)*
Drop the Prisma‑created tables, generate the schema from the Python models (`Base.metadata.create_all`, ideally behind **Alembic** for future migrations), and add a **Python seed** (demo org, admin + cashier logins, sample products). Because the tables are then created *from* the models, all 31 mismatches disappear by construction.
- ✅ Makes Python truly canonical; gives it a real migration story; unblocks writes immediately.
- ⚠️ **Destructive**: drops current tables and demo data (regenerated by the seed). The 28 model‑less tables (suppliers, purchase_orders, workflow_*, …) are dropped too — the Python app doesn't use them yet; they'd be re‑added as models when those features are built.

### Option B — Align Python models to the existing DB
Rename columns across ~25 models, add 6 missing models, add 28 more for the orphan tables, and rewrite every router/DTO that references the old attribute names.
- ✅ Non‑destructive to data.
- ⚠️ Large, error‑prone, and keeps **Prisma** as the schema authority — contradicting retiring NestJS, and still leaves Python with no migration tooling.

**Recommendation: Option A.** It is the only path that ends the dual‑ownership conflict and matches "Python is canonical." The one real cost — losing demo data — is fully recoverable via a seed script.

---

## 8. Recommended next steps (once you decide)

1. **If A:** add Alembic to `services/backend-py`; generate the initial migration from the models; `alembic upgrade head` against a fresh DB; write `app/seed.py` (org + users + a few products); drop the stale `test_e2e_*` schemas; run the pytest suite + a live smoke test of `POST /sales`.
2. **If B:** start with the money path — align `sales`, `sale_line_items`, `sale_payments`, `product_variants`, `inventory_items` models + routers, verify `POST /sales` end‑to‑end, then proceed table by table.
3. Either way, add a CI step that **fails on model/DB drift** (run the audit script in `scripts/`) so this can never silently recur.
4. Decommission the retired NestJS `services/backend` and Next.js app once the Python stack is green (kept for now, not deleted).

---

## Appendix — reproducing this audit

The read‑only script lives at `scripts/schema_audit.py`. Run from the backend package:

```bash
cd services/backend-py
PYTHONPATH=. python scripts/schema_audit.py
```

It prints the per‑table drift and the summary reproduced above. It makes **no changes** to the database.
