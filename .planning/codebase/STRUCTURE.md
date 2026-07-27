# Codebase Structure

**Analysis Date:** 2026-07-27

## Directory Layout

```
talikhapublishing/
├── src/                    # Next.js app source (App Router) — the public site + all API routes
│   ├── app/                # Routes (App Router)
│   │   ├── (public)/       # Visitor-facing pages (route group, no URL segment)
│   │   ├── admin/          # Admin server pages: login/, welcome/ (+ action helpers)
│   │   ├── api/            # All route handlers (admin/, submissions/, publications/, ...)
│   │   ├── auth/           # OAuth callback (auth/callback/route.ts)
│   │   ├── certificate-access/  # Public certificate verification/access pages
│   │   ├── feed.xml/       # RSS feed route
│   │   ├── llms.txt/       # LLM discovery file route
│   │   ├── layout.tsx      # Root layout
│   │   ├── manifest.ts     # PWA manifest
│   │   ├── robots.ts       # robots.txt
│   │   └── sitemap.ts      # sitemap.xml
│   ├── components/         # Shared React components for the Next site (server + client)
│   ├── data/               # Static/seed data (demo-content.ts, journal-store.json)
│   ├── hooks/              # Client hooks (use-mobile.ts)
│   ├── lib/                # Server domain logic + Supabase clients + auth
│   │   └── supabase/       # 4 client factories (server/browser/admin/public/config)
│   ├── types/              # database.generated.ts (generated DB types)
│   ├── proxy.ts            # Edge middleware: session refresh + /admin guard
│   └── styles.css          # Global stylesheet
├── components/             # Root shadcn-style UI primitives (components/ui/)
├── admin-panel/            # Standalone Vite + React admin SPA
│   ├── src/
│   │   ├── main.tsx        # SPA entry + workspace shell + many inline views
│   │   ├── components/     # certificates/, inbox/, ui/, icons/, team-accounts, dock
│   │   ├── hooks/          # SPA hooks
│   │   ├── lib/            # utils.ts (cn helper) — separate from src/lib
│   │   └── assets/         # Wallpapers/images bundled by Vite
│   ├── index.html          # SPA HTML shell
│   └── vite.config.ts      # base "/admin/", dev proxy to :3000
├── supabase/               # Database-as-code
│   ├── migrations/         # 32 timestamped .sql migrations
│   ├── seed.sql            # Seed data
│   └── config.toml         # Supabase CLI/local config
├── scripts/                # Node build/ops scripts (.mjs)
├── docs/                   # Operational/process markdown
├── public/                 # Static assets (incl. built admin/ copied at build time)
├── next.config.ts          # CSP, headers, /admin rewrites, image hosts
├── tailwind.config.js      # Tailwind theme
├── tsconfig.json           # TS config (path alias @/ -> src/)
├── vercel.json             # Deployment config
└── package.json            # Root scripts (dev/build/db:types/check)
```

## Directory Purposes

**`src/app/` — Routes (App Router):**
- Purpose: All URL routing for the Next site.
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts` (API), `not-found.tsx`.
- Key files: `src/app/layout.tsx` (root layout), `src/app/(public)/page.tsx` (home).

**`src/app/(public)/` — Public pages:**
- Purpose: Visitor content. Route group adds no URL segment.
- Contains: `page.tsx` per feature + dynamic `[slug]`/`[volume]`/`[issue]` segments.
- Routes: home, `authors/`, `editorial-standards/`, `faq/`, `journals/` (+ `[slug]/issues/[volume]/[issue]/`), `privacy/`, `publications/` (+ `[slug]/`), `search/`, `services/`, `submit/`, `terms/`, `track/`.

**`src/app/admin/` — Admin server pages:**
- Purpose: Server-rendered auth pages + server-action helpers (NOT the workspace UI).
- Contains: `login/page.tsx`, `welcome/page.tsx`, `actions.ts`, `workflow-actions.ts`, `layout.tsx`.
- Note: other subfolders (`authors/`, `certificates/`, `journals/`, `issues/`, `media/`, `production/`, `publications/`, `schedule/`, `submissions/`, `grain-capture/`) hold `[id]/` segments / action support, not standalone pages. The SPA owns workspace views.

**`src/app/api/` — Route handlers:**
- Purpose: All data reads/writes; the only path the admin SPA uses for data.
- Contains: `route.ts` files grouped by domain.
- Groups: `admin/` (dashboard, workspace, authors, accounts, account-setup, activity, certificates/*, files/[id], logout, submissions/[id]/*, workflow-files), `submissions/` (init, complete), `publications/[slug]/` (view, pdf), `journal-store/`, `track/` (+ `requests/respond/`), `cron/journal-lifecycle/`.

**`src/components/` — Site components:**
- Purpose: Reusable UI for the Next site (both server and `"use client"`).
- Contains: ~40 components — headers/footers, forms, PDF readers, certificate UI, JSON-LD, Turnstile widget.
- Key files: `site-header.tsx`, `site-footer.tsx`, `brand.tsx`, `admin-login-form.tsx`, `submission-form.tsx`, `tracking-form.tsx`, `publication-pdf-reader.tsx`, `turnstile-widget.tsx`, plus `ui/`, `icons/`, `certificates/` subfolders.

**`src/lib/` — Domain logic + infra:**
- Purpose: Server-side business logic, Supabase clients, auth, utilities.
- Contains: domain libs (`certificates.ts`, `journal-lifecycle.ts`, `editorial-workflow-server.ts`, `submission.ts`, `content.ts`, `receipt-pdf.tsx`, `certificate-*.ts`, `team-accounts.ts`), guards (`auth.ts`, `admin-api.ts`), infra (`rate-limit.ts`, `turnstile.ts`, `file-storage.ts`, `site.ts`, `utils.ts`).
- Key subfolder: `src/lib/supabase/` — `server.ts`, `browser.ts`, `admin.ts`, `public.ts`, `config.ts`.

**`src/types/` — Generated types:**
- Purpose: Type-safe DB access.
- Key file: `src/types/database.generated.ts` (regenerate: `npm run db:types`). Do not hand-edit.

**`components/` (root) — UI primitives:**
- Purpose: shadcn-style primitives used by the Next site.
- Contains: `components/ui/` only.

**`admin-panel/src/` — Admin SPA source:**
- Purpose: The entire editorial workspace UI (client-only).
- Contains: `main.tsx` (entry + shell + inline views), `components/{certificates,inbox,ui,icons}/`, `team-accounts.tsx`, `floating-dock.tsx`, `hooks/`, `lib/utils.ts`, `assets/`.
- Key files: `admin-panel/src/main.tsx`, `admin-panel/src/components/certificates/certificate-workspace.tsx`, `admin-panel/src/components/inbox/inbox-workspace.tsx`.

**`supabase/` — Database-as-code:**
- Purpose: Schema, RLS policies, seed.
- Contains: `migrations/*.sql` (32 files, timestamped), `seed.sql`, `config.toml`.

**`scripts/` — Build/ops scripts:**
- Purpose: Node `.mjs` automation.
- Key files: `copy-admin-build.mjs` (copies `admin-panel/dist` → `public/admin`), `check-launch-readiness.mjs` (`npm run readiness`), `upload-login-wallpaper.mjs`.

**`docs/` — Process docs:**
- Purpose: Operational/runbook markdown.
- Key files: `DEPLOYMENT.md`, `production-readiness.md`, `second-branch-launch-checklist.md`, `unified-editorial-workflow.md`.

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout for the Next site.
- `src/app/(public)/page.tsx`: Public homepage.
- `admin-panel/index.html` → `admin-panel/src/main.tsx`: Admin SPA entry.
- `src/proxy.ts`: Edge middleware (session + `/admin` guard).

**Configuration:**
- `next.config.ts`: CSP, security headers, `/admin` rewrites, remote image hosts.
- `admin-panel/vite.config.ts`: SPA `base: "/admin/"`, dev proxy to `:3000`.
- `tsconfig.json`: Path alias `@/` → `src/`.
- `tailwind.config.js`, `postcss.config.js`: Styling.
- `vercel.json`: Deployment.
- `.env.local` / `.env.example`: Environment (existence only — never read contents).

**Core Logic:**
- `src/lib/auth.ts`: Admin user resolution + roles + `requireAdmin()`.
- `src/lib/admin-api.ts`: API guard `requireEditorApi()`, body parsing, error mapping.
- `src/lib/supabase/admin.ts`: Service-role client (admin writes).
- `src/lib/supabase/server.ts` / `public.ts` / `browser.ts`: SSR / anon / client clients.
- `src/lib/journal-lifecycle.ts`, `src/lib/editorial-workflow-server.ts`, `src/lib/certificates.ts`: Domain operations.

**Testing:**
- No test framework configured (no `*.test.*`/`*.spec.*`, no test runner in `package.json`). Quality gates are `npm run typecheck` + `npm run lint` + `npm run build` (combined as `npm run check`) and `npm run readiness`.

## Naming Conventions

**Files:**
- Kebab-case for components/libs: `site-header.tsx`, `admin-login-form.tsx`, `journal-lifecycle.ts`.
- Next routes use folder + `page.tsx` / `route.ts` / `layout.tsx` / `loading.tsx` / `not-found.tsx`.
- Dynamic segments: `[slug]`, `[id]`, `[volume]`, `[issue]`, `[templateId]`, `[recordId]`, `[pageId]`.
- Route groups in parentheses: `(public)`.
- Migrations: `YYYYMMDDHHMMSS_snake_case_description.sql`.
- Scripts: `kebab-case.mjs`.

**Directories:**
- Kebab-case for feature folders: `editorial-standards/`, `certificate-access/`, `journal-store/`.
- Domain grouping under `src/app/api/admin/<domain>/`.

## Where to Add New Code

**New public page:**
- Create `src/app/(public)/<feature>/page.tsx` (Server Component). Add a `[slug]/page.tsx` for detail routes.
- Shared UI goes in `src/components/`.

**New admin workspace view:**
- Add it inside the SPA: a new view function/section in `admin-panel/src/main.tsx`, or a component under `admin-panel/src/components/`. Wire it into `sidebarSections` (index-based) in `admin-panel/src/main.tsx`.
- It will be served at `/admin` after `npm run build` (copy step).

**New admin data endpoint:**
- Add `src/app/api/admin/<domain>/route.ts`. Guard with `requireEditorApi()`, parse with `readJsonBody()`, write with `getSupabaseAdmin()`. Follow `src/app/api/admin/authors/route.ts`.
- Call it from the SPA via `fetch("/api/admin/<domain>")`.

**New public API endpoint:**
- Add `src/app/api/<domain>/route.ts` using the anon/public client (RLS applies).

**New database table / column:**
- Add a migration `supabase/migrations/<timestamp>_description.sql`, then regenerate types: `npm run db:types` (writes `src/types/database.generated.ts`).

**New shared server helper:**
- Add to `src/lib/`. Mark server-only modules with `import "server-only";`.

**Utilities:**
- Next site helpers: `src/lib/utils.ts` (`cn()`).
- SPA helpers: `admin-panel/src/lib/utils.ts` (separate `cn()`).

## Special Directories

**`public/admin/`:**
- Purpose: Built admin SPA assets served statically by Next.
- Generated: Yes (by `scripts/copy-admin-build.mjs` during `npm run build`).
- Committed: Build output — treat as generated, do not hand-edit.

**`admin-panel/dist/`, `admin-panel/dist-verify*/`:**
- Purpose: Vite build output / verification builds.
- Generated: Yes. Committed: No (build artifacts).

**`src/types/database.generated.ts`:**
- Purpose: DB types from live schema.
- Generated: Yes (`npm run db:types`). Committed: Yes, but never hand-edit.

**`.next/`, `output/`, `tmp/`, `.playwright-cli/`, `.vercel/`:**
- Purpose: Build/dev/tooling caches.
- Generated: Yes. Committed: No.

**`wallpaper/`, `src/data/`:**
- Purpose: Image/source assets and static seed/demo content (`demo-content.ts`, `journal-store.json`).
- Generated: No. Committed: Yes.

---

*Structure analysis: 2026-07-27*
