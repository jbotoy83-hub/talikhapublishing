# Codebase Structure

**Analysis Date:** 2026-07-30

## Directory Layout

```text
talikhapublishing/
|-- src/                         # Next.js application source
|   |-- app/                     # App Router pages, layouts, and route handlers
|   |-- components/              # Public site React components
|   |-- data/                    # Demo and journal fallback data
|   |-- lib/                     # Domain logic, auth, Supabase clients, utilities
|   |-- types/                   # Generated database types and app types
|   |-- proxy.ts                 # Session refresh and /admin page guard
|   `-- styles.css               # Global public-site styles
|-- admin-panel/                 # Vite + React admin SPA
|   |-- src/main.tsx             # SPA shell, URL view state, data hydration
|   |-- src/components/          # Inbox, certificate, team, dock, and UI components
|   |-- src/lib/                 # SPA utilities and journal helpers
|   |-- public/                  # Admin static assets and worker files
|   `-- vite.config.ts           # /admin base, aliases, and local API proxy
|-- components/                  # Separate root UI primitive directory; not the active @/* target
|-- public/                      # Static site assets and generated public/admin bundle
|-- supabase/                    # 36 SQL migrations, seed, and local Supabase config
|-- scripts/                     # Build and operational Node scripts
|-- tests/                       # Playwright browser tests
|-- docs/                        # Deployment, workflow, and readiness documentation
|-- .planning/                   # Project plans and codebase reference maps
|-- .claude/                     # GSD workflow engine, templates, and role contracts
|-- .codex/                      # Codex prompts, role routing, and GSD compatibility skill
|-- .agents/                     # Agent/tooling support files
|-- next.config.ts               # Next headers, CSP, rewrites, and image policy
|-- package.json                 # Root build, verify, test, and database scripts
|-- vercel.json                  # Vercel cron and deployment headers
`-- AGENTS.md                    # Repository workflow and maintenance instructions
```

## Directory Purposes

### `src/app/`

- Purpose: all Next.js URL entry points.
- Public pages are in the `(public)` route group, which contributes no URL segment.
- Server admin pages are limited to `admin/login/page.tsx` and `admin/welcome/page.tsx`; the other `src/app/admin/` folders contain loading states and server-action support for the embedded workspace.
- API handlers are under `src/app/api/` and must be treated as server boundaries.
- Non-page entry points include `src/app/auth/callback/route.ts`, `src/app/feed.xml/route.ts`, `src/app/llms.txt/route.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`, and `src/app/certificate-access/[token]/route.ts`.

### `src/app/(public)/`

- Purpose: visitor-facing pages and their loading/not-found states.
- Current route areas: home, `authors/`, `editorial-standards/`, `faq/`, `journals/`, `publications/`, `search/`, `services/`, `submit/`, `track/`, `privacy/`, and `terms/`.
- Dynamic content routes use `[slug]`, `[volume]`, and `[issue]` segments, for example `src/app/(public)/journals/[slug]/issues/[volume]/[issue]/page.tsx` and `src/app/(public)/publications/[slug]/page.tsx`.
- Shared public chrome is composed by `src/app/(public)/layout.tsx`.

### `src/app/admin/`

- Purpose: authenticated server-rendered admin entry pages and server-action helpers, not the main workspace UI.
- Key files: `src/app/admin/login/page.tsx`, `src/app/admin/welcome/page.tsx`, `src/app/admin/actions.ts`, `src/app/admin/workflow-actions.ts`, and `src/app/admin/certificates/actions.ts`.
- The folders for authors, certificates, issues, journals, media, production, publications, schedule, and submissions do not currently define independent page entry points; the SPA in `admin-panel/src/main.tsx` renders those workspace views.

### `src/app/api/`

- Purpose: server request handlers used by public pages, the admin SPA, cron, and tracking clients.
- `src/app/api/admin/`: authenticated admin data and mutations. Domains include accounts, account setup, activity, announcements, audit, authors, certificates, dashboard, featured, files, logout, submissions, workflow files, and the unified workspace read model.
- `src/app/api/submissions/`: public submission initialization and completion with private uploads.
- `src/app/api/track/`: public tracking and author request responses.
- `src/app/api/publications/`: publication PDF delivery and view metrics.
- `src/app/api/journal-store/`: admin journal/issue catalog synchronization with Supabase and local fallback.
- `src/app/api/announcements/`: public announcement read path.
- `src/app/api/search/`: rate-limited public publication search.
- `src/app/api/cron/journal-lifecycle/`: scheduled journal/issue synchronization.
- Add new handlers as `src/app/api/<domain>/route.ts`; keep request validation and access checks in the handler before calling domain logic.

### `src/components/`

- Purpose: public Next.js presentation components, shared by Server Components and explicit client components.
- Feature components include `site-header.tsx`, `site-footer.tsx`, `submission-form.tsx`, `processing-overlay.tsx`, `tracking-form.tsx`, `search-interface.tsx`, publication readers/tools, certificate UI, and privacy/announcement controls.
- `src/components/ui/` contains the public app's UI primitives and viewers; it is separate from `admin-panel/src/components/ui/`.
- Place a new public component here unless it is a route-only component that clearly belongs beside its page.

### `src/lib/`

- Purpose: server-side domain logic, client factories, authentication, validation, and shared utilities.
- Auth/API: `auth.ts`, `admin-api.ts`.
- Supabase clients: `supabase/config.ts`, `server.ts`, `browser.ts`, `public.ts`, `admin.ts`.
- Editorial workflow: `editorial-workflow.ts`, `editorial-workflow-server.ts`, `journal-lifecycle.ts`.
- Submission and files: `submission.ts`, `file-storage.ts`, `turnstile.ts`, `rate-limit.ts`.
- Content/search: `content.ts`, `search.ts`, `journal-presentation.ts`, `site.ts`, `types.ts`.
- Certificates: `certificates.ts`, `certificate-editor.ts`, `certificate-import.ts`, `certificate-security.ts`, `render-certificate.ts`.
- Receipts and team operations: `receipt-pdf.tsx`, `team-accounts.ts`, `announcements.ts`.
- New reusable server business logic belongs here, with `import "server-only"` when it can access privileged credentials or Node-only APIs.

### `src/types/`

- Purpose: database and shared application type contracts.
- `src/types/database.generated.ts` is generated from the linked Supabase schema and must not be hand-edited.
- `src/lib/types.ts` contains public/domain models; `admin-panel/src/types.ts` contains SPA view models.

### `src/data/`

- Purpose: development fallback and local catalog data.
- `src/data/demo-content.ts` contains visual/demo fixtures used only when demo content is enabled.
- `src/data/journal-store.json` is the local fallback for journals/issues when Supabase is unavailable; production admin edits should go through `src/app/api/journal-store/route.ts`.

### `admin-panel/`

- Purpose: the standalone Vite build that becomes the production `/admin` workspace.
- `admin-panel/index.html` is the Vite document shell.
- `admin-panel/src/main.tsx` is the 7,069-line application coordinator: it owns the sidebar, URL-selected views, workspace hydration, status badges, local UI state, and many inline views.
- `admin-panel/src/components/inbox/` contains the Inbox workspace, conversation list/thread/composer, channel sidebar, formatting, types, and CSS.
- `admin-panel/src/components/certificates/` contains the certificate editor canvas, field engine, inline editor, workspace, types, and CSS.
- `admin-panel/src/components/team-accounts.tsx` and `floating-dock.tsx` provide account management and workspace navigation surfaces.
- `admin-panel/src/components/ui/` is a separate set of SPA primitives imported through the SPA `@/*` alias.
- `admin-panel/src/lib/` contains SPA-specific utilities, dates, and journal catalog helpers. Do not assume these are the same as `src/lib/`.
- `admin-panel/src/assets/` contains bundled fonts/wallpapers; `admin-panel/public/` contains static admin assets and `pdf.worker.min.mjs`.

### `components/`

- Purpose: a separate root-level UI primitive directory.
- It is not the target of the root TypeScript `@/*` alias, which maps to `src/*`; the active Next public UI primitives are in `src/components/ui/`.
- Keep new public Next components in `src/components/` unless a build/configuration change explicitly establishes this directory as shared.

### `supabase/`

- Purpose: database-as-code and local Supabase configuration.
- `supabase/migrations/` contains 36 timestamped migrations covering the production schema, editorial workflow, security/RLS, journals/issues, submissions, payments, certificates, publication metrics, team accounts, announcements, and recent admin metadata/priority changes.
- `supabase/seed.sql` is intentionally empty for this branch; it does not seed first-site content.
- `supabase/config.toml` configures the Supabase CLI/local project.
- Add schema changes as a new timestamped migration, then run `npm run db:types` to update `src/types/database.generated.ts`.

### `public/`

- Purpose: static assets served by Next.js.
- `public/assets/` contains public editorial images and publication/site artwork.
- `public/admin/` is generated by `scripts/copy-admin-build.mjs` from `admin-panel/dist`; edit the SPA source, never this copy.
- `public/pdf.worker.min.mjs` supports PDF rendering where the public app or admin editor needs it.

### `scripts/`

- Purpose: build and operational automation.
- `scripts/copy-admin-build.mjs` performs the admin bundle copy during the root build.
- `scripts/check-launch-readiness.mjs` validates deployment configuration without printing secret values.
- `scripts/upload-login-wallpaper.mjs` handles the admin login wallpaper upload workflow.

### `tests/` and `src/__tests__/`

- `src/__tests__/` is the Vitest unit-test location configured in `vitest.config.ts`; current coverage includes editorial workflow stage and progress behavior in `workflow-transitions.test.ts`.
- `tests/` is the Playwright browser-test location configured in `playwright.config.ts`; current examples cover certificate editor interactions in `certificate-convert-to-field.spec.ts` and `example.spec.ts`.
- There is no single automatic web server configured in `playwright.config.ts`; browser tests expect the relevant local app to be running.

### `docs/`

- Purpose: deployment and operational documentation.
- Key files: `docs/DEPLOYMENT.md`, `docs/production-readiness.md`, `docs/second-branch-launch-checklist.md`, and `docs/unified-editorial-workflow.md`.

### `.planning/`

- Purpose: GSD project planning and codebase reference documents.
- `.planning/codebase/ARCHITECTURE.md` and `STRUCTURE.md` are the architecture/placement maps maintained by the mapper.
- The other map files record stack, integrations, conventions, testing, and concerns; update only the focus documents required by the task.

### `.claude/`, `.codex/`, and `.agents/`

- Purpose: local GSD/Codex workflow support, not runtime application code.
- `.claude/get-shit-done/` contains the workflow engine, templates, references, and `gsd-tools` scripts; `.claude/agents/` contains role contracts.
- `.codex/prompts/` contains Codex-native GSD prompt orchestrators; `.codex/agents/` and `.codex/config.toml` define role routing; `.codex/skills/get-shit-done-codex/` contains the compatibility skill.
- `.agents/` contains agent support files. Keep these separate from application modules and do not import them into `src/` or `admin-panel/src/`.

## Key File Locations

### Entry Points

- `src/app/layout.tsx`: root Next.js layout, metadata, fonts, global styles, and launch assertion.
- `src/app/(public)/page.tsx`: public homepage.
- `src/app/(public)/layout.tsx`: public header/footer/announcement/privacy/JSON-LD composition.
- `src/app/admin/login/page.tsx`: admin login page.
- `src/app/auth/callback/route.ts`: Supabase OAuth/session callback.
- `src/proxy.ts`: session refresh and `/admin` page guard.
- `admin-panel/index.html` -> `admin-panel/src/main.tsx`: admin SPA entry.
- `src/app/api/submissions/init/route.ts` and `complete/route.ts`: public submission API entry points.
- `src/app/api/cron/journal-lifecycle/route.ts`: Vercel cron entry point.

### Configuration

- `package.json`: root build chain, verification, tests, and database-type generation.
- `admin-panel/package.json`: Vite app build/typecheck scripts and SPA dependencies.
- `next.config.ts`: CSP, security headers, image hosts, `/admin` rewrites, and cache policy.
- `admin-panel/vite.config.ts`: Vite base path, aliases, Tailwind plugin, and local API proxy.
- `tsconfig.json`: root `@/* -> src/*` alias and Next TypeScript settings.
- `admin-panel/tsconfig.app.json`: SPA aliases and strict TypeScript settings.
- `vercel.json`: cron and deployment headers.
- `.env.example`: documented environment variable names; environment files are not part of the source map content.

### Core Logic

- `src/lib/auth.ts`: user/role resolution and admin page guard.
- `src/lib/admin-api.ts`: editor API authorization and common request/error helpers.
- `src/lib/content.ts`: public Supabase row mapping and fallback content.
- `src/lib/editorial-workflow.ts`: canonical workflow stages and progress activities.
- `src/lib/editorial-workflow-server.ts`: privileged workflow transitions, author/publication synchronization, receipts, and events.
- `src/lib/submission.ts`: public submission schemas and file rules.
- `src/lib/journal-lifecycle.ts`: current/submission issue synchronization.
- `src/lib/supabase/*.ts`: execution-context-specific Supabase factories.
- `src/app/api/admin/workspace/route.ts`: unified admin read model.
- `admin-panel/src/main.tsx`: admin view coordinator and API client behavior.

### Data and Schema

- `supabase/migrations/*.sql`: schema, indexes, policies, functions, and seed adjustments.
- `src/types/database.generated.ts`: generated database type contract.
- `src/data/journal-store.json`: development journal/issue fallback.
- `src/data/demo-content.ts`: optional public demo fixtures.

### Verification

- `vitest.config.ts`: unit-test configuration.
- `src/__tests__/workflow-transitions.test.ts`: domain workflow test example.
- `playwright.config.ts`: browser-test configuration.
- `tests/certificate-convert-to-field.spec.ts`: admin browser interaction test example.
- `npm run check`: root typecheck, lint, and production build gate.
- `npm run test`: Vitest unit tests.
- `npm run readiness`: launch configuration readiness check.

## Naming Conventions

### Files

- Use kebab-case for components and libraries, for example `submission-form.tsx`, `editorial-workflow-server.ts`, and `check-launch-readiness.mjs`.
- Use Next.js conventions `page.tsx`, `layout.tsx`, `loading.tsx`, `not-found.tsx`, and `route.ts` inside route folders.
- Use bracketed dynamic route names such as `[slug]`, `[id]`, `[volume]`, `[issue]`, `[templateId]`, `[recordId]`, and `[pageId]`.
- Use parentheses for route groups such as `(public)`.
- Use timestamped snake_case names for Supabase migrations.
- Use `.test.ts`/`.test.tsx` for Vitest and `.spec.ts`/`.spec.tsx` for Playwright tests.

### Directories

- Use kebab-case for feature folders such as `editorial-standards`, `certificate-access`, `journal-store`, and `team-accounts`.
- Group admin API handlers under `src/app/api/admin/<domain>/` and dynamic identifiers under `[id]`, `[recordId]`, or the domain-specific segment.
- Keep public UI, server domain logic, admin SPA UI, and GSD tooling in their existing boundaries.

## Where to Add New Code

### New public page

- Primary route: `src/app/(public)/<feature>/page.tsx`.
- Detail route: `src/app/(public)/<feature>/[slug]/page.tsx` or the existing segment pattern.
- Shared UI: `src/components/`.
- Data access: `src/lib/content.ts` or a focused `src/lib/<domain>.ts` helper using the public client.

### New public API

- Handler: `src/app/api/<domain>/route.ts`.
- Validate at the boundary, apply public rate limits where needed, and use `src/lib/supabase/public.ts` for public reads or `src/lib/supabase/admin.ts` only for server-side operations that require privileged access.

### New admin workspace view

- View state/navigation: update the existing view mapping and sidebar in `admin-panel/src/main.tsx`.
- Complex feature UI: add a focused component under `admin-panel/src/components/<feature>/` and import it from the SPA shell.
- Data reads/mutations: add or extend a guarded handler under `src/app/api/admin/<domain>/` and call it with same-origin `fetch`.
- Do not add a direct Supabase client to `admin-panel/`.

### New admin data endpoint

- Handler: `src/app/api/admin/<domain>/route.ts`.
- Mutations: call `requireEditorApi()` from `src/lib/admin-api.ts`, parse with Zod or explicit constraints, then use `getSupabaseAdmin()`.
- Authenticated reads: call `getAdminUser()` and return `401` when no user is present; add an explicit administrator-role check for audit or account-management data where required.
- File access: follow `src/app/api/admin/files/[id]/route.ts` and use signed URLs or controlled streaming.

### New workflow behavior

- Stage/progress labels and author-visible activities: `src/lib/editorial-workflow.ts`.
- Privileged transition/orchestration: `src/lib/editorial-workflow-server.ts` or a focused domain helper.
- Database-side atomic transition rules: add a Supabase migration and use the existing RPC pattern.
- Admin trigger: the relevant handler under `src/app/api/admin/submissions/[id]/`.

### New database table, column, policy, or function

- Migration: `supabase/migrations/<timestamp>_<description>.sql`.
- Generated contract: run `npm run db:types` to update `src/types/database.generated.ts`.
- Route/domain integration: `src/lib/` and the relevant `src/app/api/` handler.
- Never hand-edit generated database types as the schema source of truth.

### New shared utility

- Next/server utility: `src/lib/` or `src/components/` depending on whether it is domain/server or presentation code.
- SPA-only utility: `admin-panel/src/lib/` or `admin-panel/src/components/`.
- Do not create a cross-app utility unless both build systems can safely consume it; the current deliberate cross-app import is `src/lib/apa-citation.ts` from `admin-panel/src/main.tsx`.

## Special Directories

**`public/admin/`:** Generated static admin bundle. Created by `scripts/copy-admin-build.mjs`; do not edit by hand.

**`admin-panel/dist/`:** Vite build output. Generated and not a source location.

**`.next/`, `output/`, `tmp/`, `.playwright-cli/`, `.vercel/`, `playwright-report/`, and `test-results/`:** Generated build, deployment, browser, and test artifacts; do not place application code here.

**`node_modules/`:** Installed dependencies; never edit or map as application source.

**`src/types/database.generated.ts`:** Generated from Supabase; committed as a type contract but never hand-edit.

**`src/data/`:** Committed fallback/demo data. Keep production-authoritative records in Supabase instead.

**`admin-panel/src/assets/` and `wallpaper/`:** Committed image/font assets used by the SPA and site/login surfaces.

**`.planning/codebase/`:** Reference maps for future GSD planning and execution. Update the focus documents when the architecture or placement rules change.

---

*Structure analysis: 2026-07-30*
