# Technology Stack

**Analysis Date:** 2026-07-30

## Repository Shape

- Two applications share one repository and backend: the Next.js public site in `src/` and the Vite/React admin SPA in `admin-panel/`.
- The admin SPA is compiled into `admin-panel/dist/`, copied to `public/admin/` by `scripts/copy-admin-build.mjs`, and served by the Next.js application at `/admin/`.
- Server-side APIs, server actions, authentication, content loading, and Supabase clients live in `src/app/` and `src/lib/`.

## Languages

**Primary:**
- TypeScript 6.x declared at the root in `package.json`, used by `src/`, `components/`-equivalent files under `src/components/`, and root configuration.
- TypeScript 7.x declared by `admin-panel/package.json`, used by `admin-panel/src/` and the Vite admin configuration.

**Secondary:**
- JavaScript/ES modules for `scripts/*.mjs`, `tailwind.config.js`, `postcss.config.js`, and `admin-panel/postcss.config.js`.
- SQL for the 36 ordered migrations in `supabase/migrations/` and the development seed in `supabase/seed.sql`.
- CSS for `src/styles.css`, `admin-panel/src/styles.css`, and certificate/inbox stylesheets.

## Runtime

**Environment:**
- Node.js with ES modules; both `tsconfig.json` and `admin-panel/tsconfig.app.json` target ES2022.
- Next.js server/runtime for the public site and route handlers; Vite serves the admin development app.

**Package Manager:**
- npm, with root lockfile `package-lock.json` and admin lockfile `admin-panel/package-lock.json`.
- The root `postinstall` script installs admin dependencies through `admin-panel/package.json`.

## Frameworks

**Core:**
- Next.js 16.x in `package.json` - App Router pages, layouts, route handlers, server actions, metadata, and deployment entry point under `src/app/`.
- React 19.x in `package.json` and `admin-panel/package.json` - public components and the admin SPA.
- Vite 8.x in `admin-panel/package.json` - admin development server and production bundler.
- Tailwind CSS 3.x with `tailwind.config.js` and `postcss.config.js` - root site styling.
- Tailwind CSS 4.x with `@tailwindcss/vite` in `admin-panel/vite.config.ts` - admin styling.
- Radix UI/shadcn-style primitives configured by `components.json` and `admin-panel/components.json`.

**Testing:**
- Vitest 4.x in `vitest.config.ts`, with tests in `src/__tests__/`.
- Playwright 1.x in `playwright.config.ts`, with browser tests in `tests/`.
- The root `package.json` exposes `npm run test` and `npm run test:watch`; no separate coverage gate is configured.

**Build/Dev:**
- Root build flow is `npm run build:admin` -> `npm run copy:admin` -> `next build`, defined in `package.json`.
- `admin-panel/vite.config.ts` uses `/admin/` as the production base path and proxies `/api` to `http://localhost:3000` during development.
- `scripts/copy-admin-build.mjs` replaces `public/admin/` with the current Vite output.
- `next.config.ts` configures Turbopack, CSP/security headers, remote images, compression, and `/admin` rewrites.
- `npm run check` runs root typecheck, lint, and the combined production build; admin typechecking is separately available through `admin-panel/package.json`.

## Key Dependencies

**Backend and validation:**
- `@supabase/supabase-js` and `@supabase/ssr` in `package.json` - database, Auth, Storage, browser clients, cookie-aware server clients, and service-role operations.
- `zod` in `package.json` - request and form validation used by `src/app/api/` and `src/lib/submission.ts`.
- `@upstash/redis` and `@upstash/ratelimit` in `package.json` - optional distributed rate limiting in `src/lib/rate-limit.ts`.

**UI and motion:**
- `framer-motion` and `motion` in `package.json` - public and admin transitions, overlays, and interaction motion.
- `lucide-react`, `@hugeicons/react`, `class-variance-authority`, `clsx`, and `tailwind-merge` - icons, variants, and class composition across `src/` and `admin-panel/src/`.
- `@fontsource-variable/inter` and `@fontsource-variable/newsreader` in `admin-panel/package.json` - self-hosted admin typography.

**Documents and media:**
- `pdf-lib`, `@pdf-lib/fontkit`, and `@react-pdf/renderer` - receipts, certificates, and generated PDF output in `src/lib/`.
- `pdfjs-dist`, `@embedpdf/*`, `docx-preview`, and `mammoth` - PDF/DOCX viewing and conversion in the public and admin applications.
- `jspdf` and `html2canvas` in `admin-panel/package.json` - client-side admin certificate/PDF export.
- `sharp` in `package.json` - server-side image processing support.

## Configuration

**Application and styling:**
- `next.config.ts` - CSP, security headers, image hosts, `/admin` rewrites, and production behavior.
- `admin-panel/vite.config.ts` - admin base path, aliases, plugins, API proxy, and watch exclusions.
- `tsconfig.json`, `admin-panel/tsconfig.json`, and `admin-panel/tsconfig.app.json` - strict TypeScript project configuration and `@/*` aliases.
- `eslint.config.mjs`, `components.json`, `admin-panel/components.json`, `tailwind.config.js`, and `postcss.config.js` - linting, component conventions, and styling.
- `vitest.config.ts` and `playwright.config.ts` - automated test runners.

**Environment and launch controls:**
- `.env.local` and `.env.example` are present; their values are not part of this map.
- Runtime feature flags are read by `src/lib/launch.ts` and `next.config.ts`, including `SITE_INDEXING_ENABLED`, `SUBMISSIONS_ENABLED`, `DEMO_CONTENT_ENABLED`, `AI_TRAINING_ALLOWED`, and `NEXT_PUBLIC_ANALYTICS_ENABLED`.
- `scripts/check-launch-readiness.mjs` validates production launch approvals, public identity, security configuration, submissions, and indexing settings.

## Platform Requirements

**Development:**
- Node.js/npm, a configured Supabase project or local Supabase stack from `supabase/config.toml`, and ports 3000/5173 for Next.js and Vite.
- `launch.ps1` and `launch.bat` provide the local startup path; `README.md` and `docs/DEPLOYMENT.md` document deployment assumptions.

**Production:**
- Vercel is configured by `vercel.json` and the linked `.vercel/project.json` project metadata.
- The production deployment runs the root `build` script so the admin SPA is present before `next build`.
- Supabase is the backend platform configured by `supabase/config.toml`, `supabase/migrations/`, and the clients under `src/lib/supabase/`.
- A daily Vercel Cron invokes `/api/cron/journal-lifecycle`, configured in `vercel.json` and implemented in `src/app/api/cron/journal-lifecycle/route.ts`.

---

*Stack analysis: 2026-07-30*
