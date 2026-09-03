# Target State — Universal Enterprise Business Platform (2026–2027)

> **Document Version:** 1.1.0  
> **Status:** Long-Term Architecture Target & Engineering Contract  
> **Applicable Specs:** Master Engineering Prompt §0–§112  
> **Canonical Backend:** Python/FastAPI (NestJS legacy retained as reference)

---

## 1. Primary Objective & Architectural Philosophy

The primary objective is to transform the repository into a configurable, multi-tenant, API-first **Universal Enterprise Business Platform** capable of supporting any vertical industry (Retail, Supermarket, F&B, Restaurant, Cafe, Fuel Station, Pharmacy, Electronics, Fashion, Automotive Spare Parts, Warehouse & Logistics, Subscriptions, B2B/B2C Marketplace, and Multi-country Enterprises).

### Core Directive: Platform Over Application
```
                      ┌─────────────────────────────────────────────────────────┐
                      │             CHANNELS & PRESENTATION TIER                │
                      │   Web App · POS (Electron/SQLite) · Mobile · Telegram   │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
                      ┌────────────────────────────▼────────────────────────────┐
                      │              UNIFIED API & SECURITY GATEWAY             │
                      │  AuthN/MFA · RBAC · Rate Limiter · Audit · Request ID   │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
                      ┌────────────────────────────▼────────────────────────────┐
                      │            CONFIGURABLE BUSINESS ENGINES                │
                      │  Product · Pricing · Promotion · Tax · Order · Stock    │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
        ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
        │                                          │                                          │
┌───────▼──────────────┐                ┌──────────▼───────────┐                   ┌──────────▼───────────┐
│  PERSISTENCE TIER    │                │   ASYNC & EVENT TIER │                   │   EXTENSION & AI     │
│ PostgreSQL (Primary) │                │ Redis Streams · Jobs │                   │ AI Gateway · Tools   │
│ S3 / MinIO (Files)   │                │ BullMQ Worker Tasks  │                   │ Partner / Dev APIs   │
└──────────────────────┘                └──────────────────────┘                   └──────────────────────┘
```

---

## 2. Multi-Tenancy & Organizational Hierarchy (Spec §11)

The platform implements an infinite recursive organizational tree with strict tenant boundaries. Every data record belongs to a tenant boundary and is strictly validated on the server.

```
Platform (Global SaaS Root)
   └── Organization (Tenant Boundary - complete data isolation)
         └── Company (Legal Entity / Multi-company Enterprise)
               └── Business Unit (Division e.g., Retail, F&B, Logistics)
                     └── Region / Area (Geographical groupings)
                           └── Branch / Store (Physical location / Storefront)
                                 ├── Department (Front of House, Back of House, Kitchen)
                                 ├── Warehouse (Fulfillment & Bin Tracking)
                                 └── POS Terminal / Cashier Station
```

### Multi-Tenancy Invariants
1. **Server-Side Tenant Derivation:** The client is never trusted for `tenantId`, `organizationId`, or `locationId`. These values are derived from cryptographically verified claims on the authenticated session.
2. **Object-Level Authorization (BOLA Prevention):** A user belonging to Organization A cannot access, query, or mutate resources belonging to Organization B, even if they guess or supply a valid UUID.
3. **Location Scoping:** Staff users can be scoped to specific branches or warehouses (`locationId`). Operations outside of their designated scope are rejected with `403 FORBIDDEN`.

---

## 3. Modular Monolith Architecture (Spec §8, §100)

The platform is designed as a **Modular Monolith first**. Modules communicate through well-defined Application Service interfaces and Domain Events—never through raw cross-module database queries.

```
services/backend/src/
├── modules/
│   ├── identity/              # Users, Credentials, JWT, MFA, Sessions
│   ├── organizations/         # Tenants, Hierarchy, Settings, Feature Flags
│   ├── locations/             # Branches, Warehouses, Zones, Bins
│   ├── products/              # Universal Product Engine & Variants
│   ├── pricing/               # Dynamic Pricing Engine & Matrices
│   ├── promotions/            # Promotion Engine (BOGO, Bundles, Happy Hours)
│   ├── tax/                   # Multi-jurisdiction Tax Engine
│   ├── customers/             # Customer Profiles, Tiers, Addresses
│   ├── sales/                 # Sales Transactions, Cashier Shifts, Receipts
│   ├── orders/                # Multi-channel Order Management & Fulfillment
│   ├── inventory/             # Stock on Hand, Valuation, Movements Ledger
│   ├── warehouse/             # Putaway, Picking, Packing, Shipping, Barcode Scan
│   ├── procurement/           # PR -> RFQ -> PO -> 3-Way Match -> Payment
│   ├── finance/               # Chart of Accounts, General Ledger, AR, AP
│   ├── crm/                   # Leads, Contacts, Interactions, Deals
│   ├── hr/                    # Employees, Attendance, Shifts, Contracts
│   ├── projects/              # Projects, Milestones, Timesheets, Billing
│   ├── service-management/    # Ticketing, SLAs, Incident Management
│   ├── assets/                # Fixed Asset Tracking & Depreciation
│   ├── documents/             # Metadata, Versions, Tagging, Access Control
│   ├── storage/               # S3/MinIO Presigned URLs, Streaming, Quotas
│   ├── workflow/              # Approval Chains, State Machines, SLA Escalation
│   ├── automation/            # Trigger -> Condition -> Action Engine
│   ├── notifications/         # Email, Telegram, In-App, SMS, Webhooks
│   ├── reporting/             # Scheduled & Real-Time Financial & Operational Reports
│   ├── analytics/             # Aggregated Metrics, BI Extractors, Dashboards
│   ├── integrations/          # External Connectors (Banks, Couriers, ERPs)
│   ├── partners/              # Partner Portal, Onboarding, Contracts
│   ├── developer/             # API Keys, OAuth2, Scopes, Webhook Subscriptions
│   ├── audit/                 # Append-only Compliance Audit Trail
│   ├── search/                # Full-Text & Vector Search
│   ├── ai/                    # AI Gateway, Model Connectors, Governed Tool Exec
│   └── configuration/         # Centralized Organization Configuration
└── common/                    # Guards, Interceptors, Decorators, Errors, Tracing
```

---

## 4. Universal Domain Engines (Spec §10, §22–§25)

Business logic is never hard-coded for specific store types. Instead, configurable engines accommodate all business models:

### 1. Universal Product Engine (§22)
- **Product Classifications:** Physical, Digital, Service, Bundle, Kit, Combo, Ingredient, Raw Material, Spare Part, Fixed Asset, Subscription, Gift Card.
- **Attributes:** SKU, Multiple Barcodes, Categories, Brands, Models, Unit of Measure (with nested conversion ratios e.g., 1 Box = 24 Cans), Lot/Batch, Expiry Date, Serial Numbers / IMEIs, Custom JSON Schema Attributes.

### 2. Universal Pricing Engine (§23)
- Tiered Pricing: Retail, Wholesale, Distributor, VIP Member, Employee.
- Conditional Modifiers: Quantity-based break points, time-of-day / happy hour pricing, branch-specific price sheets, customer-contract pricing.
- Currency Handling: Multi-currency support (USD, KHR, THB, CNY, EUR) with exchange rate tracking and real-time conversion.

### 3. Promotion Engine (§24)
- Configurable rules: Buy X Get Y, percentage discounts, fixed-amount discounts, category-level promotions, time-decay promotions, loyalty coupon vouchers.
- Server-side valuation: All discounts are re-evaluated and validated on the backend.

### 4. Tax Engine (§25)
- Support for Tax-Inclusive and Tax-Exclusive pricing.
- Multiple tax rates per transaction (e.g., VAT, Specific Tax, Public Lighting Tax).
- Exemption handling for diplomatic or zero-rated tax customers.

### 5. Inventory & Warehouse Engine (§29–§32)
- Dual Ledger: Real-time stock on hand and reserved stock alongside an immutable `StockMovement` audit ledger.
- Valuation Methods: FIFO (First-In, First-Out) and FEFO (First-Expired, First-Out).
- Multi-location Transfers: Transfer requests, in-transit stock, receipt confirmations, and discrepancy tracking.

---

## 5. Offline-First POS Architecture (Spec §27, §28)

```
┌────────────────────────────────────────────────────────┐
│               ELECTRON / REACT POS TERMINAL            │
│                                                        │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │ Local SQLite DB  │            │ Local Sync Queue │  │
│  │ (Catalog & Txns) │            │ (Offline Writes) │  │
│  └────────┬─────────┘            └────────┬─────────┘  │
└───────────┼───────────────────────────────┼────────────┘
            │                               │ (Sync when online)
            │                               ▼
┌───────────▼────────────────────────────────────────────┐
│                    CENTRAL API SERVER                  │
│                                                        │
│  1. Idempotency Key Check (Guarantees zero duplicates)  │
│  2. Server Price & Tax Recalculation                   │
│  3. Atomic DB Transaction (Sale + Inventory Decrement) │
│  4. Acknowledgement & Global Sequence Confirmation     │
└────────────────────────────────────────────────────────┘
```

---

## 6. Asynchronous Processing & Background Jobs (Spec §17, §19)

Heavy, distributed, or non-blocking operations are offloaded to background workers:

1. **Redis Streams (Event Bus):** Decoupled domain events (`SALE_COMPLETED`, `STOCK_LOW`, `CUSTOMER_REGISTERED`, `INVOICE_OVERDUE`).
2. **BullMQ Queues:**
   - `reports-queue`: Long-running financial, inventory valuation, and tax exports (CSV, Excel, PDF).
   - `notifications-queue`: Dispatching multi-channel messages (Telegram, Email, Push, SMS, Webhooks).
   - `sync-queue`: Processing batch uploads from offline POS stations.
   - `ai-queue`: Async document summarization, sales forecasting, and low-stock replenishment recommendations.

---

## 7. Storage Architecture (Spec §20, §54)

Files and large binary assets are never stored in PostgreSQL:
```
Client  ───(1) Request Upload URL───►  Backend Storage Module
Client  ◄──(2) Presigned S3 URL──────  Backend Storage Module
Client  ───(3) Upload File Directly──► S3 / MinIO Object Store
Client  ───(4) Confirm Upload────────► Backend Storage Module
                                       └── Saves Metadata & Checksum in PostgreSQL
```
- Support for multipart uploads, resumable chunking, cryptographic checksum verification (SHA-256), access control policies, and automated retention lifecycle policies.

---

## 8. AI Platform & Governed Autonomous Agents (Spec §66–§68)

```
User / Admin Prompt
         │
         ▼
┌──────────────────┐     Identity & Role Verified
│    AI Gateway    │ ─── (Tenant Boundary Enforced)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Model Provider  │ ─── Supports Anthropic, OpenAI, Google, Local LLMs
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     Strict tool parameter validation via Zod
│  Approved Tools  │ ─── NO DIRECT ARBITRARY SQL ACCESS
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Business Service │ ─── Standard Application Service Layer
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Audit & Human   │ ─── High-risk actions (e.g. PO approval, refunds)
│     Approval     │     require explicit human confirmation
└──────────────────┘
```

---

## 9. Observability, Security & Reliability (Spec §69–§73)

- **Observability:** OpenTelemetry distributed tracing with correlation IDs (`x-request-id` / `traceparent`), Prometheus metrics export at `/metrics`, and Grafana dashboard integration.
- **Health & Readiness:** Dedicated `/health` (process liveness) and `/ready` (dependency check: PostgreSQL, Redis, MinIO) probes.
- **Security:** Strict Helmet headers (CSP, HSTS, X-Content-Type-Options), rate limiting via Redis Throttler, input validation via Zod + class-validator whitelist, bcrypt password hashing, and encrypted secrets storage.
- **Disaster Recovery & Data Governance:** Documented RTO/RPO targets, automated schema migrations, database snapshot procedures, and soft-delete/audit retention policies.
