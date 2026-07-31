# Refactor Log — Talikha Publishing

Running chronological log of the controlled refactor. One entry per meaningful action. Newest at the bottom.

Format per entry: date · action · files/area · evidence · result.

---

## 2026-07-31

### 1. Session start — codebase map refresh (fast scan)
- **Action:** Ran a GSD fast scan (`tech+arch` focus) to refresh the codebase map before starting.
- **Files:** `.planning/codebase/STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md` (regenerated).
- **Result:** Map refreshed and dated 2026-07-31. Per the GSD mapper rule, this map is reused throughout the refactor and only the affected sections will be updated later.

### 2. Repository safety checks (Phase 0)
- **Action:** Confirmed branch, working-tree status, HEAD, remotes, tooling.
- **Evidence:** Branch was `release/production-readiness`, 3 commits ahead of `origin`, HEAD `c00cc3c`. Working tree was **dirty** with pre-existing in-progress work (see entry 3). Node v24.16.0, npm 11.13.0, npm lockfile present.
- **Result:** Identified a blocker (dirty tree) and resolved it with the owner's decision before branching.

### 3. Preserved pre-existing in-progress work (owner-approved snapshot)
- **Action:** The tree contained an in-progress **submission idempotency + retry** feature (changes to `src/app/api/submissions/init/route.ts`, `complete/route.ts`, `src/components/local-submission-form.tsx`, `src/lib/submission.ts`, plus new migration `supabase/migrations/20260730232338_submission_idempotency.sql`) and four deleted `author-profile-*.webp` assets. With owner approval, snapshot-committed this work to preserve and isolate it.
- **Diff review:** No secrets, no debug/temp code. Migration is additive and backward-compatible (`add column if not exists idempotency_key text;` + partial unique index `where idempotency_key is not null`).
- **Commit:** `ba58b3d` — `wip: snapshot submission idempotency and retry work (pre-refactor baseline)`.
- **Result:** In-progress work preserved as one clearly-labeled commit, isolated from refactor commits.

### 4. Committed codebase-map refresh separately
- **Commit:** `5ca32d0` — `docs: refresh codebase map (tech+arch fast scan)` (the 4 regenerated `.planning/codebase/*.md`).
- **Result:** One concern per commit maintained.

### 5. Created refactor branch
- **Action:** `git checkout -b refactor/codebase-optimization` from the current branch (including the 3 unpushed local commits, per owner choice).
- **Result:** On `refactor/codebase-optimization`; working tree clean except untracked `.claude/` tooling (intentionally not staged).

### 6. Baseline verification gates
- **Action:** Ran typecheck, lint, test, build.
- **Results:** typecheck PASS (0 errors); lint PASS (0 errors, 168 warnings); test PASS (32/32 in 3 files); build initially FAILED (environment), then PASS after repair (entry 7).
- **Result:** Green baseline established. See `BASELINE_REPORT.md`.

### 7. Environment repair — corrupt admin-panel node_modules (non-code)
- **Problem:** `npm run build` failed in the admin Vite step: `Could not load node_modules/jszip ... Access is denied (os error 5)`, then `failed to resolve import "pako" from fast-png`.
- **Diagnosis:** No dev server running (only opencode MCP tooling). Root `jszip` healthy. `admin-panel/node_modules/jszip/dist/jszip.min.js` was **missing**; `pako` was present but unresolvable from `fast-png`. Conclusion: partially corrupt/incomplete nested install in `admin-panel/node_modules`.
- **Repair:** (a) copied the missing `jszip.min.js` from the identical healthy root install (both 3.10.1); (b) clean reinstall `npm ci --prefix admin-panel --no-audit --no-fund` → 177 packages, exit 0.
- **Safety:** `node_modules` is gitignored; exact locked versions (no upgrade); no code/lockfile/DB/env changed.
- **Result:** `npm run build` now PASSES (exit 0). Documented in `BASELINE_REPORT.md` §4 and `RISK_REGISTER.md`.

### 8. Established baseline documentation
- **Action:** Created `docs/refactor/` and authored the Phase 0 baseline documents: `BASELINE_REPORT.md`, `REFACTOR_LOG.md`, `RISK_REGISTER.md`, `REFACTOR_PLAN.md`, `CODEBASE_MAP.md`, `TEST_MATRIX.md`, `PERFORMANCE_BASELINE.md`.
- **Result:** Phase 0 deliverables complete; ready to proceed to Phase 2/3.

### 9. Phase 3 — submission schema characterization tests (T-SUB-1)
- **Action:** Added `src/__tests__/submission-schema.test.ts` characterizing the current behavior of `submissionInitSchema`, `submissionCompleteSchema`, and `submissionFileRules` in `src/lib/submission.ts`. Coverage: idempotency-key UUID requirement; working-title trim + min/max; `publicationType` enum (case-sensitive); `consent` literal-true; `website` honeypot (must be empty); author email + `authorDetails` bounds (1–12); payment method/reference custom messages; and the file `superRefine` rules (exactly one manuscript and one payment proof; per-field size/type limits; file-key format; 14-file cap; author photos optional). Exact messages asserted only where the code defines them; boolean pass/fail elsewhere to avoid zod-version brittleness.
- **Verification:** `npm run test` → **57 passed** (32 existing + 25 new) across 4 files. `npm run typecheck` → 0 errors. `npm run lint` → unchanged 168 warnings / 0 errors (test file adds no new issues).
- **Result:** Submission-intake validation is now protected by characterization tests. **No production code changed.**

### 10. Phase 3 — public display formatting characterization tests
- **Action:** Added `src/__tests__/display-formatting.test.ts` characterizing three pure public-display modules: `src/lib/apa-citation.ts` (APA-7 author / author-list formatting, DOI URL normalization, full journal citation including DOI-over-source-URL precedence and the `n.d.` year fallback), `src/lib/author-display.ts` (author initials including `et al.` stripping and comma/surname-first handling; deterministic portrait color), and `src/lib/journal-presentation.ts` (InQuira/Lumera/fallback presentation, archive issue labels, archive grouping + sorting, newest-first and engagement comparators, publication-date formatting). The locale-sensitive full-date format is asserted loosely (year-bearing, non-ISO) to avoid environment flakiness; the deterministic `year`-precision branch is asserted exactly.
- **Verification:** `npm run test` → **89 passed** (57 + 32 new) across 5 files. `npm run typecheck` → 0 errors. `npm run lint` → unchanged 168 warnings / 0 errors (test file adds no new issues).
- **Result:** Public citation / author / journal-display behavior is now protected by characterization tests. **No production code changed.**

### 11. Phase 4 — remove stale eslint-disable directives (mechanical cleanup)
- **Action:** Converted 8 stale `// eslint-disable-next-line react-hooks/... -- <reason>` directives into plain `// <reason>` comments across `admin-panel/src/main.tsx` (4 sites) and `admin-panel/src/components/certificates/certificate-workspace.tsx` (1 site). ESLint reported these directives as unused ("no problems were reported"), so the underlying rules no longer fire there; removing the directive clears the warning without creating a new one, while the plain comment preserves the original intent (e.g. "allowedViews is derived from isAdmin; including it would cause infinite loop"). An initial `eslint --fix` was rejected because it left trailing-whitespace-only lines and discarded the intent comments; the manual conversion yields a clean 8-line diff.
- **Verification:** `npm run lint` → **160 warnings** (down from 168), **0 unused-disable directives remaining**, 0 errors. `npm run typecheck` → 0 errors. `npm run test` → 89 passed. The remaining 160 warnings are pre-existing `react-hooks` warnings (set-state-in-effect / refs / preserve-manual-memoization) in the admin monolith — Phase 5/6 territory, not mechanical cleanup.
- **Result:** Lint gate is cleaner and intent documentation is preserved. Comment-only change; **no behavior change.**

### 12. Phase 4 — remove unused imports and a dead local type (mechanical cleanup)
- **Action:** Removed 8 genuinely-unused symbols flagged by `@typescript-eslint/no-unused-vars`, each verified as neither used nor re-exported (typecheck is the safety net — removing a used import would fail it):
  - `src/lib/search.ts`: `getJournals` import (`searchPublications` only calls `getPublications`).
  - `src/lib/content.ts`: `demoJournals` import + unused local `type IssueRow`.
  - `src/lib/render-certificate.ts`: `certificateBlockText` import.
  - `src/components/certificates/template-editor.tsx`: `ArrowDownToLine`, `ChevronDown` icon imports.
  - `src/components/search-interface.tsx`: `Pagination` wrapper import (its sub-components remain in use).
  - `src/__tests__/workflow-transitions.test.ts`: unused `type WorkflowStage` import.
- **Deliberately deferred (not in this batch):** the ~18 unused components/functions inside the 7,000-line `admin-panel/src/main.tsx` monolith (e.g. `ProductionWorkspace`, `ScheduleView`, `CertificatesWorkspace`, `markForApproval`, `publishSubmission`) — these require rigorous per-item dead-code verification (§7.2) and may be intentional WIP; and the `icon.tsx` `MinusIcon` import (icon registries often keep intentional inventory). Tracked for Phase 5/8.
- **Verification:** `npm run typecheck` → 0 errors; `npm run lint` → **152 warnings** (down from 160), no-unused-vars **51 → 43**, 0 errors; `npm run test` → 89 passed; `npm run build` → PASS.
- **Result:** 8 dead symbols removed across 6 files; **no behavior change.**
