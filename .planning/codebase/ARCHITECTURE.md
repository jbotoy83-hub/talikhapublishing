<!-- refreshed: 2026-07-31 -->
# Architecture

**Analysis Date:** 2026-07-31

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                              Clients (browser)                             │
├───────────────────────────────────┬──────────────────────────────────────┤
│   Public site (Next.js 16 RSC)     │   Admin panel (Vite + React 19 SPA)   │
│   `src/app/`  `components/`        │   `admin-panel/src/main.tsx`          │
│   Served at `/`  (localhost:3000)  │   Built → `public/admin/`, served `/admin` │
└──────────────┬────────────────────┴───────────────┬──────────────────────┘
               │ RSC reads (anon)                    │ fetch `/api/admin/*` (cookies)
               │ public writes `/api/*`              │ fetch `/api/journal-store`
               ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│            Next.js server layer  (route handlers + middleware)            │
│   `src/proxy.ts` (session refresh + /admin guard)                         │
│   `src/app/api/**/route.ts`  →  `src/lib/*` (server logic, "server-only") │
│   `src/lib/admin-api.ts` (auth guards)   `src/lib/auth.ts` (identity)     │
└──────────────┬───────────────────────────────────────────┬───────────────┘
               │ anon / service-role clients                │
               ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│   Supabase  (`src/lib/supabase/` factories)                                │
│   Postgres (34 tables + functions) · Auth (SSR cookies) · Storage buckets  │
│   `submission-files` (private) · `editorial-media` (public)                │
└──────────────────────────────────────────────────────────────────────────┘
        ▲                                   ▲
        │ rate limit                        │ bot check
┌───────┴────────┐                  ┌───────┴──────────────┐
│ Upstash Redis  │                  │ Cloudflare Turnstile  │
│ `rate-limit.ts`│                  │ `turnstile.ts`        │
└────────────────┘                  └───────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Middleware / proxy | Refresh Supabase session cookie; redirect unauthenticated `/admin` traffic to login; set no-index/no-store headers | `src/proxy.ts` |
| Identity resolver | Resolve the current admin user from JWT claims + `profiles`; enforce role; local dev bypass | `src/lib/auth.ts` |
| API auth guards | `requireEditorApi` / `requireAdminApi` / body + error helpers for route handlers | `src/lib/admin-api.ts` |
| Supabase clients | Null-guarded client factories (server/browser/public/admin service-role) | `src/lib/supabase/*.ts` |
| Public content reads | Server-side reads of journals/issues/publications/authors; demo + JSON-store fallbacks | `src/lib/content.ts` |
| Editorial workflow | Submission state transitions, checklist, payment gating (wraps DB functions) | `src/lib/editorial-workflow-server.ts`, `src/lib/editorial-workflow.ts` |
| Journal lifecycle | Derives current/submission issues; runs on cron and before reads/writes | `src/lib/journal-lifecycle.ts` |
| Journal store sync | Persists the admin-edited catalog to `journals`/`issues` + uploads covers | `src/app/api/journal-store/route.ts` |
| Public submission intake | Validates, rate-limits, Turnstile-checks, creates submission + payment + signed uploads | `src/app/api/submissions/init/route.ts` |
| Launch gates | Feature flags + production launch assertion | `src/lib/launch.ts` |
| Admin SPA | Single-page editorial workspace (overview, inbox, journals, certificates, preflight, team) | `admin-panel/src/main.tsx` + `admin-panel/src/components/*` |
| Admin build bridge | Copies Vite build into `public/admin/` for Next to serve | `scripts/copy-admin-build.mjs` |

## Pattern Overview

**Overall:** Two-app monorepo. A server-rendered Next.js App Router site plus a client-rendered Vite SPA that talks to Next.js service-role API route handlers, all backed by one Supabase project.

**Key Characteristics:**
- React Server Components for the public site; client components only where interactivity is needed (`"use client"`).
- The admin panel is a **static SPA bundled into the Next public folder** and served under `/admin` via rewrites — it is not a Next route. Its data access is entirely through `fetch("/api/admin/...")`.
- Service-role Supabase client (`getSupabaseAdmin`) is the workhorse for all writes; RLS is effectively bypassed server-side, so authorization is enforced in app code (`src/lib/admin-api.ts`).
- Null-guarded integration: every Supabase/Redis factory returns `null` when unconfigured, and callers degrade gracefully (demo content / local JSON store / "allow all").
- Feature-flagged launch: indexing, submissions, and demo content are gated by env vars (`src/lib/launch.ts`).

## Layers

**Route layer (Next.js App Router):**
- Purpose: URL → handler mapping, layouts, metadata, RSC pages.
- Location: `src/app/` (route group `(public)` for marketing/content pages, `admin/` for the login/preview shells, `api/` for handlers, plus `auth/callback`, `certificate-access/[token]`, `feed.xml`, `llms.txt`).
- Contains: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `not-found.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts`.
- Depends on: `src/lib/*`, `src/components/*`.
- Used by: browsers (HTML) and the admin SPA (JSON APIs).

**Server logic layer:**
- Purpose: all business logic, validation, Supabase queries, PDF/citation/certificate generation.
- Location: `src/lib/` (every file starts with `import "server-only"` where it touches the server).
- Contains: domain modules (`content.ts`, `submission.ts`, `editorial-workflow-server.ts`, `certificates.ts`, `journal-lifecycle.ts`, `publication-preflight.ts`, `search.ts`, `team-accounts.ts`, etc.).
- Depends on: `src/lib/supabase/*`, `src/types/database.generated.ts`.
- Used by: route handlers and RSC pages.

**Client/SPA layer:**
- Purpose: interactive UI. Public site client components in `src/components/`; the entire admin SPA in `admin-panel/src/`.
- Location: `src/components/` (site), `admin-panel/src/main.tsx` + `admin-panel/src/components/` (admin).
- Depends on: browser Supabase client (`src/lib/supabase/browser.ts`) for the site; `fetch` to `/api/*` for the admin.
- Used by: end users and editors.

**Data layer:**
- Purpose: persistence and auth.
- Location: Supabase (Postgres/Auth/Storage); migrations in `supabase/migrations/`.
- Depends on: nothing in-repo (external).
- Used by: the server logic layer via the client factories.

## Data Flow

### Primary Request Path — public page read

1. Request hits middleware → session refreshed, headers set (`src/proxy.ts:28`).
2. RSC page/layout runs; `assertLaunchConfiguration()` validates launch gates (`src/app/layout.tsx:71`).
3. Page calls a `src/lib/content.ts` getter (e.g. `getPublications`, `getJournals`).
4. `content.ts` reads via `getPublicSupabase()`/`getSupabaseAdmin()`, falling back to `src/data/journal-store.json` and `src/data/demo-content.ts` when Supabase is absent or demo mode is on (`src/lib/content.ts:46`).
5. Rendered HTML returned.

### Admin Path — editorial write

1. Editor loads `/admin`; middleware redirects to `/admin/login` if no session (`src/proxy.ts:31`).
2. SPA (`admin-panel/src/main.tsx`) calls `fetch("/api/admin/...")` with `credentials: "same-origin"`.
3. Route handler runs an auth guard first: `const user = await requireEditorApi(); if (isApiError(user)) return user;` (`src/lib/admin-api.ts:7`).
4. Body parsed/validated: `readJsonBody` + a Zod schema (`src/lib/admin-api.ts:29`).
5. Server logic calls `getSupabaseAdmin()` (service-role) and often a DB function (e.g. `transition_submission`) — see `src/app/api/admin/submissions/[id]/advance/route.ts`.
6. JSON response (`{ ok, data }` or `{ error }`) returned to the SPA.

### Public Submission Path

1. SPA/form POSTs to `/api/submissions/init` (`src/app/api/submissions/init/route.ts:33`).
2. Gates: `isSubmissionsEnabled()` → rate limit (`allowRequest`) → body size → Zod `submissionInitSchema.safeParse` → honeypot (`input.website`) → Turnstile (`verifyTurnstileToken`).
3. Validates journal/issue are still open via service-role reads.
4. Idempotency check on `idempotency_key`; inserts `submissions` + `payments`; creates signed upload URLs for the private `submission-files` bucket.
5. Client uploads files directly to Supabase Storage with the signed tokens, then `/api/submissions/complete` finalizes.

### Journal Catalog Sync Path

1. Admin edits the catalog in `JournalsView` (`admin-panel/src/main.tsx`) and clicks save → `publishCatalogToSite` POSTs to `/api/journal-store`.
2. `POST /api/journal-store` (`src/app/api/journal-store/route.ts:213`) upserts `journals` and `issues`, uploads base64 covers to the `editorial-media` bucket, records `media_assets`, and sets `current_issue_id`/`submission_issue_id`.
3. Public reads pick up the new catalog through `content.ts` (DB-first) on the next request.

**State Management:**
- Public site: server state in Supabase; RSC reads; minimal client state.
- Admin SPA: local React state in `main.tsx`; the journal catalog is also mirrored to `localStorage` (`talikha-journal-catalog-v2`) as an offline cache, with the server treated as authoritative (`admin-panel/src/main.tsx:796`).

## Key Abstractions

**Supabase client factories:**
- Purpose: centralize client creation + null-guarding so missing env never crashes a request.
- Examples: `src/lib/supabase/server.ts`, `admin.ts`, `browser.ts`, `public.ts`, `config.ts`.
- Pattern: read env → return `SupabaseClient | null`; callers branch on `null`.

**API guard + response helpers:**
- Purpose: uniform authz and error shaping across ~40 admin route handlers.
- Examples: `src/lib/admin-api.ts` (`requireEditorApi`, `requireAdminApi`, `isApiError`, `readJsonBody`, `apiErrorResponse`).
- Pattern: guard returns `AdminUser | NextResponse`; caller short-circuits on `isApiError`.

**Editorial workflow / DB functions:**
- Purpose: keep submission state transitions transactional in Postgres.
- Examples: `src/lib/editorial-workflow-server.ts` wraps DB functions like `transition_submission`, `confirm_payment_and_start_review`.
- Pattern: app code calls a named Postgres function rather than ad-hoc UPDATEs.

**Launch gates:**
- Purpose: prevent premature production exposure.
- Examples: `src/lib/launch.ts` (`isIndexingEnabled`, `isSubmissionsEnabled`, `assertLaunchConfiguration`).
- Pattern: boolean env readers + a hard throw in the root layout when indexing is misconfigured.

## Entry Points

**Public site root layout:**
- Location: `src/app/layout.tsx`.
- Triggers: every public route.
- Responsibilities: fonts (Inter/Literata via `next/font`), metadata/OG/robots, launch assertion, global styles.

**Middleware:**
- Location: `src/proxy.ts` (exported `proxy` + `config.matcher`).
- Triggers: all matched requests.
- Responsibilities: Supabase session refresh, `/admin` auth redirect, security/SEO headers.

**Admin SPA bootstrap:**
- Location: `admin-panel/src/main.tsx` (mounted from `admin-panel/index.html`).
- Triggers: loading `/admin`.
- Responsibilities: renders the sidebar shell and all workspaces; imports shared citation logic from `../../src/lib/`.

**API route handlers:**
- Location: `src/app/api/**/route.ts`.
- Triggers: fetches from the SPA and public forms, plus the Vercel cron.
- Responsibilities: all server-side mutations and privileged reads.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop; no worker threads in app code. PDF workers (`pdfjs-dist`) run client-side.
- **Global state:** The admin SPA keeps a module-level mutable `JOURNAL_CATALOG` singleton (`admin-panel/src/main.tsx:807`) synced to `localStorage` and a `talikha:catalog` CustomEvent. The rate-limiter cache is a module-level `Map` (`src/lib/rate-limit.ts:8`) — does not survive across serverless instances.
- **Cross-app import:** The admin SPA imports shared modules from the parent repo via relative paths (`../../src/lib/apa-citation`, `../../src/lib/citation-format`, `../../src/lib/types`) and a Vite alias for `@/components/icons` → `../src/components/icons`. This couples the two apps at build time.
- **React dedupe:** Admin Vite aliases `react`/`react-dom` to the root `node_modules` to avoid two React copies (`admin-panel/vite.config.ts:13`).
- **Service-role trust boundary:** Because `getSupabaseAdmin` bypasses RLS, every privileged handler MUST call an `admin-api.ts` guard. Missing a guard = unauthenticated data access (see CONCERNS.md for an existing gap).
- **Circular imports:** None detected at the module level; the cross-app imports are one-directional (admin → root `src/lib`).

## Anti-Patterns

### Admin route without an auth guard

**What happens:** A `/api/admin/*` handler reads/writes via `getSupabaseAdmin` without calling `requireEditorApi`/`requireAdminApi`.
**Why it's wrong:** The service-role client bypasses RLS, so the endpoint becomes publicly callable. `/api/admin/dashboard` currently has this gap (CONCERNS.md).
**Do this instead:** Start every handler with the guard pattern in `src/app/api/admin/submissions/[id]/advance/route.ts:6` — `const user = await requireEditorApi(); if (isApiError(user)) return user;`.

### Importing server-only logic into the admin SPA bundle

**What happens:** Reaching into `src/lib/*` modules that `import "server-only"` or touch `process.env` / Node APIs from `admin-panel/src/`.
**Why it's wrong:** `server-only` throws when bundled for the browser, and Node APIs break the SPA build.
**Do this instead:** Only import pure, browser-safe shared modules (e.g. `src/lib/apa-citation.ts`, `src/lib/citation-format.ts`, `src/lib/types.ts`). New shared logic must stay free of `server-only`/Node imports — see how `admin-panel/src/main.tsx:5` imports citations.

### Treating the in-memory rate limiter as production security

**What happens:** Relying on `src/lib/rate-limit.ts` alone to throttle abuse.
**Why it's wrong:** The limiter is per-instance memory (plus optional Upstash). On Vercel serverless, counters reset per invocation/region, and with no Upstash config it returns `true` for everything.
**Do this instead:** Ensure `UPSTASH_REDIS_REST_URL`/`TOKEN` are set in production; treat the limiter as one layer alongside Turnstile and DB constraints.

## Error Handling

**Strategy:** Fail soft on reads, fail explicit on writes. Integration clients return `null` when unconfigured; route handlers return structured JSON errors.

**Patterns:**
- Route handlers wrap logic in `try/catch` and return `apiErrorResponse(error, fallback)` which maps `ZodError` → 400 with the first issue message (`src/lib/admin-api.ts:41`).
- Auth failures return `401`/`403` `NextResponse` from the guards; callers detect via `isApiError`.
- Public content reads swallow errors and fall back to defaults (`src/lib/content.ts:51` catch → `DEFAULT_JOURNAL_STORE`).
- Launch misconfiguration throws hard in the root layout (`src/lib/launch.ts:88`) to block indexing.
- The admin SPA surfaces server `error` strings in inline messages (e.g. journal sync failures in `admin-panel/src/main.tsx`).

## Cross-Cutting Concerns

**Logging:** Minimal — bracketed `console.error` tags in sync paths; an `audit_events` table for administrative actions written by handlers.
**Validation:** Zod `safeParse`/`parse` at every API boundary (`src/lib/submission.ts`, `src/lib/admin-api.ts`); DB-level constraints + Postgres functions for invariants.
**Authentication:** Supabase SSR cookies refreshed in `src/proxy.ts`; identity + role resolved in `src/lib/auth.ts`; per-handler authorization in `src/lib/admin-api.ts`.
**Security headers:** Centralized in `next.config.ts` (CSP, HSTS, X-Frame-Options DENY, Permissions-Policy, COOP) plus `poweredByHeader: false`.
**Feature flags:** Env-driven gates in `src/lib/launch.ts` control indexing, submissions, demo content, and AI-training consent.

---

*Architecture analysis: 2026-07-31*
