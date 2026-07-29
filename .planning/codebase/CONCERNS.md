# Codebase Concerns

**Analysis Date:** 2026-07-30

## Tech Debt

**Monolithic admin workspace:**
- Issue: The primary admin SPA still combines navigation, data loading, state, seed data, and most workspace views in one 6,963-line module.
- Files: `admin-panel/src/main.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`
- Impact: Changes are difficult to isolate and test; unrelated admin surfaces can regress together, and the main bundle remains expensive to load.
- Fix approach: Extract each workspace into focused modules and hooks, move shared types/state out of `main.tsx`, and load certificate/editorial tools on demand.

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

**Documentation and map drift:**
- Issue: Operational docs still describe a nonexistent `src/app/admin/page.tsx`, while the current admin entry is the Vite SPA copied to `public/admin`; project guidance also still says no test framework exists.
- Files: `docs/DEPLOYMENT.md`, `AGENTS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/STRUCTURE.md`
- Impact: Future changes may be made in the wrong surface or skip the tests that now exist.
- Fix approach: Keep deployment/runbook and codebase-map docs synchronized with `src/app/(public)/submit/page.tsx`, `admin-panel/src/main.tsx`, and the actual test commands.

## Known Bugs

**Lint command is currently broken:**
- Symptoms: `npm.cmd run lint` fails before linting because `react-hooks/set-state-in-effect` is configured but the `react-hooks` plugin is unavailable.
- Files: `eslint.config.mjs`, `package.json`, `package-lock.json`
- Trigger: Run `npm.cmd run lint` in a clean/current checkout.
- Workaround: None in the repository; restore the plugin/config pairing or remove the unsupported rule.

**Launch-readiness checks use the wrong Supabase variable names:**
- Symptoms: `npm.cmd run readiness` reports missing `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, while runtime code and `.env.example` use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- Files: `scripts/check-launch-readiness.mjs`, `src/lib/supabase/config.ts`, `src/proxy.ts`, `.env.example`
- Trigger: Run readiness with the documented runtime variables configured.
- Workaround: The build can pass, but readiness remains blocked until the script and environment contract agree.

## Security Considerations

**Hardcoded administrator allowlist bypass:**
- Risk: `jbotoy83@gmail.com` is always included in the administrator set, independent of `ADMIN_EMAILS`; authenticating as that address can auto-promote the profile to admin.
- Files: `src/lib/auth.ts:28-75`, `.env.example:46`, `docs/DEPLOYMENT.md:64`
- Current mitigation: The user must still authenticate through Supabase.
- Recommendations: Remove the hardcoded address and require explicit, audited `ADMIN_EMAILS` or a database role; preserve the existing role on allowlist removal.

**Viewer can upload workflow files:**
- Risk: The workflow-file upload route checks only that a user exists, not that the user is an editor or administrator. A viewer session can attach production files to a submission.
- Files: `src/app/api/admin/workflow-files/route.ts:36-56`, `src/lib/admin-api.ts:7-13`
- Current mitigation: The route validates file kind, MIME type, size, and same-origin `Origin` when present.
- Recommendations: Use `requireEditorApi()` or an equivalent role check before accepting the upload.

**Reference-only public tracking exposes private artifacts:**
- Risk: `/api/track` accepts a submission reference, tracking number, or receipt number and returns author-visible events, signed manuscript/supporting-file URLs valid for one hour, and certificate download URLs. The submission reference contains only an eight-hex-character random suffix, and rate limiting is optional.
- Files: `src/app/api/track/route.ts:21-122`, `src/app/api/track/requests/respond/route.ts:57-97`, `src/lib/rate-limit.ts:21-28`, `src/app/api/submissions/init/route.ts:46-84`
- Current mitigation: Zod input validation, private/no-store responses, signed storage URLs, and an Upstash-backed limiter when configured.
- Recommendations: Require a second factor such as author email/OTP, make shared rate limiting mandatory for production, and avoid returning file links from a reference-only lookup.

**Rate limiting fails open without Redis:**
- Risk: When `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is absent, `allowRequest()` returns `true`; submission creation, completion, tracking, and author-response endpoints then have no effective distributed limit.
- Files: `src/lib/rate-limit.ts:3-28`, `src/app/api/submissions/init/route.ts:21-24`, `src/app/api/submissions/complete/route.ts:27-30`, `src/app/api/track/route.ts:21-24`
- Current mitigation: Upstash sliding-window limiting is implemented when both variables exist.
- Recommendations: Fail closed for public abuse-sensitive routes or provide a platform-backed limiter, and make the dependency a deployment readiness requirement.

**Implicit local admin bypass:**
- Risk: Any non-production process without a Supabase service-role key receives a synthetic admin from `getAdminUser()`. A shared staging environment with incomplete configuration could expose admin API routes.
- Files: `src/lib/auth.ts:16-43`, `src/app/api/admin/*.ts`
- Current mitigation: Disabled when `NODE_ENV` is `production`.
- Recommendations: Require explicit `LOCAL_ADMIN_BYPASS=true`, restrict it to loopback development, and fail closed in preview/staging.

**Cron secret is an undocumented operational dependency:**
- Risk: `/api/cron/journal-lifecycle` requires `CRON_SECRET` in production but `.env.example` does not document it. A production deployment without the secret will silently return 401 to the configured Vercel cron and stop lifecycle publication work.
- Files: `src/app/api/cron/journal-lifecycle/route.ts:5-17`, `vercel.json`, `.env.example`
- Current mitigation: Missing secrets fail closed in production.
- Recommendations: Document and validate `CRON_SECRET`, then monitor cron failures and lifecycle freshness.

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
- Improvement path: Use route/view-level dynamic imports and keep PDF/editor tooling out of the initial dashboard chunk.

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
- Test coverage: No API, database, RLS, payment, or end-to-end workflow coverage.

**Multi-step submission and browser staging:**
- Files: `src/components/local-submission-form.tsx`, `src/components/file-upload-system.tsx`, `src/lib/file-storage.ts`, `src/app/api/submissions/init/route.ts`, `src/app/api/submissions/complete/route.ts`
- Why fragile: IndexedDB staging, signed uploads, retries, payment metadata, and final status changes are coordinated across browser and server requests. Partial failures can leave `uploading`/`upload_failed` records or orphaned objects.
- Safe modification: Test refresh, retry, duplicate completion, partial upload, and cleanup paths against a real storage project; add idempotency and reconciliation for abandoned uploads.
- Test coverage: No automated submission-flow tests.

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
- Current capacity: Distributed only when Upstash is configured.
- Limit: With no Redis credentials, the public submission/tracking limits are effectively zero.
- Scaling path: Make shared rate limiting mandatory and add abuse metrics/alerts.

## Dependencies at Risk

**Install and version skew across two package manifests:**
- Risk: Both manifests use caret ranges, the root `postinstall` runs a nested `npm install`, and the root admin build invokes `npx --yes vite build`; root TypeScript and admin TypeScript are on different major versions.
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
- What's not tested: The 36 migration chain, storage policies, workflow triggers/functions, payment gates, and author/editor/admin access separation.
- Files: `supabase/migrations/`, `supabase/seed.sql`, `src/types/database.generated.ts`
- Risk: Application code relies heavily on service-role access, so policy or migration drift may not be caught by TypeScript or UI tests.
- Priority: High — add disposable-database migration checks and pgTAP or Supabase integration assertions.

**Current verification baseline:**
- What's tested: `npm.cmd test` passes 25 Vitest tests in one workflow-helper file; two Playwright specs exist, but the certificate spec assumes a separately running Vite server and the example spec targets `playwright.dev`.
- Files: `src/__tests__/workflow-transitions.test.ts`, `tests/certificate-convert-to-field.spec.ts`, `tests/example.spec.ts`, `playwright.config.ts`, `vitest.config.ts`
- Risk: The suite does not represent the production public/admin flows.
- Priority: Medium — replace the external example with an application smoke test and configure a reproducible app web server.

---

*Concerns audit: 2026-07-30*
