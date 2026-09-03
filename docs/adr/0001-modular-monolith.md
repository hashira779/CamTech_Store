# ADR 0001 — Start as a modular monolith, not microservices

- **Status:** Accepted
- **Date:** 2026-09-02
- **Context:** Spec §74–§76.

## Decision

Build the backend as a **single deployable NestJS application** internally
organized into strongly-bounded modules (`identity`, `products`, `audit`, …),
rather than starting with independent microservices.

## Rationale

- The spec explicitly says *"Do NOT start with dozens of independent services.
  Start with a modular monolith"* (§74) and warns against extracting services
  "merely for architectural fashion" (§74, §75).
- A small team ships a monolith faster: one deploy, one debugger, in-process
  calls, no premature network/serialization/distributed-transaction cost.
- Clean module boundaries + the repository pattern mean a module can later be
  **extracted** into its own service (§75) with minimal churn once it has a real
  operational reason (independent scaling/deploy/failure domain, high traffic).

## Boundaries we enforce now so extraction stays cheap

- Each module owns its tables; no module reaches into another module's tables
  with raw SQL (§101). Cross-module needs go through services/events.
- The domain layer has **no framework/DB dependency**, so it moves as-is.
- Repositories are ports (interfaces + DI tokens); the Prisma adapter is the only
  DB-aware code.
- Shared shapes live in `@mystore/contracts`, not copied between modules.

## Consequences

- We defer: API gateway, per-service DBs, Kafka/Temporal/OpenSearch, Kubernetes
  (all listed as **Phase 6 "only when required"**, §108, §112).
- We must stay disciplined about module boundaries — an import graph lint / module
  dependency check should be added as modules grow.

---

## Update (September 2026)

**The backend stack has been changed from NestJS to Python/FastAPI.** The modular monolith architectural pattern described in this ADR remains valid — the Python backend should follow the same module boundary discipline, data ownership principles, and domain isolation patterns. The NestJS implementation (28 modules) is retained as a reference for porting.
