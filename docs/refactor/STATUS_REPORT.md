# Refactor Status Report — Talikha Publishing (Interim)

**Date:** 2026-07-31
**Branch:** `refactor/codebase-optimization` (isolated; based on `release/production-readiness` incl. 3 unpushed commits)
**Base commit (pre-refactor HEAD):** `c00cc3c`
**Current HEAD:** `66fc48e`
**Commits this session:** 20
**Scope note:** This is an **interim** report. Phases 0, 1, 2, 4 and 9 are complete; Phase 3 is partially complete (pure-unit tests done; integration/e2e/RLS tests blocked on a Supabase dev project). Phases 5–8 (architecture, frontend performance, database, feature consolidation) and the final regression pass remain.

---

## 1. Executive summary

**What was done.** A controlled, behavior-preserving refactor of the Talikha Publishing platform, executed in small, individually verified batches on an isolated branch. The work established a reproducible baseline and documentation foundation, grew the automated test safety net, performed mechanical cleanup, and completed a full security review.

**Why.** To make the codebase cleaner, safer, and easier to maintain while proving existing behavior is preserved — per the master instruction's controlled-refactor mandate (no rewrite, no production work, no major upgrades, evidence-based decisions, small verified batches).

**What was intentionally preserved.** All existing features, routes, API success contracts, database structure/values, role permissions, status-transition rules, notification/activity visibility, validation behavior, visual identity, and existing records. The only deliberate behavior changes are the security fixes in Phase 9 (which *tighten* authorization) — each isolated, documented, and owner-approved.

**Measurable improvements.**
- Automated tests: **32 → 89 passing** (5 files).
- Lint warnings: **168 → 143**, **0 errors** throughout.
- Security: **8/8** documented security items resolved (6 fixed, 1 verified already-fixed, 1 owner-accepted with mitigation).
- Two superseded components and several dead declarations removed from the ~7,000-line admin monolith.
- Launch-readiness gate strengthened (now requires `CRON_SECRET` and the Upstash Redis vars for production).

**Remaining risks.** The integration/e2e/RLS test layer is absent (blocked on a Supabase dev project), so the security fixes and protected workflows are verified by type-checking, lint, build, and reasoning — not yet by automated request-level tests. Phases 5–8 (architecture, performance, database, consolidation) are not started. See §6–§8.

## 2. Change inventory (20 commits, grouped)

**Pre-refactor setup**
- `ba58b3d` — Snapshot of pre-existing in-progress submission idempotency + retry work (preserved, isolated; not refactor work).
- `5ca32d0` — Codebase map refresh (tech+arch fast scan).

**Phase 0 — baseline & documentation**
- `d16ca58` — Seven baseline documents in `docs/refactor/`: `BASELINE_REPORT`, `CODEBASE_MAP` (verified 34-table schema inventory), `RISK_REGISTER`, `REFACTOR_PLAN`, `TEST_MATRIX`, `PERFORMANCE_BASELINE`, `REFACTOR_LOG`. (Also includes the environment repair: a corrupt `admin-panel/node_modules` — missing `jszip.min.js` / broken `pako` resolution — fixed via `npm ci --prefix admin-panel`; no version changes, nothing tracked changed.)

**Phase 3 — characterization tests (pure-unit)**
- `789c325` — Submission schema characterization tests (25 tests): `submissionInitSchema`, `submissionCompleteSchema`, `submissionFileRules`.
- `ea7451b` — Citation / author-display / journal-presentation characterization tests (32 tests): APA citation, DOI normalization, author initials, portrait color, journal presentation, archive grouping/sorting, comparators, date formatting.

**Phase 4 — mechanical cleanup**
- `fd24f2b` — Removed 8 stale `eslint-disable` directives (intent comments preserved).
- `c1f4b4a` — Removed unused imports + a dead local type across 6 files.
- `ba1cf28` — Removed 4 dead local declarations from the admin monolith (`submissionStatusOrder`, `updateNamePart`, `publicationCitation` [incl. unreachable code], `currentMonthCount`).
- `6c35864` — Removed superseded `ScheduleView` component (replaced by `FunctionalScheduleView`).
- `2f0801d` — ESLint now ignores `_`-prefixed unused vars/args (intentional discards like `_discardedPdf`).
- `a9c1b3c` — Added `tmp/**` to ESLint `globalIgnores` (scratch scripts no longer crash lint).
- `d2edf54` — Removed superseded `ProductionWorkspace` component (replaced by `ProductionWorkspaceV2`; shared `ProductionViewTabs` helper preserved).

**Phase 9 — security review**
- `893fcad` — **SEC-1:** `/api/admin/dashboard` now requires editor/admin (`requireEditorApi`).
- `0303546` — Full admin-API authorization audit (38 routes); **SEC-3** verified already-fixed.
- `955ca87` — **SEC-8:** `/api/admin/workspace` + `/api/admin/files/[id]` restricted to editor/admin (owner-approved).
- `3ddedf3` — **SEC-7:** `CRON_SECRET` documented in `.env.example` + enforced at the readiness gate.
- `32d9766` — **SEC-2:** hardcoded `jbotoy83@gmail.com` admin bypass removed; allowlist now solely `ADMIN_EMAILS` / `profiles.role` (owner confirmed no lockout).
- `ee56f76` — **SEC-6:** implicit local admin bypass removed; now requires explicit `LOCAL_ADMIN_BYPASS=true`; staging/preview fail closed.
- `15b0601` — **SEC-5:** Upstash Redis vars required at the readiness gate; runtime stays fail-open (availability) but now logs a one-time warning.
- `66fc48e` — **SEC-4:** owner decision recorded — reference-only tracking access accepted, mitigated by mandatory rate limiting.

## 3. Test report

- **Baseline:** 32 tests / 3 files passing. **Now:** 89 tests / 5 files passing.
- **New tests added:** submission schema (25) + citation/author/journal display (32) = 57 characterization tests locking current behavior of pure modules.
- **Pre-existing failures:** none (baseline was green).
- **Gates run after every batch:** root `tsc --noEmit` (0 errors), admin-panel `tsc --noEmit` (0 errors), `eslint .` (0 errors), `vitest run` (all pass), `next build` (pass), and `npm run readiness` where relevant.
- **Manual workflows verified:** none run in a browser this session (no live Supabase/dev servers exercised); verification was static (type/lint/build) plus unit tests.
- **Testing limitation (important):** there are **no integration/e2e/RLS tests**. The root `tsc` does **not** cover `admin-panel/src` (the admin panel has its own typecheck), and the Vite/esbuild build does not type-check — so the admin-panel typecheck and ESLint are the gates that catch admin-panel issues. The security fixes are verified by type-checking the guard wiring and reasoning about role logic, not by automated request tests. This is the single biggest gap to close (Phase 3, blocked on a Supabase dev project).

## 4. Performance comparison

No performance optimizations were made this session (Phases 6–7 not started). A **static baseline was captured** for future comparison (full detail in `PERFORMANCE_BASELINE.md`):

| Asset (admin Vite build) | Size | Gzip |
|---|---|---|
| `index-*.js` (monolith chunk) | 1,066.85 kB | 295.65 kB |
| `lib-*.js` | 497.25 kB | 125.45 kB |
| `jspdf.es.min-*.js` | 352.08 kB | 114.87 kB |
| `html2canvas-*.js` | 199.55 kB | 46.77 kB |
| `index-*.css` | 403.50 kB | 73.97 kB |

Large raster assets emitted: `silk-ember.jpg` 1.79 MB, `chrome-wave.jpg` 1.34 MB, `violet-ribbon.jpg` 768 kB, `ember-orb.jpg` 680 kB. Vite warns the `index`/`lib` chunks exceed 500 kB. Runtime metrics (page load, query/request counts, Web Vitals, rerenders) were **not** measured — they require running apps + Supabase and are deferred to Phase 6/7.

The only performance-adjacent change: removing two dead components slightly reduces the admin bundle (not separately re-measured).

## 5. Database report

- **No database changes were made this session.** No migrations, indexes, RLS policy changes, or storage changes were authored. (The `20260730232338_submission_idempotency.sql` migration present in the tree is the owner's pre-existing in-progress work, snapshotted in `ba58b3d` — not refactor work.)
- **Schema understood:** a verified 34-table inventory plus 9 Postgres functions (incl. `transition_submission`, `allocate_certificate_number`) is documented in `CODEBASE_MAP.md`.
- **RLS:** reviewed conceptually. The admin API uses the service-role client (bypasses RLS), so authorization is enforced in app code via `src/lib/admin-api.ts`; the Phase 9 audit confirmed which routes guard correctly. RLS policy *testing* (anonymous/author/editor/admin) is deferred to the integration-test phase.
- **Data integrity:** untouched — no records, columns, buckets, certificate numbers, DOI/Zenodo data, or files were modified.

## 6. Security report (Phase 9 — complete)

| ID | Issue | Resolution |
|----|-------|-----------|
| SEC-1 | `/api/admin/dashboard` no role check | **Fixed** — `requireEditorApi` (endpoint appears unused/legacy; owner may remove). |
| SEC-2 | Hardcoded `jbotoy83@gmail.com` admin bypass | **Fixed** — removed; allowlist now `ADMIN_EMAILS` / `profiles.role` (owner confirmed no lockout). |
| SEC-3 | Viewer workflow-file upload | **Verified already-fixed** (audit was stale). |
| SEC-4 | Reference-only tracking exposes signed file URLs | **Owner-accepted** — reference-only access kept; mitigated by mandatory rate limiting. |
| SEC-5 | Rate-limit fails open without Redis | **Mitigated** — Redis required at readiness gate; runtime fail-open preserved + logged. |
| SEC-6 | Implicit local admin bypass | **Fixed** — explicit `LOCAL_ADMIN_BYPASS=true` only; staging/preview fail closed. |
| SEC-7 | Undocumented `CRON_SECRET` | **Fixed** — documented + enforced at readiness gate. |
| SEC-8 | Viewer read access to workspace + files | **Fixed** (owner-approved) — editor/admin only. |

Plus a full 38-route admin-API authorization audit (documented in `RISK_REGISTER.md`).

## 7. Remaining technical debt (by priority)

**High**
- **Integration/e2e/RLS test coverage** (PLAT-3 / FRAG-1/2/3): no automated tests for admin authorization, the editorial workflow state machine, submission flow, payment gates, certificate issuance, or RLS. **Blocked on a Supabase dev project + credentials.** This is the key enabler for safely doing Phases 5–8.
- **Fragile areas** needing integration tests before refactoring: editorial workflow (`FRAG-1`), multi-step submission + browser staging (`FRAG-2`), certificate generation pipeline (`FRAG-3`).

**Medium**
- **Performance** (`PERF-1` unbounded admin workspace read model; `PERF-2` ~1.07 MB admin bundle; `PERF-3` full-file signature validation; `PERF-4` unbounded base64 image handling) — Phase 6/7, measured.
- **Dual journal state model** (`FRAG-4`) — Phase 8.
- **Admin monolith** — `admin-panel/src/main.tsx` is ~7,000 lines; modularization is Phase 5.
- **Two submission implementations** (PLAT-5): `LocalSubmissionForm` (active) vs legacy `SubmissionForm`.
- **Install/version skew** (PLAT-1): two package manifests with caret ranges + nested install; root and admin TypeScript on different majors.
- **Readiness script Supabase var-name bug:** `check-launch-readiness.mjs` checks `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` instead of the runtime `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (documented; left untouched per change-isolation).

**Low**
- Cosmetic SPA display fallbacks using `jbotoy83`/`jbotoy83@gmail.com` (`admin-panel/src/main.tsx`) — not a security issue.
- Remaining documentation/map drift (largely addressed this session).
- Optional further hardening: restrict the local admin bypass to loopback requests (SEC-6 follow-up); a second factor for tracking (SEC-4, declined for now).

## 8. Deployment recommendation

**STAGING REQUIRES SPECIFIC VERIFICATION.**

The 20 commits are behavior-preserving (except the intended Phase 9 authorization tightening), and all static gates are green. The branch is safe to merge to a staging/review branch. **Before any production deployment**, the following must be confirmed in staging with a real Supabase project:

1. **Owner admin access still works** after SEC-2 (the owner's sign-in email is in `ADMIN_EMAILS` and/or their profile `role` is `admin`).
2. **Viewer restriction behaves as intended** after SEC-8 (viewers get 403 on workspace/files; the admin SPA handles 401 but not 403, so a viewer currently falls back to prototype data — a UX follow-up, not a security issue).
3. **Production env has `CRON_SECRET` and the Upstash Redis vars set** (now enforced by the readiness gate; without them the cron 401s and rate limiting fails open).
4. **`LOCAL_ADMIN_BYPASS` is false/unset in production and staging** (SEC-6).

The **full refactor is not complete** (Phases 5–8 and the integration-test layer remain), so this is not a final production-readiness sign-off.

## 9. Recommended next steps (sequencing)

1. **Set up the integration-test infrastructure** (owner provides a Supabase dev project + credentials) — this unblocks safe progress on everything below and lets us verify the Phase 9 security fixes end-to-end.
2. **Phase 3 integration/e2e/RLS tests** for the protected workflows (authorization, editorial workflow, submission flow, certificates) — per `TEST_MATRIX.md`.
3. **Phase 5 monolith modularization** (lowest-risk extractions first, each verified).
4. **Phase 8 feature consolidation** (single authoritative workflow/notification/activity logic).
5. **Phase 6/7 measured performance + database optimization** (only with before/after metrics).
6. **Final regression pass + final report** per the master instruction §18–§20.

---

*Prepared 2026-07-31. Living document; see `REFACTOR_LOG.md` for the per-batch record and `RISK_REGISTER.md` for the current risk posture.*
