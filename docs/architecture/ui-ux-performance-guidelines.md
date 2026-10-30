# UI/UX Design System & Frontend Performance Guidelines

Binding standard for every frontend in `apps/*` (canonical: `apps/web`). It complements principles 87–90 of
[`90-engineering-principles.md`](90-engineering-principles.md). Goal: clean, dense, operational UIs that hold 60fps.

## 1. Tokens — never hardcode colors

All colors come from the semantic tokens in `apps/web/app/globals.css`, exposed to Tailwind in `tailwind.config.ts`.

| Use | Tailwind class | Token |
|---|---|---|
| Surfaces, text, borders | `bg-background` `bg-card` `bg-muted` `text-foreground` `text-muted-foreground` `border-border` | `--background` … `--border` |
| The one brand color | `bg-primary` `text-primary` `ring-ring` | `--primary` |
| **Status only** (never decoration) | `bg-destructive` `text-success` `bg-warning` `text-info` (+ `/10`…`/90` opacity) | `--destructive` `--success` `--warning` `--info` |

- ❌ `bg-[#ff007a]`, `style={{ color: '#22c55e' }}`, `text-emerald-500` for a status.
- ✅ `text-success`, `bg-destructive/10 text-destructive`.
- Exception: data-viz series colors and brand logos (Telegram, ABA, Bakong) may use literal colors — keep them in one
  constant per feature, not inline.

## 2. Density & elevation
- Dividers `border-border`; elevation `shadow-sm` at most for cards. `shadow-xl/2xl` only for floating layers (menus, dialogs).
- Spacing on the 4px grid: `1 2 3 4 6 8` (4–32px). No arbitrary `p-[13px]`.
- Fonts: Inter (`font-sans`) + JetBrains Mono (`font-mono`). Money, dates and IDs use `.figure` (mono + tabular digits).

## 3. Data display
- Lists/tables > 50 rows: paginate server-side (cursor) or virtualize (`@tanstack/react-virtual`). Never render 1,000 DOM rows.
- Use `components/ui/table.tsx`: header is sticky by default; pass `<Table fixed>` with explicit header widths for
  frequently-updating tables. Memoize row components (`React.memo`) when rows receive live updates.
- No `backdrop-blur` on repeated elements (cards, rows, toasts). One blur per screen at most (e.g. a modal overlay).

## 4. Motion
| Allowed | Value |
|---|---|
| State transitions | `transition` / `transition-colors` — defaults are 150ms + `cubic-bezier(0.16,1,0.3,1)` |
| Duration tokens | `duration-fast` 120ms · `duration-base` 150ms · `duration-panel` 200ms (sheets, dialogs, toasts) |
| Press feedback | `active:scale-[0.98]` (built into `<Button>`) |
| Live-data cue | `animate-live-flash` — one 800ms tint when a realtime update lands |
| Loading | `<Skeleton>` shaped like the content (zero CLS); `animate-spin` only inside a button/inline status |

Forbidden: entrances > 200ms, `animate-bounce`, staggered table fade-ins, continuous decorative motion, animating
`width/height/top/left/margin/padding`. `transition-all` is **remapped** in `tailwind.config.ts` to colors, opacity,
shadow and transform only — width/height changes snap. For progress bars animate `transform: scaleX()` instead of width.
`prefers-reduced-motion` disables all motion globally (`globals.css`).

## 5. Data & realtime
- Server state through TanStack Query (already a dependency): cached data first, revalidate in the background.
- Mutations are optimistic: update the cache in `onMutate`, roll back in `onError`, toast with a Retry action.
- Realtime via the existing SSE/WebSocket bus; batch bursts into one render per frame (`requestAnimationFrame`)
  before writing to the query cache, then flash the changed row.

## 6. Checklist for every new screen
1. Semantic HTML (`main`, `nav`, `aside`, `table`, `article`); every icon-only button has `aria-label`.
2. Fully keyboard reachable; focus ring visible (`focus-visible:ring-2 ring-ring`).
3. Headless primitives from `components/ui` (Radix/shadcn) — no heavyweight UI kits.
4. Presentation components are pure; data fetching lives in hooks (`useXxxQuery`) or the page shell.
5. No new hex literals — enforced per file by `pnpm ui:check` (baseline: `apps/web/ui-token-baseline.json`).
   After burning debt down, run `node scripts/check-ui-tokens.mjs --update` to lock the gain in.

## 7. Current debt (measured 2026-10-29, `apps/web`)

| Metric | Count | Hotspots |
|---|---|---|
| Hex literals in `.tsx` | See `apps/web/ui-token-baseline.json` | Consumer surfaces (`app/mini`, `app/driver`), the printable invoice, chart and node series colors |
| `backdrop-blur` | 40 | infra views, mini app |
| `animate-pulse` / `animate-spin` / `animate-ping` | 43 / 36 / 8 | review for decorative use |
| `<table>` elements / virtualized lists | 42 / 0 | large lists in sales, inventory, infra logs |

Burn this down file by file when touching a screen — do not mass-rewrite.
