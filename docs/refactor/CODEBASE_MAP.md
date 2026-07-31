# Codebase Map — Talikha Publishing (Refactor Reference)

**Last updated:** 2026-07-31
**Purpose:** Single consolidated structural reference for the refactor. Per the project's GSD mapper rule, the detailed analysis lives in `.planning/codebase/` (ARCHITECTURE, STRUCTURE, STACK, INTEGRATIONS, CONVENTIONS, TESTING, CONCERNS). This document **consolidates and indexes** that map and adds the per-module breakdown required by the refactor methodology. Reuse it; do not re-scan the whole repo for each task. If this map disagrees with the code, the code wins — then update the map.

**Authoritative sources:** schema → `src/types/database.generated.ts` (regenerate via `npm run db:types`); migrations → `supabase/migrations/` (40+ ordered SQL files).

---

## 1. System shape (summary)

Two-app monorepo sharing one Supabase project:
- **Public site** — Next.js 16 App Router (RSC), root `src/` + `components/`, served at `/`.
- **Admin panel** — Vite + React 19 SPA in `admin-panel/`, built to static assets, copied to `public/admin/` and served under `/admin` via `next.config.ts` rewrites. It is **not** a Next route. It calls `/api/admin/*` (service-role) handlers.
- **Server layer** — `src/app/api/**/route.ts` handlers + `src/proxy.ts` middleware; business logic in `src/lib/*` (each server module begins with `import "server-only"`).
- **Data** — Supabase Postgres (34 tables + functions), Auth (SSR cookies), Storage (`submission-files` private, `editorial-media` public).
- **Cross-cutting** — Upstash Redis rate limiting (`src/lib/rate-limit.ts`), Cloudflare Turnstile bot check (`src/lib/turnstile.ts`), env-driven launch gates (`src/lib/launch.ts`).

Service-role client (`getSupabaseAdmin`) bypasses RLS, so **authorization is enforced in app code** via `src/lib/admin-api.ts` guards. A missing guard = unauthenticated data access (see RISK_REGISTER SEC-1).

## 2. Database schema inventory (verified from `database.generated.ts`)

**34 tables**, grouped by domain:

| Domain | Tables |
|---|---|
| Submissions | `submissions`, `submission_authors`, `submission_files`, `submission_history`, `author_requests` |
| Workflow / activity | `workflow_events` (activity log w/ visibility), `workflow_checklist_items`, `editorial_notes`, `audit_events` (admin audit) |
| Payments | `payments`, `payment_line_items`, `receipts` |
| Journals / issues | `journals`, `issues` |
| Publications | `publications`, `publication_authors`, `publication_records`, `publication_preflight_runs`, `publication_preflight_checks` |
| Certificates | `certificate_templates`, `certificate_template_pages`, `certificate_template_fields`, `certificate_text_blocks`, `certificate_fonts`, `certificate_records`, `certificate_output_versions`, `certificate_access_links` |
| Media | `media_assets`, `media_placements` |
| Identity / comms | `profiles`, `notifications`, `announcements`, `newsletter_subscribers` |

**View:** `admin_transition_publication`.

**Postgres functions (9):**
- `transition_submission` — authoritative workflow state transition (wraps stage gates).
- `allocate_certificate_number` (Args `p_year`, Returns string) — **certificate numbering; must not be renumbered/changed** (master instruction §5.7).
- `confirm_payment_and_start_review`, `confirm_submission_payment`, `configure_submission_payment` — payment gates.
- `complete_workflow_checklist_item` — checklist progression.
- `create_author_request`, `respond_to_author_request` — author↔editorial messaging.
- `increment_publication_metric` — public view/download counters.

**Storage buckets:** `submission-files` (private; signed upload/download URLs) and `editorial-media` (public; journal/issue covers, editorial images).

## 3. Route map

Full route inventory with static/dynamic classification is in `BASELINE_REPORT.md` §6 (captured from `next build`). Summary:
- **Public pages:** `(public)` route group — authors, journals, issues, publications, search, submit, track, faq, services, privacy, terms, editorial-standards; plus `certificate-access/[token]`, `auth/callback`.
- **Public API:** `/api/submissions/init|complete`, `/api/track(+requests/respond)`, `/api/search`, `/api/announcements`, `/api/journal-store`, `/api/publications/[slug]/pdf|view`, `/api/cron/journal-lifecycle`.
- **Admin API:** `/api/admin/*` (~40 handlers: workspace, dashboard, submissions/[id]/* lifecycle, certificates/*, featured, files, workflow-files, logout).
- **Middleware:** `src/proxy.ts`.

## 4. Per-module map

Fields: Purpose · Key files · Depends on · DB tables · Storage · Routes/roles · Side effects · Risks · Test coverage.

### 4.1 Identity & authorization
- **Purpose:** Resolve current admin user from JWT + `profiles`; enforce role; local dev bypass. API guards for handlers.
- **Files:** `src/lib/auth.ts`, `src/lib/admin-api.ts`, `src/proxy.ts`.
- **Depends on:** `src/lib/supabase/server.ts`, `admin.ts`.
- **DB tables:** `profiles`.
- **Routes/roles:** `/admin` redirect (middleware); `requireEditorApi`/`requireAdminApi` used by `/api/admin/*`. Roles: admin, editor, (viewer implied).
- **Side effects:** session cookie refresh; auto-promote to admin via allowlist.
- **Risks:** SEC-2 (hardcoded allowlist bypass), SEC-6 (implicit local admin bypass), SEC-1 (guard gaps).
- **Test coverage:** none (Phase 3 target — High).

### 4.2 Supabase client factories
- **Purpose:** Null-guarded client creation so missing env never crashes a request.
- **Files:** `src/lib/supabase/{server,admin,browser,public,config}.ts`.
- **Pattern:** read env → return `SupabaseClient | null`; callers branch on null. `getSupabaseAdmin` = service-role (bypasses RLS).
- **Risks:** service-role misuse; PLAT-1 (env var naming skew vs readiness script).
- **Test coverage:** none.

### 4.3 Public content reads
- **Purpose:** Server-side reads of journals/issues/publications/authors with demo + JSON-store fallbacks.
- **Files:** `src/lib/content.ts`, `src/lib/journal-presentation.ts`, `src/lib/author-display.ts`, `src/lib/search.ts`.
- **DB tables:** `journals`, `issues`, `publications`, `publication_authors`, `authors`, `media_assets`.
- **Routes:** all public pages (RSC).
- **Side effects:** falls back to `src/data/journal-store.json` / `demo-content.ts` when Supabase absent or demo on.
- **Test coverage:** citation/author formatting partially (`citation-format.test.ts`); content reads untested.

### 4.4 Public submission intake
- **Purpose:** Validate, rate-limit, Turnstile-check, create submission + payment + signed uploads; finalize on complete.
- **Files:** `src/lib/submission.ts` (Zod schemas), `src/app/api/submissions/init/route.ts`, `complete/route.ts`, `src/components/local-submission-form.tsx`, `src/components/file-upload-system.tsx`, `src/lib/file-storage.ts`.
- **DB tables:** `submissions`, `submission_authors`, `submission_files`, `payments`, `payment_line_items`.
- **Storage:** `submission-files` (signed upload URLs).
- **Routes/roles:** public (`/submit` → `/api/submissions/init|complete`).
- **Side effects:** creates records, issues signed URLs, validates magic bytes on completion; **idempotency via `idempotency_key`** (snapshotted work `ba58b3d`).
- **Risks:** FRAG-2 (multi-step staging), PERF-3 (full-file validation), SEC-4/SEC-5 (track exposure / rate-limit fail-open), PLAT-5 (duplicate form impl).
- **Test coverage:** schema/validation partially testable; flow untested (Phase 3 — High).

### 4.5 Editorial workflow (state machine)
- **Purpose:** Submission stage transitions, checklist, payment gating; wraps DB functions. Emits author-visible progress activity.
- **Files:** `src/lib/editorial-workflow.ts` (pure helpers), `src/lib/editorial-workflow-server.ts` (server orchestration), `src/app/api/admin/submissions/[id]/{transition,advance,assignment,checklist,priority,payment/confirm,preflight,...}/route.ts`, migration `20260718114052_unified_editorial_workflow.sql`.
- **DB tables:** `submissions`, `workflow_events`, `workflow_checklist_items`, `submission_history`, `editorial_notes`; functions `transition_submission`, `confirm_payment_and_start_review`, `complete_workflow_checklist_item`.
- **Routes/roles:** `/api/admin/submissions/[id]/*` (editor/admin via guards).
- **Side effects:** status changes, activity emission, notifications, timestamps, assignment changes.
- **Risks:** FRAG-1 (fragile, spans code+migrations).
- **Test coverage:** pure helpers unit-tested (`workflow-transitions.test.ts`, 32-test suite); **no API/DB/RLS/payment/e2e coverage** (Phase 3 — High).
- **Stage path:** `review_new → review_in_progress → review_final → review_accepted → production_ready → production_preparation → production_proof → production_records → production_ready_to_publish → production_scheduled → published` (`editorial-workflow-server.ts:283`).

### 4.6 Activity log (`workflow_events`)
- **Purpose:** Per-submission activity feed with author-vs-internal visibility.
- **Files:** written by `src/lib/editorial-workflow-server.ts` (`emitProgressActivity`, line ~289) and various admin handlers; read by `/api/track` (author-facing) and admin workspace.
- **DB table:** `workflow_events` — columns `submission_id`, `event_type` (e.g. `progress_activity`), `internal_title`, `internal_description`, `public_title`, `public_description`, `visibility` (e.g. `author`), `actor_type`, `actor_id`, `metadata` (JSONB).
- **Visibility model:** separate internal/public text + `visibility` column. **Protected behavior** — do not change defaults without tracing every caller (master instruction §5.4). Dedup by `submission_id + event_type + metadata->>batch`.
- **Test coverage:** none (Phase 3 — High).

### 4.7 Notifications & announcements
- **Purpose:** Role-specific notifications; platform-wide announcements/notices.
- **DB tables:** `notifications`, `announcements`.
- **Files:** no dedicated `src/lib/notifications.ts` — notification creation is embedded across admin handlers and the admin SPA; announcements via `src/lib/announcements.ts` + `/api/announcements`.
- **Risks:** notification creation is not centralized → Phase 8 consolidation target. **Do not merge notifications of different privacy levels or change visibility defaults** (master instruction §11.2).
- **Test coverage:** none. **Phase 2 must trace every notification creator and recipient rule.**

### 4.8 Audit log (`audit_events`)
- **Purpose:** Administrative action audit trail.
- **DB table:** `audit_events`. Written by admin handlers. Minimal bracketed `console.error` logging elsewhere.
- **Protected:** do not remove audit information (master instruction §15).

### 4.9 Journal & issue management / lifecycle
- **Purpose:** Journal/issue CRUD, current-volume/current-issue derivation, lifecycle cron, catalog sync.
- **Files:** `src/lib/journal-lifecycle.ts`, `src/app/api/journal-store/route.ts`, `admin-panel/src/lib/journal-catalog.ts`, `admin-panel/src/main.tsx` (JournalsView), `src/data/journal-store.json` (dev fallback).
- **DB tables:** `journals`, `issues`, `media_assets`, `media_placements`. **Storage:** `editorial-media` (covers).
- **Routes:** `/api/journal-store` (admin sync), `/api/cron/journal-lifecycle` (Vercel cron, needs `CRON_SECRET`).
- **Risks:** FRAG-4 (dual client/DB state), PERF-4 (unbounded base64 covers), SEC-7 (cron secret), journal-specific issue selection must stay journal-bound (INQUIRA vs LUMERA separation — master instruction §11.4).
- **Test coverage:** none.

### 4.10 Publication & public access
- **Purpose:** Article publication, archive/volume/issue display, PDF access, DOI/Zenodo display, search, metrics.
- **Files:** `src/lib/content.ts`, `src/lib/publication-preflight.ts`, `src/lib/publication-preflight-rules.ts`, `src/app/api/publications/[slug]/{pdf,view}/route.ts`, `src/app/(public)/publications/[slug]/page.tsx`.
- **DB tables:** `publications`, `publication_authors`, `publication_records`, `publication_preflight_runs`, `publication_preflight_checks`; function `increment_publication_metric`.
- **Test coverage:** preflight rules unit-tested (`publication-preflight-rules.test.ts`).

### 4.11 Certificates
- **Purpose:** Template editing, field linking, PDF rendering, numbering, issuance, access links, import.
- **Files:** `admin-panel/src/components/certificates/certificate-workspace.tsx`, `src/lib/{certificates,certificate-editor,certificate-import,certificate-security,render-certificate}.ts`, `src/app/api/admin/certificates/**`, `src/app/(public)/certificate-access/[token]/`.
- **DB tables:** `certificate_templates`, `certificate_template_pages`, `certificate_template_fields`, `certificate_text_blocks`, `certificate_fonts`, `certificate_records`, `certificate_output_versions`, `certificate_access_links`; function `allocate_certificate_number`.
- **Storage:** certificate PDFs (storage writes on issuance).
- **Risks:** FRAG-3 (fragile pipeline). **Do not regenerate/renumber existing certificates** (master instruction §5.7).
- **Test coverage:** Playwright covers a local editor interaction only (`tests/certificate-convert-to-field.spec.ts`); issuance/numbering/storage untested.

### 4.12 Author requests / messaging
- **Purpose:** Author↔editorial requests and responses.
- **DB tables:** `author_requests`; functions `create_author_request`, `respond_to_author_request`.
- **Routes:** `/api/track/requests/respond`, admin requests handlers.

### 4.13 Rate limiting & bot check
- **Files:** `src/lib/rate-limit.ts` (in-memory `Map` + optional Upstash sliding window), `src/lib/turnstile.ts`.
- **Risks:** SEC-5 (fails open without Redis; in-memory doesn't survive serverless).

### 4.14 Launch gates
- **Files:** `src/lib/launch.ts` (`isIndexingEnabled`, `isSubmissionsEnabled`, `assertLaunchConfiguration`). Env-driven; hard-throws in root layout on misconfiguration.

### 4.15 Admin SPA
- **Purpose:** Editorial workspace (overview, inbox, journals, certificates, preflight, team).
- **Files:** `admin-panel/src/main.tsx` (~7,000-line monolith) + `admin-panel/src/components/{certificates,inbox,preflight,ui}/`.
- **State:** module-level `JOURNAL_CATALOG` singleton synced to `localStorage` (`talikha-journal-catalog-v2`) + `talikha:catalog` CustomEvent.
- **Cross-app imports:** relative imports of browser-safe `../../src/lib/{apa-citation,citation-format,types}`; Vite aliases `react`/`react-dom` to root and `@/components/icons` → `../src/components/icons`.
- **Risks:** monolith (PERF-2), FRAG-4. **Do not import `server-only`/Node modules into the SPA bundle.**

## 5. Conventions, error handling, testing, deployment

See `.planning/codebase/CONVENTIONS.md`, `TESTING.md`, and `BASELINE_REPORT.md`. Highlights: kebab-case files / PascalCase components; strict TS + `@/*` alias; Tailwind v3 (site) / v4 (admin) + CSS-variable theming; `cn()` + CVA; Zod `safeParse` at every API boundary; `apiErrorResponse` maps `ZodError`→400; fail-soft reads / fail-explicit writes; security headers in `next.config.ts`. Verification gate = `npm run check` (typecheck + lint + build) plus `npm run test`.
