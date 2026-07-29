# External Integrations

**Analysis Date:** 2026-07-30

## APIs & External Services

**Supabase:**
- Supabase provides PostgreSQL, Auth, and Storage for the public submission flow, editorial workspace, publication catalogue, journals, certificates, receipts, and audit/workflow data.
- SDKs: `@supabase/supabase-js` and `@supabase/ssr` in `package.json`.
- Configuration and clients: `src/lib/supabase/config.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/public.ts`, `src/lib/supabase/browser.ts`, and `src/lib/supabase/admin.ts`.
- Public/browser access uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; privileged server work uses `SUPABASE_SERVICE_ROLE_KEY` and is kept in server-only modules.
- Database types are generated into `src/types/database.generated.ts` by `npm run db:types`.

**Cloudflare Turnstile:**
- `src/lib/turnstile.ts` verifies tokens with `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Server configuration uses `TURNSTILE_SECRET_KEY`; the readiness script also expects `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the client widget.
- The token check is optional in `src/app/api/submissions/init/route.ts` when the server secret is absent; the active `/submit` page renders `src/components/local-submission-form.tsx`, while `src/components/submission-form.tsx` contains the alternate widget-based form.

**Upstash Redis:**
- `src/lib/rate-limit.ts` uses `@upstash/redis` and `@upstash/ratelimit` when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.
- Submission initialization/completion call the limiter; without both variables the limiter fails open and requests proceed.

## Data Storage

**Database:**
- Supabase PostgreSQL is configured for major version 17 in `supabase/config.toml`.
- Schema changes are ordered in the 36 files under `supabase/migrations/`, covering journals/issues/publications, authors, submissions/files/history, editorial workflow, payments/receipts, certificates, media, metrics, announcements, and team accounts.
- `supabase/seed.sql` is the local seed entry point; production content is expected to be managed through the authenticated editorial workspace.

**Storage buckets:**
- `submission-files` - private manuscript, author-photo, and payment-proof uploads created through signed upload URLs in `src/app/api/submissions/init/route.ts`.
- `submission-proofs` - private editorial proof files defined by `supabase/migrations/20260718114053_unified_editorial_workflow_security.sql`.
- `receipts` - private generated receipt PDFs written by `src/lib/editorial-workflow-server.ts`.
- `certificates` - private certificate outputs defined by the unified workflow migration.
- `certificate-assets` - private certificate backgrounds, fonts, and template assets managed by `src/lib/certificate-import.ts`, `src/lib/render-certificate.ts`, and `src/app/api/admin/certificates/`.
- `editorial-media` - public editorial images and journal covers written by `src/app/api/journal-store/route.ts` and exposed through Supabase public URLs.
- Bucket creation and policies are defined in `supabase/migrations/20260714000000_initial_production_schema.sql`, `20260715135118_editorial_admin_foundation.sql`, `20260718114053_unified_editorial_workflow_security.sql`, and `20260721180759_certificate_editor.sql`.
- The local Storage default file limit is 15 MiB in `supabase/config.toml`; individual bucket limits are set by the migration SQL.

**Browser-local storage:**
- IndexedDB stages files before protected upload in `src/lib/file-storage.ts`.
- The fallback/local submission path uses browser storage under `src/components/local-submission-form.tsx`; production submission requests use the `/api/submissions/init` and `/api/submissions/complete` routes.

**Caching:**
- No Redis/Memcached application cache is used; Upstash is only the optional rate-limit backend.
- Admin responses and `/admin` are marked private/no-store by `src/proxy.ts`, `next.config.ts`, and `vercel.json`.

## Authentication & Identity

**Auth provider:**
- Supabase Auth email/password is used by `src/components/admin-login-form.tsx` through the browser client.
- `src/proxy.ts` refreshes the Supabase session cookie and protects `/admin` except `/admin/login` and `/admin/welcome`.
- `src/app/auth/callback/route.ts` exchanges the Auth code for a session and redirects to the requested internal admin path.
- Signup is disabled in `supabase/config.toml`; `src/app/api/admin/accounts/route.ts` provisions team accounts through the service-role client.

**Authorization:**
- `src/lib/auth.ts` resolves `admin`, `editor`, and `viewer` roles from `profiles`, with `ADMIN_EMAILS` as an allowlist that promotes configured users to admin.
- `src/lib/admin-api.ts` provides the API-level editor gate; individual admin routes under `src/app/api/admin/` call it or `getAdminUser()`.
- Supabase RLS and Storage policies in `supabase/migrations/` provide the database-side authorization boundary.
- The development-only local bypass is disabled whenever `NODE_ENV` is production in `src/lib/auth.ts`.

## Monitoring & Observability

**Error tracking:**
- No Sentry, hosted error tracker, or external APM integration is configured.

**Logs and activity:**
- Server and client diagnostics use console output; local launcher logs are `dev-server.log` and `dev-server-error.log`.
- Admin activity is recorded through `src/app/api/admin/activity/route.ts` and Supabase audit/workflow tables.
- `src/app/api/admin/audit/route.ts` exposes editorial audit information to authorized users.

**Analytics:**
- No external analytics provider is implemented. `NEXT_PUBLIC_ANALYTICS_ENABLED` is guarded by `src/lib/launch.ts`, and publication views/downloads are stored in Supabase through `src/app/api/publications/[slug]/view/route.ts`.

## CI/CD & Deployment

**Hosting:**
- Vercel hosts the Next.js application and the copied admin SPA; project linkage is recorded in `.vercel/project.json` and deployment guidance is in `docs/DEPLOYMENT.md`.
- `vercel.json` adds the daily `/api/cron/journal-lifecycle` schedule and admin cache/indexing headers.
- `next.config.ts` supplies global CSP, HSTS, frame, content-type, robots, and admin no-store headers.

**Build/deployment pipeline:**
- `package.json` builds Vite admin assets, copies them to `public/admin/`, then runs Next.js production build.
- `scripts/check-launch-readiness.mjs` is the explicit pre-launch configuration gate.
- No GitHub Actions workflow is present under `.github/workflows/`; deployment is Vercel-driven and the repository remote is documented by Git configuration rather than an in-repo CI file.

**Scheduled job:**
- Vercel Cron calls `GET /api/cron/journal-lifecycle` daily.
- `src/app/api/cron/journal-lifecycle/route.ts` accepts `Authorization: Bearer <CRON_SECRET>` in production and runs `synchronizeJournalLifecycles` plus `publishDuePublications`.

## Environment Configuration

**Runtime variables read by application code:**
- Supabase/Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, and `LOCAL_ADMIN_BYPASS` for local development only.
- Site/launch: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_SHORT_NAME`, `NEXT_PUBLIC_SITE_TAGLINE`, `NEXT_PUBLIC_SITE_DESCRIPTION`, `NEXT_PUBLIC_SITE_LOCALE`, `NEXT_PUBLIC_SITE_LOCATION`, `NEXT_PUBLIC_SITE_AREA_SERVED`, `NEXT_PUBLIC_SITE_FOUNDING_YEAR`, `NEXT_PUBLIC_SITE_OG_IMAGE`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE`, `SITE_INDEXING_ENABLED`, `DEMO_CONTENT_ENABLED`, `SUBMISSIONS_ENABLED`, `AI_TRAINING_ALLOWED`, and `NEXT_PUBLIC_ANALYTICS_ENABLED`.
- Security/operations: `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `REMOTE_IMAGE_HOSTS`, `GOOGLE_SITE_VERIFICATION`, and `BING_SITE_VERIFICATION`.

**Readiness-script alignment:**
- `scripts/check-launch-readiness.mjs` currently requires `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, while the running clients in `src/lib/supabase/config.ts` and `src/lib/supabase/admin.ts` use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- The same script checks approval flags `BACKEND_ISOLATION_CONFIRMED`, `DATABASE_SECURITY_APPROVED`, `CONTENT_APPROVED`, `LEGAL_APPROVED`, and `OWNER_LAUNCH_APPROVED`; those are deployment gates rather than application integrations.

**Secrets location:**
- Local values are supplied through ignored `.env.local`; deployment values are configured in the Vercel project and Supabase dashboard as described in `docs/DEPLOYMENT.md`.
- Secret values are intentionally excluded from this map.

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` receives Supabase Auth redirects in `src/app/auth/callback/route.ts`.
- `/api/cron/journal-lifecycle` receives the Vercel Cron request and bearer secret in `src/app/api/cron/journal-lifecycle/route.ts`.
- `/api/submissions/init` and `/api/submissions/complete` receive browser submission requests and validate them with `src/lib/submission.ts` and the Supabase service-role client.

**Outgoing:**
- The application calls Supabase REST/Auth/Storage through the SDK, Cloudflare Turnstile through `src/lib/turnstile.ts`, and Upstash Redis through `src/lib/rate-limit.ts`.
- No outgoing webhook receiver, email provider, payment gateway, or transactional mail service is configured.

## Payment Processing

**Status:** Manual payment confirmation; no gateway SDK is installed in `package.json`.
- Public submitters select GCash, Maya, or bank transfer in `src/components/local-submission-form.tsx` and submit a payment reference plus proof file.
- `/api/submissions/init` creates a pending `payments` row; an administrator confirms it through `/api/admin/submissions/[id]/payment/confirm` and the database RPCs in `supabase/migrations/20260726114250_allow_manual_payment_review_confirmation.sql`.
- `src/lib/editorial-workflow-server.ts` generates the official PDF receipt and stores it in the private `receipts` bucket.
- Database guards in `supabase/migrations/20260726113036_payment_gate_and_certificate_delivery.sql` prevent review from starting before payment confirmation.

## Email

**Status:** Not implemented as a server integration.
- The site displays contact and follow-up addresses through `src/lib/site.ts` and uses `mailto:` links in public sharing/contact surfaces.
- No Resend, SendGrid, Mailgun, SMTP, or Nodemailer dependency/configuration is present; submission follow-up is currently represented by the tracking record and the admin workflow.

---

*Integration audit: 2026-07-30*
