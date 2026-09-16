# Phased Implementation Plan: CamTech Infra & Security Control Center

**Objective:** Build and deploy the CamTech Infra & Security Control Center (`https://infra.camtech.cam`) in 5 incremental, production-grade phases with zero regressions to existing functioning business modules.

---

## Phase 1: Foundation, Data Persistence & Identity Security (Current Phase)

### 1.1 Backend Service Foundation (`infra-service` on port `4009`)
- [ ] Create domain models in `services/backend-py/app/modules/infra/models.py`:
  - `InfraService` (service registry, port, version, health status, ping latency)
  - `InfraServiceDependency` (source service, target service, protocol, health)
  - `InfraSecurityEvent` (severity, category, source IP, ASN, signals, defensive action)
  - `InfraIncident` (incident ID, severity, status, title, summary, owner)
  - `InfraIncidentTimeline` (timeline entries, evidence references, actor, timestamp)
  - `InfraPlaybook` (rule name, trigger condition, action type, requires approval)
  - `InfraDeployment` (service, version, commit hash, deployer, status)
  - `InfraBreakGlassSession` (actor ID, justification, TTL, expires at, is active)
- [ ] Register all new models in `services/backend-py/app/models/entities.py`.
- [ ] Create schemas in `services/backend-py/app/modules/infra/schemas.py`.
- [ ] Build core REST API controller in `services/backend-py/app/modules/infra/api.py`:
  - `GET /api/v1/infra/overview` (global system status, high-level metrics, active alerts)
  - `GET /api/v1/infra/services` (registered microservices, ports, health, memory/CPU)
  - `GET /api/v1/infra/topology` (node and edge graph structure for XYFlow)
  - `GET /api/v1/infra/traffic` (recent API requests, latency percentiles, status codes)
  - `GET /api/v1/infra/security/events` (security incidents, signals, violations)
  - `POST /api/v1/infra/security/bans` & `DELETE /api/v1/infra/security/bans/{ip}` (IP ban control)
  - `GET /api/v1/infra/incidents` & `POST /api/v1/infra/incidents` (incident creation & triage)
  - `GET /api/v1/infra/deployments` (deployment history & error correlation)
  - `GET /api/v1/infra/audit` (immutable administrative audit log search)
  - `POST /api/v1/infra/break-glass` (emergency session activation with mandatory justification)
  - `GET /api/v1/infra/events/stream` (SSE real-time streaming endpoint)
- [ ] Mount router in monolith `services/backend-py/app/main.py`.
- [ ] Create standalone microservice entrypoint `services/backend-py/app/microservices/infra_service.py` (`port=4009`).
- [ ] Register route in Edge Gateway `services/backend-py/app/microservices/gateway.py` (`ROUTING_MAP["/api/v1/infra"] = INFRA_SERVICE_URL`).

### 1.2 TypeScript Shared Contracts
- [ ] Add `packages/contracts/src/infra.ts` with typed DTOs matching backend Pydantic models.
- [ ] Export all contracts from `packages/contracts/src/index.ts`.

### 1.3 Nginx & Deployment Infrastructure
- [ ] Update `deploy/nginx/nginx.conf`:
  - Add subdomain rewrite for `infra.*`, `soc.*`, `noc.*` -> `/infra-proxy/`
  - Route `/infra-proxy/` upstream to `infra_app` on internal port `80`
- [ ] Add `infra-app` target to `apps/Dockerfile.prod`.
- [ ] Add `mystore-infra-service` and `mystore-infra-app` to `docker-compose.prod.yml` and root `package.json` (`ms:infra`, `infra:dev`).

### 1.4 Frontend Web Application Console (`apps/web/src/apps/infra`)
- [ ] Create dedicated enterprise application shell `InfraControlApp.tsx` and layout:
  - Sidebar navigation with all 13 core sections
  - Global status bar with active incident indicators and Break-Glass modal
- [ ] Implement views:
  - **Overview**: Executive NOC/SOC summary cards, active incident counter, live event feed
  - **Services**: Live status grid with deep database ping latency
  - **Service Map**: Interactive topology using `@xyflow/react` with custom styled nodes
  - **API Traffic**: Real-time request table, HTTP status badges, latency percentiles
  - **Security Threat Center**: IP violations, active bans, ASN intelligence, manual ban dialog
  - **Incident Commander**: Triage board, timeline, severity filters, incident creator
  - **Audit Log**: Structured before/after diff viewer with trace IDs
  - **Break-Glass Dialog**: Modal with required justification, timer countdown, and confirmation
- [ ] Wire domain routing in `apps/web/src/App.tsx`:
  - Route `hostname.startsWith('infra.')` and path `/infra` to `InfraControlApp`.
- [ ] Add portal switcher link in `apps/web/components/domain-bar.tsx`.

---

## Phase 2: Observability Depth & Distributed Tracing
- [ ] Integrate OpenTelemetry OTLP traces directly from Jaeger backend into Trace Viewer.
- [ ] Structured log query explorer with full-text search against service loggers.
- [ ] Rolling latency percentile calculator (P50, P95, P99) using Redis sorted sets.

---

## Phase 3: Automated Security Playbooks & Anomaly Detection
- [ ] Rule engine evaluating failed auth rates against thresholds.
- [ ] Automated sliding-window rate limit escalation with Slack/Telegram dispatch.
- [ ] Source network intelligence aggregation (ASN, ISP classification).

---

## Phase 4: Incident Response Automation & On-Call Workflows
- [ ] Integrated playbooks with operator confirmation gates.
- [ ] Automated postmortem template generation with correlated telemetry snapshots.

---

## Phase 5: AI Operations Assistant (CamTech SRE Copilot)
- [ ] Real-time incident explanation assistant using underlying evidence (logs, traces, deployments).
- [ ] Strict attribution: zero hallucinated telemetry; explicit citations to trace and log IDs.
