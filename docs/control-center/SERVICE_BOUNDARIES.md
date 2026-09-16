# Service Boundaries & Domain Isolation: CamTech Infra & Security Control Center

**Standard:** Microservices Domain Isolation & Anti-Corruption Layers (Principle 10, 16, 74, 75, 77)

---

## 1. Domain Responsibility Matrix

| Service / Subsystem | Primary Responsibilities | Port | Persistence / Store | Downstream Dependencies |
|---|---|---|---|---|
| **API Edge Gateway** (`gateway.py`) | Inbound reverse proxy, W3C traceparent injection, IP ban enforcement, auth token verification, SSE streaming. | `4000` | Redis 7 (bans, rate limits) | Microservices `4001`–`4009` |
| **Identity Service** (`auth_service.py`) | Staff passkey (WebAuthn), JWT minting, relational `user_roles`, session invalidation. | `4001` | PostgreSQL (`users`, `user_roles`), Redis (challenges) | None |
| **Catalog & Pricing** (`catalog_service.py`) | Products, categories, price lists, inventory ledger, stock movements. | `4002` | PostgreSQL (`products`, `inventory_items`) | None |
| **Sales & CRM** (`sales_service.py`) | Orders, checkouts, customer accounts, payment webhooks. | `4003` | PostgreSQL (`sales`, `customers`) | Catalog, Redis |
| **Delivery & Fleet** (`delivery_service.py`) | GPS dispatch, driver manifests, courier authentication. | `4004` | PostgreSQL (`delivery_orders`, `drivers`) | Sales |
| **HR & Workforce** (`hr_service.py`) | Staff directory, departments, payroll entries, attendance. | `4005` | PostgreSQL (`employees`, `departments`) | Identity |
| **Finance & Accounting** (`finance_service.py`) | Chart of accounts, double-entry journal entries, fiscal periods. | `4006` | PostgreSQL (`accounts`, `journal_entries`) | Sales |
| **Platform & Bot** (`platform_service.py`, `bot_builder`) | Service desk, workflows, notifications, telegram bots. | `4007`, `4008` | PostgreSQL (`tickets`, `flows`, `bots`) | Redis |
| **Infra & Security Control Service** (`infra_service.py`) | **Observability ingestion, real-time API monitoring, distributed trace viewer, threat center, incident commander, topology graph, defensive playbooks, break-glass auditor.** | **`4009`** | **PostgreSQL (`infra_*`), Redis Streams & PubSub** | All services via `/health` & telemetry events |

---

## 2. Inbound & Outbound Boundary Rules

1. **Decoupled Telemetry Ingestion (No Direct Synchronous Coupling):**
   - Business services (`sales`, `catalog`, `hr`, etc.) **never make synchronous HTTP calls** to the Control Center.
   - Telemetry flows via non-blocking asynchronous event emission:
     - Edge Gateway emits request timing and status records into Redis Stream `mystore:telemetry:requests`.
     - Rate-limit violations emit to Redis Stream `mystore:security:events`.
     - Control Center background workers consume and aggregate these streams.
2. **Defensive Response Invocation (Anti-Corruption Control):**
   - When an operator triggers a mitigation action (e.g. IP ban, session revocation):
     - IP bans write directly to Redis `ip_ban:<ip>` with TTL and notify the Gateway via Redis PubSub.
     - Session revocations publish `AUTH_SESSION_REVOKED` consumed by `auth_service`.
     - All mutations write an immutable record to PostgreSQL `audit_logs` before taking effect.
3. **Health & Topology Discovery:**
   - The Control Center polls registered services via their standardized `/health` and `/ready` endpoints.
   - Service metadata (version, git commit, uptime, database ping latency) is refreshed every 10 seconds.
   - If a microservice becomes unreachable, the Control Center immediately flags the node as `DEGRADED` or `DOWN` and triggers an automated health event.
