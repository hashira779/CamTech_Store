# Multi-Domain / Multi-Subdomain Experience Architecture (Spec §228–§258)

> **Document Version:** 1.0.0  
> **Platform Standard:** Multi-Subdomain Experience Boundaries over Unified Enterprise Core  
> **Status:** Production-Ready & Verified

---

## 1. Architectural Model (§228, §258)

```text
Incoming Domain / Subdomain (e.g. store.camtech.cam, delivery.camtech.cam, hr.camtech.cam)
                 ↓
           Domain Resolver
                 ↓
       Application Registry
                 ↓
   ┌─────────────┴─────────────┐
   ▼                           ▼
Dedicated Role Shell    Tenant Context & RBAC
   │                           │
   └─────────────┬─────────────┘
                 ▼
      Unified Enterprise Core
  (Identity, APIs, DB, Audit, SSE)
```

**Golden Rule (§228, §258)**:  
*A domain/subdomain is an **experience boundary**, not a backend service boundary. Different domains provide completely distinct products and user journeys while sharing one rock-solid security, data, and transactional core.*

---

## 2. The 10 First-Class Subdomain Applications (§230–§239, §242)

| Subdomain | Application Title | Primary Persona | Dedicated Landing | Capabilities & UX Focus |
|---|---|---|---|---|
| **`store.camtech.cam`** | CamTech Online Store | Public Shopper | [`/shop`](file:///d:/Project/MyStore/apps/web/app/shop/page.tsx) | Product discovery, search, cart drawer, Bakong KHQR instant payment, order tracking. Zero ERP clutter. |
| **`cashier.camtech.cam`** | POS Cashier Terminal | Cashier / Retail Staff | [`/sales/new`](file:///d:/Project/MyStore/apps/web/app/sales/new/page.tsx) | Speed, large touch targets, barcode scanning, split payments, shift drawer. |
| **`delivery.camtech.cam`** | Driver & Fleet App | Courier / Fleet Driver | [`/driver`](file:///d:/Project/MyStore/apps/web/app/driver/page.tsx) | Mobile-first one-handed UI: today's route, call customer, navigate, Proof of Delivery (POD) signature, COD cash collection. |
| **`warehouse.camtech.cam`** | Warehouse WMS | WMS Operator | [`/transfers`](file:///d:/Project/MyStore/apps/web/app/transfers/page.tsx) | Bin locations, stock receiving, transfer dispatch, lot quarantine, barcode scanning. |
| **`hr.camtech.cam`** | HR People Operations | HR Manager | [`/hr`](file:///d:/Project/MyStore/apps/web/app/hr/page.tsx) | Employee directory, attendance logs, leave approval workflows, monthly payroll runs. |
| **`finance.camtech.cam`** | Finance & Accounts | Accountant / CFO | [`/finance`](file:///d:/Project/MyStore/apps/web/app/finance/page.tsx) | General ledger, chart of accounts, tax liabilities, fixed assets, trial balances. |
| **`customer.camtech.cam`** | Customer Portal | Consumer / Client | [`/customer`](file:///d:/Project/MyStore/apps/web/app/customer/page.tsx) | Past orders, download official tax invoices, live tracking timeline, loyalty rewards balance. |
| **`partner.camtech.cam`** | Partner & Developer | B2B Partner / Dev | [`/developers`](file:///d:/Project/MyStore/apps/web/app/developers/page.tsx) | Developer apps, scoped API keys, webhook delivery audit logs, and OpenAPI docs. |
| **`ceo.camtech.cam`** | Executive Command Center | CEO / Board Member | [`/dashboard`](file:///d:/Project/MyStore/apps/web/app/dashboard/page.tsx) | High-level decision support: revenue velocity, cash, branch drilldowns, approvals, AI Copilot. |
| **`admin.camtech.cam`** | Enterprise Control Plane | Super Admin | [`/settings`](file:///d:/Project/MyStore/apps/web/app/settings/page.tsx) | Multi-tenant isolation, security center, database backups, audit guards, and feature flags. |

---

## 3. Domain Resolution & Multi-Tenant Mapping (§240, §241)

- **Backend Registry API**: `GET /api/v1/apps/registry` returns all 10 registered application profiles.
- **Domain Resolver API**: `GET /api/v1/apps/resolve?host=...` maps hostnames to their application configuration.
- **Custom Tenant Domains**: `POST /api/v1/apps/custom-domain` allows tenants to map custom domains (e.g. `shop.brand.com` $\to$ `store`).
- **Interactive Simulator Bar**: [`apps/web/components/domain-bar.tsx`](file:///d:/Project/MyStore/apps/web/components/domain-bar.tsx) enables seamless testing across all subdomains with 1 click in development and preview environments.
