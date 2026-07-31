# Codebase Structure

**Analysis Date:** 2026-07-31 (refreshed)

Monorepo: a Next.js 16 public site at the root plus a Vite + React 19 admin SPA in `admin-panel/`, sharing one Supabase backend.

## Directory Layout

```
talikhapublishing/
├── src/                     # Next.js public site + server logic (root app)
│   ├── app/                 # App Router routes, layouts, API handlers
│   │   ├── (public)/        # Marketing/content pages (route group)
│   │   │   ├── authors/[slug]/
│   │   │   ├── journals/[slug]/issues/[volume]/[issue]/
│   │   │   ├── publications/[slug]/
│   │   │   ├── search/  submit/  track/  faq/  services/
│   │   │   ├── privacy/  terms/  editorial-standards/
│   │   │   └── page.tsx  layout.tsx  loading.tsx  not-found.tsx
│   │   ├── admin/           # Admin login + preview shells (Next pages)
│   │   ├── api/             # Route handlers (public + admin + cron)
│   │   │   ├── admin/       # 14 privileged sub-routes (see below)
│   │   │   ├── announcements/  publications/  search/
│   │   │   ├── submissions/  track/  journal-store/
│   │   │   └── cron/journal-lifecycle/
│   │   ├── auth/callback/   # Supabase auth callback
│   │   ├── certificate-access/[token]/  # Public certificate viewer
│   │   ├── feed.xml/  llms.txt/         # RSS + LLMs routes
│   │   └── layout.tsx  loading.tsx  not-found.tsx
│   │       manifest.ts  robots.ts  sitemap.ts  icon.svg
│   ├── components/          # Site feature components (48 files)
│   │   ├── ui/              # shadcn/ui primitives (19 files, radix-nova)
│   │   ├── certificates/    # Certificate display components
│   │   └── icons/           # Shared icon set (also aliased into admin)
│   ├── lib/                 # Server-only business logic (30 modules)
│   │   └── supabase/        # Null-guarded Supabase client factories
│   ├── data/                # demo-content.ts, journal-store.json (fallbacks)
│   ├── hooks/               # Client hooks (use-mobile.ts)
│   ├── types/               # database.generated.ts (Supabase types)
│   ├── __tests__/           # Vitest unit tests (5 files) + setup.ts
│   ├── proxy.ts             # Next middleware (session + /admin guard)
│   └── styles.css           # Global site styles + theme variables
├── admin-panel/             # Vite + React 19 admin SPA
│   ├── src/
│   │   ├── main.tsx         # SPA entry — editorial workspace (~7,188 lines)
│   │   ├── components/
│   │   │   ├── certificates/  # 6 files (workspace, canvas, field-engine, types)
│   │   │   ├── inbox/         # 11 files (workspace, channels, conversations)
│   │   │   ├── preflight/     # 2 files (workspace + css)
│   │   │   ├── ui/            # 14 shadcn primitives
│   │   │   ├── floating-dock.tsx
│   │   │   └── team-accounts.tsx
│   │   ├── lib/             # date.ts, journal-catalog.ts, utils.ts
│   │   ├── hooks/           # use-mobile.ts
│   │   ├── assets/          # fonts/, wallpapers/
│   │   └── styles.css  types.ts  vite-env.d.ts
│   ├── public/              # Static assets copied into the build
│   ├── dist/                # Vite build output (copied to public/admin)
│   └── index.html  vite.config.ts  components.json
│       tsconfig.json  tsconfig.app.json  postcss.config.js
├── supabase/                # Backend definition
│   ├── migrations/          # 41 ordered SQL migrations
│   └── seed.sql  config.toml
├── scripts/                 # Build/helper Node scripts (.mjs)
├── tests/                   # Playwright E2E specs (2 files)
├── public/                  # Next static assets
│   └── admin/               # GENERATED — copied Vite admin build
├── docs/                    # Operational + refactor documentation
│   ├── refactor/            # Refactor baseline, plan, risk register, logs
│   ├── DEPLOYMENT.md  production-readiness.md
│   ├── second-branch-launch-checklist.md
│   └── unified-editorial-workflow.md
├── .devlogs/  wallpaper/  output/  tmp/   # Logs, scratch
├── next.config.ts  tsconfig.json  tailwind.config.js  postcss.config.js
├── eslint.config.mjs  vitest.config.ts  playwright.config.ts
├── vercel.json  components.json  package.json  package-lock.json
├── launch.ps1  launch.bat   # Local launcher (both apps + Chrome bridge)
├── DESIGN.md  AGENTS.md  README.md
└── .env.example  .env.local # Env template + live secrets (do not commit)
```

## Directory Purposes

**`src/app/`:**
- Purpose: all routing for the public site and the API surface used by the admin SPA.
- Contains: `page.tsx`/`layout.tsx` (RSC), `route.ts` (handlers), `loading.tsx`, metadata files.
- Key files: `src/app/layout.tsx` (root layout), `src/app/api/submissions/init/route.ts` (public intake), `src/app/api/journal-store/route.ts` (catalog sync), `src/app/api/admin/**` (privileged handlers), `src/app/api/cron/journal-lifecycle/route.ts` (Vercel cron).

**`src/app/api/admin/` (14 sub-routes):**
- `account-setup/`, `accounts/`, `activity/`, `announcements/`, `audit/`, `authors/`, `certificates/`, `dashboard/`, `featured/`, `files/`, `logout/`, `submissions/`, `workflow-files/`, `workspace/`.
- All privileged handlers now use `requireEditorApi()` or `requireAdminApi()` guards.

**`src/app/(public)/`:**
- Purpose: content/marketing pages under a route group (no URL segment).
- Contains: `authors/[slug]`, `journals/[slug]/issues/[volume]/[issue]`, `publications/[slug]`, `search`, `submit`, `track`, `faq`, `services`, `privacy`, `terms`, `editorial-standards`.

**`src/lib/` (30 modules):**
- Purpose: server-only domain logic. Add new business rules here, not in route handlers.
- Contains: `content.ts`, `auth.ts`, `admin-api.ts`, `submission.ts`, `editorial-workflow-server.ts`, `editorial-workflow.ts`, `journal-lifecycle.ts`, `certificates.ts`, `certificate-editor.ts`, `certificate-import.ts`, `certificate-security.ts`, `render-certificate.ts`, `publication-preflight.ts`, `publication-preflight-rules.ts`, `search.ts`, `rate-limit.ts`, `turnstile.ts`, `launch.ts`, `announcements.ts`, `team-accounts.ts`, `site.ts`, `apa-citation.ts`, `citation-format.ts`, `author-display.ts`, `journal-presentation.ts`, `receipt-pdf.tsx`, `file-storage.ts`, `utils.ts` (`cn()`), `types.ts`.
- Key subdirectory: `src/lib/supabase/` — `server.ts`, `admin.ts`, `browser.ts`, `public.ts`, `config.ts`.

**`src/components/` (48 files):**
- Purpose: reusable site UI. Feature components at top level; primitives in `ui/`.
- Key files: `src/components/ui/*` (19 shadcn primitives), `src/components/local-submission-form.tsx`, `src/components/submission-form.tsx`, `src/components/publication-pdf-reader.tsx`, `src/components/site-header.tsx`, `src/components/search-interface.tsx`, `src/components/icons/` (shared with admin).
- Notable additions: `admin-shell.tsx`, `announcement-banner.tsx`, `author-directory-shell.tsx`, `journal-archive.tsx`, `publication-activity-panel.tsx`, `related-publications-carousel.tsx`, `talikha-board-tour.tsx`.

**`admin-panel/src/`:**
- Purpose: the entire admin SPA.
- Contains: `main.tsx` (the ~7,188-line workspace monolith), `components/certificates/` (6 files), `components/inbox/` (11 files), `components/preflight/` (2 files), `components/ui/` (14 primitives), `components/floating-dock.tsx`, `components/team-accounts.tsx`, `lib/`, `hooks/`, `assets/`.
- Key files: `admin-panel/src/main.tsx`, `admin-panel/src/components/inbox/inbox-workspace.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`.

**`supabase/migrations/` (41 files):**
- Purpose: authoritative database schema + Postgres functions, applied in timestamp order.
- Key files: `20260714000000_initial_production_schema.sql`, `20260718114052_unified_editorial_workflow.sql`, `20260726113036_payment_gate_and_certificate_delivery.sql`, `20260729173318_publication_preflight_gate.sql`, `20260730184727_publication_author_metadata.sql`, `20260730200950_delete_submission_cascade.sql`, `20260730232338_submission_idempotency.sql`.

**`scripts/`:**
- Purpose: build and ops helpers (ESM `.mjs`).
- Key files: `copy-admin-build.mjs` (admin → `public/admin`), `check-launch-readiness.mjs`, `upload-login-wallpaper.mjs`.

**`docs/refactor/`:**
- Purpose: refactor planning and tracking (Phase 0 baseline).
- Key files: `BASELINE_REPORT.md`, `REFACTOR_PLAN.md`, `RISK_REGISTER.md`, `STATUS_REPORT.md`, `TEST_MATRIX.md`, `PERFORMANCE_BASELINE.md`, `CODEBASE_MAP.md`, `REFACTOR_LOG.md`.

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: root layout (fonts, metadata, launch assertion).
- `src/proxy.ts`: middleware (session refresh + `/admin` guard).
- `admin-panel/src/main.tsx`: admin SPA bootstrap.
- `admin-panel/index.html`: Vite HTML entry.

**Configuration:**
- `next.config.ts`: CSP/security headers, image hosts, `/admin` rewrites.
- `tsconfig.json` / `admin-panel/tsconfig.app.json`: TS + `@/*` aliases.
- `tailwind.config.js` (site v3) / `admin-panel` uses Tailwind v4 via `@tailwindcss/vite`.
- `components.json` + `admin-panel/components.json`: shadcn/ui config (radix-nova).
- `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `vercel.json`.
- `.env.example`: full env var reference (63 lines, includes CRON_SECRET).

**Core Logic:**
- `src/lib/auth.ts` + `src/lib/admin-api.ts`: identity and authorization.
- `src/lib/supabase/*`: data access.
- `src/lib/content.ts`: public reads.
- `src/lib/editorial-workflow-server.ts`: submission state machine.
- `src/app/api/journal-store/route.ts`: catalog persistence.

**Testing:**
- `src/__tests__/`: vitest unit tests (5 files): `citation-format.test.ts`, `display-formatting.test.ts`, `publication-preflight-rules.test.ts`, `submission-schema.test.ts`, `workflow-transitions.test.ts` + `setup.ts`.
- `tests/`: Playwright specs (`example.spec.ts`, `certificate-convert-to-field.spec.ts`).

**Generated / types:**
- `src/types/database.generated.ts`: Supabase-generated DB types (regenerate via `npm run db:types`).

## Naming Conventions

**Files:**
- kebab-case for all source files: `editorial-workflow-server.ts`, `publication-preflight.ts`, `site-header.tsx`.
- Route handlers are always `route.ts`; pages are `page.tsx`; layouts `layout.tsx`.
- Dynamic segments use brackets: `[slug]`, `[id]`, `[volume]`, `[token]`.
- Migrations: `YYYYMMDDHHMMSS_snake_case_description.sql`.
- Build scripts: ESM `.mjs` in `scripts/`.

**Directories:**
- kebab-case for feature dirs (`certificate-access`, `admin-panel`); Next route group in parentheses (`(public)`).
- Domain subpaths nest under `src/lib/supabase/`, `src/components/ui/`, `admin-panel/src/components/{certificates,inbox,preflight}/`.

**Identifiers (observed):**
- Components: PascalCase (`PublicationCard`, `JournalsView`).
- Functions/variables: camelCase (`getAdminUser`, `requireEditorApi`).
- Types: PascalCase, often suffixed (`AdminUser`, `SearchResponse`, `StoredFile`).
- DB columns: snake_case (`submission_issue_id`, `editorial_metadata`); mapped to camelCase in app types.
- Env vars: SCREAMING_SNAKE_CASE; public ones prefixed `NEXT_PUBLIC_`.

## Where to Add New Code

**New public page:**
- Create `src/app/(public)/<segment>/page.tsx` (RSC). Add a `[slug]` subdir for dynamic routes.
- Put data reads in `src/lib/content.ts` (or a new `src/lib/<domain>.ts` with `import "server-only"`).
- Reusable markup → `src/components/<kebab-name>.tsx`.

**New admin API endpoint:**
- Add `src/app/api/admin/<resource>/route.ts`.
- MUST start with an auth guard: `const user = await requireEditorApi(); if (isApiError(user)) return user;` (see `src/app/api/admin/submissions/[id]/advance/route.ts`).
- Validate bodies with `readJsonBody` + a Zod schema; return errors via `apiErrorResponse`.
- Call the admin SPA from `admin-panel/src/main.tsx` (or a component) using `fetch("/api/admin/...", { credentials: "same-origin" })`.

**New admin workspace/feature:**
- Prefer a new component under `admin-panel/src/components/<feature>/` and wire it into the sidebar in `admin-panel/src/main.tsx` (`sidebarSections`). Avoid growing `main.tsx` further (see CONCERNS.md monolith note).

**New shared (cross-app) helper:**
- Only if browser-safe (no `server-only`, no Node APIs). Place in `src/lib/<name>.ts` and import from the admin via relative path (`../../src/lib/<name>`) — follow `apa-citation.ts`/`citation-format.ts`.

**New database change:**
- Add a timestamped SQL file to `supabase/migrations/`, then regenerate types with `npm run db:types`.

**New Supabase client usage:**
- Reuse the factories in `src/lib/supabase/`; never construct a client inline. Use `getSupabaseAdmin()` for privileged server work, `createServerSupabase()`/`getPublicSupabase()` for anon reads, `getSupabaseBrowser()` in client components.

**Utilities:**
- Shared class-merge helper `cn()` lives in `src/lib/utils.ts` (site) and `admin-panel/src/lib/utils.ts` (admin). Date helpers in `admin-panel/src/lib/date.ts`.

## Special Directories

**`public/admin/`:**
- Purpose: the compiled admin SPA served by Next at `/admin`.
- Generated: Yes — by `npm run build:admin` + `scripts/copy-admin-build.mjs`.
- Committed: Should be treated as a build artifact (eslint ignores `public/admin/**`).

**`admin-panel/dist/` (and `dist-verify*/`):**
- Purpose: Vite build output (verify dirs are one-off build checks).
- Generated: Yes. Committed: No (build artifacts).

**`src/data/`:**
- Purpose: development/demo fallbacks — `demo-content.ts` and `journal-store.json`.
- Generated: `journal-store.json` is a local dev fallback written/read by the journal store; production reads come from Supabase.
- Committed: Yes (defaults).

**`supabase/.temp/`:**
- Purpose: Supabase CLI local state (project ref, versions, pooler URL).
- Generated: Yes. Committed: No.

**`.next/`, `output/`, `tmp/`, `test-results/`, `playwright-report/`, `.devlogs/`:**
- Purpose: build output, scratch files, and test/dev logs.
- Generated: Yes. Committed: No.

---

*Structure analysis: 2026-07-31 (refreshed)*
