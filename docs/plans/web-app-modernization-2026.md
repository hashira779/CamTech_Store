# Web Application Modernization Plan — "Super App" 2026 → beyond

**Date:** 2026-09-03  
**App:** `apps/web` (Vite 6 + React 19 + TypeScript, react-router-dom)  
**Canonical Backend:** Python/FastAPI (`services/backend-py/`)  
**Goal:** evolve the current broad-but-shallow admin into a fast, powerful, offline-capable, AI-assisted enterprise super-app.

---

## 0. Honest starting point

**Good news — the stack is already modern and strong (2026-grade).** No re-platforming needed:

| Concern | Already in place |
|---|---|
| UI system | Radix UI primitives + `class-variance-authority` + `tailwind-merge` + `tailwindcss-animate` (the shadcn/ui pattern) |
| Data | TanStack Query (server state) + TanStack Table (grids) + Zustand (client state) |
| Forms | React Hook Form + Zod (shared `@mystore/contracts`) |
| Power UX | `cmdk` (command palette), `nuqs` (URL state), `sonner` (toasts), `recharts` (charts), `lucide` (icons), `date-fns` |
| Breadth | ~28 feature pages: dashboard, POS (`/sales/new`), sales, inventory, finance, HR, procurement, pricing, promotions, loyalty, projects, tickets, assets, approvals, developers, telegram, storage, notifications, taxes, transfers, locations, customers, products, reports, settings |

**The real gaps are depth and reality, not tooling:**

1. ⛔ **The backend can't save data.** Per [the schema-drift audit](../audits/python-backend-schema-drift.md), 31/40 tables break writes. A beautiful UI on a backend that 500s on save is not "powerful." **This is Phase 0 and blocks everything below.**
2. Pages are likely breadth-first shells — need real data wiring, empty/loading/error states, and RBAC-aware behavior.
3. Missing the things that make an enterprise app feel *powerful*: global search, server-driven data grids (filter/sort/paginate/export), real-time updates, offline POS, an AI assistant, and a consistent design system.
4. No frontend quality gates yet (component tests, e2e, performance/a11y budgets, CI).

---

## 1. Guiding principles (the "powerful" bar)

- **API-first & typed end-to-end** — every screen speaks the shared `@mystore/contracts` types; no client-invented shapes.
- **Never trust the client** — prices, totals, permissions computed server-side (mirrors backend §66/§106).
- **Fast by default** — route-level code-splitting, list virtualization, optimistic updates, a Core Web Vitals budget enforced in CI.
- **Offline-capable where it matters** — the POS must keep selling with no network (spec §31).
- **Real-time where it helps** — live dashboards, stock, approvals, notifications.
- **Accessible & global** — WCAG 2.2 AA, full keyboard control, i18n (EN/KM/TH/ZH/VI) + multi-currency (spec §83–§84).
- **One design system** — every screen is built from the same primitives; no bespoke one-off styling.
- **AI-assisted** — a copilot that can answer questions and drive the app through approved API tools (spec §64).

---

## 2. Phased roadmap

### Phase 0 — Unblock backend writes (prerequisite, ~days)
> The Python/FastAPI backend has schema drift against the PostgreSQL database (31/40 tables have write-breaking mismatches). This must be resolved before the web app can be pointed at the canonical backend.
- Resolve backend schema ownership — **Option A recommended** in the [schema drift audit](../audits/python-backend-schema-drift.md): recreate schema from SQLAlchemy models + Python seed, add Alembic + a CI drift-check.
- Wire the web to the Python API for a first vertical (Products → POS → Sales) and verify data persistence.
- Ensure the typed API client layer over TanStack Query works with the Python backend's `{success,data,requestId}` envelope + error toasts.

### Phase 1 — Foundation & consistency (weeks 1–3)
- **Design-system pass:** consolidate all pages onto shared shadcn-style components (Button, Input, Select, Dialog, DataTable, Card, Tabs, Badge, EmptyState, Skeleton). One theme, light/dark, tokens.
- **App shell:** persistent, permission-aware sidebar + topbar, breadcrumb, user menu, org/branch switcher.
- **Data & state discipline:** every list/detail gets loading (skeleton), empty, and error states; optimistic mutations with rollback; query invalidation conventions.
- **Auth/session:** refresh-token handling, route guards, RBAC-driven nav/visibility (hide what you can't do).
- **Quality gates:** Vitest + Testing Library for components, Playwright for 3 critical flows (login, create sale, approve), ESLint/Prettier, and CI (`typecheck → lint → unit → e2e → build`).

### Phase 2 — Power features (weeks 3–8)
- **Global command palette + search** (`cmdk`): jump to any record/page, run quick actions ("Create sale", "Find invoice #…"), permission-scoped.
- **Enterprise DataTable:** server-side pagination/sort/multi-filter, column visibility, saved views (`nuqs` URL state), row selection + bulk actions, CSV/Excel export (async jobs for large exports, spec §79).
- **Real-time layer:** WebSocket/SSE for live dashboards, stock levels, approval queues, and a notification center with unread badges (spec §56).
- **Executive dashboard:** customizable widget grid (drag/reorder), KPIs + Recharts, date-range + branch filters, drill-through (spec §14).
- **Keyboard-first UX:** shortcuts for every primary action; a discoverable shortcut sheet.

### Phase 3 — Channels & offline (weeks 6–12)
- **PWA:** installable, service worker, app manifest, background sync.
- **Offline-first POS** (spec §30–§31): IndexedDB cart/catalog cache, a durable **sync queue** with **idempotency keys**, conflict handling, "offline" indicator, and a fast touch-optimized register UI. Every transaction carries a globally-unique id so retries never duplicate.
- **Responsive/mobile & touch**; **web push** notifications (approvals, low stock, payments).

### Phase 4 — Intelligence (weeks 10–16)
- **AI assistant panel** (spec §64): natural-language → approved API tools → answer, with the platform's identity/permission/audit flow. "Show today's sales", "Which drinks sell best?", "Create a purchase request" (as a draft requiring human approval).
- **In-context copilots:** form autofill/validation help, anomaly callouts on dashboards, semantic search over products/customers/docs.

### Phase 5 — Platform & extensibility (weeks 14–24)
- **Full i18n** (EN/KM/TH/ZH/VI) with translation keys; **multi-currency** display + FX (spec §83–§84).
- **Theming / white-label** per organization (brand colors, logo) — supports franchise/marketplace tenants.
- **Widget/extension system:** dashboards and reports as pluggable widgets; developer-portal UI for API keys, webhooks, sandbox (spec §58).

### Phase 6 — Visionary (2028 → beyond, directional)
- **Real-time collaboration** (CRDT) on shared docs/orders; presence.
- **Agentic workflows:** AI agents that draft POs / reconcile / triage tickets, gated by human approval (spec §65).
- **Edge & streaming rendering**, voice input for POS/warehouse, AR-assisted stock picking, on-device models for privacy.
- Treat these as a north star; adopt each only when a concrete need and stable primitive exist.

---

## 3. Cross-cutting quality (every phase)

| Dimension | Target |
|---|---|
| **Performance** | Route code-splitting, virtualized lists/tables, image/asset optimization; budget: LCP < 2.5s, INP < 200ms, CLS < 0.1; enforced in CI |
| **Accessibility** | WCAG 2.2 AA, full keyboard nav, focus management in dialogs, ARIA on custom widgets |
| **Security** | No secrets/prices trusted client-side, strict CSP, sanitized rich text, auth on every request, no PII in URLs |
| **Observability** | Real-user monitoring (Web Vitals), error tracking with `requestId` correlation to the backend |
| **Testing** | Component (Vitest), e2e (Playwright) on money/critical paths, visual regression on the design system |
| **i18n-ready** | No hard-coded UI strings; all via translation keys from day one |

---

## 4. Recommended near-term backlog (first 10 tickets)

1. **Phase 0:** decide schema Option A/B; unblock backend writes; verify `POST /sales` end-to-end from the POS page.
2. Build the shared `DataTable` (server pagination/sort/filter, saved views, export) and adopt it on Products + Sales.
3. App shell with permission-aware nav + org/branch switcher.
4. Standard loading/empty/error states + toast error handling wired to the API envelope.
5. Global command palette + global search (permission-scoped).
6. Executive dashboard with real KPIs + Recharts + date/branch filters.
7. Notification center + real-time channel (SSE first, WebSocket later).
8. Offline POS spike: IndexedDB catalog cache + idempotent sync queue.
9. CI pipeline: typecheck → lint → Vitest → Playwright (login/sale/approve) → build, with a perf budget.
10. i18n scaffolding (extract strings, add EN + KM) + multi-currency formatting.

---

## 5. What's needed next

- **Complete Phase 0.5 (Schema Reconciliation)** from the [implementation roadmap](../architecture/implementation-roadmap.md) — Option A is recommended. This unblocks all web features that need to persist data.
- **Prioritize:** which matters most first — *offline POS*, *real-time dashboards*, *AI assistant*, or *design-system polish*? The default sequence above is sensible; adjust if your reality differs (e.g., daily floor sales → offline POS jumps to front).

Any phase can be turned into a concrete, ticket-by-ticket build once the backend writes are unblocked.
