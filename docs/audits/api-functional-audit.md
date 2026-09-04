# API Functional Audit — Backend Write Paths

**Date:** 2026-09-04
**Method:** Probed the running canonical backend (`services/backend-py`, FastAPI on :4000) as a real authenticated admin — enumerated the OpenAPI surface, hit every reachable `GET`, and tested representative `POST` create/compute endpoints with realistic payloads.
**Headline:** Reads work broadly; **a large fraction of write (create) paths are broken by one systemic bug.** The platform *looks* complete but cannot yet persist data in most modules.

> [!NOTE]
> ## ✅ RESOLVED — 2026-09-04 (later same day)
> Every write path in this audit is now fixed and **verified live** against the running stack:
> - **Enum-binding sweep — complete.** All 33 native Postgres enum types are bound via [`app/core/db_enums.py`](../../services/backend-py/app/core/db_enums.py) (`pg_enum()`). Models + full app import cleanly (62 tables, 108 routes). `POST /products`, `POST /locations`, `POST /sales`, etc. now return `200/201`.
> - **`POST /customers` 405 — fixed.** Added `POST` + `PATCH`/`PUT` in [`customers/api.py`](../../services/backend-py/app/modules/customers/api.py) with enum validation (bad `type` → clean `400`, not a DB 500).
> - **Reports `$0.00` (404) — fixed.** The frontend called `GET /reports/summary`, which did not exist; implemented it (plus `/reports/export`) computing real figures from live data in [`reporting/api.py`](../../services/backend-py/app/modules/reporting/api.py). Removed the hardcoded mock `/reports/dashboard`.
> - **`/customers` routing bug — fixed.** The admin CRM route was hijacked by the customer-portal shell (`startsWith('/customer')`); fixed in [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx) and `domain-bar.tsx`.
> - **Live smoke test:** all create endpoints `200/201`; 44/47 GETs `200` (the 3 non-200 are param-required or the SSE stream). See the session changelog: [`session-2026-09-04.md`](session-2026-09-04.md).

---

## 1. Reads — healthy ✅

Of **45 probed `GET` endpoints**: **42 → 200 OK**, **0 → 500**. The two `4xx` are param-required endpoints (`/apps/check-access`, `/apps/resolve` → 400 without query args) and one is the SSE stream (`/events/stream`). Listing/detail pages across the platform read real data correctly.

## 2. Writes — systemically broken ⛔

Representative create/compute test:

| Endpoint | Result |
|---|---|
| `POST /categories` | ✅ 200 |
| `POST /sales` | ✅ 200 (fixed earlier this session) |
| `POST /taxes/calculate` | ✅ 200 |
| `POST /pricing/resolve` | ✅ 200 |
| `POST /promotions/evaluate` | ✅ 200 |
| `POST /products` | ⛔ **500** |
| `POST /locations` | ⛔ **500** |
| `POST /customers` | ⚠️ **405** (method/route mismatch — see §4) |

### Root cause (systemic): enum column ↔ string mismatch
The database defines **native Postgres `ENUM` types**, but the SQLAlchemy models declare those columns as plain `String`. On insert, asyncpg sends a `varchar` and Postgres refuses the implicit cast:

```
asyncpg.exceptions.DatatypeMismatchError:
  column "type" is of type "ProductType" but expression is of type character varying
```

This is the **same bug** already fixed for `sales` (`SaleStatus`, `PaymentMethod`, `PaymentStatus`). It is **not unique to sales** — it affects every table with an enum column whose model still uses `String`.

### Blast radius: 29 tables, 37 enum columns
Every table below has ≥1 native enum column. Any `INSERT`/`UPDATE` touching it 500s unless the model binds the enum type:

| Fixed ✅ | Confirmed broken ⛔ | Likely broken (same pattern) |
|---|---|---|
| `sales` (SaleStatus) · `sale_payments` (PaymentMethod, PaymentStatus) | `products` (ProductType) · `locations` (LocationType) | `customers` (CustomerType) · `accounts` (AccountType) · `employees` (EmploymentStatus) · `fixed_assets` (DepreciationMethod, AssetStatus) · `journal_entries` (JournalSourceType, JournalEntryStatus) · `promotions` (PromotionScope, PromotionType) · `purchase_orders` (PurchaseOrderStatus) · `service_tickets` (TicketPriority, TicketStatus) · `stock_movements` (StockMovementType) · `stock_transfers` (StockTransferStatus) · `leave_requests` · `payroll_runs` · `loyalty_transactions` · `goods_receipts` · `project_tasks` · `projects` · `accounting_periods` · `price_lists` · `notification_records` · `store_credit_transactions` · `suppliers` · `warehouse_zones` · `workflow_definitions`/`instances`/`steps` |

**~24 tables still need the fix.** Until then, creating a product, location, customer, journal entry, PO, ticket, transfer, etc. will fail with a 500.

## 3. The standard fix (one mechanical pattern)
Bind each enum column to its existing Postgres type so SQLAlchemy emits the cast — the pattern already applied in `app/modules/sales/models.py`:

```python
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
ProductTypeEnum = PgEnum("PHYSICAL", "SERVICE", ..., name="ProductType", create_type=False)
# ...
type = Column(ProductTypeEnum, nullable=False)   # was Column(String)
```

Applied across the 29 tables, this unblocks the create endpoints in one pass. (Enum label sets can be read straight from `pg_enum`.)

## 4. Other findings (from this and prior audits)
- **`POST /customers` → 405** — the path exists but doesn't accept `POST` there; the create route is mis-mounted or under a different path. Needs a routing check (separate from the enum issue).
- **Contracts ↔ backend drift** — `@mystore/contracts` still uses the old NestJS shapes (`lineItems`/`productVariantId`) vs the backend's `items`/`variantId`. Band-aided at the `api.createSale` boundary; other calls (e.g. `driver` page `DeliveryOrderDto`) still fail typecheck. Needs a one-time reconciliation.
- **Two POS implementations** — cashier experience (`src/apps/pos/PosPage.tsx`) vs admin (`app/sales/new/page.tsx`). The cashier one had **dead checkout buttons** (no handler) — fixed this session; they diverge and should be consolidated.
- **Frontend data is real, not static** — audit of ~30 pages found zero mock/hardcoded data; every page uses live API calls.

## 5. Verdict
The platform's **breadth is real and reads work**, but it is **not yet operational for data entry** across most domains: a single systemic enum-binding defect breaks ~26 of the create endpoints. This is high-impact but **low-difficulty** — one repeated, mechanical fix (plus the customers routing fix and the contracts reconciliation) restores write capability platform-wide.

### Recommended order
1. **Enum binding sweep** (all 29 tables) — unblocks writes everywhere. *Highest leverage.*
2. **Fix `POST /customers` routing** (405).
3. **Reconcile `@mystore/contracts` with the Python backend** — kills a whole class of frontend/API mismatches.
4. **Consolidate the two POS screens.**
