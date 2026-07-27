# Codebase Concerns

**Analysis Date:** 2026-07-27

## Tech Debt

**Monolithic admin panel (7117 lines in one file):**
- Issue: The entire admin panel UI lives in a single file with all views, types, helpers, and state management inlined.
- Files: `admin-panel/src/main.tsx`
- Impact: Extremely difficult to modify, review, or test any single feature. Any change risks regressions across unrelated views. IDE performance degrades. Merge conflicts are constant.
- Fix approach: Extract each workspace view (Bank, Journals, Studies, Certificates, Inbox, TeamAccounts) into its own component file under `admin-panel/src/components/`. Move shared types to `admin-panel/src/types.ts`. Move journal-catalog state logic into a dedicated hook or store module.

**Duplicate icon component libraries:**
- Issue: Animated icon components are duplicated between the Next.js site and the Vite admin panel with identical implementations.
- Files: `src/components/icons/` (~40 files), `admin-panel/src/components/icons/` (~40 files)
- Impact: Bug fixes or new icons must be applied twice. Drift between the two sets is inevitable.
- Fix approach: Extract icons into a shared package or use a single source directory referenced by both build configs.

**Hardcoded demo/seed data in admin panel:**
- Issue: Sample submissions, publication records, bank transactions, and study records are defined inline in the main component file rather than loaded from the API or a fixture module.
- Files: `admin-panel/src/main.tsx:229-749`
- Impact: Dead weight in the production bundle. Confusing for developers. Cannot be tree-shaken.
- Fix approach: Remove inline seed data. The workspace endpoint (`/api/admin/workspace`) already provides live data; use it exclusively.

## Known Bugs

**None confirmed at time of audit.**

## Security Considerations

**CRITICAL — Dashboard API route has no authentication:**
- Risk: The `/api/admin/dashboard` endpoint returns submission counts, recent submissions (with author emails), journals, authors, and publication records to ANY unauthenticated request. It calls `getSupabaseAdmin()` (service-role client) directly without checking `getAdminUser()`.
- Files: `src/app/api/admin/dashboard/route.ts:4-5`
- Current mitigation: None. The route is publicly accessible.
- Recommendations: Add `const user = await getAdminUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });` at the top of the GET handler, matching the pattern in `src/app/api/admin/workspace/route.ts:10-11`.

**CRITICAL — Hardcoded admin email bypasses env configuration:**
- Risk: `configuredAdminEmails()` returns a hardcoded set `["jbotoy83@gmail.com"]` instead of reading the `ADMIN_EMAILS` environment variable. The `ADMIN_EMAILS` var is documented in `.env.example:42` but never consumed. Any user authenticating with that email is auto-promoted to admin role regardless of their database profile.
- Files: `src/lib/auth.ts:28-30`
- Current mitigation: The email is presumably the project owner's. No runtime configuration is possible without a code change.
- Recommendations: Replace the hardcoded set with `new Set((process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean))`. Remove the hardcoded value.

**HIGH — In-memory rate limiter ineffective in serverless:**
- Risk: Rate limiting uses a module-level `Map` that resets on every cold start and is not shared across Vercel's distributed serverless instances. An attacker can bypass limits by hitting different instances or waiting for recycling.
- Files: `src/lib/rate-limit.ts:3`
- Current mitigation: Provides minimal protection in single-instance dev. No protection in production multi-instance deployment.
- Recommendations: Replace with Vercel KV / Upstash Redis rate limiting, or use Supabase row-level counters with TTL. At minimum, document that production rate limiting is not enforced.

**HIGH — CRON_SECRET not documented in .env.example:**
- Risk: The cron endpoint (`/api/cron/journal-lifecycle`) checks `CRON_SECRET` but this variable is absent from `.env.example`. Deployers may not set it, leaving the cron open (the route returns `true` for auth when no secret is configured and `NODE_ENV !== "production"`).
- Files: `src/app/api/cron/journal-lifecycle/route.ts:6-8`, `.env.example` (missing entry)
- Current mitigation: In production, if `CRON_SECRET` is empty, the `authorized()` function returns `false` (safe). But the variable is undocumented.
- Recommendations: Add `CRON_SECRET=` to `.env.example` under the server-only section with a comment explaining Vercel cron sends an `Authorization: Bearer <secret>` header.

**MEDIUM — LOCAL_ADMIN_BYPASS auto-enables when Supabase is unconfigured:**
- Risk: In non-production environments, if `SUPABASE_SERVICE_ROLE_KEY` is missing, `isLocalAdminBypassEnabled()` returns `true` automatically, granting full admin access without credentials. If a staging/preview deployment accidentally lacks the key, it becomes fully open.
- Files: `src/lib/auth.ts:21-26`
- Current mitigation: Guarded by `NODE_ENV !== "production"` check on line 22.
- Recommendations: Require explicit `LOCAL_ADMIN_BYPASS=true` rather than auto-enabling. Log a warning when bypass is active.

**MEDIUM — Journal-store route has its own dev bypass:**
- Risk: `requireEditor()` in the journal-store route independently grants admin access in non-production when `getAdminUser()` returns null, duplicating and diverging from the central auth logic.
- Files: `src/app/api/journal-store/route.ts:69-76`
- Current mitigation: Non-production only.
- Recommendations: Remove the local bypass. Use the central `getAdminUser()` / `requireEditorApi()` pattern consistently.

**MEDIUM — No rate limiting on admin API routes:**
- Risk: All `/api/admin/*` routes lack rate limiting. A compromised or leaked admin session could brute-force transitions, file uploads, or account creation without throttling.
- Files: All files under `src/app/api/admin/`
- Current mitigation: Supabase auth session required (except dashboard — see above).
- Recommendations: Add per-user rate limiting on mutation endpoints (POST/PATCH/DELETE), especially `accounts`, `workflow-files`, and `transition`.

**LOW — innerHTML usage in submission form:**
- Risk: `details.innerHTML = ...` injects a static HTML string. Currently safe (no user input interpolated), but fragile if future edits introduce dynamic values.
- Files: `src/components/submission-form.tsx:51`
- Current mitigation: Static string only, no interpolation.
- Recommendations: Replace with React JSX to eliminate the pattern entirely.

## Performance Bottlenecks

**Workspace endpoint loads entire database without pagination:**
- Problem: `/api/admin/workspace` fetches ALL submissions, publication records, journals, issues, authors, certificate templates, certificate records, and media assets in a single request with no `.limit()` or cursor.
- Files: `src/app/api/admin/workspace/route.ts:16-25`
- Cause: Designed for the current small dataset. No pagination or lazy-loading strategy.
- Improvement path: Add `.limit()` with cursor-based pagination. Split into per-view endpoints that load on demand. The admin panel already has separate views; each should fetch only its own data.

**Submission completion downloads files for signature validation:**
- Problem: The `/api/submissions/complete` route downloads each uploaded file's full bytes to verify magic-number signatures, doubling storage I/O for every submission.
- Files: `src/app/api/submissions/complete/route.ts:65-66`
- Cause: Supabase Storage metadata does not expose magic bytes; full download is the only verification path.
- Improvement path: Accept the trade-off for now (files are ≤15 MB). If volume grows, validate signatures client-side before upload and trust the storage metadata.

## Fragile Areas

**Journal-store sync (bidirectional local + database):**
- Files: `src/app/api/journal-store/route.ts`, `admin-panel/src/main.tsx:869-896`
- Why fragile: The admin panel maintains a localStorage mirror of the journal catalog AND syncs to the database via POST. Conflict resolution is last-write-wins. The `editorial_metadata` JSONB column stores a growing blob of UI state (status, changelog, dates, flags) with no schema validation.
- Safe modification: Always test the full round-trip: load from DB → edit in admin → save → reload. Never rename metadata keys without a migration.
- Test coverage: None. No automated tests exist for this flow.

**Editorial workflow state machine:**
- Files: `src/lib/editorial-workflow-server.ts` (488 lines)
- Why fragile: Stage transitions are validated in application code, not enforced by database constraints. A direct service-role update could put a submission into an invalid stage.
- Safe modification: Read the full transition map before adding stages. Add a database CHECK constraint on `current_stage` as a safety net.
- Test coverage: None.

## Scaling Limits

**Single-file admin panel:**
- Current capacity: Works for 1–2 developers making infrequent changes.
- Limit: Any team growth or feature acceleration will produce constant merge conflicts and review bottlenecks.
- Scaling path: Decompose into per-view modules before adding new workspace views.

**In-memory rate limiter:**
- Current capacity: Effective only in single-process dev.
- Limit: Zero protection in Vercel's multi-instance serverless environment.
- Scaling path: Move to a shared store (Upstash, Vercel KV) before enabling public submissions in production.

## Dependencies at Risk

**`latest` version pins in admin-panel:**
- Risk: `admin-panel/package.json` pins `@vitejs/plugin-react`, `lucide-react`, `typescript`, and `vite` to `"latest"`. Every fresh install may pull breaking changes.
- Impact: Non-reproducible builds. A bad upstream publish breaks the next `npm install`.
- Migration plan: Pin to specific semver ranges (e.g., `"^6.0.0"`) and use the lockfile.

**Dual PDF libraries:**
- Risk: Both `pdfjs-dist` and `@react-pdf/renderer` + `pdf-lib` + `@embedpdf/*` (13 packages) are installed. Overlapping functionality increases bundle size and maintenance surface.
- Impact: ~2 MB+ of PDF-related JavaScript shipped to clients.
- Migration plan: Audit which viewer/renderer is actually used per route. Remove unused libraries.

## Missing Critical Features

**No automated test suite:**
- Problem: Zero test files exist in either the Next.js app or the admin panel. No test runner is configured (no vitest, jest, or playwright config in `package.json`).
- Blocks: Confident refactoring, dependency upgrades, and regression detection. Every change is manual-verify-only.

**No email/notification service:**
- Problem: The submission form displays "Email receipts will be available once an email service is connected." Authors receive no confirmation email.
- Blocks: Production submission workflow. Authors must screenshot their reference number.

## Test Coverage Gaps

**All application code is untested:**
- What's not tested: Every API route, every React component, every library module, every database migration.
- Files: Entire `src/` and `admin-panel/src/` trees.
- Risk: Regressions in auth, submission flow, payment confirmation, or file handling will reach production undetected.
- Priority: High — start with API route integration tests for `/api/submissions/*` and `/api/admin/*` auth checks.

**RLS policies untested:**
- What's not tested: The 30+ row-level-security policies across 12 migrations have no automated verification.
- Files: `supabase/migrations/20260714010000_harden_security_and_indexes.sql`, `supabase/migrations/20260718114053_unified_editorial_workflow_security.sql`
- Risk: A future migration could accidentally open a table to anon or authenticated users without detection.
- Priority: High — add pgTAP or supabase-js test assertions that anon cannot read submissions and editors cannot escalate to admin.

---

*Concerns audit: 2026-07-27*
