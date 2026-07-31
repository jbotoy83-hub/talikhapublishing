# External Integrations

**Analysis Date:** 2026-07-31 (refreshed)

## APIs & External Services

**Backend-as-a-Service (Supabase):**
- Supabase is the single shared backend for both apps — Postgres database, Auth, and file Storage.
- Project: `talikha-publishing`, region `ap-southeast-1` (`.env.example`).
- SDK/Client: `@supabase/supabase-js` ^2.110.3 and `@supabase/ssr` ^0.12.1.
- Client factories live in `src/lib/supabase/` (see Data Storage and Authentication sections below).
- Generated types: `src/types/database.generated.ts` (regenerate with `npm run db:types`).

**Bot protection (Cloudflare Turnstile):**
- Used to protect the public submission flow.
- Server verification: `src/lib/turnstile.ts` posts to `https://challenges.cloudflare.com/turnstile/v0/siteverify` and requires `action === "submission"`.
- Client widget: `src/components/turnstile-widget.tsx`.
- Auth: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET_KEY` (server-only). Verification is skipped if no secret is configured.

**Distributed rate limiting (Upstash Redis):**
- `src/lib/rate-limit.ts` — sliding-window limiter built on `@upstash/redis` + `@upstash/ratelimit`.
- Used by public write endpoints (e.g. `src/app/api/submissions/init/route.ts` keys on `submission:<ip>`).
- Falls back to "allow all" when Redis env vars are absent — this means no rate limiting locally or if misconfigured. A one-time `console.warn` is now emitted on first call when Redis is absent (SEC-5, 2026-07-31). The launch-readiness gate requires both vars for production.
- Auth: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**CDN:**
- `https://cdn.jsdelivr.net` is whitelisted in CSP `connect-src` (`next.config.ts`) — used to load the pdf.js worker for the PDF viewer.

**Search engine verification:**
- Google + Bing verification tokens wired into metadata: `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` (`src/app/layout.tsx`).

## Data Storage

**Databases:**
- Supabase Postgres (single database shared by both apps).
- Connection: `NEXT_PUBLIC_SUPABASE_URL` + anon/service keys (no raw connection string in app code; all access is via the Supabase client).
- Clients (all null-guarded, returning `null` when unconfigured):
  - `src/lib/supabase/server.ts` — `createServerSupabase()`: SSR cookie client (anon key) for Server Components/routes.
  - `src/lib/supabase/browser.ts` — `getSupabaseBrowser()`: browser client (anon key) for client components.
  - `src/lib/supabase/public.ts` — `getPublicSupabase()`: stateless anon client for server reads.
  - `src/lib/supabase/admin.ts` — `getSupabaseAdmin()`: **service-role** client that bypasses RLS; used by all `/api/admin/*` handlers and public write endpoints.
  - `src/lib/supabase/config.ts` — shared env readers (`getPublicSupabaseConfig`, `hasAdminSupabaseConfig`).
- Schema: 34 tables + several Postgres functions. Key tables (from `src/types/database.generated.ts`): `submissions`, `submission_authors`, `submission_files`, `submission_history`, `journals`, `issues`, `publications`, `publication_records`, `publication_authors`, `authors`, `profiles`, `payments`, `payment_line_items`, `receipts`, `certificate_templates`, `certificate_template_pages`, `certificate_template_fields`, `certificate_records`, `certificate_access_links`, `certificate_fonts`, `media_assets`, `media_placements`, `announcements`, `notifications`, `audit_events`, `workflow_events`, `workflow_checklist_items`, `editorial_notes`, `publication_preflight_runs`, `publication_preflight_checks`, `author_requests`, `newsletter_subscribers`.
- DB functions invoked from app code: `transition_submission`, `confirm_submission_payment`, `confirm_payment_and_start_review`, `configure_submission_payment`, `allocate_certificate_number`, `increment_publication_metric`, `create_author_request`, `respond_to_author_request`, `complete_workflow_checklist_item`, `admin_transition_publication`.
- Migrations: `supabase/migrations/` (40+ ordered SQL files), seed: `supabase/seed.sql`, local config: `supabase/config.toml`.

**File Storage:**
- Supabase Storage buckets:
  - `submission-files` — **private** bucket; public uploads go through signed upload URLs created in `src/app/api/submissions/init/route.ts` (`createSignedUploadUrl`). Files served back to admins via `src/app/api/admin/files/[id]/route.ts`.
  - `editorial-media` — **public** bucket; journal/issue cover images uploaded in `src/app/api/journal-store/route.ts` (`persistImage`), metadata recorded in the `media_assets` table.
- Browser-side scratch storage: `src/lib/file-storage.ts` uses IndexedDB (`talikha-file-storage`) for client-side file staging/validation in the submission UI (not the source of truth).

**Caching:**
- Upstash Redis is used only for rate limiting, not response caching.
- Next.js image optimization caches remote images (`next.config.ts` `images.formats: avif/webp`).
- React `cache()` wraps some server data reads (`src/lib/content.ts`).

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email-based; SSR cookie sessions).
- Implementation:
  - Session refresh + route guard: `src/proxy.ts` (Next middleware). It calls `supabase.auth.getUser()` on every matched request and redirects unauthenticated users away from `/admin/*` (except `/admin/login` and `/admin/welcome`) to `/admin/login?next=...`.
  - Identity resolution: `src/lib/auth.ts` — `getAdminUser()` reads JWT claims via `supabase.auth.getClaims()`, loads the `profiles` row, and resolves role (`admin` | `editor` | `viewer`). `requireAdmin()` redirects viewers/non-users to login.
  - API guards: `src/lib/admin-api.ts` — `requireEditorApi()` (admin/editor) and `requireAdminApi()` (admin only) return `401`/`403` `NextResponse`s; callers check with `isApiError()`.
- Admin allowlist: `ADMIN_EMAILS` env (comma-separated) in `configuredAdminEmails()` (`src/lib/auth.ts`). No hardcoded email (removed 2026-07-31, SEC-2); `profiles.role = 'admin'` is the alternative.
- Local dev bypass: `isLocalAdminBypassEnabled()` (`src/lib/auth.ts`) returns a fake admin only when `LOCAL_ADMIN_BYPASS=true` is set explicitly; forced off in production and fails closed in staging/preview (SEC-6, 2026-07-31). The bypass is no longer implicit — a missing service-role key returns `null`, not a synthetic admin.
- Roles drive both UI access (`access_views`, `requires_account_setup` on `profiles`) and API authorization.

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Datadog/etc.).

**Logs:**
- `console.error` with bracketed tags in the admin/journal sync path (e.g. `[journal-store]` in `admin-panel/src/main.tsx`).
- Dev server logs captured to `dev-server.log` / `dev-server-error.log` and `admin-panel/.vite-dev.log` by the launcher.
- An `audit_events` table exists for in-app administrative audit trails (written by admin route handlers).

**Analytics:**
- Intentionally disabled. `NEXT_PUBLIC_ANALYTICS_ENABLED` must stay `false` until a consent-aware provider is implemented (`src/lib/launch.ts` blocks indexing otherwise). A privacy consent UI exists (`src/components/privacy-preferences.tsx`, `src/components/privacy-banner.tsx`).

## CI/CD & Deployment

**Hosting:**
- Vercel (`.vercel/` directory present).
- `vercel.json`: daily cron `0 0 * * *` → `/api/cron/journal-lifecycle` (journal lifecycle synchronizer, `src/lib/journal-lifecycle.ts`), plus `/admin` no-store/no-index headers.

**CI Pipeline:**
- None detected (no `.github/workflows/`). The local verification gate is `npm run check` (typecheck + lint + build).

## Environment Configuration

**Required env vars (production):**
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`.
- Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Bot protection: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
- Admin: `ADMIN_EMAILS` (comma-separated allowlist; no hardcoded email), `CRON_SECRET` (Bearer token for Vercel cron; documented in `.env.example`).
- Site identity: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_DESCRIPTION`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE`.
- Launch gates: `SITE_INDEXING_ENABLED`, `DEMO_CONTENT_ENABLED`, `SUBMISSIONS_ENABLED`, `CONTENT_APPROVED`, `LEGAL_APPROVED`, `OWNER_LAUNCH_APPROVED`, `DATABASE_SECURITY_APPROVED`.
- Optional: `REMOTE_IMAGE_HOSTS` (comma-separated HTTPS hosts for `next/image`), `JOURNAL_STORE_TOKEN`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`.

**Secrets location:**
- `.env.local` at repo root (present; contents not read). Template in `.env.example`. `.env*` should be git-ignored.

## Webhooks & Callbacks

**Incoming:**
- Supabase Auth callback: `src/app/auth/callback/route.ts` (completes the email/OAuth login handshake).
- Vercel cron hit: `GET /api/cron/journal-lifecycle` (`src/app/api/cron/journal-lifecycle/route.ts`) — scheduled, not a third-party webhook. Authenticated via `CRON_SECRET` (Bearer token); documented in `.env.example` and enforced by the launch-readiness gate (SEC-7, 2026-07-31).
- No third-party payment/webhook receiver — the payment provider is explicitly "not connected" (admin `BankView` in `admin-panel/src/main.tsx` shows placeholder/prototype data).

**Outgoing:**
- Server-to-Supabase (DB, Auth, Storage) and server-to-Turnstile (`src/lib/turnstile.ts`).
- Admin SPA → `/api/journal-store` POST to publish the journal catalog (`admin-panel/src/main.tsx` `publishCatalogToSite`).

---

*Integration audit: 2026-07-31 (refreshed)*
