# Performance Baseline — Talikha Publishing Refactor

**Last updated:** 2026-07-31
**Purpose:** Record measurable pre-refactor performance figures so improvements are proven, not claimed (master instruction §14). Only report what was measured; do not invent percentages.

---

## 1. What was measured (static build baseline)

Captured from the successful `npm run build` (admin Vite build → copy → Next build) on branch `refactor/codebase-optimization`.

### 1.1 Admin SPA bundle (Vite/rolldown output)

| Asset | Size | Gzip |
|---|---|---|
| `index-*.js` (monolith chunk) | **1,066.85 kB** | 295.65 kB |
| `lib-*.js` | 497.25 kB | 125.45 kB |
| `jspdf.es.min-*.js` | 352.08 kB | 114.87 kB |
| `html2canvas-*.js` | 199.55 kB | 46.77 kB |
| `index.es-*.js` | 151.35 kB | 48.89 kB |
| `purify.es-*.js` | 26.87 kB | 10.45 kB |
| `typeof-*.js` | 0.27 kB | 0.16 kB |
| `index-*.css` | **403.50 kB** | 73.97 kB |

**Vite warning:** "Some chunks are larger than 500 kB after minification" — the `index` and `lib` chunks. This is the large-admin-bundle concern (RISK_REGISTER PERF-2).

### 1.2 Admin fonts & images emitted

| Asset | Size |
|---|---|
| `silk-ember.jpg` | 1,789.46 kB |
| `chrome-wave.jpg` | 1,343.68 kB |
| `violet-ribbon.jpg` | 768.02 kB |
| `ember-orb.jpg` | 680.40 kB |
| `Oswald-Variable.ttf` | 172.08 kB |
| `newsreader-latin-wght-normal.woff2` | 58.08 kB |
| `inter-latin-wght-normal.woff2` | 48.25 kB |
| `newsreader-latin-ext-wght-normal.woff2` | 36.24 kB |
| `GlacialIndifference-Regular.woff` | 22.88 kB |
| `GlacialIndifference-Bold.woff` | 16.27 kB |
| `newsreader-vietnamese-wght-normal.woff2` | 11.93 kB |

> The four large `.jpg` wallpapers (>680 kB each) are candidate assets for optimization/compression in Phase 6, preserving visual quality and dimensions.

### 1.3 Next.js public site

The `next build` completed and emitted the full route table (see `BASELINE_REPORT.md` §6) with static vs dynamic classification. Per-route bundle sizes were not separately captured in this baseline; capture them in a follow-up if page-level JS becomes a refactor target.

## 2. Known performance bottlenecks (from `.planning/codebase/CONCERNS.md`)

| ID | Bottleneck | Files | Improvement path |
|----|-----------|-------|------------------|
| PERF-1 | Unbounded admin workspace read model (loads all collections in parallel; no limit/cursor) | `src/app/api/admin/workspace/route.ts:16-25`, `admin-panel/src/main.tsx` | Split by workspace; paginate; select view-specific fields; lazy-load certificates/media |
| PERF-2 | Large admin client bundle (~1.07 MB main chunk; eager PDF/editor/doc-parse) | `admin-panel/src/main.tsx`, `certificate-workspace.tsx`, `vite.config.ts` | Route/view-level dynamic imports; keep PDF/editor tooling out of initial chunk |
| PERF-3 | Full-file signature validation on completion (downloads + reads whole blob) | `src/app/api/submissions/complete/route.ts:44-70` | Bound file count; inspect header bytes only; async validation for large files |
| PERF-4 | Unbounded base64 image handling in journal sync | `src/app/api/journal-store/route.ts:87-105,212-246` | Enforce byte/dimension limits before decode; signed uploads for large assets |

## 3. What was NOT measured (requires running apps + Supabase)

These require the dev servers and a configured Supabase project; they were **not** captured in this static baseline and must be measured before/after any performance change:

- Critical-page load time (LCP/TTI) for public pages and `/admin`.
- Core Web Vitals / Lighthouse scores.
- Database query counts per critical workflow (submission, workspace load, transition).
- API request counts per critical page (duplicate/waterfall requests).
- Client-side rerender counts (React profiler).
- Runtime memory / leaks in the admin SPA.
- Real-time subscription load.

**Rule:** When a Phase 6/7 change claims an improvement, capture the relevant metric before and after with the same method, and record both here. Do not report unsupported estimates.

## 4. Acceptance criteria (master instruction §14)

The refactor must not cause: increased critical-page load without justification; increased bundle size without justification; increased DB query counts; increased API request counts; increased layout shift; increased rerenders; new memory leaks; new console/hydration errors; new failed requests; new slow queries; new a11y failures; reduced visual quality; reduced upload reliability.

Preferred (measured) outcomes: fewer duplicate requests; smaller client bundles; faster dashboard render; more efficient Supabase queries; reduced rerenders; faster navigation; lower repeated computation; consistent caching; better error recovery; clearer module ownership.
