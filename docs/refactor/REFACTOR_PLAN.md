# Refactor Plan — Talikha Publishing

**Last updated:** 2026-07-31
**Branch:** `refactor/codebase-optimization`
**Objective:** Improve code quality, maintainability, consistency, reliability, security, and performance **without** changing existing features, workflows, routes, API contracts, data structures, permissions, or user-visible behavior. This is a controlled refactor, not a rewrite.

---

## 1. Non-negotiable guardrails

1. **Preserve behavior.** No changes to features, business rules, workflows, route paths, API request/response contracts, DB relationships/values, role permissions, status transitions, notification/activity visibility, validation behavior, layout/visual identity, labels, existing records, certificate numbers, DOI/Zenodo data, uploaded files, sessions, or production env vars — unless a defect is separately documented and approved.
2. **No rewrite.** No replacing the framework, database, auth provider, or deployment platform. Improve incrementally.
3. **No production work.** Stay on `refactor/codebase-optimization`. No manual production DB changes, no table resets/recreation, no bucket replacement, no env overwrites, no auto-deploy to production, no force-push.
4. **No major upgrades.** No major-version bumps of Next.js/React/Supabase/TypeScript/Tailwind/UI libs/auth libs/build tools/test frameworks unless a specific dependency is broken/insecure/blocking.
5. **Evidence-based.** Inspect the repo before deciding. No assumptions about router, package manager, Supabase patterns, unused modules/tables/env vars, or public vs protected routes.
6. **Small verified batches.** One concern per commit; verify after each batch; never modify dozens of unrelated files in one change.

## 2. Phase sequence

| Phase | Goal | Status |
|---|---|---|
| **0 — Protection & baseline** | Branch, baseline gates, baseline docs | **Done** (see `BASELINE_REPORT.md`) |
| **1 — Map codebase** | Consolidate structural map; reuse `.planning/codebase/` | In progress (`CODEBASE_MAP.md`) |
| **2 — Identify critical behavior** | Enumerate protected workflows that actually exist | Pending |
| **3 — Safety test suite** | Characterization tests (unit/integration/e2e/contract) protecting Phase 2 behavior | Pending |
| **4 — Mechanical cleanup** | Unused imports/code, centralize constants/types, remove stale lint disables | Pending |
| **5 — Architectural refactor** | Split large components; centralize business logic, data access, validation, error handling | Pending |
| **6 — Frontend optimization** | Measured rendering/network/bundle/asset/CSS improvements | Pending |
| **7 — Supabase/backend optimization** | Query/index/RLS/storage review (high risk; additive migrations only) | Pending |
| **8 — Feature consolidation** | One authoritative workflow/notifications/activity/journal/upload/certificate logic | Pending |
| **9 — Security review** | Isolated, documented fixes for `RISK_REGISTER.md` SEC-* | Pending |
| **V — Verification & report** | Full regression matrix + final deliverables | Pending |

## 3. Recommended commit sequence (per concern)

```
1. test: establish characterization coverage
2. refactor: mechanical cleanup
3. refactor: centralize shared types and constants
4. refactor: consolidate validation
5. refactor: consolidate data access
6. refactor: modularize large components
7. perf: optimize frontend rendering
8. perf: optimize Supabase queries
9. security: harden authorization and validation
10. docs: finalize architecture and verification reports
```

Commit message rules: specific concern (`refactor: centralize notification event formatting`), never vague (`cleanup`, `fix stuff`, `refactor everything`). Before each commit: review full diff, remove formatting noise/debug/temp logs, confirm no secrets, run relevant tests, manually confirm the changed workflow, update `REFACTOR_LOG.md`.

## 4. Verification gates (run after every batch)

Minimum: lint · typecheck · unit tests · production build · dev startup · console/network/DB errors · role-permission checks · visual comparison.

Project commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run check` (typecheck+lint+build). Admin typecheck: `cd admin-panel; npm run typecheck`.

**Rule:** Do not proceed when a new failure appears. A pre-existing failure may remain only if it is recorded in `BASELINE_REPORT.md`, not worsened, unrelated to the change, and documented in the final report.

## 5. Database rules (Phase 7)

- Version-controlled migration; backward compatible; non-destructive; preserves records; rollback instructions; tested in dev first; logged in `RISK_REGISTER.md`.
- Additive migrations preferred. No renaming/deleting production columns unless necessary and explicitly approved.
- Never use a service-role key client-side. Verify RLS as anonymous / author / editor / admin.
- No index added blindly: identify the query, examine plan where possible, confirm table size/write frequency, document benefit, add via migration, verify.

## 6. Dead-code removal rule (Phase 4/8)

Before deleting any module: search static imports, dynamic imports, route references, string references, config references, test references; check external callers and Supabase functions/triggers/webhooks; run the app after removal; record evidence in `REFACTOR_LOG.md`. Do **not** remove DB columns, storage buckets, routes, or API handlers during ordinary cleanup.

## 7. Stop conditions

Stop the current batch and document (`Affected area / Current behavior / Observed risk / Required decision / Recommended options / Safest default`) when: behavior cannot be confidently determined; tests reveal inconsistent business rules; a migration could cause data loss; a permission change could expose private data; a production-only dependency cannot be reproduced; a required secret/service is unavailable; an optimization yields no measurable benefit; a change requires a major upgrade; a working feature would need redesign; scope is exceeded.

## 8. Definition of done

Build passes; no new TS/lint/test failures; critical workflows pass e2e; routes/API contracts/DB records/files/permissions/notifications/activity visibility/interface behavior all unchanged; no secrets exposed; performance ≥ baseline; all changes documented; branch reviewable; no automatic production deployment.

## 9. Current status

Phase 0 complete. Next: finish Phase 1 (`CODEBASE_MAP.md`), then Phase 2 (critical behavior), then Phase 3 (characterization tests) before any code refactor.
