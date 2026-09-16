# Event Contracts & Telemetry Schema Specification

**Standard:** W3C Trace Context, Redis 7 Streams & Versioned Event Schemas (Principle 35, 79, 80)

---

## 1. Real-Time Telemetry Event Schema (`API_REQUEST`)

Published on every inbound edge request through Gateway / Ingress:

```json
{
  "eventId": "evt_01J9X8YZ...",
  "eventType": "API_REQUEST",
  "version": "1.0",
  "timestamp": "2026-09-16T13:45:00.123Z",
  "traceContext": {
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7",
    "requestId": "req_8846129841",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  },
  "request": {
    "method": "POST",
    "route": "/api/v1/sales/orders",
    "path": "/api/v1/sales/orders",
    "targetService": "sales-service",
    "statusCode": 201,
    "durationMs": 142.65,
    "clientIp": "103.20.12.44",
    "approximateGeo": {
      "country": "KH",
      "region": "Phnom Penh",
      "asn": "AS136173",
      "org": "SINET / CamTech Networks"
    },
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "rateLimit": {
      "violation": false,
      "remaining": 48
    }
  },
  "actor": {
    "userId": "usr_998124",
    "organizationId": "org_demo",
    "role": "CASHIER"
  }
}
```

---

## 2. Security Threat Event Schema (`SECURITY_EVENT`)

Published on authentication bursts, rate limit violations, or anomalous behavior:

```json
{
  "eventId": "sec_01J9X9AA...",
  "eventType": "SECURITY_EVENT",
  "version": "1.0",
  "timestamp": "2026-09-16T13:46:12.000Z",
  "severity": "HIGH",
  "category": "AUTH_ABUSE",
  "ruleId": "RULE_CONSECUTIVE_AUTH_FAILURES",
  "source": {
    "ip": "185.220.101.5",
    "approximateGeo": {
      "country": "NL",
      "region": "North Holland",
      "asn": "AS60729"
    }
  },
  "affectedService": "auth-service",
  "observedSignals": {
    "failedAttempts": 18,
    "timeWindowSeconds": 60,
    "distinctUsernamesTargeted": 12,
    "rateLimitTriggered": true
  },
  "defenseAction": {
    "actionTaken": "IP_AUTO_BANNED",
    "durationSeconds": 3600,
    "expiresAt": "2026-09-16T14:46:12.000Z"
  }
}
```

---

## 3. Incident Lifecycle Event Schema (`INCIDENT_MUTATION`)

Published when operational incidents are detected, escalated, or mitigated:

```json
{
  "eventId": "inc_01J9X9BB...",
  "eventType": "INCIDENT_MUTATION",
  "version": "1.0",
  "timestamp": "2026-09-16T13:48:00.000Z",
  "incidentId": "INC-2026-0042",
  "severity": "SEV2",
  "status": "INVESTIGATING",
  "title": "Elevated 504 Gateway Timeouts in Sales Microservice",
  "affectedServices": ["sales-service", "api-gateway"],
  "correlatedDeployment": {
    "deploymentId": "dep_20260916_01",
    "service": "sales-service",
    "commit": "a1b2c3d",
    "deployedAt": "2026-09-16T13:42:00.000Z"
  },
  "action": {
    "actorId": "usr_sec_lead",
    "actionType": "STATUS_CHANGED",
    "summary": "Assigned to SRE on-call. Isolating connection pool contention."
  }
}
```

---

## 4. Redaction Invariants (Principle 43, 45)

All telemetry serializers must pass payloads through `scrub_sensitive_telemetry()`:
1. `password`, `secret`, `token`, `authorization`, `cookie`, `apiKey`, `credential` fields are replaced with `[REDACTED]`.
2. Private WebAuthn parameters (`privateKey`, `credentialPublicKey`, `signature` internal bytes) are excluded from telemetry logs.
3. Card numbers, bank accounts, and customer PII are masked (`****-****-****-1234`).
