# External Integrations

**Analysis Date:** 2026-07-27

## APIs & External Services

**Backend-as-a-Service:**
- Supabase (project: `talikha-publishing`, region: ap-southeast-1)
  - SDK/Client: `@supabase/supabase-js` ^2.110.3 + `@supabase/ssr` ^0.12.1
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Config: `src/lib/supabase/config.ts` (env reader), `supabase/config.toml` (local dev)
  - Provides: PostgreSQL database, authentication, file storage

**Bot Protection:**
- Cloudflare Turnstile
  - SDK/Client: Direct `fetch()` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  - Auth: `TURNSTILE_SECRET_KEY` (server), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client widget)
  - Implementation: `src/lib/turnstile.ts`
  - Purpose: Protects public submission forms from automated abuse

## Data Storage

**Databases:**
- Supabase PostgreSQL 17
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (REST/PostgREST via SDK)
  - Client: Four tiered clients in `src/lib/supabase/`:
    - `server.ts` - Cookie-aware server client for authenticated requests (Server Components, API routes)
    - `admin.ts` - Service-role client bypassing RLS (server-only, `getSupabaseAdmin()`)
    - `public.ts` - Anon-key client without session persistence (server-only, public reads)
    - `browser.ts` - Browser client for client components (`"use client"`)
  - Types: `src/types/database.generated.ts` (generated via `npm run db:types`)
  - Migrations: `supabase/migrations/` (34 migration files, schema managed via SQL)
  - Seed: `supabase/seed.sql`

**File Storage:**
- Supabase Storage (6 buckets):
  - `submission-files` - Author manuscript uploads and supporting documents
  - `submission-proofs` - Author proof files (editorial workflow)
  - `editorial-media` - Public images, site assets (public URLs via `getPublicUrl`)
  - `certificate-assets` - Certificate template backgrounds, fonts, rendered PDFs
  - `certificates` - Issued certificate PDFs and previews
  - `receipts` - Generated payment receipt PDFs
  - File size limit: 15 MiB (configured in `supabase/config.toml`)
  - Access patterns: signed upload URLs for public submissions, service-role for admin operations
  - Key files: `src/app/api/submissions/init/route.ts` (signed URL creation), `src/app/api/admin/files/[id]/route.ts` (authenticated download)

**Client-Side Storage:**
- IndexedDB (`talikha-file-storage` database) - Temporary file staging in browser before upload
  - Implementation: `src/lib/file-storage.ts`
  - Stores: blob data + file metadata in two object stores

**Caching:**
- None (no Redis/Memcached; in-memory rate limiting only)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password)
  - Implementation: `src/lib/auth.ts` (server-side session resolution)
  - Login UI: `src/components/admin-login-form.tsx` (client-side `signInWithPassword`)
  - Middleware: `src/proxy.ts` (session refresh + `/admin` route protection)
  - Signup: Disabled (`enable_signup = false` in `supabase/config.toml`)
  - Team accounts: Provisioned via admin API (`src/app/api/admin/accounts/route.ts`, `src/lib/team-accounts.ts`)
  - Username scheme: `{username}@team.talikha.internal` (synthetic emails for non-email usernames)

**Authorization:**
- Role-based: `admin`, `editor`, `viewer` (stored in `profiles` table)
- View-level access: `access_views` array on profiles controls admin panel sections
- Hardcoded owner email: `jbotoy83@gmail.com` auto-promoted to admin (`src/lib/auth.ts:29`)
- Local dev bypass: `LOCAL_ADMIN_BYPASS=true` or absent Supabase config → synthetic admin user
- Admin email allowlist: `ADMIN_EMAILS` env var (comma-separated)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, LogRocket, or similar)

**Logs:**
- Console-based (no structured logging framework)
- Dev server logs: `dev-server.log`, `dev-server-error.log` (gitignored)
- Admin activity tracking: `src/app/api/admin/activity/route.ts` (writes to Supabase)

**Analytics:**
- Not implemented (consent UI exists but provider is disabled)
- Gate: `NEXT_PUBLIC_ANALYTICS_ENABLED=false` enforced by `src/lib/launch.ts`
- Consent components: `src/components/privacy-banner.tsx`, `src/components/privacy-preferences.tsx`
- Publication metrics (views/downloads) tracked in-database, not via external analytics

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js platform)
  - Config: `vercel.json` (cron schedule, admin headers)
  - `.vercel/` directory present (project linked)
  - Admin panel: built as static SPA, copied to `public/admin/`, served by Next.js

**CI Pipeline:**
- None detected (no GitHub Actions, no `.github/workflows/`)
- Local checks: `npm run check` (typecheck + lint + build)
- Launch readiness: `npm run readiness` → `scripts/check-launch-readiness.mjs`

**Scheduled Jobs:**
- Vercel Cron: `0 0 * * *` → `/api/cron/journal-lifecycle` (daily journal state transitions)
  - Implementation: `src/app/api/cron/journal-lifecycle/route.ts`
  - Logic: `src/lib/journal-lifecycle.ts`

## Environment Configuration

**Required env vars (production):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only admin key (never expose to client)
- `SUPABASE_PROJECT_REF` - Project identifier
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile server verification
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Turnstile client widget key
- `ADMIN_EMAILS` - Comma-separated admin allowlist
- `JOURNAL_STORE_TOKEN` - Auth token for journal store writes

**Feature flags:**
- `SITE_INDEXING_ENABLED` - Controls robots/X-Robots-Tag headers
- `SUBMISSIONS_ENABLED` - Gates public submission forms
- `DEMO_CONTENT_ENABLED` - Shows/hides demo content
- `NEXT_PUBLIC_ANALYTICS_ENABLED` - Must remain false until provider chosen
- `CONTENT_APPROVED`, `LEGAL_APPROVED`, `OWNER_LAUNCH_APPROVED` - Manual launch gates
- `DATABASE_SECURITY_APPROVED` - DB security review gate

**Public site identity (NEXT_PUBLIC_):**
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_TAGLINE`
- `NEXT_PUBLIC_CONTACT_EMAIL` - editor@talikhapublishing.com
- `REMOTE_IMAGE_HOSTS` - Comma-separated allowlist for external image hosts

**Secrets location:**
- `.env.local` (gitignored, present in workspace)
- `.env.example` documents all variables without values

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` - Supabase Auth redirect target (configured in `supabase/config.toml`)
- `/api/cron/journal-lifecycle` - Vercel Cron trigger (daily)

**Outgoing:**
- None (no outbound webhooks configured)

## Payment Processing

**Status:** Manual (no payment gateway integrated)
- Payment proof: Authors upload image/PDF proof via submission form
- Confirmation: Admin manually confirms via `/api/admin/submissions/[id]/payment/confirm`
- Receipts: Generated server-side as PDF, stored in `receipts` bucket
- Implementation: `src/lib/editorial-workflow-server.ts` (receipt generation), `src/app/api/admin/submissions/[id]/payment/confirm/route.ts`

## Email

**Status:** Not implemented
- No email service (Resend, SendGrid, etc.) configured
- No transactional email for submission confirmations or notifications
- Contact email is static: `NEXT_PUBLIC_CONTACT_EMAIL`

---

*Integration audit: 2026-07-27*
