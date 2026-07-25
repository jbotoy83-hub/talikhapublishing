# Talikha Publishing

This is an independent working copy of the Lakbay-Sinag website and its
editorial admin-panel prototype, prepared for transformation into Talikha
Publishing. It does not contain local credentials, generated build output, or
Git history from the source project.

This repository is a reusable Next.js publishing platform for journals,
publication records, author profiles, secure manuscript submissions, and an
authenticated editorial workspace.

The current first-site publications, authors, journal names, testimonials,
statistics, files, history, and branding are preview fixtures. Production
indexing and submissions stay disabled until the second branch replaces and
approves them.

## Architecture

- Next.js App Router renders accessible public pages and metadata.
- Supabase stores editorial records, users, audit events, and private files.
- Vercel is the intended application host.
- Public routes have reusable SEO, scholarly citation, schema, sitemap, feed,
  and AI-discovery foundations.
- `/admin` is isolated from the public layout, excluded from discovery,
  authenticated, and authorized again by every privileged server action.
- Preview deployments emit `noindex` headers, disallow crawling, publish no
  sitemap URLs, and hide the RSS and `llms.txt` discovery endpoints.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Keep `SITE_INDEXING_ENABLED=false` and `DEMO_CONTENT_ENABLED=false`.
3. Add the selected second-branch Supabase credentials.
4. Run `npm install`.
5. Review and apply the migrations to the selected branch database.
6. Run `npm run dev`.

Use a separate Supabase project and Vercel project for the second branch when
possible. If the owner chooses to reuse infrastructure, document and verify the
data-isolation boundary before setting `BACKEND_ISOLATION_CONFIRMED=true`.

`supabase/seed.sql` is intentionally empty so a reset cannot repopulate the
new branch with first-site records.

## Verification commands

```powershell
npm run typecheck
npm run lint
npm run build
npm run check
npm run readiness
```

`npm run readiness` is expected to fail during owner preview. It becomes the
final configuration gate after replacement content, legal approval, backend
security review, final domain setup, and owner sign-off.

## Production cutover

Follow [the second-branch launch checklist](docs/second-branch-launch-checklist.md)
and read [the current publishability report](docs/production-readiness.md).
Do not enable indexing merely because the application builds successfully.
