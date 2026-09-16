# UI Architecture & Enterprise NOC/SOC Design System

**Target Host:** `https://infra.camtech.cam`  
**Framework:** React 19 + TypeScript 5.7 + Tailwind CSS + Radix Primitives + @xyflow/react + Recharts  
**Design Standard:** Dense, High-Contrast, Accessible Enterprise Operator Console (Principle 87, 88)

---

## 1. Visual Hierarchy & Ergonomic Philosophy

The **CamTech Control Center** is built for mission-critical operators, SREs, and security analysts working in high-pressure scenarios. It eschews generic dashboard templates, excessive gradients, and toy animations in favor of **rapid scannability, deterministic status indicators, and keyboard-first navigation**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [CT] CAMTECH INFRA & SECURITY CONTROL CENTER         [Global: HEALTHY]  [Break-Glass]  │
├───────────────┬────────────────────────────────────────────────────────────────────────┤
│ NAVIGATION    │ LIVE COMMAND CENTER OVERVIEW                                           │
│ • Overview    │ ┌──────────────┬──────────────┬──────────────┬──────────────────────┐  │
│ • Services    │ │ Services     │ Traffic      │ Error Rate   │ Security Threats     │  │
│ • Service Map │ │ 9/9 Healthy  │ 2,480 req/s  │ 0.08%        │ 0 Active SEV-1       │  │
│ • API Traffic │ └──────────────┴──────────────┴──────────────┴──────────────────────┘  │
│ • Logs        │                                                                        │
│ • Metrics     │ ┌──────────────────────────────────────┐ ┌───────────────────────────┐ │
│ • Traces      │ │ LIVE SERVICE TOPOLOGY MAP            │ │ ACTIVE INCIDENTS (2)      │ │
│ • Security    │ │ Gateway (:4000)                      │ │ • [SEV-2] Latency warning │ │
│ • Incidents   │ │  ├─ Auth (:4001) ── DB               │ │ • [SEV-3] 429 burst NL    │ │
│ • Auth & Pass │ │  ├─ Catalog (:4002) ── Redis         │ ├───────────────────────────┤ │
│ • Infra & DB  │ │  └─ Sales (:4003)                    │ │ RECENT DEPLOYMENTS        │ │
│ • Deployments │ └──────────────────────────────────────┘ │ • sales-service v2.8.2    │ │
│ • Audit Logs  │                                          └───────────────────────────┘ │
│ • Playbooks   │ ┌────────────────────────────────────────────────────────────────────┐ │
│ • Settings    │ │ LIVE TELEMETRY STREAM (SSE CONNECTED)                              │ │
│               │ │ 13:45:01  POST /api/v1/sales/orders  201  142ms  KH SINET          │ │
│               │ │ 13:45:02  GET  /api/v1/products      200   24ms  KH Smart          │ │
│               │ └────────────────────────────────────────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Navigation Structure & Views

1. **Overview (Executive NOC/SOC):** Global system status, key metrics, active incidents, degraded nodes, live telemetry stream.
2. **Services Catalog:** Detailed health matrix, memory/CPU usage, uptime, endpoints count, and deep ping latency for all 9 microservices.
3. **Service Map (Interactive Topology):** Rendered using `@xyflow/react` with real-time edge traffic animations, node statuses, and drill-down inspectors.
4. **API Traffic (Live Ingress Monitor):** Live request stream, status code distribution (2xx, 4xx, 5xx), P50/P95/P99 latency trends, top routes, and rate-limit violations.
5. **Log Explorer:** Structured JSON log search with multi-filter facets (severity, service, traceId, requestId, time window).
6. **Distributed Tracing:** Visual trace timeline, span waterfalls, service hops, and error correlation.
7. **Security / Threat Center:** Active attacks, brute force detection, sliding-window IP violations, ban/unban management, and ASN breakdown.
8. **Incidents Commander:** Incident triage, status workflows (Detected -> Closed), severity badges, timeline events, evidence logs, and postmortem records.
9. **Authentication & Identity:** WebAuthn passkey registration audits, active sessions, device revocations, suspicious login alerts.
10. **Infrastructure & Databases:** PostgreSQL connection pool health (active/idle/max), Redis memory/hit rate, disk usage, queue depth.
11. **Deployments & Rollbacks:** Deployment changelog, Git commit tags, deployer identity, and automated error/latency correlation.
12. **Audit System:** Cryptographic audit trail with actor, action, timestamp, before/after diffs, and break-glass session flags.
13. **Playbooks & Automation:** Configurable if-this-then-that defensive automation with strict safety guards and approval toggles.

---

## 3. UI State Management & Real-Time Sync

- **TanStack Query (v5):** Caching, background refetching, and optimistic mutations for operational data.
- **Server-Sent Events Hook (`useInfraStream`):** Consumes `/api/v1/infra/events/stream` and merges incoming payloads directly into TanStack Query cache without triggering full page refetches.
- **Zustand (Scoped):** Selected time range (`15m`, `1h`, `24h`, `7d`), active filters, and topology inspector pane state.
- **Offline / Reconnection Banner:** When SSE drops, displays subtle warning bar with automatic exponential backoff reconnection.
