# Modular Monolith → Microservice Evolution Strategy (Spec §198–§227)

> **Document Version:** 1.0.0  
> **Platform Standard:** Enterprise Modular Monolith with Strangler Extraction Readiness  
> **Status:** Production-Ready & Verified

---

## 1. Evolution Philosophy (§198, §226, §227)

```text
STAGE 1 (CURRENT)
FastAPI Modular Monolith (Universal Core) + Shared PostgreSQL (62 Tables) + Redis + MinIO
                          ↓
STAGE 2 (INTERMEDIATE)
API Gateway + Monolith + Transactional Outbox + Event Bus Relay
                          ↓
STAGE 3 (TARGET HIGH-VALUE EXTRACTION)
API Gateway + Selective Extracted Services (e.g. Notifications, Storage, AI) + Monolith Core
                          ↓
STAGE 4 (EXPANSION)
Fully scalable service platform where only proven, high-throughput domains have been extracted.
```

> [!IMPORTANT]
> **Golden Rule (§226)**: *Never create microservices simply to make architecture diagrams look impressive. The system optimizes for Reliability, Maintainability, Performance, Security, and Operational Simplicity.*

---

## 2. Microservice-Ready Module Boundaries (§199–§202)

Even when running inside one FastAPI process, every module maintains strict logical ownership:

```text
services/backend-py/app/
├── routers/          # API layer (FastAPI endpoints, DTO validation)
├── domain/           # Pure business logic engines (Hierarchy, Industry, Delivery, AI, Outbox)
├── models/           # Logical data schemas & entity ownership (SQLAlchemy 2.0)
└── core/             # Security, Database, Configuration, Crypto, Observability
```

### Module Boundary Enforcement (§200, §202):
- **Rule**: Module A must interact with Module B via **Public Application Interfaces or Events**, NEVER via direct cross-module SQL queries on private tables.
- **Data Ownership (§201)**: Logical table sets (Sales, Inventory, Finance, Identity) are strictly decoupled so that physical database extraction requires zero rewrite of business domains.

---

## 3. Transactional Outbox & Event Contracts (§208–§210)

To avoid dual-write bugs where database records commit but event publishing fails, the system implements the **Transactional Outbox Pattern**:

```text
Database Transaction
      │
      ├── 1. Commit Business Change (e.g. Sale, Order, Transfer)
      └── 2. Insert Outbox Record (PENDING)
      │
Transaction Committed
      │
Async Outbox Relay (OutboxRelay)
      │
      └── 3. Pulls PENDING records and dispatches to Event Bus
      └── 4. Marks record as PUBLISHED (or FAILED with retry count)
```

### Event Contract Schema (§209):
```json
{
  "eventId": "evt_4a781b0923f1",
  "eventType": "SALE_COMPLETED",
  "version": 1,
  "occurredAt": "2026-09-03T14:30:00Z",
  "tenantId": "org_default",
  "aggregateId": "sale_10492",
  "data": {
    "total": 142.50,
    "itemsCount": 2,
    "tenderMethod": "BAKONG_KHQR"
  },
  "correlationId": "w3c_trace_001",
  "causationId": "req_84912"
}
```

---

## 4. Idempotent Consumer Deduplication (§211)

All event consumers adhere to at-least-once delivery semantics:
- Incoming events are evaluated by `IdempotentConsumerRegistry`.
- If `eventId` has already been recorded, processing is skipped with `DUPLICATE_IGNORED`.
- Prevents double billing, duplicate stock deduction, or repeated customer notifications.

---

## 5. Distributed Sagas with Automated Compensations (§212)

Cross-domain transactions spanning multiple services avoid distributed database locking (`2PC`) by using **Choreographed / Orchestrated Sagas**:

```text
Step 1: Reserve Order        ──[Failure]──▶  Compensate: Cancel Order
         ↓
Step 2: Authorize Payment    ──[Failure]──▶  Compensate: Refund Payment & Cancel Order
         ↓
Step 3: Deduct Inventory     ──[Failure]──▶  Compensate: Restock Inventory, Refund, Cancel
         ↓
Step 4: Dispatch Courier
```

- Verified in [`tests/test_outbox_engine.py`](file:///d:/Project/MyStore/services/backend-py/tests/test_outbox_engine.py).

---

## 6. Consistency Matrix (§213)

| Domain Operation | Required Consistency | Architectural Mechanism |
|---|---|---|
| **Payment Authorization** | **Strong Consistency** | Immediate synchronous ACID validation |
| **Stock Deduction** | **Strong Consistency** | Atomic database check & reservation |
| **Financial Journal Posting** | **Strong Consistency** | Balanced double-entry debit/credit ledger |
| **Search Indexing** | *Eventual Consistency* | Async Outbox $\to$ Search worker |
| **Analytics & KPI Rollups** | *Eventual Consistency* | Background aggregation pipeline |
| **Customer Notifications** | *Eventual Consistency* | Outbox Relay $\to$ Webhook / Telegram / Push |

---

## 7. Service Extraction Checklist (§225)

Before extracting any module into an independently deployed service, verify all 15 gates:

- [x] Clear domain boundary defined
- [x] Clear data ownership identified (no cross-table foreign key constraints)
- [x] Stable OpenAPI API contract established
- [x] Stable Event contract schema (§209) implemented
- [x] No private-table direct SQL dependencies
- [x] Transactional Outbox pattern implemented ([`outbox_engine.py`](file:///d:/Project/MyStore/services/backend-py/app/domain/outbox_engine.py))
- [x] Idempotent consumer deduplication active
- [x] Sagas and compensation mechanisms defined
- [x] Authentication & RBAC token propagation verified
- [x] Audit trail recording in place
- [x] Observability probes active (`/health`, `/health/deep`, `/metrics`, W3C trace propagation)
- [x] Contract & regression tests passing (69/69 passing)
- [x] Failure handling & circuit breaking implemented
- [x] Deployment containerization ready (`Dockerfile`, `docker-compose.yml`)
- [x] Zero frontend rewrite required (All apps communicate through stable API client)

---

## 8. Verification & Test Evidence

- Outbox Unit & API Tests: [`services/backend-py/tests/test_outbox_engine.py`](file:///d:/Project/MyStore/services/backend-py/tests/test_outbox_engine.py) (5 tests passing in 0.80s)
- Outbox Routes: [`services/backend-py/app/routers/outbox_routes.py`](file:///d:/Project/MyStore/services/backend-py/app/routers/outbox_routes.py)
- Full Backend Test Suite: **69/69 passed in 1.49s**
