# Architecture Specification: CamTech Infra & Security Control Center

**Primary Domain:** `https://infra.camtech.cam`  
**Internal Gateway Port:** `4000` (`/api/v1/infra/*`)  
**Microservice Port:** `4009` (`infra-service`)  
**Web Application Port:** `5009` (`infra-app` / `apps/web` dynamic shell)  
**Status:** Architectural Blueprint & Phase 1 Specification  

---

## 1. Executive Summary & Design Vision

The **CamTech Infra & Security Control Center** is a dedicated, platform-level operational, observability, identity-security, API-monitoring, and incident-response microservice and web application. It serves as the unified **NOC/SOC (Network Operations Center / Security Operations Center)** for the entire CamTech enterprise ecosystem.

It is strictly **defensive-in-depth**, adhering to the 90 CamTech Engineering Principles. It ingests telemetry, tracks API latencies and anomalies, correlates deployments with errors, manages security incidents, enforces rate limits and IP bans, audits administrative actions, and provides real-time topology visualization.

```
                               ┌────────────────────────────────┐
                               │  https://infra.camtech.cam     │
                               │  (NOC / SOC Web Console :5009) │
                               └───────────────┬────────────────┘
                                               │ HTTPS / WSS / SSE
                                               ▼
                              ┌──────────────────────────────────┐
                              │     Edge Reverse Proxy (Nginx)   │
                              │     Port 80 / 443 (:8090)        │
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
               ┌────────────────────────────────────────────────────────────────┐
               │         CamTech Enterprise API Gateway (:4000)                 │
               │         W3C Traceparent Injection · Rate Limiting · IP Bans    │
               └───────┬───────────────────────┬───────────────────────┬────────┘
                       │                       │                       │
                       ▼                       ▼                       ▼
         ┌───────────────────────────┐ ┌───────────────┐ ┌───────────────────────────┐
         │ Core Business Services    │ │ Identity      │ │ Infra & Security Control  │
         │ :4002 Catalog             │ │ Service       │ │ Service (:4009)           │
         │ :4003 Sales               │ │ (:4001)       │ │ • Observability Ingestion │
         │ :4004 Delivery            │ │ • WebAuthn    │ │ • Security Threat Center  │
         │ :4005 HR                  │ │ • JWT Auth    │ │ • Incident Commander      │
         │ :4006 Finance             │ │ • Relational  │ │ • Service Topology        │
         │ :4007 Platform            │ │   User Roles  │ │ • Playbook Automation     │
         │ :4008 Bot Builder         │ └───────┬───────┘ └─────────────┬─────────────┘
         └─────────────┬─────────────┘         │                       │
                       │                       │                       │
                       └───────────────────────┼───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │   Redis 7 Event Backbone & Telemetry Cache   │
                        │   • Stream: mystore:telemetry:requests       │
                        │   • Stream: mystore:security:events          │
                        │   • PubSub: mystore:infra:realtime           │
                        │   • Keys: ip_ban:* & ip_violations:*         │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │      PostgreSQL 16 Primary Persistence       │
                        │      `camtechStore` Database (75+ tables)    │
                        │      Native ENUMs · CamelCase Columns        │
                        └──────────────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### 2.1. Zero-Mock & Real Data Integrity (Principle 4, 10, 42)
The platform is designed around real backend contracts, structured logging from Python microservices, and live telemetry. Mock data, hardcoded counters, and fake decorative charts are strictly forbidden. Telemetry is sourced from:
1. **API Gateway Telemetry Middleware** (`app/core/telemetry.py`): W3C traceparent headers, latencies, status codes, route timings.
2. **Rate Limiter & IP Ban System** (`app/core/rate_limiter.py`): Real-time sliding window violations, automatic ban escalation, Redis TTL tracking.
3. **Audit Log Repository** (`audit_logs` table): Cryptographically verifiable admin actions.
4. **Active Microservice Health Probes** (`/health`, `/ready` on ports 4000–4009): Round-trip latency, DB ping, uptime.

### 2.2. Defensive Security Boundary (Principle 43, 44, 45)
- **Defensive Monitoring Only:** The Control Center exists to monitor, detect abuse, mitigate attacks, and coordinate incident response. No offensive exploitation, packet sniffing, credential harvesting, or automated hacking tools.
- **Approximate Network Geolocation:** IP intelligence is explicitly marked as approximate autonomous system (ASN) / network level data. IP addresses are never treated as proof of physical personal identity.
- **Data Classification & Secret Redaction:** Telemetry streams enforce automatic scrubbing of passwords, authorization headers, bearer tokens, passkey private credentials, and personal financial data.

### 2.3. Dual Deployment Topology (Principle 15, 73)
The Control Center adheres to the MyStore standard dual-deployment architecture:
1. **Modular Monolith Mode (`pnpm py:dev` on `:4000`):** The Infra Control router is mounted under `/api/v1/infra` directly within `app.main:app`.
2. **Independent Microservices Mode (`pnpm ms:all` on `:4000`–`:4009`):** The Infra Control service runs as a standalone process on port `4009` (`app.microservices.infra_service:app`) behind the Edge Gateway (`gateway.py`).

---

## 3. Storage & Partitioning Strategy

High-volume telemetry (millions of raw API requests) is strictly separated from business transaction storage:
- **Hot Ingest (Buffer & Windowing):** Redis 7 Streams (`XADD mystore:telemetry:requests MAXLEN ~ 50000`) and sorted sets for rolling 1-hour P50/P95/P99 latency calculations.
- **Long-Term Relational Core (PostgreSQL 16):** Normalized tables for persistent operational artifacts:
  - `infra_services`: Dynamic service catalog, health state, and instance metadata.
  - `infra_service_dependencies`: Service-to-service communication edges and protocol contracts.
  - `infra_security_events`: Security signals, failed auth bursts, WAF blocks, and threat classifications.
  - `infra_incidents`: Formal operational incidents with severity ratings (SEV-1 to SEV-4).
  - `infra_incident_timeline`: Append-only incident chronology and action log.
  - `infra_playbooks`: Pre-approved automated defensive response workflows.
  - `infra_deployments`: Deployment metadata, commit hashes, and error rate delta correlations.
  - `infra_break_glass_sessions`: Ephemeral emergency privileged access records with reason and TTL.

---

## 4. Real-Time Streaming Architecture

The Control Center provides real-time situational awareness without client polling:
1. **Server-Sent Events (SSE) Stream (`/api/v1/infra/events/stream`):** Delivers lightweight, categorized push events (`API_REQUEST`, `SECURITY_EVENT`, `INCIDENT_UPDATE`, `SERVICE_HEALTH`).
2. **Backpressure & Heartbeats:** SSE connections transmit an empty comment ping (`: ping\n\n`) every 15 seconds to detect client drops and maintain Cloudflare tunnel keep-alive.
3. **Redis PubSub Multiplexing:** Individual worker instances publish to `mystore:infra:realtime`, and the streaming route subscribes to broadcast directly to connected NOC/SOC browser sessions.
