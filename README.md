# MyStore Platform — Universal Enterprise Business Platform (2026–2030)

> **Platform Status:** All Enterprise Specifications (§1–§116, §151–§197, §198–§199, §228–§258) Implemented & Verified  
> **Canonical Backend:** Python/FastAPI (`services/backend-py`) — Modular Monolith with 18 Decoupled Domain Modules (**76/76 Tests Passing 100%**)  
> **Canonical Frontend:** Multi-Experience Vite 6 SPA (`apps/web`) — 11 Subdomain Experiences & Dedicated Shells  
> **Architecture Guides:** [docs/architecture/module-map.md](docs/architecture/module-map.md) · [docs/architecture/multi-experience-ux.md](docs/architecture/multi-experience-ux.md) · [docs/audits/master-spec-compliance-matrix.md](docs/audits/master-spec-compliance-matrix.md)

---

## Monorepo Folder Structure

```text
MyStore/
├── apps/
│   ├── web/            # ⭐ CANONICAL MULTI-EXPERIENCE SPA (Powers all 11 subdomains dynamically)
│   ├── cashier/        # Standalone terminal build target (Retail POS)
│   ├── delivery/       # Standalone terminal build target (Driver Dispatch)
│   └── store/          # Standalone terminal build target (Public Storefront)
├── services/
│   ├── backend-py/     # ⭐ CANONICAL PYTHON/FASTAPI BACKEND (18 modular domains, 76 tests)
│   └── backend/        # Legacy NestJS backend (retained for architectural reference)
├── packages/
│   └── contracts/      # TypeScript DTOs, interfaces, and App Registry (@mystore/contracts)
├── docs/               # Architecture specs, compliance audits, ADRs, and guidelines
└── scripts/            # Database backups and management scripts
```

---

## Multi-Domain Experience Ecosystem (Spec §228–§258)

The platform supports multiple independent web experiences based on the incoming domain/subdomain:

| Subdomain | Target Persona | Application Shell | Purpose & Experience |
|---|---|---|---|
| `store.camtech.cam` | Public Consumer | `PublicStoreShell` | Fast product discovery, cart, Bakong KHQR checkout |
| `cashier.camtech.cam` | Cashier / Retail Staff | `POSShell` | Fast register, barcode scanning, split payments, cash drawer |
| `delivery.camtech.cam` | Courier / Driver | `DeliveryShell` | Mobile-first route map, GPS telemetry, proof of delivery (POD), COD |
| `warehouse.camtech.cam` | WMS Clerk | `WarehouseShell` | Stock receiving, bin barcode scanning, transfer dispatch, lot quarantine |
| `hr.camtech.cam` | HR Manager | `HRShell` | People directory, department trees, leave approvals, payroll runs |
| `finance.camtech.cam` | Accountant / CFO | `FinanceShell` | General ledger, chart of accounts, journal entries, fiscal tax calculation |
| `customer.camtech.cam` | Registered Customer | `CustomerShell` | Self-service portal: past orders, invoice PDFs, shipment tracking |
| `partner.camtech.cam` | Developer / Partner | `PartnerShell` | Developer hub: API key generation, HMAC webhooks, automations |
| `support.camtech.cam` | Service Desk Agent | `SupportShell` | Incident ticketing queue, SLA priority timers, resolution comments |
| `ceo.camtech.cam` | CEO / Executive | `ExecutiveShell` | Executive decision support: revenue velocity, cash, branch drill-downs |
| `admin.camtech.cam` | Enterprise Administrator | `AdminShell` | Enterprise control center: multi-tenant provisioning, RBAC, audit |

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Python ≥ 3.12 (Python 3.14 recommended)
- PostgreSQL 16+ running locally (or via `docker compose up -d`)

### 2. Install Monorepo Dependencies
```bash
# Install root and package dependencies
pnpm install

# Build shared contracts package
pnpm --filter @mystore/contracts build
```

### 3. Start Canonical Python Backend
```bash
# Run FastAPI server with auto-reload (runs on http://localhost:4000)
pnpm py:dev

# Run automated backend test suite (76 tests)
pnpm py:test
```

### 4. Start Multi-Experience Web Client
```bash
# Run unified multi-experience SPA (runs on http://localhost:3000)
pnpm web:dev
```

---

## Quality Verification

```bash
# Run canonical backend test suite (100% green)
pnpm py:test

# Build canonical multi-experience frontend (Vite 6)
pnpm --filter @mystore/web build

# Run typecheck across contracts and web
pnpm typecheck
```
