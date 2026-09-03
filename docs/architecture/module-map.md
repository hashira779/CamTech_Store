# Module Map — Universal Enterprise Business Platform

> **Document Version:** 3.0.0  
> **Last Verified:** September 2026  
> **Canonical Backend:** Python/FastAPI (Fully Modularized Monolith - 100% Complete)  
> **Legacy Backend:** NestJS (Deprecated)

> [!TIP]
> All ✅ **Active** statuses below refer to the **canonical Python/FastAPI backend**. The entire modular monolith extraction is complete with 18 decoupled domain modules in `app/modules/`, and all 75 tests pass (100% passing).

---

## Status Legend

| Status Icon | Meaning | Definition |
|---|---|---|
| ✅ **Active (NestJS Legacy)** | Production-grade vertical slice in NestJS | Domain entity, service, DB schema, API, UI, validation, audit, and tests pass in the legacy stack |
| 🔶 **Partial** | Scaffolded / In-Progress | Partial implementation (e.g. data model or service scaffolded, UI or API pending) |
| ⛔ **Blocked** | Blocked by schema drift | Cannot proceed until schema reconciliation is completed |
| 🔜 **Prioritized** | Immediate Next Milestone | Architecture ready; implementation scheduled in the immediate phase |
| ❌ **Planned** | Roadmap Specification | Domain defined in master specification; pending scheduled development phase |

---

## Complete Enterprise Module Matrix (Spec §8, §21)

> **Note:** The "Status" column reflects the **canonical Python backend** implementation.

| # | Module | Backend | Database | API | Frontend | Tests | Status | Phase |
|---|---|---|---|---|---|---|---|---|
| 1 | **Identity & Auth** | ✅ Domain / Service | ✅ `User` | ✅ `/auth/login`, `/me` | ✅ `/login` | ✅ Unit/E2E | ✅ Active | Phase 1 |
| 2 | **Organizations** | ✅ Settings Service | ✅ `Organization` (Settings) | ✅ `/organizations/current` | ✅ `/settings` | ✅ Unit/E2E | ✅ Active | Phase 1 |
| 3 | **Locations & Branches** | ✅ Tree Engine | ✅ `Location` (Tree) | ✅ `/locations` (CRUD, Tree) | ✅ `/locations` | ✅ Unit | ✅ Active | Phase 1 |
| 4 | **Products & Catalog** | ✅ Entity + Service | ✅ `Product`, `Variant` | ✅ `/products` | ✅ `/products` | ✅ Unit/E2E | ✅ Active | Phase 2 |
| 5 | **Customers & CRM Core** | ✅ Entity + Service | ✅ `Customer`, `Address` | ✅ `/customers` | ✅ `/customers` | ✅ Unit | ✅ Active | Phase 2 |
| 5b | **Customer Loyalty & Store Credit** | ✅ LoyaltyCalculator + Service | ✅ `LoyaltyProgramConfig`, `LoyaltyTransaction`, `StoreCreditTransaction` | ✅ `/loyalty/*` (Config, Points, Credit) | ✅ `/loyalty` | ✅ Unit | ✅ Active | Phase 2 |
| 6 | **Sales & Transactions** | ✅ Entity + Service | ✅ `Sale`, `LineItems` | ✅ `/sales` | ✅ `/sales` | ✅ Unit | ✅ Active | Phase 2 |
| 7 | **POS Terminal** | ✅ Offline Queue + Idemp | ✅ Split Payments + Cache | ✅ POS + Batch Sync API | ✅ `/sales/new` | ✅ Unit | ✅ Active | Phase 2 |
| 8 | **Inventory Ledger** | ✅ Entity + Service | ✅ `InventoryItem`, `Stock` | ✅ `/inventory` | ✅ `/inventory` | ✅ Unit | ✅ Active | Phase 2 |
| 9 | **Warehouse Management & Transfers** | ✅ Zones, Bins, Batches, Transfers | ✅ `WarehouseZone`, `WarehouseBin`, `ProductBatch`, `StockTransfer` | ✅ `/wms/*` (Transfers, Ship, Receive, Zones, Batches) | ✅ `/transfers` | ✅ Unit | ✅ Active | Phase 2 |
| 10 | **Procurement & PO** | ✅ Entity + Service | ✅ PO, GRN, Supplier | ✅ `/procurement/*` | ✅ `/procurement` | ✅ Unit | ✅ Active | Phase 2 |
| 11 | **Pricing Engine** | ✅ Resolver + Service | ✅ PriceList, Items | ✅ `/pricing/*` | ✅ `/pricing` | ✅ Unit | ✅ Active | Phase 2 |
| 12 | **Promotion Engine** | ✅ Evaluator + Service | ✅ `Promotion` (Rules) | ✅ `/promotions/*` | ✅ `/promotions` | ✅ Unit | ✅ Active | Phase 2 |
| 13 | **Tax Engine & Fiscal Rules** | ✅ TaxCalculator + Service | ✅ `TaxRate`, `ProductVariant.taxRateId` | ✅ `/taxes/*` (Rates, Calculate) | ✅ `/taxes` | ✅ Unit | ✅ Active | Phase 2 |
| 13b | **Payment Gateways & KHQR** | ✅ Generator + Service | ✅ `SalePayment`, `PaymentStatus` | ✅ `/payments/*` (Intent, Verify, Webhook) | ✅ Embedded in POS | ✅ Unit | ✅ Active | Phase 2 |
| 14 | **Audit Logging** | ✅ `AuditService` | ✅ `AuditLog` | 🔶 Internal Service | 🔶 Activity Feed | ✅ Unit/E2E | ✅ Active | Phase 1 |
| 15 | **Ops & Telemetry** | ✅ `MetricsService` | — | ✅ `/health`, `/metrics` | — | ✅ E2E | ✅ Active | Phase 1 |
| 16 | **Finance & Accounting** | ✅ Domain + Service | ✅ `Account`, `JournalEntry`, `Lines` | ✅ `/finance/*` (COA, Journals, Statements) | ✅ `/finance` | ✅ Unit | ✅ Active | Phase 3 |
| 17 | **Workflow & Approvals** | ✅ State Machine + Service | ✅ `WorkflowDefinition`, `Instance`, `Step`, `Log` | ✅ `/workflows/*` (Submit, Review, Steps) | ✅ `/approvals` | ✅ Unit | ✅ Active | Phase 3 |
| 18 | **Storage & Documents** | ✅ Local/S3 Drivers | ✅ `DocumentRecord` | ✅ `/storage/*` (Intents, Upload, Stream) | ✅ `/storage` | ✅ Unit | ✅ Active | Phase 3 |
| 19 | **Notifications Platform** | ✅ Multi-channel | ✅ `NotificationRecord`, `NotificationConfig` | ✅ `/notifications/*` | ✅ `/notifications` | ✅ Unit | ✅ Active | Phase 3 |
| 20 | **Reporting & BI** | ✅ Aggregation Engine | ✅ Relational Rollups | ✅ `/reports/*` (Summary, Sales, Inventory, Export) | ✅ `/reports`, `/dashboard` | ✅ Unit | ✅ Active | Phase 3 |
| 21 | **HR & Payroll** | ✅ Calculator + Service | ✅ `Department`, `Employee`, `Leave`, `Payroll` | ✅ `/hr/*` (Depts, Staff, Leave, Payroll) | ✅ `/hr` | ✅ Unit | ✅ Active | Phase 3 |
| 22 | **Projects & Billing** | ✅ Entity + Service | ✅ `Project`, `ProjectTask`, `TimesheetEntry` | ✅ `/projects/*` (Projects, Tasks, Timesheets) | ✅ `/projects` | ✅ Unit | ✅ Active | Phase 3 |
| 23 | **Service Management** | ✅ Entity + Service | ✅ `ServiceTicket`, `TicketComment` | ✅ `/tickets/*` (Tickets, Status, Comments) | ✅ `/tickets` | ✅ Unit | ✅ Active | Phase 3 |
| 24 | **Fixed Assets** | ✅ Depreciation Engine | ✅ `FixedAsset`, `DepreciationRecord` | ✅ `/assets/*` (Register, Depreciate) | ✅ `/assets` | ✅ Unit | ✅ Active | Phase 3 |
| 25 | **Partner & Dev Platform** | ✅ Generator + Service | ✅ `DeveloperApp`, `ApiKey`, `WebhookSubscription` | ✅ `/developers/*` (Apps, Keys, Webhooks) | ✅ `/developers` | ✅ Unit | ✅ Active | Phase 4 |
| 26 | **Telegram Platform** | ✅ Router + Service | ✅ `TelegramChatBinding` | ✅ `/telegram/*` (Webhook, Bindings, Broadcast) | ✅ `/telegram` | ✅ Unit | ✅ Active | Phase 4 |
| 27 | **Flow Automation Platform** | ✅ Graph Engine + Dispatcher | ✅ `AutomationFlow`, `FlowExecution` | ✅ `/flows/*` (Flows, Executions, Webhooks) | ✅ `/automations` | ✅ Unit | ✅ Active | Phase 4 |
| 28 | **Mobile App (Flutter)** | ⏭️ Skipped (Budget) | ❌ Local SQLite | ❌ Mobile Sync | ❌ Flutter Client | ❌ Deferred | ⏭️ Skipped | Phase 4 |
| 29 | **AI Platform & Agents** | ⏭️ Skipped (Budget) | ❌ Tool History | ❌ AI Gateway | ❌ Assistant Modal | ❌ Deferred | ⏭️ Skipped | Phase 5 |

---

## Detailed Status of Core Functional Vertical Slices

### 1. Catalog & Product Engine (`modules/products`)
- **Backend:** `Product` entity enforces validation of variants, costs, prices, currencies, and computes margins server-side. `ProductsService` enforces tenant isolation and SKU uniqueness.
- **Database:** `products` (master) and `product_variants` (sellable SKU) with cascade relationships and tenant index.
- **Frontend:** Searchable product table with variant drill-downs, margin indicators, and a product creation modal.
- **Tests:** Unit tests verify margin calculation, invariant validations, and SKU duplicate handling.

### 2. Customer Management (`modules/customers`)
- **Backend:** `CustomerEntity` enforces validation for Customer Types (Individual, Company, Wholesale, Government, Internal) and phone/email formatting.
- **Database:** `customers` with auto-sequencing support (`code`), VAT/tax ID, and relational `customer_addresses`.
- **Frontend:** Customer directory page with account filtering and customer creation drawer.
- **Tests:** Unit tests verify email/phone format validation and customer type logic.

### 3. Sales Engine & POS (`modules/sales`)
- **Backend:** Server-side price lookup for every line item (never trusts client price), validation of payments covering grand total, atomic transaction for sale completion and inventory deduction, support for voiding sales and reversing inventory.
- **Database:** `sales`, `sale_line_items` (immutable price snapshot), `sale_payments` (split tender support), and `idempotencyKey` index.
- **Frontend:** Sales ledger at `/sales` and interactive Point of Sale terminal at `/sales/new`.
- **Tests:** Unit tests verify server price calculations, discount & tax computations, payment validations, and idempotency guarantees.

### 4. Inventory Ledger (`modules/inventory`)
- **Backend:** `InventoryItemEntity` computes available quantity (`stockOnHand - reservedQty`) and dynamically evaluates low-stock conditions against reorder points. `InventoryService` creates an immutable `StockMovement` ledger entry for every adjustment or sale.
- **Database:** `inventory_items` (scoped by organization, variant, and location) and `stock_movements`.
- **Frontend:** Inventory tracker with low stock filters, stock adjustment modal, and transaction movement logs.
- **Tests:** Unit tests verify stock calculations, available quantity logic, and low-stock detection.

### 5. Multi-Channel Notifications Platform (`modules/notifications`)
- **Backend:** `NotificationsService` with pluggable `TelegramAdapter` and `InAppAdapter` delivering event-driven operational broadcasts (`LOW_STOCK_ALERT`, `ORDER_CREATED`, `TRANSFER_DISPATCHED`, `PAYMENT_RECEIVED`).
- **Database:** `notification_records` (tenant-isolated alert history with read flags) and `notification_configs` (Telegram bot tokens, chat IDs, email settings).
- **Frontend:** Dedicated notification center at `/notifications` with channel filtering, single-click read reconciliation, and live test broadcast triggers.
- **Tests:** Unit tests verify adapter routing, unread counting, and broadcast delivery resilience.

### 6. Reporting & Business Intelligence Engine (`modules/reporting`)
- **Backend:** `ReportingService` runs database aggregation queries computing net revenue, COGS, gross margin $, margin %, AOV, payment tender distributions, time-series velocity, and inventory asset valuation. Streaming CSV export for sales and inventory audits.
- **Database:** Optimized relational rollups over `sales`, `sale_line_items`, `product_variants`, `inventory_items`, and `sale_payments`.
- **Frontend:** Dedicated BI Studio at `/reports` featuring preset time windows (Today, 7D, 30D, This Month), branch filtering, interactive sales velocity timeline, payment tender breakdowns, product margin ranking, and instant CSV downloads.
- **Tests:** Unit tests verify gross margin calculations, COGS evaluation, date boundary handling, and CSV formatting.

### 7. Finance & Accounting Platform (`modules/finance`)
- **Backend:** `JournalEntryEntity` enforces the double-entry invariant $\sum \text{Debits} = \sum \text{Credits}$ and entry immutability once posted. `FinancialStatementEngine` computes live Trial Balance, Income Statement (P&L), and Balance Sheet. `FinanceService` provisions standard GAAP Chart of Accounts for new tenants and orchestrates double-entry postings.
- **Database:** `accounts`, `accounting_periods`, `journal_entries`, and `journal_line_items` with full multi-tenant isolation.
- **Frontend:** Dedicated Financial Command Center at `/finance` with categorized Chart of Accounts tree, General Journal with draft-to-posted state machine, live interactive Trial Balance, and dynamic Financial Statements (P&L & Balance Sheet).
- **Tests:** Unit tests verify double-entry invariant enforcement, negative/unbalanced line rejection, COA provisioning, and balance sheet equation validation ($Assets = Liabilities + Equity$).

### 8. Universal Workflow & Approvals Engine (`modules/workflow`)
- **Backend:** `WorkflowStateMachine` provides pure domain evaluation for multi-step approval sequences. Supports sequential and parallel sign-offs, reviewer role assignments, and immediate rejection terminations. `WorkflowService` manages approval submission, step execution, and immutable audit logs.
- **Database:** `workflow_definitions`, `workflow_instances`, `workflow_steps`, and `workflow_logs`.
- **Frontend:** Universal Approvals Inbox at `/approvals` with visual step progress cards, filterable status tabs (`PENDING`, `APPROVED`, `REJECTED`), step review justification modal, and new approval request trigger.
- **Tests:** Unit tests verify state machine step progression, rejection handling, and service-level approval lifecycles.

### 9. Human Resources & Payroll Platform (`modules/hr`)
- **Backend:** `PayrollCalculator` computes net pay disbursements ($Base + Allowances - Deductions$) across active workforce. `HrService` manages organizational departments, employee records, leave requests (with manager approve/reject workflows), and batch payroll calculation.
- **Database:** `departments`, `employees`, `leave_requests`, `payroll_runs`, and `payroll_items`.
- **Frontend:** Workforce Command Center at `/hr` with tabs for Employee Directory, Department Management, Leave Accruals & Approvals, and Batch Payroll Generation.
- **Tests:** Unit tests verify payroll calculation arithmetic, leave request transitions, department uniqueness constraints, and batch run generation.

### 10. Fixed Assets & Depreciation Engine (`modules/assets`)
- **Backend:** `DepreciationCalculator` executes Straight-Line and Double-Declining-Balance depreciation schedules. Caps depreciation at salvage values. `AssetsService` records monthly depreciation entries and updates current book values.
- **Database:** `fixed_assets` and `depreciation_records`.
- **Frontend:** Fixed Assets Explorer at `/assets` featuring KPI cards for Initial Capitalization, Net Book Value, and Accumulated Amortization, accompanied by asset registry and single-click monthly depreciation execution.
- **Tests:** Unit tests verify straight-line monthly calculations, salvage value threshold limits, and asset capitalization.

### 11. Projects & Billing Platform (`modules/projects`)
- **Backend:** `ProjectsService` tracks multi-phase client and internal initiatives, milestone tasks, estimated vs. actual worker hours, and timesheet entries.
- **Database:** `projects`, `project_tasks`, and `timesheet_entries`.
- **Frontend:** Projects & Timesheets Console at `/projects` with budget utilization, task breakdowns, and worker timesheet logging modals.
- **Tests:** Unit tests verify task assignment, actual hours rollup, and timesheet logging transactions.

### 12. Service Management & Helpdesk (`modules/tickets`)
- **Backend:** `TicketsService` generates auto-sequenced incident tickets (`TICK-YYYY-XXXXX`), supports priority SLAs (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), tracks investigation comments/internal notes, and handles status lifecycles (`OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`).
- **Database:** `service_tickets` and `ticket_comments`.
- **Frontend:** Service Desk Desk at `/tickets` with priority filters, incident resolution actions, and interactive discussion threads.
- **Tests:** Unit tests verify sequential ticket numbering, status transitions, resolution timestamps, and comment append operations.

### 13. Partner & Developer Platform (`modules/developer`)
- **Backend:** `ApiKeyGenerator` issues cryptographically secure API keys (`sk_live_...`) with prefix lookups and SHA-256 one-way hashing for secure storage. Supports granular scopes (`products:read`, `sales:write`, `webhooks:manage`, etc.), expiration dates, rate limits, and revocation. `DeveloperService` manages application registrations, key lifecycles, and outbound HMAC-SHA256 signed webhook delivery.
- **Database:** `developer_apps`, `api_keys`, `webhook_subscriptions`, and `webhook_deliveries`.
- **Frontend:** Developer & Partner Portal at `/developers` with API key manager (reveal-once secret modal + copy button), webhook endpoint subscriber with event multi-select, registered applications directory, and live OpenAPI spec launcher.
- **Tests:** Unit tests verify API key entropy generation, SHA-256 hash matching, revocation rejection, and HMAC-SHA256 signature calculation.

### 14. Telegram Operations Platform (`modules/telegram`)
- **Backend:** `TelegramCommandRouter` processes slash commands (`/sales`, `/stock`, `/orders`, `/approve <id>`, `/help`, `/start`) and formats structured Markdown responses with revenue velocity, inventory depletion warnings, and workflow status. `TelegramService` parses incoming webhook updates, verifies authorized chat bindings, and sends broadcast alerts.
- **Database:** `telegram_chat_bindings` mapping Telegram chat IDs to tenant organizations and authorized roles.
- **Frontend:** Telegram Operations Hub at `/telegram` with chat bindings registry, emergency broadcast alert modal, command reference documentation, and interactive live webhook command simulator.
- **Tests:** Unit tests verify command routing logic, chat binding uniqueness constraints, and webhook update evaluation.

### 15. Flow Automation Platform (n8n Engine) (`modules/automation`)
- **Backend:** `FlowExecutionEngine` pure domain engine evaluates directed acyclic graphs of nodes and edges, resolving context interpolation (`{{trigger.field}}`), evaluating conditionals (`if_condition` with true/false branch traversal), and producing step-by-step execution traces. `AutomationService` orchestrates execution runs and dispatches actions across enterprise subsystems (Telegram messages, Service Desk tickets, In-App alerts, HTTP webhooks).
- **Database:** `automation_flows` and `flow_executions` with execution traces and run logs.
- **Frontend:** n8n-inspired Flow Automation Console at `/automations` featuring interactive visual node graph viewer, parameter inspections, test execution simulator with custom JSON payload inputs, and step-by-step execution trace drawer with JSON input/output inspection per node.
- **Tests:** Unit tests verify linear execution, condition branching, parameter interpolation, and action dispatcher side-effects.


