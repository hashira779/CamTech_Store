# Session 2026-09-16 — API RBAC Rollout

**Scope:** `services/backend-py/app/modules/*`, `app/routers/*`, `app/core/permissions.py`, `app/core/dependencies.py`.
**Closes:** the P0 finding in `2026-09-09-master-ui-data-role-audit.md` — *"role-based authorization is not enforced at the API layer."*

## Headline

`RequirePermissions` / `RequireAnyPermission` existed and worked but were wired to
~10 endpoints. **157 call sites across 32 files used bare `get_current_user`**, which
authenticates but does not authorize — any authenticated user of any role could
reach nearly the whole API.

**After:** 5 call sites use bare authentication, all deliberate and allowlisted in
`tests/test_rbac_matrix.py`. Every other endpoint carries a permission.

Test suite: **136 passed** (112 pre-existing + 24 new), `python -m pytest tests -q`.

---

## 1. What changed

### `app/core/permissions.py`
Matrix expanded from 17 permission strings to a full taxonomy covering every
module. Role rows rewritten with a stated rationale per role:

| Role | Shape of access |
|---|---|
| `SUPER_ADMIN` / `ORG_ADMIN` | `["*"]` — unchanged |
| `MANAGER` | Full day-to-day operations; **no** ledger posting, tenant config, or permanent deletes |
| `DISPATCHER` | Delivery dispatch + the read context needed to route orders |
| `CASHIER` | POS: sales, catalog/pricing reads, walk-in customer registration, restaurant front-of-house |
| `DELIVERY_DRIVER` | `delivery:read` + `delivery:update_own` only (unchanged, deliberately minimal) |

Added `ADMIN_ONLY_PERMISSIONS` — the permissions granted by no role row, so only
the `*` wildcard reaches them. This extends the `apps:delete` convention to every
permanent delete (`catalog:delete`, `locations:delete`, `pricing:delete`,
`telegram:delete`, `automations:delete`, `bots:delete`), ledger integrity
(`finance:post`, `finance:void`), tenant config (`org:write`, `org:domains`,
`industry:setup`, `notifications:config`), and platform plumbing
(`platform:admin`, `security:manage`, `data:import`, `hr:payroll`).

It is a test fixture as well as documentation: `test_admin_only_permissions_are_granted_by_no_role`
fails if one is ever added to a role row.

### `app/core/dependencies.py`
Added `RequireStreamingPermissions` — same contract as `RequirePermissions` but
resolves through `get_streaming_user`, because SSE clients authenticate with
`?token=` (browsers cannot set headers on `EventSource`). Used by `GET /events/stream`.

### `app/routers/security_routes.py`
Replaced the hand-rolled `_require_admin` role check with
`RequirePermissions(["security:manage"])`. Behaviour is identical (the permission is
admin-only by construction) but the check now routes through the shared matrix.

---

## 2. Security holes closed along the way

These were pre-existing bugs found while working through the modules, not
consequences of the rollout:

1. **`GET /delivery/tasks` was effectively unauthenticated.** It ran on
   `get_optional_user`, and `resolve_org_id(None)` falls back to
   `settings.DEFAULT_ORG_ID` — so an anonymous caller received the default org's
   entire delivery book: recipient names, phone numbers, addresses, COD amounts.
   Now `delivery:read`.
2. **`PATCH /delivery/tasks/{order_id}/status` was effectively unauthenticated** —
   anyone could move any order to `DELIVERED`. Now
   `RequireAnyPermission(["delivery:manage", "delivery:update_own"])`. (Flagged in the task brief.)
3. **`GET /delivery/drivers/public` leaked the driver roster** — live telemetry,
   vehicle, phone — to anonymous callers. No frontend called it. Now `delivery:read`.
4. **`GET /notifications/config` returns `telegramBotToken` in plaintext.** It is
   gated on the admin-only `notifications:config`, not on `notifications:read`.
5. **The customer portal rendered other customers' orders.** `apps/web/app/customer/page.tsx`
   fetched `/delivery/tasks` (whole-org) and filtered client-side with
   `if (matchesUser || mergedList.length === 0)` — so a customer with no local
   session orders saw *everything*. Repointed to the customer-scoped
   `GET /customers/orders?email=…`, which already returns the delivery tracking
   fields the page needs. See §4.

---

## 3. Endpoints intentionally left open

**Unauthenticated (no change):**

| Endpoint | Why |
|---|---|
| `GET /public/products` | Storefront catalog |
| `POST /auth/{register,login,oauth-sync,refresh}` | Pre-authentication |
| `POST /delivery/auth/{register/init,register/verify,login/auto}` | Driver onboarding, pre-authentication |
| `GET /delivery/track/{identifier}` | Customer parcel tracking by tracking number |
| `POST /delivery/orders/public`, `POST /delivery/tasks` | Storefront checkout creates the dispatch order (`apps/web/app/shop/page.tsx`) |
| `POST /customers/{sync,public-sync}`, `GET /customers/profile`, `GET,POST /customers/cart` | Storefront guest/customer session |
| `POST /sales/{store-checkout,public-checkout}`, `GET /sales/customer-orders`, `GET /customers/orders` | Storefront checkout + customer order history; scoped by email/phone, not by role |
| `GET /apps/registry`, `GET /apps/resolve` | App registry used for hostname routing before login |
| `POST /telegram/webhook`, `POST /bot-builder/webhook/{bot_id}` | Telegram posts to these directly — see caveat below |

**Authenticated but deliberately not permission-gated** (allowlisted in `tests/test_rbac_matrix.py`):

| Endpoint | Why |
|---|---|
| `GET /auth/me`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify` | Self-service on the caller's own account |
| `GET /apps/check-access`, `GET /apps/my-apps` | Self-service; already evaluate the caller's own roles. Gating them would break every app's bootstrap |

---

## 4. Frontend change

`apps/web/app/customer/page.tsx` — the only frontend change. Required: the page
called the now-restricted `/delivery/tasks`, and the `CUSTOMER` role holds no
permissions (see §5). Swapped to `GET /customers/orders?email=…`, normalising
`SaleDto` into the delivery-task shape the page renders, and dropped the
client-side owner-matching heuristic since the server now scopes the result.

The other non-admin apps were checked against their API clients and need **no**
changes: `cashier` (`/auth/login`, `/public/products`, `/sales`), `delivery`
(`/delivery/auth/*`, `/delivery/orders`, `/delivery/orders/{id}/status`), `hr`
(`/hr/employees`), `ceo` (`/sales`, `/hr/employees`, `/public/products`,
`/apps/registry`), `store` (all storefront endpoints listed above).
`test_role_permission_expectations` pins each of these role/permission pairs.

---

## 5. Known gaps — NOT addressed here

1. **`CUSTOMER` is not in `PERMISSIONS_MATRIX`.** `POST /auth/register` defaults new
   users to role `CUSTOMER` (`identity/api.py:55`), which is absent from the matrix
   and from `VALID_ROLES`, so it grants zero permissions. That is safe-by-default and
   correct for the storefront, but it means `CUSTOMER` is load-bearing in the code
   while being invisible to the RBAC matrix. It should be added explicitly.
2. **`extract_user_roles` falls back to `["CASHIER"]`** (`dependencies.py:31`) when a
   user has no `user_roles` rows. A user with no roles silently becomes a cashier
   with `sales:write` / `customers:write`. It should fail closed. Changing it is a
   behavioural decision with breakage risk, so it is flagged rather than changed.
3. **Neither Telegram webhook validates a secret.** `POST /telegram/webhook` and
   `POST /bot-builder/webhook/{bot_id}` accept any JSON body; the latter drives the
   workflow engine for any known `bot_id`. Telegram supports
   `X-Telegram-Bot-Api-Secret-Token` — wiring it needs a per-bot secret stored at
   registration, so it is out of scope for an RBAC pass.
4. **Permissions are endpoint-level, not row-level.** `delivery:update_own` is
   enforced as "may call the update endpoint", not "may only update *their own*
   assignments" — the handler still decides. Row scoping is a separate pass.
