# Technology Stack

**Analysis Date:** 2026-07-27

## Languages

**Primary:**
- TypeScript ^6.0.3 (root) / latest (admin-panel) - All application code in both apps

**Secondary:**
- JavaScript (ESM) - Build scripts (`scripts/*.mjs`), config files (`tailwind.config.js`, `postcss.config.js`, `eslint.config.mjs`)
- SQL - Supabase migrations (`supabase/migrations/*.sql`)
- CSS - Tailwind utility classes + custom stylesheets (`src/styles.css`, `admin-panel/src/styles.css`)

## Runtime

**Environment:**
- Node.js (ES2022 target in both tsconfigs)
- Next.js 16 server runtime (Turbopack enabled in dev)

**Package Manager:**
- npm (lockfiles present: `package-lock.json` at root and `admin-panel/package-lock.json`)
- Root `postinstall` script auto-installs admin-panel dependencies

## Frameworks

**Core:**
- Next.js ^16.2.10 - Public-facing site, API routes, server components (`src/app/`)
- React ^19.2.7 - UI layer for both apps
- Vite latest - Admin panel dev server and bundler (`admin-panel/vite.config.ts`)

**Testing:**
- Not detected (no test framework configured in either app)

**Build/Dev:**
- Turbopack - Next.js dev bundler (configured in `next.config.ts`)
- Vite ^latest + @vitejs/plugin-react - Admin panel HMR and production build
- PostCSS ^8.5.6 + Autoprefixer ^10.4.21 - CSS processing (root)
- @tailwindcss/vite ^4.3.3 - Tailwind v4 Vite plugin (admin-panel)

## Key Dependencies

**Critical:**
- @supabase/supabase-js ^2.110.3 - Database, auth, and storage client
- @supabase/ssr ^0.12.1 - Server-side Supabase client with cookie handling
- zod ^4.3.6 - Runtime request validation in API routes
- radix-ui ^1.6.2 (root) / ^1.6.4 (admin) - Headless UI primitives (shadcn/ui base)

**UI & Animation:**
- framer-motion ^12.42.2 + motion ^12.42.2 - Component animation (root)
- motion ^12.42.2 - Animation (admin-panel)
- lucide-react ^1.25.0 (root) / latest (admin) - Icon library
- @hugeicons/core-free-icons ^4.2.3 + @hugeicons/react ^1.1.9 - Additional icon set (root)
- class-variance-authority ^0.7.1 + clsx ^2.1.1 + tailwind-merge ^3.6.0 - Variant styling utilities
- tailwindcss-animate ^1.0.7 + tw-animate-css ^1.4.0 - Animation utilities

**Document Processing:**
- pdf-lib ^1.17.1 + @pdf-lib/fontkit ^1.1.1 - PDF generation (certificates, receipts)
- @react-pdf/renderer ^4.5.1 - React-based PDF rendering
- pdfjs-dist ^5.4.624 - PDF viewing/rendering (both apps)
- @embedpdf/* ^2.14.4 (12 packages) - PDF viewer plugin system (root)
- docx-preview ^0.4.0 - DOCX preview rendering (root)
- mammoth ^1.12.0 - DOCX-to-HTML conversion (both apps)

**Admin Panel Specific:**
- jspdf ^4.2.1 - Client-side PDF generation
- html2canvas ^1.4.1 - DOM-to-canvas capture for PDF export
- @fontsource-variable/inter ^5.2.8 + @fontsource-variable/newsreader ^5.3.0 - Self-hosted fonts

**Infrastructure:**
- server-only ^0.0.1 - Prevents server modules from bundling into client
- react-easy-crop ^6.2.2 - Image cropping (root)

## Configuration

**Environment:**
- `.env.local` (present, gitignored) - Active environment configuration
- `.env.example` - Documented template with all required variables
- Key env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_EMAILS`
- Feature flags: `SITE_INDEXING_ENABLED`, `SUBMISSIONS_ENABLED`, `DEMO_CONTENT_ENABLED`, `NEXT_PUBLIC_ANALYTICS_ENABLED`

**Build:**
- `next.config.ts` - Next.js config with CSP headers, image remote patterns, admin rewrites
- `admin-panel/vite.config.ts` - Vite config with `/admin/` base path, API proxy to localhost:3000
- `tailwind.config.js` - Tailwind v3 theme (root, custom forest/clay/parchment palette)
- `admin-panel/postcss.config.js` - Empty plugins (Tailwind v4 handled by Vite plugin)
- `tsconfig.json` - Root TS config with `@/*` → `./src/*` path alias
- `admin-panel/tsconfig.app.json` - Admin TS config with `@/*` → `./src/*` path alias
- `components.json` - shadcn/ui config (root: RSC enabled, style "radix-nova")
- `admin-panel/components.json` - shadcn/ui config (admin: RSC disabled)
- `eslint.config.mjs` - ESLint flat config with next/core-web-vitals + typescript
- `vercel.json` - Vercel cron job + admin cache headers

**Component System:**
- shadcn/ui (radix-nova style) - Both apps use `@/components/ui/` for primitives
- Aceternity UI registry configured (root only, `components.json`)

## Platform Requirements

**Development:**
- Node.js (ES2022+ required by tsconfig target)
- npm (workspaces not used; root postinstall chains admin-panel install)
- Supabase project (cloud or local via `supabase/config.toml`)
- Both apps run concurrently: `next dev` on :3000, `vite` on :5173
- `launch.ps1` / `launch.bat` - Automated dev environment launcher

**Production:**
- Vercel (Next.js hosting with admin panel served as static files under `/admin/`)
- Build pipeline: `npm run build` → builds admin (Vite) → copies to `public/admin/` → builds Next.js
- Supabase cloud (region: ap-southeast-1, project: talikha-publishing)
- Vercel Cron: daily journal lifecycle job at `/api/cron/journal-lifecycle`

---

*Stack analysis: 2026-07-27*
