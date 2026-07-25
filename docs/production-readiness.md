# Second-branch publishability report

Updated: July 16, 2026

## Verdict

The codebase is suitable for owner verification as a reusable second-branch
foundation. It is not yet suitable for public indexing or a final production
announcement because the current database and several story/policy sections
still describe the first website.

This distinction is enforced in code:

- indexing is opt-in and currently disabled;
- preview responses carry `noindex, nofollow, noarchive`;
- preview `robots.txt` disallows all crawling;
- preview sitemap output is empty;
- preview RSS and `llms.txt` return 404;
- submissions are closed unless explicitly enabled;
- production indexing fails at startup unless owner, content, legal, backend,
  and database-security approvals are all set.

## Ready for owner review

- Public, admin, authentication, and API route boundaries are separated.
- Existing visual design, responsive effects, mobile navigation, journal
  browsing, publication pages, author pages, search, and admin sign-in remain.
- Public content renders as server-readable HTML.
- Canonicals, Open Graph, robots rules, sitemap, RSS, manifest, Organization,
  WebSite, Periodical, ProfilePage, Article, ItemList, and breadcrumb data exist.
- Publication pages expose Google-style scholarly citation metadata, including
  HTML full-text URLs and conditional ISSN, abstract, and PDF tags.
- OpenAI search crawling and optional model-training crawling are controlled
  separately.
- Supabase authentication checks claims on protected admin routes.
- Submission creation requires server-validated Cloudflare Turnstile when open.
- Security headers, private admin caching, upload validation, RLS migrations,
  and private submission storage boundaries are present.
- Demo content no longer appears as a silent production fallback when Supabase
  is unavailable.
- Static analysis reports no unused files, dependencies, exports, or types.
- Type checking, linting, the production build, browser console checks, and the
  package vulnerability audit pass.

## Intentional launch blockers

1. Replace or delete every first-site journal, author, publication, file,
   testimonial, statistic, history statement, citation, contact, and social
   link.
2. Choose and confirm the second branch's database/storage isolation model.
   A separate Supabase project is recommended.
3. Apply and verify all repository migrations against that branch project.
4. Approve the final privacy notice, terms, editorial claims, fees, review
   timelines, rights language, and effective date.
5. Configure the final custom domain, contact email, social card, Turnstile
   keys if submissions open, admin accounts, and recovery procedures.
6. Complete desktop/mobile regression, accessibility, metadata, security,
   backup, and rollback checks on the final deployment.
7. Obtain owner approval, then enable indexing once on the canonical deployment.

## Known scope boundary

The current fixture dataset generates more than one thousand static publication
paths and therefore lengthens production builds. The larger pagination,
on-demand rendering, and data-query redesign was intentionally excluded from
the approved phases. Reassess it if the second branch launches with a similarly
large catalogue or if build duration becomes operationally significant.

## Verification snapshot

Verified locally on July 16, 2026:

- `npm run check` passed (type checking, linting, and the production build).
- The production build generated 1,201 routes from the current disposable
  fixture catalogue.
- `knip` reported no unused files, dependencies, exports, or types.
- `npm audit --audit-level=low` reported zero known package vulnerabilities.
- Browser checks passed for representative public, submission, error, and
  protected admin routes on desktop and mobile without console errors.
- Lighthouse on the protected preview build scored 89 performance, 100
  accessibility, and 100 best practices. Its SEO score was 69 because the
  deliberate preview `noindex` rule was the sole crawlability failure; rerun
  Lighthouse after the final-domain indexing gate is approved.
- Preview route checks confirmed an empty sitemap, crawl blocking, unavailable
  RSS/`llms.txt`, private admin caching, and disabled submission initialization.

The final accessible-name adjustment made after that production build was
rechecked with type checking, linting, static analysis, and the package audit.

## Live database audit boundary

The currently configured Supabase project was inspected read-only. It contains
the seven migrations through `20260715143144_split_anonymous_public_read_policies`.
The repository migration
`20260716061739_restrict_editorial_media_metadata.sql` has not been applied.
That is intentional until the owner selects the second branch's database.

Current advisor findings to resolve on the selected branch project:

- enable leaked-password protection;
- review overlapping authenticated `SELECT` policies on `media_assets` and
  `media_placements`;
- reassess 18 currently unused indexes only after realistic branch traffic
  exists--absence of usage in this test project is not enough reason to remove
  them.

No live data, policy, migration, or authentication setting was changed during
this audit.

## AI and search discoverability assessment

Once the final domain is indexable and contains original, verifiable branch
content, the technical foundation is discoverable by traditional search and AI
search systems. That does not guarantee ranking, citation, or inclusion.

The durable work is conventional: accessible server-rendered pages, stable
canonical URLs, accurate titles and descriptions, real authorship, visible
publication dates, citations, identifiers, internal links, structured data,
and crawl access. `llms.txt` is provided as an optional convenience; Google
states that it is not required for its AI search features.

For ChatGPT discovery, allow `OAI-SearchBot`. `GPTBot` is a separate
training-control choice and is blocked by default. After analytics is genuinely
implemented, measure referrals carrying `utm_source=chatgpt.com`.

## Publication decision

- Owner/design verification: **ready**
- Content entry for the second branch: **ready**
- Public submissions: **ready to configure, closed by default**
- Public indexing: **blocked until checklist approval**
- Final production launch: **blocked until checklist approval**

Run `npm run readiness` for the current machine-readable blocker list.
