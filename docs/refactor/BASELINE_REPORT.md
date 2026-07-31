# Baseline Report — Talikha Publishing Refactor

**Date:** 2026-07-31
**Branch:** `refactor/codebase-optimization`
**Base branch:** `release/production-readiness` (included 3 unpushed local commits)
**Pre-refactor HEAD:** `c00cc3c` ("Preserve and manage publication attachments")
**First refactor-branch commits:** `ba58b3d` (WIP snapshot), `5ca32d0` (map refresh)
**Purpose:** Record the verified, pre-refactor state of the codebase so every later change can be compared against a known-good baseline. Nothing in this report was "fixed" during baseline capture except one environment-only repair (documented below).

---

## 1. Environment

| Item | Value |
|---|---|
| OS | Windows (win32) |
| Node.js | v24.16.0 |
| npm | 11.13.0 |
| Package manager | npm (`package-lock.json` present; no yarn/pnpm/bun lockfiles) |
| Deployment | Vercel (`vercel.json`: daily cron `/api/cron/journal-lifecycle`, no-index/no-store headers on `/admin`) |
| Backend | Supabase (project ref via env; region ap-southeast-1 per `.env.example`) |
| Apps | Next.js 16 public site (root `src/`) + Vite/React 19 admin SPA (`admin-panel/`) |

## 2. Verification Gate Results (baseline)

All four gates were run from the repo root using the project's own scripts.

| Gate | Command | Result | Detail |
|---|---|---|---|
| Type check | `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 TypeScript errors |
| Lint | `npm run lint` (`eslint .`) | **PASS (with warnings)** | 0 errors, **168 warnings** |
| Unit tests | `npm run test` (`vitest run`) | **PASS** | 3 test files, **32 tests passed**, 0 failed (~2.6s) |
| Production build | `npm run build` (`build:admin` → `copy:admin` → `next build`) | **PASS** | Succeeded after the environment repair in §4 |

**Conclusion:** The baseline is green across all gates. Any new failure introduced during the refactor is therefore clearly attributable to the change that caused it.

### 2.1 Lint warning inventory (pre-existing, not fixed at baseline)

`eslint .` reports **168 warnings, 0 errors**. The dominant category is:

- `Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')`
- `Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')`

These are concentrated in the large admin workspace file `admin-panel/src/main.tsx` (line numbers in the 500–7200 range) and a few other admin components. They indicate stale `// eslint-disable` comments left behind after the `react-hooks` plugin became resolvable. 8 warnings are auto-fixable with `--fix`.

> These warnings are recorded as pre-existing. Removing stale disable directives is a valid Phase 4 mechanical-cleanup task, but it was intentionally not done during baseline capture.

## 3. Pre-existing issues recorded (NOT introduced, NOT silently fixed)

These were observed during baseline capture and are documented here rather than fixed, per the rule against silently fixing unrelated errors during baseline.

1. **`npm run readiness` uses wrong Supabase variable names.** `scripts/check-launch-readiness.mjs` checks for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`, while runtime code and `.env.example` use `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. Readiness can report false negatives. (Also noted in `.planning/codebase/CONCERNS.md`.)
2. **168 lint warnings** (see §2.1).
3. **Codebase-map drift.** `.planning/codebase/CONCERNS.md` and `TESTING.md` (dated 2026-07-30) claim "lint command is currently broken" and "25 Vitest tests in one file." Both are now stale — see §5 corrections.
4. **Known security gaps** documented in `.planning/codebase/CONCERNS.md` (hardcoded admin allowlist bypass, viewer can upload workflow files, reference-only tracking exposes signed URLs, rate limiting fails open without Redis, implicit local admin bypass, undocumented `CRON_SECRET`, unauthenticated `/api/admin/dashboard`). These are carried into `RISK_REGISTER.md` and Phase 9; none were touched at baseline.

## 4. Environment repair performed during baseline (non-code, not tracked in git)

The production build initially **failed** in the admin-panel Vite step. Diagnosis and resolution:

**Symptom 1:** `Could not load node_modules/jszip ... Access is denied. (os error 5)` while bundling `mammoth` (the `.docx` preview library).

**Symptom 2 (after addressing symptom 1):** `Rolldown failed to resolve import "pako" from ".../admin-panel/node_modules/fast-png/lib-esm/PngEncoder.js"`.

**Root cause:** `admin-panel/node_modules` was in a **partially corrupt / incomplete install state**:
- `admin-panel/node_modules/jszip/dist/jszip.min.js` was missing (present in the healthy root `node_modules/jszip`). jszip's `package.json` `browser` field remaps its entry to `./dist/jszip.min.js`, so the browser-targeted admin build resolved straight into the missing file.
- `pako` (required by `fast-png` at v2, while `jszip` uses pako v1) was present at top level but not resolvable from `fast-png`, indicating a broken hoisting/nesting state.
- No Talikha dev server was running (the only node processes were opencode MCP tooling). The likely original cause is an interrupted or antivirus-affected nested install (the root `postinstall` runs `npm install --prefix admin-panel`).

**Repair:**
1. First restored the single missing `jszip.min.js` by copying it from the identical healthy root install (both jszip `3.10.1`) — a surgical, reversible step that proved the files were writable.
2. Then performed a clean, reproducible reinstall of the admin-panel dependencies from its existing lockfile: `npm ci --prefix admin-panel --no-audit --no-fund` → "added 177 packages in 17s", exit 0.

**Why this is safe / in scope:**
- `node_modules/` is gitignored — nothing tracked in git changed.
- `npm ci` installs the **exact locked versions**; this is install-integrity repair, **not** a dependency upgrade or change.
- No source code, lockfile, database, or environment variable was modified.

**Follow-up recommendation (owner):** If this recurs, add the project folder / `node_modules` to Windows Defender exclusions and prefer lockfile-only installs (`npm ci`) in CI. See `RISK_REGISTER.md` (install-integrity risk).

## 5. Codebase-map staleness corrections

The `.planning/codebase/` docs (some dated 2026-07-30) were compared against fresh measurements. Corrections to carry forward:

| Stale claim | Current reality (measured 2026-07-31) |
|---|---|
| "Lint command is currently broken (react-hooks plugin unavailable)" | Lint **passes**; the `react-hooks` plugin resolves. The 168 warnings are *unused* eslint-disable directives. |
| "25 Vitest tests in one file" | **32 tests across 3 files**: `src/__tests__/workflow-transitions.test.ts`, `src/__tests__/publication-preflight-rules.test.ts`, `src/__tests__/citation-format.test.ts`. |
| "No test framework exists" (older AGENTS.md/TESTING.md phrasing) | Vitest (unit) and Playwright (e2e) are configured and have runnable scripts. |

Per the project's own rule ("if the map disagrees with the code, the code wins — then update the map"), these corrections are noted here and should be reflected in `.planning/codebase/` during Phase 1 consolidation.

## 6. Route inventory (from `next build` output)

Captured from the successful production build. `○` = prerendered static, `ƒ` = server-rendered on demand.

**Admin API (service-role; must be guarded by `src/lib/admin-api.ts`):**
`/api/admin/certificates/*` (templates, assets, background, from-submission, imports, records, records/[recordId], records/[recordId]/issue, records/[recordId]/use-author-photo), `/api/admin/dashboard`, `/api/admin/featured`, `/api/admin/files/[id]`, `/api/admin/logout`, `/api/admin/submissions/[id]` (+ `advance`, `assignment`, `checklist`, `payment/confirm`, `preflight`, `preflight/checks/[checkId]`, `preflight/submit`, `priority`, `publication-actions`, `publication-record`, `requests`, `requests/[rid]/close`, `reschedule`, `review-settings`, `transition`), `/api/admin/workflow-files`, `/api/admin/workspace`.

**Public API:** `/api/announcements`, `/api/cron/journal-lifecycle` (Vercel cron), `/api/journal-store`, `/api/publications/[slug]/pdf`, `/api/publications/[slug]/view`, `/api/search`, `/api/submissions/init`, `/api/submissions/complete`, `/api/track`, `/api/track/requests/respond`.

**Auth:** `/auth/callback`.

**Public pages:** `/authors` ○, `/authors/[slug]` ƒ, `/certificate-access/[token]` ƒ, `/editorial-standards` ○, `/faq` ○, `/journals` ○, `/journals/[slug]` ƒ, `/journals/[slug]/issues/[volume]/[issue]` ƒ, `/publications` ƒ, `/publications/[slug]` ƒ, `/search` ○, `/services` ○, `/submit` ƒ, `/terms` ○, `/track` ○, `/privacy` ○.

**Meta/feeds:** `/feed.xml` ƒ, `/icon.svg` ○, `/llms.txt` ƒ, `/manifest.webmanifest` ○, `/robots.txt` ○, `/sitemap.xml` ○.

**Middleware:** `src/proxy.ts` (Supabase session refresh + `/admin` auth redirect + security/SEO headers).

> The admin SPA itself is **not** a Next route — it is the Vite build copied to `public/admin/` and served under `/admin` via rewrites in `next.config.ts`.

## 7. Bundle & asset summary (baseline)

Full detail in `PERFORMANCE_BASELINE.md`. Headline figures from the admin Vite build:

- `index-*.js` **1,066.85 kB** (gzip 295.65 kB) — the monolith chunk; Vite warns >500 kB.
- `lib-*.js` 497.25 kB (gzip 125.45 kB)
- `jspdf.es.min-*.js` 352.08 kB; `html2canvas-*.js` 199.55 kB; `index.es-*.js` 151.35 kB
- `index-*.css` 403.50 kB (gzip 73.97 kB)
- Large raster assets emitted: `silk-ember.jpg` 1.79 MB, `chrome-wave.jpg` 1.34 MB, `violet-ribbon.jpg` 768 kB, `ember-orb.jpg` 680 kB; `Oswald-Variable.ttf` 172 kB.

## 8. Baseline acceptance

- [x] Branch created and isolated (`refactor/codebase-optimization`)
- [x] Working tree clean (only untracked `.claude/` tooling, intentionally excluded)
- [x] Type check passes
- [x] Lint passes (warnings inventoried)
- [x] Unit tests pass (32/32)
- [x] Production build passes (after documented environment repair)
- [x] Pre-existing issues documented, not silently fixed
- [x] Route inventory captured
- [x] Bundle/asset baseline captured
