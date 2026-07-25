# Talikha Publishing — Deployment & Handover Guide

This document describes how the Talikha Publishing platform is built, deployed, and
maintained. It reflects the live production setup as of the v1.0 production-readiness
release.

## 1. Architecture overview

Talikha Publishing is a single Next.js application that serves both the public website
and the publisher admin workspace.

- **Frontend / app:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS.
- **Admin workspace:** the `admin-panel/` Vite project is imported directly into the
  Next.js app (`src/app/admin/page.tsx` renders `PrototypeAdminPanel` from
  `admin-panel/src/main`). It is **not** deployed separately — it is bundled into the
  Next.js build. The Vite dev server (`admin-panel/`) exists only for standalone admin
  development and proxies `/api` to the Next.js server on port 3000.
- **Backend:** Supabase (PostgreSQL database, Auth, Storage). The project reference is
  `pigrcxjlmcnzwlkewtin`, region **Singapore (ap-southeast-1)**.
- **Hosting:** Vercel. Production URL: `https://talikhapublishing.vercel.app`.
  Custom domain `talikhapublishing.com` is attached in Vercel (pending DNS — see §5.3).
- **Source control:** GitHub `jbotoy83-hub/talikhapublishing`.

Data flow for a submission: the author fills the form → the app calls
`/api/submissions/init` (server action, service-role client) which creates the record
and returns signed upload URLs → the browser uploads files **directly to private
Supabase Storage** → the app calls `/api/submissions/complete`, which validates the
uploaded files (magic-byte signature check) and finalizes the record. Admins see the
submission through `/api/admin/workspace`.

## 2. Infrastructure references

| System   | Identifier                                                        |
| -------- | ----------------------------------------------------------------- |
| Supabase | project `pigrcxjlmcnzwlkewtin` (Singapore / ap-southeast-1)        |
| Vercel   | project `talikhapublishing` (scope `jbotoy83-2211s-projects`)      |
| GitHub   | `jbotoy83-hub/talikhapublishing`                                   |
| Production URL | `https://talikhapublishing.vercel.app`                       |
| Custom domain  | `talikhapublishing.com` (attached; awaiting DNS)             |

## 3. Environment variables

Variables live in three places: `.env.local` (local dev, git-ignored), Vercel project
settings (Production + Preview), and the Supabase dashboard. **Never commit secret
values.** `.env.example` documents the full list with empty values.

Supabase (required for the app to connect):

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser-safe | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser-safe | Public anon/publishable key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Service-role key; bypasses RLS; never sent to the browser |
| `SUPABASE_PROJECT_REF` | server | Project reference (`pigrcxjlmcnzwlkewtin`) |

Site identity / feature gates (see `.env.example` for the full set):

- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, etc. — public branding.
- `SUBMISSIONS_ENABLED` — opens/closes the public submission form and API.
- `SITE_INDEXING_ENABLED` — when false, sends `noindex` and disables the sitemap/llms.txt.
- `DEMO_CONTENT_ENABLED` — falls back to demo content when the database has none.
- `CONTENT_APPROVED`, `LEGAL_APPROVED`, `OWNER_LAUNCH_APPROVED`, `DATABASE_SECURITY_APPROVED` — manual launch gates enforced only when indexing is enabled.
- `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — optional Cloudflare Turnstile bot protection. When unset, submissions rely on the honeypot field + per-IP rate limiting.
- `ADMIN_EMAILS` — optional comma-separated admin allowlist (alternative to the `profiles.role`).

The content-security policy in `next.config.ts` allows `connect-src`/`img-src` to the
Supabase origin (derived from `NEXT_PUBLIC_SUPABASE_URL`) plus Cloudflare Turnstile.

## 4. Local development

```bash
npm install                 # also installs admin-panel deps via postinstall
npm run dev                 # Next.js on http://localhost:3000
# optional standalone admin dev:
cd admin-panel && npm install && npm run dev   # Vite on http://localhost:5173 (proxies /api to :3000)
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run check` (typecheck + lint + build), `npm run db:types`
(regenerates `src/types/database.generated.ts` from the linked Supabase schema).

Local `.env.local` must contain the Supabase variables above. A local admin bypass
exists for development only (`LOCAL_ADMIN_BYPASS=true`, or automatically when no
Supabase admin client is configured); it is **disabled in production**.

## 5. Deployment (Vercel)

### 5.1 How it deploys

The Vercel project is connected to the GitHub repo. Build command: `next build`.
The install step runs `npm install`, whose `postinstall` script also installs the
`admin-panel/` dependencies — this is required because the admin panel is bundled into
the Next.js build but has its own `package.json` (Tailwind v4, fonts, html2canvas,
jspdf). Without it the build fails with "module not found".

### 5.2 Environment variables on Vercel

All variables from `.env.local` are mirrored in Vercel for the **Production** and
**Preview** environments. After changing any variable in Vercel, create a new
deployment (old deployments do not pick up new values automatically).

### 5.3 Custom domain

`talikhapublishing.com` is attached in Vercel. To activate it, set at the domain
registrar:

- `A` record: `talikhapublishing.com` → `76.76.21.21`
- (optional) `CNAME`: `www` → `cname.vercel-dns.com`

Vercel verifies automatically and provisions HTTPS.

### 5.4 Preview deployments

Preview deployments (per branch) are protected by Vercel Authentication (Vercel login)
by default; **production is public**. This is configured under
Vercel → Project Settings → Deployment Protection.

## 6. Database & migrations

Schema changes are tracked in `supabase/migrations/` and applied with:

```bash
supabase db push --linked          # applies new migrations to the remote project
```

The schema (24+ tables) covers profiles, journals, issues, authors, publications,
submissions and their files/history/authors, the unified editorial workflow
(`workflow_events`, `workflow_checklist_items`, `author_requests`, `payments`,
`receipts`, `publication_records`, `notifications`), and certificates. Row Level
Security is enabled on every table. `workflow_events` is **immutable** (a trigger
blocks update/delete) to preserve the audit trail.

Never make ad-hoc schema changes through the dashboard; always add a migration.

## 7. Admin operations

### 7.1 Provisioning an account

Sign-up is disabled by design. Create accounts with the service-role client, then set
the profile role:

```js
const { data } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
await supabase.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
```

Roles: `admin`, `editor`, `viewer`. Alternatively, add the email to `ADMIN_EMAILS`.

### 7.2 Signing in

`/admin/login` supports password sign-in (works now) and magic-link sign-in (requires
the redirect URLs in §9.1). The current admin is `jbotoy83@gmail.com`.

## 8. Security posture

- **Row Level Security** is enabled on all tables. Anonymous users can read only
  published content; editorial tables (submissions, workflow, profiles, etc.) are
  restricted to editorial roles; authors can read their own submission data.
- **Storage:** six buckets — `submission-files`, `submission-proofs`, `receipts`,
  `certificates`, `certificate-assets` are **private**; only `editorial-media` is
  public. Private manuscripts are served via short-lived signed URLs, never public URLs.
- **Service-role key** is server-only (`src/lib/supabase/admin.ts`, marked
  `server-only`), never prefixed with `NEXT_PUBLIC_`, and not present in source control.
- **CSP** (`next.config.ts`) restricts `connect-src`/`img-src` to self, the Supabase
  origin, and Cloudflare Turnstile; sets HSTS, `X-Frame-Options: DENY`, `nosniff`, etc.
- **Admin routes** are protected server-side (`getAdminUser()`); the admin data API
  returns 401 when unauthenticated.
- **Submissions** are protected by server-side zod validation, a honeypot field,
  per-IP rate limiting, and (optionally) Cloudflare Turnstile.

## 9. Maintenance tasks

### 9.1 Enable magic-link login (one-time)

In the Supabase dashboard → Authentication → URL Configuration, set:

- **Site URL:** `https://talikhapublishing.com`
- **Redirect URLs:**
  - `https://talikhapublishing.com/auth/callback`
  - `https://talikhapublishing.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev)

### 9.2 Rotate API keys (periodic / after exposure)

Supabase dashboard → Project Settings → API. Rotate the **legacy** JWT keys (the app
uses the newer publishable/secret keys, so rotating the legacy JWT does not affect the
running app). Update `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` and Vercel if you rotate the active keys, then redeploy.

### 9.3 Regenerate database types

After schema changes: `npm run db:types` (requires `supabase` linked).

## 10. Rollback

- **Application:** in Vercel → Deployments, promote the previous known-good deployment
  ("Promote to Production"), or revert the release commit and let Vercel redeploy.
- **Database:** do not blindly reverse a migration after data has been written. Prefer a
  forward-fix migration, or restore a Supabase backup (Dashboard → Database → Backups).
  Never run destructive SQL without a confirmed backup and an affected-row analysis.

## 11. Known follow-ups

- Activate the `talikhapublishing.com` DNS (§5.3).
- Enable magic-link redirect URLs (§9.1) if magic-link login is desired.
- Rotate the legacy service-role JWT (§9.2) as routine hygiene.
- Optionally wire the generated `database.generated.ts` types into queries for
  end-to-end type safety (queries are currently untyped but validated at runtime).
