# Multi-Experience Enterprise UX Architecture (Spec §151–§197)

> **Document Version:** 1.0.0  
> **Standard:** Universal Platform, Multi-Experience Resolution  
> **Status:** Production-Ready & Verified

---

## 1. Architectural Tenet (§151, §197)

```text
               SHARED BUSINESS PLATFORM
                          │
           ┌──────────────┼──────────────┐
           │              │              │
       Identity        Business         Data
                      Services
           │              │              │
           └──────────────┼──────────────┘
                          │
                    EXPERIENCE LAYER
                          │
     ┌────────┬────────┬──┴───┬────────┬─────────┐
     │        │        │      │        │         │
    CEO      POS     Driver   HR    Warehouse Customer
     │        │        │      │        │         │
  Command   POS UI   Driver   HR UI   WMS UI    Store
  Center              App                        UI
```

**Rule**: *One platform, one business core, one data model — but many experiences, many applications, many workflows, and many business configurations.*

---

## 2. Experience Resolution Matrix (§154, §180)

| Experience Profile | Target Role / Persona | Dedicated Application Interface | Features & Capabilities | What is NOT Exposed |
|---|---|---|---|---|
| **`EXECUTIVE`** | CEO / Super Admin | [`/dashboard`](file:///d:/Project/MyStore/apps/web/app/dashboard/page.tsx) & Command Center | Global enterprise KPIs, revenue, cash, AR/AP, branch drilldown, approvals, system health, AI copilot | None (Full control plane) |
| **`STORE_MANAGER`** | Branch / Store Manager | Store Operations Workspace | Today's sales, cashier shift oversight, low stock alerts, branch discount/refund approvals | Global corporate settings, developer API keys |
| **`POS_CASHIER`** | Cashier / Retail Staff | [`/sales/new`](file:///d:/Project/MyStore/apps/web/app/sales/new/page.tsx) (POS Terminal) | Direct entry into touch cart, barcode scanning, split payments, KHQR, shift drawer | General ledger, HR records, cost margins |
| **`DELIVERY_DRIVER`** | Courier / Fleet Driver | [`/driver`](file:///d:/Project/MyStore/apps/web/app/driver/page.tsx) (Mobile Express App) | Mobile-first one-handed UI: today's route, call customer, start route, Proof of Delivery (POD) signature, COD cash collection | General ledger, HR payroll, system administration |
| **`WAREHOUSE_WMS`** | WMS Operator / Stock Clerk | [`/transfers`](file:///d:/Project/MyStore/apps/web/app/transfers/page.tsx) & Inventory | Bin locations, stock receiving, transfer dispatch, barcode verification, lot quarantine | Finance statements, HR employee records |
| **`HR_OPERATIONS`** | HR Manager / People Ops | [`/hr`](file:///d:/Project/MyStore/apps/web/app/hr/page.tsx) (People Command Center) | Employee directory, attendance logs, leave approval workflows, monthly payroll execution | POS terminal, inventory valuation, supplier cost |
| **`FINANCE_LEDGER`** | Accountant / CPA / CFO | [`/finance`](file:///d:/Project/MyStore/apps/web/app/finance/page.tsx) & [`/taxes`](file:///d:/Project/MyStore/apps/web/app/taxes/page.tsx) | General ledger, chart of accounts, journal entries, tax liabilities, depreciation | Operational driver tasks, customer cart |
| **`CUSTOMER_STORE`** | Public Consumer / Client | [`/shop`](file:///d:/Project/MyStore/apps/web/app/shop/page.tsx) (Commerce Storefront) | Public e-commerce portal: category discovery, search, cart drawer, Bakong KHQR instant payment, order tracking | Internal margins, supplier costs, warehouse valuation |

---

## 3. Experience Switching & Control Plane (§176, §190)

- **Interactive Switcher Component**: [`WorkspaceSwitcher`](file:///d:/Project/MyStore/apps/web/components/workspace-switcher.tsx) is mounted directly in the top header and navigation drawer.
- **Admin Full Control**: CEOs, Super Admins, and Organization Admins can switch between any role experience at will with a single click to inspect, test, or operate in that exact role's perspective.
- **Dedicated Entry Enforcement**: When a driver logs in, they are immediately routed to `/driver`; cashiers are routed to `/sales/new`; consumers to `/shop`.
