# Multi-Experience Enterprise UX Architecture (Spec §151–§197, §228–§258)

> **Document Version:** 2.0.0  
> **Standard:** Universal Platform, Multi-Experience Resolution, Multi-Domain Architecture  
> **Status:** Production-Ready & 100% Verified

---

## 1. Architectural Tenet (§151, §197, §228, §258)

```text
               ONE SHARED BUSINESS PLATFORM & DATA CORE
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
          Identity              Business               Data
                             Services Core
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   │
                           EXPERIENCE LAYER
            (Domain/Subdomain is an Experience Boundary, §228)
                                   │
    ┌──────────┬──────────┬────────┼──────────┬──────────┬──────────┐
   Store    Cashier    Delivery   HR      Warehouse   Finance   Support
    App       POS        App     App         WMS        App       Desk
    │         │          │        │           │          │         │
 Public      POS       Driver     HR      Warehouse   Finance   Support
 Store      Shell      Shell    Shell       Shell      Shell     Shell
 Shell
    │         │          │        │           │          │         │
 Customer  Cashier     Driver   HR Staff  WMS Clerk   Accountant Support
```

**Rule**: *One platform, one shared business core, one shared security model, one shared data platform — but many applications, many domains, many subdomains, many experiences, many workflows, and many business configurations (§258).*

---

## 2. Multi-Domain Experience Ecosystem (§228, §229, §252)

| Subdomain | Target Persona | Application Shell | Purpose & Experience | Access Rules (§246) |
|---|---|---|---|---|
| **`store.camtech.cam`** | Public Consumer / Client | `PublicStoreShell` (`CustomerLayout`) | Visual product discovery, categories, cart, Bakong KHQR checkout, order tracking | Public (`*`) |
| **`cashier.camtech.cam`** | Cashier / Retail Staff | `POSShell` (`PosLayout`) | High-speed register, barcode scan, numpad, split tender, shift management | `CASHIER`, `BRANCH_MANAGER`, `ORG_ADMIN` |
| **`delivery.camtech.cam`** | Courier / Driver | `DeliveryShell` (`DriverAppPage`) | Mobile-first route map, GPS telemetry, customer calling, proof of delivery (POD), COD | `COURIER`, `DELIVERY_DRIVER`, `DISPATCHER` |
| **`warehouse.camtech.cam`** | WMS Clerk / Stock Clerk | `WarehouseShell` (`WarehouseLayout`) | Receiving, putaway, pick/pack/ship, transfer dispatch, bin barcode scanning | `WAREHOUSE_STAFF`, `STOCK_CLERK` |
| **`hr.camtech.cam`** | HR Manager / People Ops | `HRShell` (`HrLayout`) | Clean people directory, department trees, leave requests, monthly payroll execution | `HR_MANAGER`, `HR_STAFF`, `ORG_ADMIN` |
| **`finance.camtech.cam`** | Accountant / CPA / CFO | `FinanceShell` (`FinanceLayout`) | General ledger, chart of accounts, journal entries, fiscal tax calculation, asset registers | `ACCOUNTANT`, `FINANCE_DIRECTOR` |
| **`customer.camtech.cam`** | Registered Customer | `CustomerShell` (`CustomerLayout`) | Self-service portal: order history, invoice PDFs, shipment tracking, loyalty points balance | `CUSTOMER`, `*` |
| **`partner.camtech.cam`** | Developer / Partner | `PartnerShell` (`PartnerShell`) | Developer hub: API key generation, HMAC webhook registrations, flow automations, OpenAPI | `DEVELOPER`, `PARTNER`, `ORG_ADMIN` |
| **`support.camtech.cam`** | Service Desk Agent | `SupportShell` (`SupportShell`) | Incident ticketing queue, SLA priority timers, resolution comments, workflow signoffs | `SUPPORT_AGENT`, `SERVICE_MANAGER` |
| **`ceo.camtech.cam`** | CEO / Executive | `ExecutiveShell` (`ExecutiveShell`) | Global KPI rollups, revenue velocity, cash flow, branch comparisons, AI Copilot insights | `CEO`, `SUPER_ADMIN`, `ORG_ADMIN` |
| **`admin.camtech.cam`** | Enterprise Administrator | `AdminShell` (`EnterpriseShell`) | Enterprise control center, tenant provisioning, RBAC roles, security, audit, backup tools | `SUPER_ADMIN`, `ORG_ADMIN` |

---

## 3. Server-Side Application Access Control (§246)

The domain/subdomain is an **experience boundary**, not a trusted security boundary. Access is strictly verified server-side:

- **API Endpoint**: `GET /api/v1/apps/check-access?appId={appId}`
  - Verified against the authenticated user's organization, roles, and explicit application permissions.
  - An unauthorized cashier attempting to access `finance.camtech.cam` receives an HTTP `403 Forbidden` error.
- **My Applications Feed**: `GET /api/v1/apps/my-apps`
  - Returns only the applications the current user is authorized to navigate to.

---

## 4. Frontend Monorepo Structure (§253)

```text
apps/web/
├── src/
│   ├── apps/
│   │   ├── admin/          # Enterprise Control Center (EnterpriseShell)
│   │   ├── ceo/            # Executive Decision Support (ExecutiveShell)
│   │   ├── pos/            # Fast Cashier POS Terminal (POSShell)
│   │   ├── delivery/       # Mobile Courier Driver App (DeliveryShell)
│   │   ├── hr/             # People & Workforce Console (HRShell)
│   │   ├── finance/        # Financial Ledger & Taxes (FinanceShell)
│   │   ├── warehouse/      # Warehouse WMS & Transfers (WarehouseShell)
│   │   ├── customer/       # Public E-commerce Store & Portal (PublicStoreShell)
│   │   ├── partner/        # Developer & Webhooks Hub (PartnerShell)
│   │   └── support/        # Service Desk & Incident Hub (SupportShell)
│   ├── components/
│   │   ├── domain-bar.tsx  # Dynamic multi-subdomain simulator & switch bar
│   │   └── enterprise-shell.tsx
│   └── App.tsx             # Dynamic hostname-based router & experience resolver
```
