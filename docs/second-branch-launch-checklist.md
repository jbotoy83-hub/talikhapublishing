# Second-branch production launch checklist

Keep indexing off until every required item is complete. The safest sequence is
preview, replace, verify, approve, deploy, then index.

## 1. Ownership, isolation, and rollback

- [ ] Confirm who owns the Vercel team, Supabase organization, domain, email,
  Turnstile account, Search Console, and Bing Webmaster Tools.
- [ ] Prefer a new Vercel project and a new Supabase project for the second
  branch.
- [ ] If infrastructure is reused, document exactly how first-branch data,
  storage, users, logs, backups, and billing are isolated.
- [ ] Record the last known-good Vercel deployment.
- [ ] Export database/storage backups and perform a restore check.
- [ ] Save a secure inventory of production environment-variable names and
  owners; never put secret values in this repository.
- [ ] Set `BACKEND_ISOLATION_CONFIRMED=true`.

## 2. Branch identity and canonical domain

- [ ] Final organization name, short name, tagline, description, locale,
  location, service area, and founding year are owner-approved.
- [ ] Final contact address uses a controlled business mailbox.
- [ ] Final Facebook or other social profiles are verified before linking.
- [ ] Create a 1200×630 branch-specific social image and set
  `NEXT_PUBLIC_SITE_OG_IMAGE`.
- [ ] Configure the final HTTPS custom domain and set
  `NEXT_PUBLIC_SITE_URL`.
- [ ] Remove `LEGACY_SITE_URL` and first-site hosts from
  `REMOTE_IMAGE_HOSTS`.
- [ ] Verify apex/www redirects and that only one host is canonical.

## 3. Replacement content and records

- [ ] Delete or archive first-site database records only after confirming the
  owner-approved isolation and backup plan.
- [ ] Replace every journal title, slug, scope, cadence, ISSN, hero image,
  volume, issue, and publication relationship.
- [ ] Replace every publication title, author, abstract, keyword, date, page,
  DOI, citation, license, rights holder, and full-text link.
- [ ] Replace every author biography, affiliation, credential, portrait, and
  ORCID.
- [ ] Replace the About story, FAQ answers, homepage topics, service claims,
  statistics, testimonials, contact details, and social links.
- [ ] Remove all first-site files from the selected second-branch storage
  project.
- [ ] Verify every published record opens at a stable URL and contains only
  factual, owner-approved information.
- [ ] Keep `DEMO_CONTENT_ENABLED=false`.
- [ ] Set `CONTENT_APPROVED=true`.

## 4. Editorial and legal approval

- [ ] Owner/editor confirms what is actually peer reviewed and what is not.
- [ ] Fees, refund/cancellation terms, review timelines, publication cadence,
  DOI/ISSN claims, copyright, licensing, corrections, retractions, AI use,
  ethics, conflicts, and appeals match real operations.
- [ ] Privacy notice accurately names processors, storage, retention, lawful
  purposes, contact route, and applicable rights.
- [ ] Terms and privacy effective date is set in
  `NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE`.
- [ ] Optional analytics remains disabled unless a real consent-aware provider,
  withdrawal control, retention policy, and documentation are implemented.
- [ ] Set `LEGAL_APPROVED=true`.

## 5. Database, auth, storage, and security

- [ ] Link the intended second-branch Supabase project.
- [ ] Review and apply every migration in `supabase/migrations`.
- [ ] Confirm RLS is enabled on every table exposed through the Data API.
- [ ] Confirm anonymous users can read only published public records.
- [ ] Confirm anonymous/authenticated users cannot list editorial media
  metadata, submissions, private files, audit events, or admin-only records.
- [ ] Confirm the `submission-files` bucket is private and signed links are
  short lived.
- [ ] Confirm the public editorial image bucket contains no private material.
- [ ] Disable open account creation unless it is intentionally required.
- [ ] Configure controlled admin accounts, `ADMIN_EMAILS`, role assignment,
  MFA policy, SMTP/magic-link behavior, recovery, and offboarding.
- [ ] Enable Supabase leaked-password protection when the selected plan supports
  it.
- [ ] Resolve or explicitly approve the overlapping authenticated `SELECT`
  policies reported for `media_assets` and `media_placements`.
- [ ] Rotate any credential previously shared outside the approved secret
  store.
- [ ] Verify backup/PITR policy and restore ownership.
- [ ] Set `LOCAL_ADMIN_BYPASS=false`.
- [ ] Set `DATABASE_SECURITY_APPROVED=true`.

## 6. Submission workflow

If submissions will remain closed, keep `SUBMISSIONS_ENABLED=false` and state
the alternative contact path clearly.

If submissions will open:

- [ ] Create production Turnstile keys restricted to the final host.
- [ ] Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- [ ] Test a successful manuscript submission end to end.
- [ ] Test invalid type, oversize file, bot challenge failure, duplicate token,
  interrupted upload, incomplete upload, and rate-limit behavior.
- [ ] Verify the author receives the promised reference and the editorial team
  has a real follow-up workflow.
- [ ] Verify private files cannot be accessed without an authorized signed URL.
- [ ] Consider a durable distributed rate limiter before a high-traffic launch;
  the local in-memory limit is only a best-effort supplement to Turnstile.

## 7. Search and AI discovery

- [ ] Verify final page titles, descriptions, canonicals, language, Open Graph,
  and social images.
- [ ] Validate Organization, WebSite, Periodical, ProfilePage, Article,
  ItemList, and breadcrumb structured data against final records.
- [ ] Validate scholarly citation metadata on representative publications.
- [ ] Confirm `robots.txt` allows public pages and blocks admin/API paths.
- [ ] Decide whether `GPTBot` training access is allowed; keep
  `OAI-SearchBot` available for ChatGPT search discovery.
- [ ] Verify `sitemap.xml`, `feed.xml`, and `llms.txt` use the final host.
- [ ] Add the final domain to Google Search Console and Bing Webmaster Tools.
- [ ] Submit the sitemap only after the canonical deployment is live.
- [ ] Do not promise ranking, Google Scholar inclusion, AI citation, or index
  coverage.

References:

- OpenAI publisher controls:
  https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- Google AI search guidance:
  https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

## 8. Quality, accessibility, and operations

- [ ] Run `npm ci`, `npm run check`, `npm audit`, and
  `npm run readiness`.
- [ ] Test home, journals, publication, author, search, about, policies,
  submission, 404, admin login, and admin workflows on current desktop/mobile
  browsers.
- [ ] Test keyboard-only navigation, skip link, focus visibility, menu focus,
  zoom/reflow, reduced motion, labels, alternative text, and color contrast.
- [ ] Confirm there are no browser console errors, mixed content, broken assets,
  horizontal overflow, or misleading empty states.
- [ ] Re-run Lighthouse against the final production host and record results.
- [ ] Configure uptime/error monitoring and identify the on-call owner.
- [ ] Verify logs do not expose secrets, full private file URLs, or unnecessary
  personal data.

## 9. Final cutover

- [ ] Owner reviews the exact production deployment.
- [ ] Set `OWNER_LAUNCH_APPROVED=true`.
- [ ] Keep `SITE_INDEXING_ENABLED=false`, deploy, and run the complete live
  route/header/browser test once more.
- [ ] Set `SITE_INDEXING_ENABLED=true` only on the canonical production
  deployment.
- [ ] Run `npm run readiness`; it must report no errors.
- [ ] Promote the tested deployment.
- [ ] Verify robots, sitemap, feed, `llms.txt`, canonical URLs, redirects,
  submissions, admin protection, and monitoring from outside the account.
- [ ] Submit the sitemap and begin monitoring crawl/index coverage.

## 10. First 72 hours

- [ ] Watch uptime, server errors, Supabase auth/storage logs, Turnstile
  failures, submissions, crawl errors, and unexpected 404s.
- [ ] Check that indexed URLs use the canonical domain and no preview/legacy
  pages are appearing.
- [ ] Track support questions and correct inaccurate content immediately.
- [ ] If security, privacy, data, or canonical issues appear, disable indexing
  and/or submissions, roll back the deployment, and restore from the verified
  backup as appropriate.
