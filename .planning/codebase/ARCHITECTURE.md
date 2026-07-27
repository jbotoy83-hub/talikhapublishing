<!-- refreshed: 2026-07-27 -->
# Architecture

**Analysis Date:** 2026-07-27

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────┐
│                          Browser / Clients                             │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │                                    │
                ▼                                    ▼
┌───────────────────────────────────┐  ┌────────────────────────────────┐
│   Public Site (Next.js App Router) │  │   Admin Panel (Vite React SPA)  │
│   `src/app/`                       │  │   `admin-panel/src/`            │
│   Server Components + API routes   │  │   Client-only, base `/admin/`   │
│   Routes: (public), auth, api,     │  │   Entry: `admin-panel/src/      │
│   certificate-access, feed, llms   │  │   main.tsx`                     │
└───────────────┬───────────────────┘  └───────────────┬────────────────┘
                │                                       │
                │  Server Components read directly      │  fetch("/api/admin/*")
                │  via anon / SSR Supabase clients      │  (NO direct Supabase)
                ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────┐
│              Next.js Route Handlers  `src/app/api/**/route.ts`         │
│   Guarded by `requireEditorApi()` / `requireAdmin()` (`src/lib/`)      │
│   Use service-role client `getSupabaseAdmin()` for writes              │
└───────────────┬───────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│   Supabase (Postgres + Auth + Storage)                                 │
│   Schema: `supabase/migrations/*.sql` (32 migrations)                  │
│   Types:  `src/types/database.generated.ts`                            │
└───────────────────────────────────────────────────────────────────────┘
```

**The two apps in one repo:**

- **Public site** — a Next.js 16 App Router application at the repo root (`src/`, `components/`, `package.json`). Renders all visitor-facing pages and hosts every API route handler.
- **Admin panel** — a standalone Vite + React 19 single-page app in `admin-panel/`. It is **built and shipped as static assets inside the Next.js app**, not run as a separate service in production.

**How the admin SPA is served (critical to understand):**

1. `admin-panel/vite.config.ts` sets `base: "/admin/"` for production builds.
2. `npm run build` (root) runs `build:admin` (Vite build) → `copy:admin` (`scripts/copy-admin-build.mjs` copies `admin-panel/dist` → `public/admin`) → `next build`.
3. `next.config.ts` rewrites `/admin` and `/admin/` → `/admin/index.html` (the copied SPA shell).
4. The SPA does **internal, state-based navigation** (sidebar index switching in `admin-panel/src/main.tsx`), not a URL router — so deep admin URLs are not separate SPA entry points.
5. In **development**, the SPA runs via Vite (`localhost:5173/admin`) and `admin-panel/vite.config.ts` proxies `/api` and `/admin/login` to the Next dev server at `localhost:3000`.

**Division of labor for `/admin`:**

| Path | Served by | File |
|------|-----------|------|
| `/admin`, `/admin/` | Vite SPA (static `index.html`) | `public/admin/index.html` (built) |
| `/admin/login` | Next.js server page | `src/app/admin/login/page.tsx` |
| `/admin/welcome` | Next.js server page (first-sign-in setup) | `src/app/admin/welcome/page.tsx` |
| All other admin workspace views | Vite SPA (in-memory navigation) | `admin-panel/src/main.tsx` + `admin-panel/src/components/*` |

> Note: `src/app/admin/` contains subfolders (`authors/`, `certificates/`, `journals/`, etc.) but **only `login/` and `welcome/` contain `page.tsx`**. The other folders hold dynamic `[id]/` segments and server-action helpers (`src/app/admin/actions.ts`, `src/app/admin/workflow-actions.ts`), not standalone pages. The SPA owns the workspace UI.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Public site shell | Root layout, metadata, providers | `src/app/layout.tsx` |
| Public pages | Marketing, journals, publications, authors, submit, track, search | `src/app/(public)/**/page.tsx` |
| API route handlers | All data mutations + admin reads | `src/app/api/**/route.ts` |
| Auth middleware | Session refresh + `/admin` guard | `src/proxy.ts` |
| OAuth callback | Exchange code for session | `src/app/auth/callback/route.ts` |
| Auth logic | Resolve admin user, roles, guards | `src/lib/auth.ts`, `src/lib/admin-api.ts` |
| Supabase clients | 4 client factories (server/browser/admin/public) | `src/lib/supabase/*.ts` |
| Admin SPA entry | Workspace shell + all inline views | `admin-panel/src/main.tsx` |
| Admin workspaces | Certificates, inbox, team accounts, dock | `admin-panel/src/components/{certificates,inbox}/*` |
| Database schema | Migrations + seed | `supabase/migrations/*.sql`, `supabase/seed.sql` |
| Generated DB types | TypeScript types from live schema | `src/types/database.generated.ts` |

## Pattern Overview

**Overall:** Two-app monorepo — server-rendered Next.js public site + statically-embedded Vite admin SPA, both backed by one Supabase project.

**Key Characteristics:**
- Next.js **App Router** with React Server Components by default; interactivity isolated to `"use client"` components.
- Admin UI is a **client-only SPA** that never touches Supabase directly — it only calls the site's own `/api/admin/*` route handlers.
- **Service-role** Supabase client (`getSupabaseAdmin()`) is used server-side for admin writes, bypassing RLS; public reads use anon/SSR clients that respect RLS.
- Auth is **Supabase Auth via SSR cookies**, guarded at the edge by `src/proxy.ts`.
- Database types are **code-generated** from the live Supabase schema (`npm run db:types`).

## Layers

**Presentation — Public (Server Components):**
- Purpose: Render visitor pages, SEO metadata, JSON-LD, sitemaps/feeds.
- Location: `src/app/(public)/`, `src/components/`
- Contains: `page.tsx` server components, layout, shared UI (`site-header.tsx`, `site-footer.tsx`, publication cards/readers).
- Depends on: `src/lib/content.ts`, `src/lib/site.ts`, Supabase public/SSR clients.
- Used by: End visitors.

**Presentation — Admin (Client SPA):**
- Purpose: Editorial workspace (submissions, journals, certificates, inbox, authors, media, finance preview).
- Location: `admin-panel/src/`
- Contains: `main.tsx` (monolithic shell + many inline views), `components/{certificates,inbox,ui,icons}/`.
- Depends on: `/api/admin/*` via `fetch`, one shared helper `../../src/lib/apa-citation`.
- Used by: Authenticated admin/editor users.

**API / Application layer:**
- Purpose: Validate requests, enforce auth/role, orchestrate Supabase reads/writes.
- Location: `src/app/api/**/route.ts`
- Contains: Route handlers grouped by domain (`admin/`, `submissions/`, `publications/`, `journal-store/`, `track/`, `cron/`).
- Depends on: `src/lib/admin-api.ts`, `src/lib/auth.ts`, `src/lib/supabase/admin.ts`, domain libs in `src/lib/`.
- Used by: Admin SPA, public client components, cron.

**Domain / business logic:**
- Purpose: Reusable server-side domain operations.
- Location: `src/lib/` (e.g. `certificates.ts`, `journal-lifecycle.ts`, `editorial-workflow-server.ts`, `submission.ts`, `receipt-pdf.tsx`, `certificate-security.ts`).
- Depends on: Supabase clients, `src/types/database.generated.ts`.
- Used by: API routes and server pages.

**Data layer:**
- Purpose: Postgres schema, RLS policies, seed data.
- Location: `supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml`.
- Contains: 32 timestamped migrations + generated types.
- Used by: All Supabase clients.

## Data Flow

### Primary Request Path — Public page render

1. Request hits Next.js; `src/proxy.ts` refreshes the Supabase session cookie (pass-through for public routes).
2. App Router renders `src/app/(public)/<route>/page.tsx` as a Server Component.
3. Page calls domain lib (e.g. `src/lib/content.ts`) which uses the anon/public Supabase client (`src/lib/supabase/public.ts`) — RLS applies.
4. Rendered HTML returned; client components hydrate for interactivity.

### Admin Data Path — SPA mutation

1. Authenticated user interacts with the SPA (`admin-panel/src/main.tsx` or a workspace component).
2. SPA calls `fetch("/api/admin/<domain>", { method: "POST", body })` — relative URL, same origin.
3. Route handler (`src/app/api/admin/<domain>/route.ts`) calls `requireEditorApi()` (`src/lib/admin-api.ts`) → `getAdminUser()` (`src/lib/auth.ts`).
4. On success, handler uses `getSupabaseAdmin()` (service-role, `src/lib/supabase/admin.ts`) to read/write Postgres.
5. JSON response returned to the SPA; SPA updates local state.

### Auth Flow

1. User submits credentials via `src/components/admin-login-form.tsx` on `/admin/login` (`src/app/admin/login/page.tsx`).
2. Supabase Auth redirects to `/auth/callback` (`src/app/auth/callback/route.ts`), which exchanges the code for a session cookie and redirects to `/admin` (or `?next=`).
3. Every `/admin/*` request passes through `src/proxy.ts`; unauthenticated users are redirected to `/admin/login?next=<path>`.
4. `getAdminUser()` (`src/lib/auth.ts`) reads JWT claims (`supabase.auth.getClaims()`) + the `profiles` table to resolve `role` (`admin` | `editor` | `viewer`) and `access_views`.
5. A hardcoded owner email (`jbotoy83@gmail.com` in `configuredAdminEmails()`) is auto-promoted to admin.
6. **Local dev bypass:** when Supabase is not configured (or `LOCAL_ADMIN_BYPASS=true`, non-production only), `getAdminUser()` returns a synthetic local admin.

**State Management:**
- Public site: server-rendered; client state is local React state per component (no global store).
- Admin SPA: in-component `useState` plus a module-level mutable journal catalog (`JOURNAL_CATALOG` in `admin-panel/src/main.tsx`) mirrored to `localStorage` (`talikha-journal-catalog-v2`) and synced to the server via `/api/journal-store`.

## Key Abstractions

**Supabase client factories:**
- Purpose: Provide the right client per execution context.
- Examples: `src/lib/supabase/server.ts` (SSR, cookies), `browser.ts` (client), `admin.ts` (service-role), `public.ts` (anon, no session), `config.ts` (env helpers).
- Pattern: Each returns `SupabaseClient | null` so callers degrade gracefully when env vars are absent.

**Admin user + role guard:**
- Purpose: Centralize authz for pages and APIs.
- Examples: `getAdminUser()` / `requireAdmin()` in `src/lib/auth.ts`; `requireEditorApi()` in `src/lib/admin-api.ts`.
- Pattern: `requireEditorApi()` returns `AdminUser | NextResponse`; callers short-circuit with `isApiError()`.

**Generated database types:**
- Purpose: Type-safe table access.
- Examples: `src/types/database.generated.ts` (regenerate with `npm run db:types`).
- Pattern: Output of `supabase gen types typescript --linked --schema public`.

## Entry Points

**Public site:**
- Location: `src/app/layout.tsx` (root layout) + `src/app/(public)/page.tsx` (home).
- Triggers: Any visitor request.
- Responsibilities: Global layout, fonts, providers, page rendering.

**Admin SPA:**
- Location: `admin-panel/index.html` → `admin-panel/src/main.tsx`.
- Triggers: Loading `/admin` (served from `public/admin/` in prod, Vite in dev).
- Responsibilities: Mount the React workspace, render sidebar + active view, call `/api/admin/*`.

**Admin login (server):**
- Location: `src/app/admin/login/page.tsx`.
- Triggers: `/admin/login`, or redirect from `src/proxy.ts`.
- Responsibilities: Render login form, redirect authenticated users to `/admin/welcome`.

**Middleware / proxy:**
- Location: `src/proxy.ts` (exports `proxy` + `config.matcher`).
- Triggers: Every non-asset request.
- Responsibilities: Refresh Supabase session, guard `/admin`, set noindex/no-store headers on admin.

## Architectural Constraints

- **Threading:** Single-threaded Node/Next server; admin SPA is browser-side. No worker threads except PDF.js workers in the browser.
- **Global state:** Module-level `JOURNAL_CATALOG` singleton in `admin-panel/src/main.tsx` (mutable, localStorage-mirrored). Server libs are stateless singletons returned per call.
- **Circular imports:** None detected. The only cross-app import is one-directional: `admin-panel/src/main.tsx` → `../../src/lib/apa-citation`.
- **Admin SPA has no Supabase dependency:** `admin-panel/` contains zero Supabase imports; all data access is proxied through `/api/admin/*`. Do not add a Supabase client to the SPA.
- **Service role is server-only:** `src/lib/supabase/admin.ts` and `public.ts` import `"server-only"`; they must never be imported into client components or the SPA.
- **Static admin assets:** The SPA only works in prod after `copy:admin` copies `admin-panel/dist` → `public/admin`. `public/admin/` is build output, not source.
- **Routing split:** Only `/admin` and `/admin/` rewrite to the SPA. `/admin/login` and `/admin/welcome` are real Next pages; everything else under `/admin` is SPA-internal state.

## Anti-Patterns

### Calling Supabase from the admin SPA

**What happens:** Adding `@supabase/supabase-js` to `admin-panel/` and querying tables from the browser.
**Why it's wrong:** The SPA is intentionally decoupled; it would bypass the `requireEditorApi()` role checks and the service-role write path, and duplicate authz logic.
**Do this instead:** Add/extend a route handler under `src/app/api/admin/` guarded by `requireEditorApi()` (see `src/app/api/admin/authors/route.ts`), then `fetch` it from the SPA.

### Importing server-only libs into client code

**What happens:** Importing `src/lib/supabase/admin.ts`, `public.ts`, or `src/lib/auth.ts` into a `"use client"` component or the SPA.
**Why it's wrong:** These import `"server-only"` and read service-role secrets; they will break the build or leak the service key.
**Do this instead:** Use `src/lib/supabase/browser.ts` in client components, or route through an API handler.

### Duplicating UI primitives across the two apps

**What happens:** Editing a shadcn-style component in `components/ui/` and expecting the admin SPA to reflect it.
**Why it's wrong:** The two apps keep **separate** `ui/` folders (`components/ui/`, `src/components/ui/`, `admin-panel/src/components/ui/`) and separate `cn()` helpers (`src/lib/utils.ts`, `admin-panel/src/lib/utils.ts`). They are not shared.
**Do this instead:** Edit the component in the specific app that renders it.

## Error Handling

**Strategy:** Guard-then-act in API routes; graceful `null` from client factories; user-facing error strings.

**Patterns:**
- API routes call `requireEditorApi()`; if it returns a `NextResponse` (detected via `isApiError()`), return it immediately (`src/lib/admin-api.ts`).
- JSON body parsing via `readJsonBody()` returns a 400 `NextResponse` on failure.
- `apiErrorResponse(error, fallback)` maps `z.ZodError` to 400 with the first issue message; other errors to 400 with a fallback string.
- Missing Supabase config returns `503` with a friendly message (e.g. "The editorial database is not configured.").
- Client factories return `null` when env vars are missing rather than throwing.

## Cross-Cutting Concerns

**Logging:** Minimal `console.error` in the SPA for sync failures (e.g. `[journal-store] publish failed`); no structured server logger.
**Validation:** `zod` (`src/lib/admin-api.ts`, domain libs) for request bodies in API routes.
**Authentication:** Supabase Auth SSR cookies; edge guard in `src/proxy.ts`; role resolution in `src/lib/auth.ts`.
**Security headers:** CSP, HSTS, X-Frame-Options, Permissions-Policy set globally in `next.config.ts` `headers()`; admin routes additionally get `noindex`/`no-store`.
**Rate limiting / bot protection:** `src/lib/rate-limit.ts` and Cloudflare Turnstile (`src/lib/turnstile.ts`, `src/components/turnstile-widget.tsx`) on public forms.

---

*Architecture analysis: 2026-07-27*
