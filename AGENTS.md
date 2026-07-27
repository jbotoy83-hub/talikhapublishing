# AGENTS.md — Talikha Publishing

Read this first. Then read `.planning/codebase/` before exploring code — it is a full map of the codebase, so you do not need to re-scan everything.

## Session start (do this first, every new session)

1. Read this file, then skim `.planning/codebase/ARCHITECTURE.md` and `STRUCTURE.md` to refresh the layout.
2. Check what changed since the map was written: `git log --oneline -15` and `git status`.
3. If recent commits touched architecture, structure, stack, or integrations, note which map doc is now stale and refresh just that doc (per the Map maintenance policy below) before starting work.
4. Then proceed with the task. Only inspect files directly related to the current task. Read additional files only when the existing codebase map does not contain enough information, or when verification of a specific implementation is required.

## The map (read these, not the whole repo)

`.planning/codebase/`:
- `ARCHITECTURE.md` — how the two apps connect, data flow, auth
- `STRUCTURE.md` — directory → responsibility index (where to add new code)
- `STACK.md` — frameworks, dependencies, versions
- `INTEGRATIONS.md` — Supabase, Turnstile, Vercel, env vars
- `CONVENTIONS.md` — code style and patterns actually in use
- `TESTING.md` — verification approach (no test framework exists)
- `CONCERNS.md` — known tech debt and security gaps

If the map disagrees with the code, the code wins — then update the map.

## Map maintenance policy

| Situation | Action |
|---|---|
| Normal feature work | Use existing `.planning/codebase/` docs; inspect only the relevant implementation files |
| After a small change | Do not remap |
| After a large architectural change | Run a targeted or fast map (`gsd-map-codebase --fast`, or one focus area) |
| After major restructuring | Run the full mapper again |

## What this is

A monorepo with two apps sharing one Supabase backend:
1. **Public site** — Next.js 16 (App Router), lives in `src/` + `components/` at the repo root. Serves `localhost:3000`.
2. **Admin panel** — Vite + React 19 SPA in `admin-panel/`. Built to static assets and served by Next.js at `/admin`. It calls `/api/admin/*` route handlers (service-role) in the Next app; auth is guarded by `src/proxy.ts` + `src/lib/auth.ts`.

## Commands

Run from repo root unless noted.

| Task | Command |
|---|---|
| Dev (public site) | `npm run dev` |
| Dev (admin panel) | `npm run dev` *(inside `admin-panel/`)* |
| Typecheck (root) | `npm run typecheck` |
| Lint | `npm run lint` |
| Full verify | `npm run check` *(typecheck + lint + build)* |
| Build (both apps) | `npm run build` |
| Admin typecheck | `npm run typecheck` *(inside `admin-panel/`)* |
| Regen DB types | `npm run db:types` |
| Launch both + browser bridge | `powershell -NoProfile -ExecutionPolicy Bypass -File launch.ps1` |

**Always run `npm run check` after non-trivial changes.** There is no test suite; typecheck + lint + build is the verification gate.

## Where things live

- Public routes: `src/app/`
- Shared UI: `components/` (shadcn/ui, radix-nova style)
- Server logic / Supabase clients / auth: `src/lib/`
- Generated DB types: `src/types/database.generated.ts`
- Admin SPA source: `admin-panel/src/`
- Admin API route handlers: `src/app/api/admin/`
- DB migrations: `supabase/migrations/`
- Build/helper scripts: `scripts/`

## Conventions (short version)

- kebab-case filenames, PascalCase components
- Strict TypeScript in both apps; `@/*` path alias
- Styling: Tailwind (v3 site / v4 admin) + CSS-variable theming; `cn()` helper + CVA for variants
- Supabase via null-guard client factories in `src/lib/`
- Validation with Zod `safeParse`; API errors via `NextResponse`
- No code comments unless asked

## Known critical issues (don't reintroduce)

See `CONCERNS.md`. Top ones:
- `/api/admin/dashboard` route is unauthenticated
- A hardcoded admin email bypasses the `ADMIN_EMAILS` env allowlist
- In-memory rate limiter doesn't work on serverless
- Admin panel is a ~7000-line monolith
