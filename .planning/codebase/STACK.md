# Technology Stack

**Analysis Date:** 2026-07-31

This is a monorepo with two applications sharing one Supabase backend:

1. **Public site** — Next.js 16 (App Router) at the repo root (`src/` + `components/`). Serves `localhost:3000`.
2. **Admin panel** — Vite 8 + React 19 single-page app in `admin-panel/`. Built to static assets, copied into `public/admin/`, and served by Next.js at `/admin`.

## Languages

**Primary:**
- TypeScript (strict mode, both apps) — all application code. Root config `tsconfig.json`, admin config `admin-panel/tsconfig.app.json`. Both target `ES2022`, `moduleResolution: bundler`, `jsx: react-jsx`.
- TSX — React components (`.tsx`) in both apps.

**Secondary:**
- CSS — Tailwind-driven plus hand-written CSS-variable theme sheets: `src/styles.css` (site) and `admin-panel/src/styles.css` (admin, includes component CSS such as `admin-panel/src/components/inbox/inbox.css`).
- SQL — Supabase migrations in `supabase/migrations/` (40+ files) and `supabase/seed.sql`.
- JavaScript (ESM `.mjs`) — build/helper scripts in `scripts/` (`copy-admin-build.mjs`, `check-launch-readiness.mjs`, `upload-login-wallpaper.mjs`) and config files (`eslint.config.mjs`, `tailwind.config.js`, `postcss.config.js`).

## Runtime

**Environment:**
- Node.js v24.16.0 (verified locally). No `.nvmrc` / `.node-version` pinning file detected.

**Package Manager:**
- npm 11.13.0
- Lockfiles present: `package-lock.json` (root) and `admin-panel/package-lock.json`.
- Root `postinstall` script auto-installs admin deps: `npm install --include=dev --prefix admin-panel` (`package.json`).

## Frameworks

**Core:**
- `next` ^16.2.10 — public site, App Router, React Server Components (`package.json`). Config: `next.config.ts`.
- `react` ^19.2.7 / `react-dom` ^19.2.7 — shared by both apps. The admin Vite build aliases `react`/`react-dom` to the root `node_modules` to dedupe (`admin-panel/vite.config.ts`).
- `vite` ^8.1.5 — admin panel bundler/dev server (`admin-panel/package.json`). Config: `admin-panel/vite.config.ts`.

**Testing:**
- `vitest` ^4.1.10 + `@vitejs/plugin-react` — unit tests. Config: `vitest.config.ts` (jsdom env, `src/__tests__/**/*.test.{ts,tsx}`).
- `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^7.0.0 — component/DOM assertions. Setup: `src/__tests__/setup.ts`.
- `jsdom` ^30.0.0 — DOM environment for vitest.
- `@playwright/test` ^1.62.0 — E2E. Config: `playwright.config.ts` (testDir `./tests`, chromium only). Currently only stub specs exist (`tests/example.spec.ts`, `tests/certificate-convert-to-field.spec.ts`).

**Build/Dev:**
- `typescript` ^6.0.3 (root) / ^7.0.2 (admin) — typechecking (`npm run typecheck`).
- `eslint` ^9.39.1 + `eslint-config-next` ^16.2.10 — flat config in `eslint.config.mjs`.
- `tailwindcss` ^3.4.17 (site, v3 with `tailwind.config.js`) / ^4.3.3 (admin, v4 via `@tailwindcss/vite` plugin).
- `postcss` ^8.5.6 + `autoprefixer` — CSS pipeline (`postcss.config.js`).
- `@vitejs/plugin-react` ^6.0.4 — React fast-refresh in both vitest and admin Vite.

## Key Dependencies

**Critical (data + backend):**
- `@supabase/supabase-js` ^2.110.3 — Postgres/Auth/Storage client.
- `@supabase/ssr` ^0.12.1 — cookie-based SSR auth client (`createServerClient` / `createBrowserClient`).
- `@upstash/redis` ^1.38.0 + `@upstash/ratelimit` ^2.0.8 — distributed rate limiting (`src/lib/rate-limit.ts`).
- `zod` ^4.3.6 — request/body validation (e.g. `src/lib/submission.ts`, `src/lib/admin-api.ts`).
- `server-only` ^0.0.1 — guards server-only modules from client bundling (imported at top of `src/lib/*.ts`).

**UI component system (both apps):**
- `radix-ui` ^1.6.2 (site) / ^1.6.4 (admin) — headless primitives.
- `class-variance-authority` ^0.7.1 — component variant definitions.
- `clsx` ^2.1.1 + `tailwind-merge` ^3.6.0 — combined in the `cn()` helper (`src/lib/utils.ts`, `admin-panel/src/lib/utils.ts`).
- `lucide-react` ^1.25.0 — icon library (site). Admin reuses root `src/components/icons` via alias.
- `@hugeicons/core-free-icons` ^4.2.3 + `@hugeicons/react` ^1.1.9 — additional icons.
- `framer-motion` ^12.42.2 / `motion` ^12.42.2 — animation.
- `tailwindcss-animate` ^1.0.7 + `tw-animate-css` ^1.4.0 — animation utilities.
- shadcn/ui — component scaffolding (style `radix-nova`); config in `components.json` (root) and `admin-panel/components.json`.

**Document/PDF processing (site):**
- `pdfjs-dist` ^5.4.624 — PDF rendering (`src/components/ui/pdf-viewer.tsx`).
- `pdf-lib` ^1.17.1 + `@pdf-lib/fontkit` ^1.1.1 — PDF generation/manipulation.
- `@react-pdf/renderer` ^4.5.1 — receipts (`src/lib/receipt-pdf.tsx`).
- `@embedpdf/*` ^2.14.4 (core, engines, models, + 11 plugins) — embeddable PDF viewer toolkit.
- `docx-preview` ^0.4.0 + `mammoth` ^1.12.0 — Word document preview/conversion (`src/components/ui/docx-viewer.tsx`).
- `sharp` ^0.35.3 — server-side image processing.

**Admin-only extras (`admin-panel/package.json`):**
- `jspdf` ^4.2.1 + `html2canvas` ^1.4.1 — client-side certificate/PDF export.
- `jszip` 3.10.1 — bulk ZIP export.
- `react-easy-crop` (resolved via root) — image cropping in `admin-panel/src/main.tsx`.
- `@fontsource-variable/inter` ^5.2.8 + `@fontsource-variable/newsreader` ^5.3.0 — self-hosted admin fonts.

## Configuration

**Environment:**
- Env vars are documented in `.env.example` (55 lines). Live values live in `.env.local` (present, not read — contains secrets).
- Public vars are prefixed `NEXT_PUBLIC_` (site identity, Supabase URL/anon key, Turnstile site key, feature flags).
- Server-only vars: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_EMAILS`, `LOCAL_ADMIN_BYPASS`, `JOURNAL_STORE_TOKEN`.
- Feature/launch gates read via `src/lib/launch.ts`: `SITE_INDEXING_ENABLED`, `DEMO_CONTENT_ENABLED`, `SUBMISSIONS_ENABLED`, `AI_TRAINING_ALLOWED`, plus approval gates `CONTENT_APPROVED`, `LEGAL_APPROVED`, `OWNER_LAUNCH_APPROVED`, `DATABASE_SECURITY_APPROVED`.
- `assertLaunchConfiguration()` (`src/lib/launch.ts`) throws at render time if indexing is enabled without required config — called from `src/app/layout.tsx`.

**Build:**
- `next.config.ts` — CSP headers, security headers, `images.remotePatterns` (Supabase host + `REMOTE_IMAGE_HOSTS`), `/admin` rewrites, `optimizePackageImports: ["lucide-react"]`.
- `admin-panel/vite.config.ts` — `base: "/admin/"` on build, dev proxy `/api` and `/admin/login` → `http://localhost:3000`, react/react-dom dedupe aliases.
- `tsconfig.json` — `@/*` → `./src/*`. Admin `tsconfig.app.json` — `@/*` → `./src/*` plus `@/components/icons` → `../src/components/icons` (shares the root icon set).
- `components.json` (root + admin) — shadcn/ui `radix-nova` style, `neutral` base color, CSS variables enabled, lucide icons.

**NPM scripts (root `package.json`):**
- `dev` — `next dev` (public site).
- `build` — `build:admin` (vite build) → `copy:admin` (copy to `public/admin`) → `next build`.
- `check` — `typecheck` + `lint` + `build` (the verification gate; there is no test suite wired into it).
- `db:types` — regenerate `src/types/database.generated.ts` from the linked Supabase project.
- `test` / `test:watch` — vitest.

## Platform Requirements

**Development:**
- Node.js (v24 verified) + npm.
- `launch.ps1` / `launch.bat` start both apps and wire a Chrome debug bridge on port 9222 (`launch.ps1`).
- Admin dev (`npm run dev` inside `admin-panel/`) proxies API calls to the Next dev server on `:3000`.

**Production:**
- Vercel (`.vercel/` present, `vercel.json` defines a daily cron at `/api/cron/journal-lifecycle` and `/admin` no-cache/no-index headers).
- Supabase project `talikha-publishing`, region `ap-southeast-1` (per `.env.example`).
- Upstash Redis required for production rate limiting (in-memory fallback does not work across serverless instances — see CONCERNS.md).

---

*Stack analysis: 2026-07-31*
