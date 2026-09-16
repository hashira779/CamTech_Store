# ADR-0003: Infra Control Center Uses Vite + React Router

**Status:** Accepted  
**Date:** 2026-09-16  
**Deciders:** hashira779 (repo owner)

---

## Context

The Infra & Security Control Center (`infra.camtech.cam`) was initially built as a
single-component tab-switcher inside `InfraControlApp.tsx`. An earlier specification
mentioned Next.js as a possible frontend framework. This ADR records the definitive
architectural decision before any implementation proceeds.

---

## Decision

The Infra Control Center is implemented **inside the existing `apps/web` Vite monorepo**,
using **React Router v6** for routing and nested layouts.

**Next.js is explicitly rejected** for this application.

---

## Rationale

| Consideration | Verdict |
|---|---|
| Monorepo already uses Vite + React Router for all micro-frontends | No divergence |
| Next.js would require a second build system, second Docker target type, second deployment pattern | Unnecessary complexity |
| React Router v6 `<Routes>` + `<Outlet>` satisfies all navigation requirements | Sufficient |
| TanStack Query satisfies all server state / real-time requirements | Sufficient |
| Zustand satisfies client UI state (break-glass session, sidebar collapse) | Sufficient |
| SSE streaming is already implemented via native `EventSource` | No framework needed |

The original Next.js mention in specification drafts was a **capability/architecture
description** (modular routing, auth, RBAC, real-time, SSE), not permission to
introduce framework divergence. All those capabilities are fully satisfied by the
existing stack.

---

## Consequences

1. The Infra Control Center lives in `apps/web/src/apps/infra/` and follows the same
   conventions as `AdminApp`, `CeoApp`, `SupportApp`, etc.
2. It has its **own dedicated Docker container** (`infra-app`, port 5009) and its
   own Cloudflare tunnel entry (`infra.camtech.cam → localhost:5009`), ensuring
   complete runtime separation from the admin console.
3. Future contributors **must not introduce Next.js** for this application unless
   there is a demonstrated requirement that Vite + React Router cannot satisfy.
4. This decision is reviewed only if a specific capability gap is identified and
   documented.

---

## Architecture

```
apps/web/src/apps/infra/
  InfraControlApp.tsx     ← React Router <Routes>, code-split pages
  InfraShell.tsx          ← Persistent layout: header + NavLink sidebar + SSE + break-glass
  views/                  ← Pure presentation components (receive typed props)
    OverviewView.tsx
    ServicesView.tsx
    ApiTrafficView.tsx
    SecurityThreatView.tsx
    IncidentsView.tsx
    AuditView.tsx
  components/
    TopologyGraph.tsx
```

Routes:

| URL | Page |
|---|---|
| `/infra/overview` | Command Overview |
| `/infra/services` | Microservices Mesh |
| `/infra/topology` | Interactive Topology |
| `/infra/traffic` | Live Edge Traffic |
| `/infra/threats` | Security Threat Center |
| `/infra/incidents` | Incidents & Deploys |
| `/infra/audit` | Immutable Audit Logs |
