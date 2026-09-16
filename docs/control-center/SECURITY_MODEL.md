# Security Model, RBAC & Break-Glass Protocol

**Standard:** Least Privilege, Defense-in-Depth & Zero-Trust Governance (Principle 43, 44, 45, 46)

---

## 1. Granular Role-Based Access Control (RBAC)

The Control Center enforces fine-grained permissions:

| System Role | Granted Permissions | Scope / Capabilities |
|---|---|---|
| **Platform Owner** | `*` (All permissions) | Full root control across all services, playbooks, and break-glass. |
| **Security Administrator** | `security.*`, `audit.read`, `identity.sessions.revoke`, `infra.services.read` | Threat response, IP un/banning, incident resolution, session revokes. |
| **Infrastructure Administrator (SRE / DevOps)** | `infra.*`, `audit.read`, `security.incidents.manage` | Service restarts, topology inspections, deployment rollback triggers. |
| **Backend Developer** | `infra.services.read`, `infra.logs.read`, `infra.traces.read`, `infra.metrics.read` | Troubleshooting, trace inspection, latency debugging. Read-only on security. |
| **Auditor** | `audit.read`, `security.events.read`, `infra.services.read` | Immutable compliance and inspection. Zero mutation access. |
| **Read-Only Operator** | `*.read` (Excluding raw secrets & sensitive payloads) | Read-only dashboards and status monitoring. |

---

## 2. Granular Permissions Nomenclature

- `infra.services.read` / `infra.services.manage`
- `infra.deployments.read` / `infra.deployments.rollback`
- `infra.logs.read` / `infra.traces.read` / `infra.metrics.read`
- `security.events.read` / `security.events.manage`
- `security.sources.block` / `security.sources.unblock`
- `security.incidents.create` / `security.incidents.manage` / `security.incidents.close`
- `identity.sessions.read` / `identity.sessions.revoke`
- `identity.passkeys.manage`
- `audit.read` / `audit.export`
- `infra.break_glass.activate`

---

## 3. Break-Glass Emergency Protocol (Principle 44, 46)

In catastrophic infrastructure or security situations where normal RBAC prevents an on-call engineer from mitigating an active outage:
1. **Trigger Condition:** User must be an authenticated staff member (`STAFF` WebAuthn passkey or hardware MFA).
2. **Justification Requirement:** Mandatory emergency incident reason (e.g. `Active SEV-1 Database Deadlock - Mitigating connection saturation`).
3. **Time-To-Live (TTL):** Maximum 20 minutes before automatic token expiration.
4. **Audit Trail:**
   - Every HTTP mutation executed during an active break-glass window is flagged `isBreakGlass=true` in `audit_logs`.
   - Generates an immediate high-priority Telegram alert to the Executive & Security Leads with IP, timestamp, and justification.
   - Session cannot be extended; a new session requires re-authentication and fresh justification.

---

## 4. Defensive Boundary Guarantees

1. **No Weaponization:** No penetration testing payloads, exploit modules, denial-of-service stress tools, or credential spraying scripts may be packaged into or executed from the Control Center.
2. **Approximate Geolocation Disclaimer:** Geolocation lookups only resolve Autonomous System Numbers (ASN), Country, and General Metro Region. No personal addresses or exact coordinates.
3. **Session Revocation Invalidation:** Revoking a session broadcasts a blacklist event to Redis (`revoked_token:<jti>`) with token expiration TTL, instantly rejecting requests across all 7 microservices without waiting for token expiration.
