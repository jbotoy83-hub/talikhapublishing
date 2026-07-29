# Architecture

**Analysis Date:** 2026-07-30

## Pattern Overview

**Overall:** Two-application monorepo: a Next.js App Router site and a Vite/React admin SPA share one Supabase project. The Next.js app owns server rendering, authentication, APIs, and deployment; the admin SPA is compiled into the Next.js app as static `/admin` assets.

**Key Characteristics:**
- Public pages are Next.js Server Components under `src/app/(public)/` and read published content through server-side domain helpers.
- The admin UI is a client-only SPA rooted at `admin-panel/src/main.tsx`; it uses same-origin `fetch` calls and does not contain a Supabase client.
- Next.js route handlers under `src/app/api/` are the application boundary for mutations, privileged reads, file access, and public form APIs.
- Supabase provides PostgreSQL, Auth, private object storage, RPC functions, and row-level security; service-role access is confined to server modules.
- `npm run build` builds the admin app, copies it to `public/admin`, then builds the Next.js app for Vercel.

## System Boundary

```text
Browser
  |
  +--> Next.js public routes: `src/app/(public)/`
  |       |-- Server Components -> `src/lib/content.ts` -> public Supabase client
  |       `-- Client components -> public API routes / browser Supabase client when needed
  |
  +--> Admin shell: `/admin` -> `public/admin/index.html`
          |-- Vite bundle from `admin-panel/src/main.tsx`
          `-- same-origin `/api/admin/*` -> auth guard -> service-role Supabase client

Next.js server / route handlers
  |-- Auth/session: `src/proxy.ts`, `src/lib/auth.ts`, `src/app/auth/callback/route.ts`
  |-- Domain logic: `src/lib/`
  `-- Supabase: `src/lib/supabase/{server,browser,public,admin}.ts`

Supabase project
  |-- PostgreSQL schema and RLS: `supabase/migrations/`
  |-- Auth sessions and profiles
  `-- Private/public storage buckets and signed URLs
```

## Application Boundaries

### Public Next.js application

- Location: `src/app/`, `src/components/`, `src/lib/`, and root configuration files.
- Entry: `src/app/layout.tsx` and `src/app/(public)/page.tsx`.
- Responsibilities: public page rendering, metadata, JSON-LD, feeds, sitemap/robots, public search, submission intake, tracking, certificate access, and all server APIs.
- Public content reads use `getPublicSupabase()` from `src/lib/supabase/public.ts` and fall back to `src/data/journal-store.json` or `src/data/demo-content.ts` only when the configured launch mode permits it.
- Server-only modules such as `src/lib/auth.ts`, `src/lib/supabase/admin.ts`, and `src/lib/supabase/public.ts` must not be imported by client components.

### Admin Vite/React application

- Source: `admin-panel/index.html`, `admin-panel/src/main.tsx`, `admin-panel/src/components/`, and `admin-panel/src/lib/`.
- Responsibilities: authenticated editorial workspace views for submissions, production, scheduling, authors, studies, journals, featured publications, announcements, media, reports, activity, inbox, team accounts, and certificates.
- `admin-panel/src/main.tsx` is currently the SPA shell and a large view coordinator. View selection is URL state (`?view=...`) mapped to the `workspaceViews` array; it is not a separate Next route or React Router tree.
- The SPA calls `/api/admin/*` and `/api/journal-store` on the same origin. It has no direct Supabase import; the one root-source import is the shared citation helper `src/lib/apa-citation.ts`.
- Some non-authoritative UI state is kept in browser storage, including journal catalog edits, local development samples, schedule drafts, certificate editor layouts, and wallpaper preferences. Supabase-backed workspace data remains the production source of truth.

### Production serving boundary

1. `admin-panel/vite.config.ts` uses `/admin/` as the production asset base.
2. Root `package.json` runs `build:admin`, then `scripts/copy-admin-build.mjs` copies `admin-panel/dist` to `public/admin`.
3. `next.config.ts` rewrites `/admin` and `/admin/` to `/admin/index.html`.
4. `src/proxy.ts` protects `/admin` while excluding built admin assets and common static extensions from session interception.
5. `src/app/admin/login/page.tsx` and `src/app/admin/welcome/page.tsx` are real Next.js pages; the workspace itself is the embedded SPA.
6. `vercel.json` adds the scheduled `/api/cron/journal-lifecycle` invocation.

## Layers

### Route and presentation layer

- Purpose: define URLs, page composition, loading states, metadata, and browser interactions.
- Location: `src/app/`, `src/components/`, `admin-panel/src/main.tsx`, and `admin-panel/src/components/`.
- Public route groups include home, journals/issues, publications, authors, services, editorial standards, FAQ, search, submit, track, privacy, terms, certificate access, feeds, and discovery files.
- Admin presentation is split between Next auth/setup pages and the embedded Vite SPA.
- Depends on: domain helpers, client factories, and route handlers.

### API and application layer

- Purpose: validate requests, enforce access, orchestrate domain operations, and return HTML, JSON, streams, redirects, or signed-file redirects.
- Location: `src/app/api/**/route.ts`.
- Groups: `admin/`, `submissions/`, `publications/`, `track/`, `journal-store/`, `announcements/`, `search/`, and `cron/journal-lifecycle/`.
- Admin routes use `src/lib/admin-api.ts` for editor mutations or `getAdminUser()` for authenticated reads and session/account operations.
- Public submission routes use Zod schemas, rate limits, optional Cloudflare Turnstile verification, and private storage validation.

### Domain and workflow layer

- Purpose: hold reusable business rules and database orchestration outside route handlers.
- Location: `src/lib/`.
- Important modules: `content.ts`, `submission.ts`, `editorial-workflow.ts`, `editorial-workflow-server.ts`, `journal-lifecycle.ts`, `certificates.ts`, `certificate-editor.ts`, `certificate-import.ts`, `certificate-security.ts`, `file-storage.ts`, `receipt-pdf.tsx`, `search.ts`, and `team-accounts.ts`.
- Workflow transitions use the ordered stages in `src/lib/editorial-workflow.ts`; server-side transition and publication behavior is implemented in `src/lib/editorial-workflow-server.ts` and related API routes.
- Journal synchronization is invoked by public journal reads and the journal-store route through `src/lib/journal-lifecycle.ts`.

### Persistence layer

- Purpose: store editorial records, publication records, user profiles, audit/workflow events, certificate data, journal metadata, and private files.
- Schema source: 36 timestamped SQL migrations in `supabase/migrations/`, plus `supabase/seed.sql`.
- Type contract: `src/types/database.generated.ts`, generated from the linked public schema by `npm run db:types`.
- Clients: `src/lib/supabase/server.ts` for SSR cookies, `browser.ts` for browser-authenticated client use, `public.ts` for stateless public reads, and `admin.ts` for server-only service-role operations.
- Storage access is through Supabase Storage. Private submission and certificate files are served through short-lived signed URLs or server-streamed responses.

## Data Flow

### Public page render

1. A request enters Next.js and passes through `src/proxy.ts`; public paths are allowed through while the session is refreshed when Supabase is configured.
2. A Server Component under `src/app/(public)/` calls a helper such as `getPublications()`, `getJournals()`, or `getAuthors()` from `src/lib/content.ts`.
3. The helper reads published rows through `src/lib/supabase/public.ts`, maps database rows to `src/lib/types.ts`, and uses local fallback data only if the public client is unavailable or a read fails.
4. `src/app/(public)/layout.tsx` adds shared header/footer, announcements, privacy controls, JSON-LD, and cached journal navigation.
5. Client components hydrate for search, forms, viewers, consent, tracking, and other interactions.

### Public submission

1. `src/app/(public)/submit/page.tsx` loads journals and submission targets for `src/components/submission-form.tsx`.
2. The form sends validated metadata and file descriptors to `src/app/api/submissions/init/route.ts`.
3. The init route checks launch state, rate limits, optional Turnstile, the journal/issue target, and payment metadata; it creates a submission in `uploading` state and returns signed upload tokens for private `submission-files` storage.
4. The browser uploads each file directly to the signed storage path.
5. The form calls `src/app/api/submissions/complete/route.ts`; the route verifies object existence, size/type rules, file signatures, and the expected path, then creates `submission_files`, changes the submission to `submitted`, and emits initial author-visible workflow events.
6. `src/components/processing-overlay.tsx` presents the four fixed processing stages while this request is pending; it is presentation state and does not replace server workflow state.

### Admin workspace hydration

1. `admin-panel/src/main.tsx` records an `admin_app_opened` activity event through `/api/admin/activity`.
2. It loads the unified read model from `src/app/api/admin/workspace/route.ts`.
3. That route resolves the authenticated admin user and reads submissions, publication records, journals, issues, authors, certificate templates/records, and media with the service-role client.
4. The SPA maps the response into its local view types, derives counts and badges from current workflow stages, and uses `/api/admin/files/[id]` for protected file previews/downloads.
5. A `401` response causes the SPA to return to `/admin/login` with the current location encoded as `next`.

### Admin editorial mutation

1. A workspace view submits JSON, `FormData`, or a file request to an endpoint under `src/app/api/admin/`.
2. Mutating routes call `requireEditorApi()` from `src/lib/admin-api.ts`; authenticated read/session routes use `getAdminUser()` and administrator-only routes also check `user.role`.
3. The handler validates request data with Zod or explicit type/size checks, invokes domain logic, and writes through `getSupabaseAdmin()`.
4. Workflow changes use `src/lib/editorial-workflow-server.ts` or the database `transition_submission` RPC, update audit/workflow events, and may create receipts, publication records, certificates, or signed files.
5. The SPA updates its local state, URL view, counts, and visible status badges from the response or a refreshed read model.

### Journal management synchronization

1. `admin-panel/src/main.tsx` loads the catalog from `/api/journal-store` and mirrors a safe local copy in `localStorage` for responsive editing.
2. `src/app/api/journal-store/route.ts` reads canonical journals/issues from Supabase when available and maps editorial metadata into the admin catalog shape.
3. Journal and issue edits are sent back to the same route; images are uploaded to the `editorial-media` bucket and metadata is recorded in `media_assets`.
4. `src/data/journal-store.json` is a development fallback, not the production authority.

### Author tracking and response

1. `src/app/(public)/track/page.tsx` calls `src/app/api/track/route.ts` with a reference, tracking number, or receipt number.
2. The route resolves the record through the service-role client, assembles public-safe workflow events, signed files, requests, and certificate links, and returns private no-store JSON.
3. Author responses go through `src/app/api/track/requests/respond/route.ts`, which rate-limits the request and invokes the `respond_to_author_request` database RPC.

## Authentication and Authorization

### Sign-in flow

1. `/admin/login` renders `src/components/admin-login-form.tsx`.
2. Supabase Auth sends the callback to `src/app/auth/callback/route.ts`, which exchanges the code for a session using `src/lib/supabase/server.ts` and redirects to the requested safe path.
3. `src/proxy.ts` refreshes the cookie session and redirects unauthenticated `/admin` page requests to `/admin/login?next=...`.
4. `src/lib/auth.ts` reads JWT claims and the `profiles` row, resolves `admin`, `editor`, or `viewer`, and exposes `accessViews` and account-setup state.

### Enforcement points

- Page protection is applied in `src/proxy.ts`; `/admin/login` and `/admin/welcome` are allowed through the page guard.
- API protection is handler-level because `/api/admin/*` is outside the `/admin` page prefix. Of the 32 current admin route handlers, 23 use `requireEditorApi()`, while authenticated read/account/file routes use `getAdminUser()` and `audit` additionally requires the `admin` role. `/api/admin/logout` intentionally only signs out the session.
- Service-role access is server-only in `src/lib/supabase/admin.ts`; the admin SPA must call an API route instead of importing Supabase.
- Development-only local bypass exists in `src/lib/auth.ts` when not in production and Supabase is unavailable or `LOCAL_ADMIN_BYPASS=true`.
- `configuredAdminEmails()` in `src/lib/auth.ts` combines the configured `ADMIN_EMAILS` allowlist with the current owner email and can promote a matching profile to `admin`.

## Key Abstractions

**Supabase client factories:** `src/lib/supabase/server.ts`, `browser.ts`, `public.ts`, `admin.ts`, and `config.ts` select the appropriate credentials and execution context. They return `null` when required configuration is absent so callers can provide a fallback or a clear 503 response.

**Admin guards:** `src/lib/auth.ts` owns user/role resolution and page redirects; `src/lib/admin-api.ts` owns editor API authorization, JSON parsing, and common error mapping.

**Workflow stages:** `src/lib/editorial-workflow.ts` defines canonical stages, progress boundaries, public labels, and activity descriptions. `src/lib/editorial-workflow-server.ts` applies them to database records and audit events.

**Content mapping:** `src/lib/content.ts` translates Supabase publication, journal, issue, and author rows into the public model types in `src/lib/types.ts`.

**Generated database types:** `src/types/database.generated.ts` is the TypeScript contract for the 36-migration Supabase schema and must be regenerated rather than hand-edited.

## Entry Points

**Next.js site:** `src/app/layout.tsx` loads fonts, metadata, launch assertions, and global styles; `src/app/(public)/page.tsx` is the public home route.

**Admin server entry:** `src/app/admin/login/page.tsx` is the login page; `src/app/admin/welcome/page.tsx` handles first-account setup; `src/proxy.ts` is the session/page guard.

**Admin SPA entry:** `admin-panel/index.html` mounts `admin-panel/src/main.tsx`, which mounts React with `createRoot` and owns the workspace shell.

**Submission entry:** `src/components/submission-form.tsx` starts the public intake flow; `src/app/api/submissions/init/route.ts` and `complete/route.ts` are the server boundary.

**Scheduled entry:** `src/app/api/cron/journal-lifecycle/route.ts` is invoked by the Vercel cron in `vercel.json`.

**Verification entry points:** `src/__tests__/` contains Vitest unit tests; `tests/` contains Playwright browser tests configured by `playwright.config.ts`.

## Error Handling

**Strategy:** Validate at the boundary, return explicit HTTP responses, use null-guarded clients, and keep user-facing fallbacks readable.

**Patterns:**
- `src/lib/admin-api.ts` uses `readJsonBody()`, `apiErrorResponse()`, and `isApiError()` for consistent API short-circuiting.
- Public and admin routes return `400` for invalid input, `401`/`403` for access failures, `409` for stale workflow/journal targets, `429` for rate limits, `503` for missing backend configuration, and `500` for unexpected storage/database failures.
- Storage routes delete or reject invalid uploads and only expose private files through signed redirects or controlled streams.
- Public content helpers log read failures and fall back to safe local data; admin workspace failures return `connected: false` or a 503 response instead of fabricating production data.

## Cross-Cutting Concerns

**Validation:** Zod schemas and explicit checks in `src/lib/submission.ts`, `src/lib/admin-api.ts`, and route handlers.

**Authentication:** Supabase Auth SSR cookies, session refresh in `src/proxy.ts`, role resolution in `src/lib/auth.ts`, and route-level guards.

**Security:** CSP and security headers in `next.config.ts`; private/no-store admin responses; Turnstile and rate limiting for public intake; private storage with signed access; audit events for administrative activity and file access.

**Caching:** React `cache()` and page revalidation in public content/layout helpers; explicit `no-store` for admin/workflow responses; public search uses short shared cache headers in `src/app/api/search/route.ts`.

**Deployment:** Vercel hosts the single Next.js deployment; `vercel.json` supplies the journal lifecycle cron; the admin Vite bundle is copied into the Next build output.

## Architectural Constraints

- Keep the admin SPA on same-origin `/api/admin/*` endpoints; do not add a browser Supabase client to `admin-panel/`.
- Keep service-role modules server-only and out of client components.
- Treat `public/admin/` and `admin-panel/dist/` as build output; edit `admin-panel/src/` instead.
- Treat Supabase-backed workspace data and database workflow stages as authoritative; localStorage samples are for development/UI continuity only.
- Only `/admin` and `/admin/` are rewrites to the SPA shell; login and welcome remain Next pages.
- Keep public routes in `src/app/(public)/` and public shared UI in `src/components/`; the separate root `components/` directory is not the active Next alias target.

---

*Architecture analysis: 2026-07-30*
