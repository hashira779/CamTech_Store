# 90 Engineering & Architecture Principles Playbook

> **Platform:** Universal Enterprise Business Platform (`MyStore` / `CamTech_Store`)  
> **Target Horizon:** 2026–2030 Cloud-Native Architecture  
> **Scope:** Monorepo (`apps/*`, `services/backend-py`, `packages/contracts`, infrastructure)

---

## Part I: Core Software Design, Paradigms & Clean Code (1–20)

### 1. Core System Flow Principles
- **Imperative:** Architecture flows along clean, unidirectional, event-aware pipelines: Request → Gateway/Auth → Domain Engine → Transactional Storage → Outbox/Event Stream → Reactive Client Invalidation.
- **MyStore Application:** Inbound requests pass through the FastAPI Gateway (`app.microservices.gateway`), apply tenant context (`organization_id`), execute within domain engines (`app.modules.*`), commit via SQLAlchemy asyncpg, and emit SSE/Redis events (`RealtimeEventBus`) for instantaneous UI updates.

### 2. OOP Principles (Object-Oriented Programming)
- **Imperative:** Model domain nouns with clear identities, behaviors, and lifecycles. Encapsulate business rules with the data they mutate.
- **MyStore Application:** SQLAlchemy entities (`app.models.entities`) and domain engines (`DeliveryEngine`, `HierarchyEngine`, `OutboxEngine`) encapsulate core business state machines and transactional logic rather than scattering procedural scripts.

### 3. SOLID Principles
- **S (Single Responsibility):** Each module, service, and hook has one reason to change (e.g., `rate_limiter.py` handles throttling, `auth.py` handles token lifecycle).
- **O (Open/Closed):** Add features by extending without mutating tested cores (e.g., adding industry modules via configuration plugins without modifying the core sales ledger).
- **L (Liskov Substitution):** Subtypes must satisfy contracts of base abstractions (e.g., all database session providers fulfill `AsyncSession` interfaces).
- **I (Interface Segregation):** Granular, focused schemas in `packages/contracts` over bloated monolithic interfaces.
- **D (Dependency Inversion):** High-level modules depend on abstractions/protocols, not low-level drivers (e.g., repository and cache interfaces injected via FastAPI `Depends`).

### 4. DRY Principles (Don't Repeat Yourself)
- **Imperative:** Every piece of knowledge must have a single, unambiguous, authoritative representation.
- **MyStore Application:** The shared DTO contract library (`packages/contracts`) defines data shapes once for all frontends (`apps/web`, `apps/store`, `apps/cashier`). The backend standard envelope (`wrap_response`) is centralized in `app.microservices.common`.

### 5. KISS Principles (Keep It Simple, Stupid)
- **Imperative:** Avoid accidental complexity. The best system is the smallest, clearest solution that solves the real business problem.
- **MyStore Application:** Single shared database with strict tenant filtering (`where organization_id == ...`) instead of complex dynamic multi-database routing before scaling demands it.

### 6. YAGNI Principles (You Aren't Gonna Need It)
- **Imperative:** Never implement speculative features based on hypothetical future needs.
- **MyStore Application:** The modular monolith runs as unified microservice containers with shared code, avoiding complex distributed consensus protocols until independent scaling is justified.

### 7. Clean Code Principles
- **Imperative:** Code is read 10x more often than it is written. Variable names describe intent; functions are small, side-effect-aware, and self-documenting.
- **MyStore Application:** Snake_case Python attributes cleanly mapped to camelCase database columns (`created_at = Column("createdAt", DateTime)`). No magical abbreviations or cryptic flags.

### 8. Clean Architecture Principles
- **Imperative:** Business rules sit at the core. Frameworks, databases, and network transports are peripheral implementation details.
- **MyStore Application:** Domain entities and schemas (`app/modules/<domain>/{models,schemas}.py`) remain free of HTTP transport details; routers (`api.py`) only marshal requests into domain calls.

### 9. Separation of Concerns (SoC)
- **Imperative:** Isolate distinct layers: presentation, application routing, business validation, persistence, and event telemetry.
- **MyStore Application:** UI components render state, React Query manages network cache, API client handles transport tokens, and backend handles validation and persistence.

### 10. Modularity Principles
- **Imperative:** Systems are composed of discrete, self-contained, loosely coupled modules with explicit public interfaces.
- **MyStore Application:** 18 domain modules in `services/backend-py/app/modules/` (auth, catalog, sales, delivery, hr, finance, etc.), each self-contained with its own models, schemas, and API.

### 11. Reusability Principles
- **Imperative:** Build reusable primitives for cross-cutting concerns (tables, modals, token verifiers, encryption).
- **MyStore Application:** `@mystore/web/components/ui` (Radix primitives), `data-table`, `enterprise-shell`, and backend `db_enums.py` provide uniform reusable capabilities.

### 12. Extensibility Principles
- **Imperative:** Design hook points and lifecycle events to allow system enhancement without core surgery.
- **MyStore Application:** The Automation & Workflow Engine (`app/modules/automations`, `app/modules/workflows`) allows custom webhooks, triggers, and approval chains to be attached to system events.

### 13. Maintainability Principles
- **Imperative:** Code must be understandable, testable, and modifiable by any contributor without regression.
- **MyStore Application:** Governed by `AGENTS.md`, strict type safety (`pnpm typecheck`), and automated CI tests (`pytest` running 95+ test suites).

### 14. Scalability Principles
- **Imperative:** System handles increased load by adding resources without architectural redesign.
- **MyStore Application:** Asynchronous I/O (`asyncpg` connection pooling), stateless API processes, background worker offloading via Redis, and database read-replica readiness.

### 15. Flexibility Principles
- **Imperative:** Adapt to varying tenant configurations and enterprise deployment targets without separate branches.
- **MyStore Application:** Deployable both as a single-process monolith on `:4000` (`pnpm py:dev`) or as 7 microservices on `:4000–:4007` (`pnpm ms:all`) from the exact same codebase.

### 16. Loose Coupling Principles
- **Imperative:** Components interact through contracts and events, minimizing direct inter-component dependencies.
- **MyStore Application:** Microservices communicate via Gateway routing and Redis event pub/sub rather than tightly bound inter-service in-memory references.

### 17. High Cohesion Principles
- **Imperative:** Related operations, entities, and validation rules reside in the same bounded module.
- **MyStore Application:** All delivery routes, dispatch algorithms, driver tracking, and status transitions reside strictly within `app/modules/delivery/`.

### 18. Composition Over Inheritance
- **Imperative:** Assemble complex behaviors by combining polymorphic components rather than deep class inheritance hierarchies.
- **MyStore Application:** React 19 component composition with Radix UI slots, and FastAPI dependency injection composition (`Depends(get_db)`, `Depends(get_current_user)`).

### 19. Dependency Inversion Principles (DIP)
- **Imperative:** Depend on interfaces, protocols, and abstract data providers.
- **MyStore Application:** Handlers receive database sessions (`AsyncSession`), event buses, and cache clients via dependency injection containers.

### 20. Interface Segregation Principles (ISP)
- **Imperative:** Clients should never be forced to depend on interfaces they do not use.
- **MyStore Application:** Specialized frontends (`apps/cashier`, `apps/delivery`, `apps/hr`, `apps/store`) consume dedicated, lightweight contract slices rather than one gigantic schema.

---

## Part II: Domain Modeling, State & API Architecture (21–30)

### 21. Domain-Driven Design (DDD)
- **Imperative:** Align software models directly with enterprise ubiquitous language and bounded contexts.
- **MyStore Application:** Bounded contexts for Catalog, Sales/Orders, Delivery, Human Resources, Finance/Ledger, and Warehouse with explicit domain aggregate roots.

### 22. Design Pattern Principles
- **Imperative:** Apply battle-tested software patterns to recurring enterprise problems.
- **MyStore Application:** Repository pattern for persistence, Factory pattern for microservice creation (`create_microservice`), Outbox pattern for reliable messaging, Saga pattern for multi-step order transactions.

### 23. Encapsulation Principles
- **Imperative:** Hide internal state representations; expose only valid state transitions.
- **MyStore Application:** Pydantic schemas validate and sanitize all inbound state before reaching domain models. Raw database columns are never directly updated from arbitrary client JSON.

### 24. Abstraction Principles
- **Imperative:** Expose clean high-level intents while hiding infrastructural and protocol complexity.
- **MyStore Application:** Frontend calls `apiClient.get('/products')` without needing to manage Bearer token extraction, refresh loops, or network serialization.

### 25. Immutability Principles
- **Imperative:** State modifications create new representations or append audit records rather than overwriting historical facts.
- **MyStore Application:** Financial journal entries, audit logs (`AuditLog`), and event streams are strictly append-only.

### 26. Stateless Design Principles
- **Imperative:** Application servers store no persistent session state in local memory.
- **MyStore Application:** JWT authentication with cryptographically signed claims; transient caching stored in Redis. Any backend instance can handle any user request.

### 27. API-First Principles
- **Imperative:** APIs are designed as complete, self-describing products before client implementation begins.
- **MyStore Application:** FastAPI OpenAPI / Swagger documentation (`/docs`) auto-generated from Pydantic schemas, serving as the contract for frontend integration.

### 28. Contract-First Principles
- **Imperative:** Shared contracts govern data exchange between frontend and backend.
- **MyStore Application:** `packages/contracts` holds canonical TypeScript DTOs and Zod validation rules that mirror backend Pydantic models.

### 29. Backward Compatibility Principles
- **Imperative:** Existing client applications must continue functioning when backend services update.
- **MyStore Application:** Additive schema changes (optional fields, new endpoints) never break existing mobile or web clients consuming existing payloads.

### 30. Versioning Principles
- **Imperative:** Manage public interface evolution through explicit semantic versioning and URL prefixing.
- **MyStore Application:** All canonical endpoints reside under `/api/v1/`, providing a clean boundary for future major version migrations (`/api/v2/`).

---

## Part III: Data Architecture, Transactions & Distributed Events (31–40)

### 31. Database Evolution Principles
- **Imperative:** Treat database schemas as code with automated version control and zero manual production modifications.
- **MyStore Application:** Alembic migrations in `services/backend-py/alembic` combined with automated drift verification (`scripts/schema_audit.py`).

### 32. Schema Migration Principles
- **Imperative:** Migrations must execute safely, reversibly, and without locking tables or degrading production throughput.
- **MyStore Application:** Native PostgreSQL enum types bound explicitly via `pg_enum()` in `db_enums.py` to prevent data-type mismatch downtime.

### 33. Data Ownership Principles
- **Imperative:** Each domain module strictly owns its tables. Cross-domain queries avoid ad-hoc foreign joins.
- **MyStore Application:** Cross-module data queries use service boundaries or read models, preventing monolithic database entanglements.

### 34. Transaction Integrity Principles
- **Imperative:** Guarantee ACID guarantees for financial and inventory operations; use compensating transactions (Sagas) for distributed flows.
- **MyStore Application:** Inventory decrement and order creation execute inside atomic database transactions (`async with db.begin():`).

### 35. Event-Driven Architecture (EDA)
- **Imperative:** Decouple services by publishing domain events when state changes occur.
- **MyStore Application:** `RealtimeEventBus` and Redis stream engine publish events (`SALE_COMPLETED`, `LOW_STOCK_ALERT`, `APPROVAL_REQUIRED`).

### 36. Asynchronous Processing Principles
- **Imperative:** Keep request-response cycles sub-50ms by moving long-running tasks out of the critical HTTP path.
- **MyStore Application:** Password hashing, report generation, webhook delivery, and telegram alerts execute via background tasks and workers.

### 37. Idempotency Principles
- **Imperative:** Processing the same message or request multiple times produces the same outcome without unintended side-effects.
- **MyStore Application:** Payment checkout, inventory adjustments, and webhook ingestion use unique idempotency keys (`X-Idempotency-Key`).

### 38. Fault-Tolerance Principles
- **Imperative:** The failure of an auxiliary subsystem must not bring down the entire application.
- **MyStore Application:** The Gateway includes lazy, guarded fallback handling (`get_fallback_app()`), ensuring routing remains active even if an auxiliary module encounters an error.

### 39. Resilience Principles
- **Imperative:** Systems gracefully absorb transient failures and automatically return to a healthy state.
- **MyStore Application:** Redis reconnection loops, database connection pool recycling (`pool_pre_ping=True`), and React UI error boundary trees.

### 40. Retry & Recovery Principles
- **Imperative:** Transient network or locking failures are retried with exponential backoff and jitter.
- **MyStore Application:** Outbox publisher retries failed deliveries up to 5 times before moving messages to a dead-letter queue for operator inspection.

---

## Part IV: Reliability, Validation & Enterprise Security (41–52)

### 41. Error Handling Principles
- **Imperative:** Errors must be predictable, structured, logged with correlation IDs, and sanitized of sensitive stack traces.
- **MyStore Application:** Standardized error envelope `{ success: false, error: { code, message, details }, requestId }` applied by global FastAPI exception handlers.

### 42. Validation Principles
- **Imperative:** Validate early at the boundary; never trust client input.
- **MyStore Application:** Dual-layer validation: Zod schemas on the frontend client form layer; strict Pydantic models on the FastAPI backend.

### 43. Security-by-Design
- **Imperative:** Security is an architectural foundation, not an afterthought.
- **MyStore Application:** Helmet security headers, CORS origin restrictions, strict CSP, parameterized SQL queries via SQLAlchemy (zero SQL injection).

### 44. Least Privilege Principles
- **Imperative:** Users, services, and tokens have access only to the minimal set of resources required for their role.
- **MyStore Application:** Role-Based Access Control (`ORG_ADMIN`, `STORE_MANAGER`, `CASHIER`, `DELIVERY_DRIVER`, `HR_MANAGER`) enforced on every endpoint.

### 45. Zero-Trust Principles
- **Imperative:** Never trust, always verify. Every internal request must authenticate, authorize, and validate tenant context.
- **MyStore Application:** Every single query enforces `organization_id` derived directly from verified JWT tokens, never from unauthenticated request parameters.

### 46. Auditability Principles
- **Imperative:** Every sensitive mutation (financial, inventory, credentials, permission changes) must leave an indelible audit trail.
- **MyStore Application:** Dedicated `AuditLog` table capturing timestamp, actor ID, IP address, before/after state diffs, and action types.

### 47. Observability Principles
- **Imperative:** Systems must expose telemetry that enables operators to understand internal states without deploying debug code.
- **MyStore Application:** W3C `traceparent` propagation (`00-{trace_id}-{span_id}-01`), structured JSON logs, and `/health/deep` diagnostics.

### 48. Logging Principles
- **Imperative:** Logs must be structured, contextual, machine-readable, and free of PII or credentials.
- **MyStore Application:** Structured logging with `X-Request-Id` correlation, log levels (INFO, WARN, ERROR), and automatic redaction of passwords and tokens.

### 49. Monitoring & Telemetry
- **Imperative:** Real-time visibility into latency, error rates, saturation, and resource saturation.
- **MyStore Application:** Prometheus metrics integration (`prom-client`), HTTP processing duration tracking (`X-Process-Time-Ms`), and Kubernetes liveness/readiness probes.

### 50. Performance & Throughput
- **Imperative:** Sub-50ms API responses, 0ms page transitions, and minimal asset bundle weights.
- **MyStore Application:** Vite manual chunk splitting (`vendor-charts`, `vendor-table`, `vendor-forms`), hover link prefetching, and asyncpg non-blocking DB queries.

### 51. Caching Principles
- **Imperative:** Cache expensive, frequently read, rarely changed computations with explicit invalidation triggers.
- **MyStore Application:** In-memory TanStack React Query cache with targeted invalidation on SSE events, and Redis key-value caching for tenant configurations.

### 52. Concurrency Principles
- **Imperative:** Handle multiple requests concurrently without race conditions, blocking event loops, or deadlocks.
- **MyStore Application:** Python 3.12 `asyncio` non-blocking runtime, async connection pooling, and optimistic concurrency control on inventory items.

---

## Part V: Quality Assurance, DevOps & Infrastructure (53–70)

### 53. Testing Principles
- **Imperative:** Automated test pyramids (unit, integration, end-to-end) validate correctness on every commit.
- **MyStore Application:** 95+ passing pytest suites covering security, API routing, domain engines, and lifecycle flows (`pnpm py:test`).

### 54. Testability Principles
- **Imperative:** Code is designed with dependency injection to allow isolated testing without mocks or network fragility.
- **MyStore Application:** Test fixtures (`conftest.py`) provision ephemeral databases and mock event buses cleanly.

### 55. CI/CD Principles
- **Imperative:** Continuous Integration and Continuous Deployment gates ensure zero broken builds reach production.
- **MyStore Application:** GitHub Actions `.github/workflows/ci.yml` verifying TypeScript types, Python tests, and database schema drift on every PR.

### 56. Infrastructure-as-Code (IaC)
- **Imperative:** Infrastructure environments are declared in code, reproducible, and version-controlled.
- **MyStore Application:** `docker-compose.yml` and `docker-compose.prod.yml` define containers for backend services, database, Redis, and reverse proxy.

### 57. Configuration Management
- **Imperative:** Externalize all environment-specific settings (database URLs, secrets, ports) out of source code.
- **MyStore Application:** Strict `.env` parsing via Pydantic `BaseSettings` with secure defaults and CI mock fallback overrides.

### 58. Environment Separation
- **Imperative:** Development, staging, and production environments remain isolated with zero shared credentials.
- **MyStore Application:** Isolated production ports, dedicated database schemas, and separate configuration paths.

### 59. Feature Flag Principles
- **Imperative:** Decouple code deployment from feature release using dynamic feature flags.
- **MyStore Application:** Industry vertical modules (e.g., restaurant vs pharmacy) enabled via tenant-level feature configuration toggles.

### 60. Progressive Rollout Principles
- **Imperative:** Deploy changes incrementally (canary, blue-green) to minimize blast radius.
- **MyStore Application:** Production deployment script `scripts/deploy_production.sh` executes zero-downtime container updates.

### 61. Documentation Principles
- **Imperative:** Documentation is treated as living code, versioned in the repository, and updated with every architectural shift.
- **MyStore Application:** Comprehensive documentation suite in `docs/` and `AGENTS.md` keeping AI and human contributors in sync.

### 62. Code Ownership Principles
- **Imperative:** Clear boundaries of responsibility for services, contracts, and frontend shells.
- **MyStore Application:** Pnpm workspace structure defining explicit ownership across `apps/`, `services/`, and `packages/`.

### 63. Standardization Principles
- **Imperative:** Uniform code style, linting, formatting, and file organization across all workspaces.
- **MyStore Application:** Biome/ESLint configs, Prettier, Black/Ruff standards, and Turborepo monorepo orchestration.

### 64. Convention-over-Configuration
- **Imperative:** Adopt sensible defaults to reduce boilerplate and cognitive load.
- **MyStore Application:** Standard module layout (`models.py`, `schemas.py`, `api.py`), standard route prefixes, and standard response envelopes.

### 65. Backward-Compatible Changes
- **Imperative:** Deprecate before removing; never introduce sudden breaking changes.
- **MyStore Application:** Contract updates maintain optionality for legacy fields during multi-step frontend migrations.

### 66. Graceful Degradation
- **Imperative:** Under degraded conditions, continue serving essential features while disabling non-critical enhancements.
- **MyStore Application:** If SSE stream disconnects, UI falls back to manual refresh buttons without crashing user workflows.

### 67. Disaster Recovery Principles
- **Imperative:** Regularly tested automated backups and recovery procedures to guarantee business continuity.
- **MyStore Application:** `scripts/backup_db.py` providing snapshotting and Point-in-Time recovery automation.

### 68. High Availability (HA)
- **Imperative:** Eliminate single points of failure across web servers, gateways, and data stores.
- **MyStore Application:** Multi-replica gateway containers behind Nginx reverse proxy; PostgreSQL connection failover readiness.

### 69. Horizontal Scaling
- **Imperative:** Scale application tiers by adding more instances rather than oversized single servers.
- **MyStore Application:** Python Uvicorn instances scale horizontally behind load balancers with stateless JWT session distribution.

### 70. Migration-Friendly Architecture
- **Imperative:** System allows incremental migration between frameworks and languages without stopping business operations.
- **MyStore Application:** Successfully migrated from legacy NestJS to Python/FastAPI while preserving existing PostgreSQL tables and TypeScript contracts.

---

## Part VI: Microservices, Integration & Evolution (71–86)

### 71. Vendor Independence Principles
- **Imperative:** Avoid hard vendor lock-in; build on open, cloud-native standards.
- **MyStore Application:** Standard PostgreSQL 16, Redis 7, Docker, FastAPI, and Vite—runnable on any Linux VPS, AWS, GCP, or bare metal.

### 72. Technology-Agnostic Domain Principles
- **Imperative:** Core enterprise business logic is expressed independently of cloud vendor SDKs.
- **MyStore Application:** Domain rules reside in pure Python algorithms and relational constraints, easily portable to any infrastructure.

### 73. Microservices Evolution Principles
- **Imperative:** Start with a clean modular monolith; extract independent microservices only when traffic or organizational scale warrants.
- **MyStore Application:** Same codebase executes as monolithic `/api/v1` or as 7 decomposed microservices via `create_microservice()`.

### 74. Service Boundary Principles
- **Imperative:** Service boundaries follow business capability domains, not technical tiers.
- **MyStore Application:** Services partitioned by Auth, Catalog, Sales, Delivery, HR, Finance, and Platform.

### 75. Domain Isolation Principles
- **Imperative:** Internal domain states are private and accessible to external modules only through public API contracts.
- **MyStore Application:** Direct database cross-table updates between unrelated domains are strictly prohibited.

### 76. Shared Kernel Principles
- **Imperative:** Restrict shared code to truly universal domain models and contracts.
- **MyStore Application:** Shared kernel maintained in `packages/contracts` and backend `app/core/`.

### 77. Anti-Corruption Layer (ACL)
- **Imperative:** Translate external third-party models into internal domain representations at integration boundaries.
- **MyStore Application:** Telegram bot webhook payloads and payment gateway webhooks translated into internal typed domain events before processing.

### 78. Integration Boundary Principles
- **Imperative:** All external communication is mediated by dedicated gateways and integration adapters.
- **MyStore Application:** Gateway (`app.microservices.gateway`) acts as the single secure entrypoint for all frontend traffic.

### 79. Message Contract Principles
- **Imperative:** Event schemas are strictly typed, validated, and backward-compatible.
- **MyStore Application:** Event bus messages carry standard metadata (`id`, `event_type`, `tenant_id`, `timestamp`, `payload`).

### 80. Event Versioning Principles
- **Imperative:** Events evolve with non-breaking changes or explicit event version numbers (`v1.order.created`).
- **MyStore Application:** Event handlers ignore unrecognized fields and maintain compatibility across consumer upgrades.

### 81. Dependency Management
- **Imperative:** Actively audit, lock, and patch external dependencies to protect against supply-chain vulnerabilities.
- **MyStore Application:** Managed via pnpm workspace overrides, `.github/dependabot.yml`, and `requirements.txt` pinning.

### 82. Technical Debt Management
- **Imperative:** Track, budget, and resolve technical debt continuously rather than letting legacy code fester.
- **MyStore Application:** Clear isolation of legacy code (`services/backend`), deprecation roadmaps in `docs/architecture/`, and automated CI lint gates.

### 83. Refactoring Principles
- **Imperative:** Improve code structure and readability continuously while keeping automated tests green.
- **MyStore Application:** Safe continuous refactoring backed by 95 passing pytest suites and TypeScript typecheck guarantees.

### 84. Incremental Development
- **Imperative:** Deliver software in small, verified, production-ready increments rather than massive risky releases.
- **MyStore Application:** Vertical slice evolution—delivering end-to-end verified features (DB + API + UI + Realtime) in each iteration.

### 85. Progressive Architecture
- **Imperative:** Architecture evolves adaptively based on measured telemetry and real business requirements.
- **MyStore Application:** Evolution from single database to read-replicas, and modular monolith to microservices as load scales.

### 86. Future-Proofing Principles
- **Imperative:** Build on durable, standardized technologies that will remain robust for years.
- **MyStore Application:** Anchored on PostgreSQL 16, Python 3.12+, React 19, Vite 6, and Tailwind CSS.

---

## Part VII: User Experience, Internationalization & Global Reach (87–90)

### 87. UX/UI Consistency Principles
- **Imperative:** Provide a unified visual language, typography, and interaction model across all platform experiences.
- **MyStore Application:** Persistent `EnterpriseShell` layout, bundled Inter font typography, standardized KPI cards, and unified Radix UI tokens.

### 88. Accessibility Principles (a11y)
- **Imperative:** Applications must be accessible to all users, supporting screen readers, keyboard navigation, and contrast standards.
- **MyStore Application:** Radix UI primitives providing built-in ARIA roles, focus rings, keyboard navigation (`Cmd+J`, Escape, Tab), and high-contrast color tokens.

### 89. Internationalization Principles (i18n)
- **Imperative:** Architecture supports multi-lingual, multi-currency, and global business operations natively.
- **MyStore Application:** Database models and API contracts store ISO currency codes, UTC timestamps, and localized string mappings.

### 90. Localization Principles (l10n)
- **Imperative:** Adapt presentation of dates, numbers, currencies, and languages to the user's specific cultural locale.
- **MyStore Application:** Standardized formatting utilities for currencies (USD, KHR), dates (`date-fns` locale formatters), and timezones.
