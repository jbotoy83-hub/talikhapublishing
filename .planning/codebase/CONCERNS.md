# Codebase Concerns

**Analysis Date:** 2026-07-31 (refreshed)

## Tech Debt

**Monolithic admin workspace:**
- Issue: The primary admin SPA still combines navigation, data loading, state, seed data, and most workspace views in one ~7,188-line module (reduced from ~7,450 by dead-code removal on 2026-07-31).
- Files: `admin-panel/src/main.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`
- Impact: Changes are difficult to isolate and test; unrelated admin surfaces can regress together, and the main bundle remains expensive to load.
- Fix approach: Extract each workspace into focused modules and hooks, move shared types/state out of `main.tsx`, and load certificate/editorial tools on demand. Refactor baseline documented in `docs/refactor/`.

**Two submission implementations:**
- Issue: The active `/submit` page renders `LocalSubmissionForm`, while the older `SubmissionForm` remains as a second API-backed form implementation with overlapping upload and completion logic.
- Files: `src/app/(public)/submit/page.tsx`, `src/components/local-submission-form.tsx`, `src/components/submission-form.tsx`, `src/components/file-upload-system.tsx`
- Impact: Validation, copy, processing states, and server payloads can drift; dead code also increases maintenance and bundle risk.
- Fix approach: Confirm the production form, delete or isolate the unused implementation, and keep one shared submission/upload contract.

**Dual journal state model:**
- Issue: The admin catalog keeps client/localStorage state while synchronizing a loosely validated JSONB metadata structure through the journal-store endpoint.
- Files: `admin-panel/src/main.tsx`, `admin-panel/src/lib/journal-catalog.ts`, `src/app/api/journal-store/route.ts`, `src/data/journal-store.json`
- Impact: Last-write-wins updates can overwrite edits, arbitrary metadata can accumulate, and local state can disagree with database state.
- Fix approach: Make the database model authoritative, validate the complete payload with a schema, and add conflict/version handling.

**Duplicated UI primitives and icons:**
- Issue: Similar icon and UI implementations exist in both applications.
- Files: `src/components/icons/`, `admin-panel/src/components/icons/`, `components/ui/`, `admin-panel/src/components/ui/`
- Impact: Fixes and accessibility improvements must be repeated and can diverge.
- Fix approach: Establish a small shared package or an explicitly shared source layer compatible with both build targets.

## Known Bugs

**Launch-readiness checks use the wrong Supabase variable names:**
- Symptoms: `npm run readiness` reports missing `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, while runtime code and `.env.example` use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- Files: `scripts/check-launch-readiness.mjs:104-105`, `src/lib/supabase/config.ts`, `src/proxy.ts`, `.env.example`
- Trigger: Run readiness with the documented runtime variables configured.
- Workaround: The build can pass, but readiness remains blocked until the script and environment contract agree.

## Security Considerations

**Hardcoded administrator allowlist bypass — RESOLVED (2026-07-31, SEC-2):**
- The hardcoded `jbotoy83@gmail.com` was removed from `configuredAdminEmails()` (`src/lib/auth.ts`); the admin allowlist now comes solely from `ADMIN_EMAILS` (or `profiles.role = 'admin'`).

**Unauthenticated admin dashboard — RESOLVED (2026-07-31, SEC-1):**
- `/api/admin/dashboard` now calls `requireEditorApi()` as its first statement. All 14 admin sub-routes are guarded.

**Viewer access to workspace and files — RESOLVED (2026-07-31, SEC-8):**
- `/api/admin/workspace` and `/api/admin/files/[id]` now use `requireEditorApi()` (admin/editor only); viewers are rejected with 403.

**Implicit local admin bypass — RESOLVED (2026-07-31, SEC-6):**
- `getAdminUser()` no longer returns a synthetic admin when the service-role key is missing. The bypass requires explicit `LOCAL_ADMIN_BYPASS=true` and is forced off in production. Staging/preview fail closed.

**Cron secret undocumented — RESOLVED (2026-07-31, SEC-7):**
- `CRON_SECRET` is now documented in `.env.example` with usage notes and enforced by the launch-readiness gate.

**Rate limiting fails open without Redis — MITIGATED (2026-07-31, SEC-5):**
- Risk: When `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is absent, `allowRequest()` returns `true`; submission creation, completion, tracking, and author-response endpoints then have no effective distributed limit.
- Files: `src/lib/rate-limit.ts:3-41`, `src/app/api/submissions/init/route.ts`, `src/app/api/submissions/complete/route.ts`, `src/app/api/track/route.ts`
- Current mitigation: A one-time `console.warn` fires on first call when Redis is absent. The launch-readiness gate requires both vars for production. Owner accepted reference-only tracking risk (SEC-4).
- Remaining recommendations: Consider failing closed for abuse-sensitive routes or adding a platform-backed limiter as a second layer.

**Reference-only public tracking exposes private artifacts — ACCEPTED (2026-07-31, SEC-4):**
- Risk: `/api/track` accepts a submission reference, tracking number, or receipt number and returns author-visible events, signed manuscript/supporting-file URLs valid for one hour, and certificate download URLs. The submission reference contains only an eight-hex-character random suffix.
- Files: `src/app/api/track/route.ts`, `src/app/api/track/requests/respond/route.ts`, `src/lib/rate-limit.ts`
- Current mitigation: Zod input validation, private/no-store responses, signed storage URLs, Upstash-backed limiter when configured. Owner decision: accepted with rate-limit mitigation.
- Remaining recommendations: If abuse is observed, add a second factor (author email/OTP) or make shared rate limiting mandatory before go-live.

## Performance Bottlenecks

**Unbounded admin workspace read model:**
- Problem: The initial workspace request loads all submissions, publication records, journals, issues, authors, certificate records, and media assets in parallel.
- Files: `src/app/api/admin/workspace/route.ts:16-25`, `admin-panel/src/main.tsx`
- Cause: All admin views share one read model and most queries have no limit or cursor.
- Improvement path: Split by workspace, paginate large collections, select only view-specific fields, and lazy-load certificates/media.

**Large admin client bundle:**
- Problem: The production build emits an approximately 998 kB minified main JavaScript chunk and a 368 kB CSS chunk; Vite warns about chunks over 500 kB.
- Files: `admin-panel/src/main.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`, `admin-panel/vite.config.ts`
- Cause: The SPA eagerly includes certificate editing, PDF generation, document parsing, and multiple workspaces.
- Improvement path: Use route/view-level dynamic imports and keep PDF/editor tooling out of the initial dashboard chunk. Performance baseline documented in `docs/refactor/PERFORMANCE_BASELINE.md`.

**Full-file signature validation during completion:**
- Problem: Submission completion downloads every uploaded file and reads the entire blob into memory to check magic bytes.
- Files: `src/app/api/submissions/complete/route.ts:44-70`
- Cause: Validation is performed after storage upload and supports files up to the configured limits.
- Improvement path: Enforce a bounded file count, stream or inspect only required header bytes where possible, and move expensive validation to an asynchronous verification path for larger submissions.

**Unbounded base64 image handling in journal sync:**
- Problem: Journal-store accepts data URLs, decodes the complete base64 payload, and uploads it without a request or decoded-image size limit.
- Files: `src/app/api/journal-store/route.ts:87-105`, `src/app/api/journal-store/route.ts:212-246`
- Cause: The endpoint is designed to persist edited covers from the admin UI.
- Improvement path: Enforce request/image dimensions and byte limits before decoding, then use direct signed uploads for larger assets.

## Fragile Areas

**Editorial workflow state machine:**
- Files: `src/lib/editorial-workflow.ts`, `src/lib/editorial-workflow-server.ts`, `src/app/api/admin/submissions/[id]/transition/route.ts`, `supabase/migrations/20260718114052_unified_editorial_workflow.sql`
- Why fragile: Stage transitions, payment gates, author-facing labels, events, and database functions span application code and migrations; only pure helper behavior is unit-tested.
- Safe modification: Update the transition map, server route, SQL constraints/functions, and author-status projections together; add transition integration tests before changing gates.
- Test coverage: Pure workflow helpers unit-tested (25 assertions); no API, database, RLS, payment, or end-to-end workflow coverage.

**Multi-step submission and browser staging:**
- Files: `src/components/local-submission-form.tsx`, `src/components/file-upload-system.tsx`, `src/lib/file-storage.ts`, `src/app/api/submissions/init/route.ts`, `src/app/api/submissions/complete/route.ts`
- Why fragile: IndexedDB staging, signed uploads, retries, payment metadata, and final status changes are coordinated across browser and server requests. Partial failures can leave `uploading`/`upload_failed` records or orphaned objects.
- Safe modification: Test refresh, retry, duplicate completion, partial upload, and cleanup paths against a real storage project; add idempotency and reconciliation for abandoned uploads. Idempotency key support added in migration `20260730232338_submission_idempotency.sql`.
- Test coverage: Submission schema characterization tests exist (`src/__tests__/submission-schema.test.ts`); no automated submission-flow E2E tests.

**Certificate generation pipeline:**
- Files: `admin-panel/src/components/certificates/certificate-workspace.tsx`, `src/app/api/admin/certificates/records/[recordId]/issue/route.ts`, `src/lib/render-certificate.ts`, `src/lib/certificate-import.ts`
- Why fragile: Editing, PDF rendering, storage writes, certificate numbering, previews, publication attachment, and workflow events are coordinated in large client/server modules.
- Safe modification: Treat issuance as an idempotent transaction, verify storage/database cleanup on each failure, and test real PDF output after template changes.
- Test coverage: Playwright covers a local certificate editor interaction, not issuance, storage, numbering, or delivery.

## Scaling Limits

**Admin read model and client memory:**
- Current capacity: Suitable for a small catalogue and a single initial workspace load.
- Limit: Dataset growth increases response size, query time, browser memory, and render cost because the workspace is not paginated.
- Scaling path: Introduce per-view endpoints, cursors, server-side filtering, and virtualized lists.

**Serverless public abuse controls:**
- Current capacity: Distributed only when Upstash is configured; launch-readiness gate enforces this for production.
- Limit: With no Redis credentials, the public submission/tracking limits are effectively zero (fail-open with warning).
- Scaling path: Make shared rate limiting mandatory and add abuse metrics/alerts.

## Dependencies at Risk

**Install and version skew across two package manifests:**
- Risk: Both manifests use caret ranges, the root `postinstall` runs a nested `npm install`, and the root admin build invokes `npx --yes vite build`; root TypeScript (^6.0.3) and admin TypeScript (^7.0.2) are on different major versions.
- Files: `package.json`, `admin-panel/package.json`, `package-lock.json`, `admin-panel/package-lock.json`
- Impact: Fresh Vercel installs can resolve different dependency graphs or expose type/build differences between the two apps.
- Migration plan: Use lockfile-only CI installs, pin the admin build to the local package script, align compatible toolchain versions, and verify both lockfiles in CI.

**PDF/document dependency surface:**
- Risk: PDF viewing, generation, DOCX parsing, canvas capture, and embedded PDF tooling are spread across multiple large packages.
- Files: `package.json`, `admin-panel/package.json`, `src/components/ui/pdf-viewer.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`
- Impact: Large bundles, browser memory pressure, and upgrade compatibility issues.
- Migration plan: Audit actual consumers, lazy-load each tool, and remove overlapping libraries only after output parity is verified.

## Missing Critical Features

**Transactional email and delivery history:**
- Problem: Submission confirmation and editorial notifications are not connected to an email provider; the user must retain the reference manually.
- Files: `src/components/local-submission-form.tsx`, `src/components/submission-form.tsx`, `admin-panel/src/main.tsx`, `docs/production-readiness.md`
- Blocks: Reliable author receipt delivery, revision notifications, and operational delivery tracking.

**Production monitoring and CI:**
- Problem: No GitHub Actions workflow or external error-tracking service is present; operational logs are console-based.
- Files: `.github/` (not detected), `src/lib/rate-limit.ts`, `docs/DEPLOYMENT.md`
- Blocks: Automatic lint/build/test/migration gates and fast detection of failed cron, submission, or admin operations.

## Test Coverage Gaps

**API and authorization paths:**
- What's not tested: Admin role boundaries, viewer restrictions, public tracking confidentiality, cron authentication, signed file access, submission init/complete, payment confirmation, and certificate issuance.
- Files: `src/app/api/`, `src/lib/auth.ts`, `src/lib/admin-api.ts`, `src/proxy.ts`
- Risk: Security and workflow regressions can reach production while the current unit suite still passes.
- Priority: High — add route-level tests with mocked auth/storage and representative unauthorized/role cases.

**Database and RLS behavior:**
- What's not tested: The 41-migration chain, storage policies, workflow triggers/functions, payment gates, and author/editor/admin access separation.
- Files: `supabase/migrations/`, `supabase/seed.sql`, `src/types/database.generated.ts`
- Risk: Application code relies heavily on service-role access, so policy or migration drift may not be caught by TypeScript or UI tests.
- Priority: High — add disposable-database migration checks and pgTAP or Supabase integration assertions.

**Current verification baseline:**
- What's tested: `npm run test` passes 5 Vitest files covering workflow transitions (25 assertions), citation formatting, display formatting (author-display + journal-presentation), publication preflight rules, and submission schema validation. Two Playwright specs exist, but the certificate spec assumes a separately running Vite server and the example spec targets `playwright.dev`.
- Files: `src/__tests__/workflow-transitions.test.ts`, `src/__tests__/citation-format.test.ts`, `src/__tests__/display-formatting.test.ts`, `src/__tests__/publication-preflight-rules.test.ts`, `src/__tests__/submission-schema.test.ts`, `tests/certificate-convert-to-field.spec.ts`, `tests/example.spec.ts`
- Risk: The suite does not represent the production public/admin flows.
- Priority: Medium — replace the external example with an application smoke test and configure a reproducible app web server.

---

*Concerns audit: 2026-07-31 (refreshed)*
