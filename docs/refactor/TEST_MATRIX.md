# Test Matrix — Talikha Publishing Refactor

**Last updated:** 2026-07-31
**Purpose:** Define the safety test suite that protects critical behavior before and during refactoring (master instruction Phase 3). Characterization tests document what the system *currently does*, including imperfect behavior.

---

## 1. Current state (baseline)

| Layer | Tool | Status |
|---|---|---|
| Unit | Vitest 4 (`vitest.config.ts`, jsdom, `src/__tests__/`) | **3 files / 32 tests passing**: `workflow-transitions.test.ts`, `publication-preflight-rules.test.ts`, `citation-format.test.ts` |
| E2E | Playwright 1.62 (`playwright.config.ts`, Chromium, `tests/`) | 2 specs: `certificate-convert-to-field.spec.ts` (needs Vite at `localhost:5173/admin?view=certificates`), `example.spec.ts` (targets playwright.dev — not a Talikha test) |
| Integration | — | **None** (no route-handler / Supabase / RLS coverage) |
| Contract | — | **None** |
| Visual regression | — | **None** |
| Coverage threshold | — | None configured |

**Commands:** `npm run test` (vitest run) · `npm run test:watch` · `npx playwright test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run check`.

## 2. Required testing layers

- **Unit** — pure utilities, formatters, validators, status mapping, permission helpers, notification text, file-validation rules, certificate-number formatting, date formatting.
- **Integration** — API routes, server actions, service modules, Supabase queries/transforms, notification creation, status transitions, role checks (with mocked auth/storage).
- **E2E** — critical journeys: author login→submission; admin login→verification; editorial assignment; status progression; author tracking; publication scheduling; public article access.
- **Contract** — lock API request/response fields, HTTP status codes, error formats, route/search params, server-action inputs, DB return shapes, notification payloads, status-transition payloads.
- **Visual regression** — screenshots of author dashboard, submission page, admin dashboard, editorial workspace, notification panel, activity log, journal/issue management, public article page.

## 3. Test-data safety

Use local dev data, seeded data (`supabase/seed.sql`), mocked services, a dedicated Supabase dev project, or a temporary schema. **Never run destructive tests against production.** No production data for destructive testing.

## 4. Characterization test matrix (by protected workflow)

Priority: **H** = add before any refactor of that area.

| ID | Workflow | Layer | Target files | Key assertions (current behavior) | Priority |
|----|----------|-------|--------------|-----------------------------------|----------|
| T-AUTH-1 | Role resolution & guards | unit+integration | `src/lib/auth.ts`, `admin-api.ts` | admin/editor/viewer resolution; allowlist behavior (incl. hardcoded address — document, don't yet change); guard 401/403 shapes; local bypass only when non-prod | H |
| T-AUTH-2 | Protected-route redirect | e2e | `src/proxy.ts` | unauthenticated `/admin` → login; session refresh; no-index/no-store on `/admin` | H |
| T-SUB-1 | Submission init validation | unit | `src/lib/submission.ts` | `submissionInitSchema` accept/reject cases incl. `idempotencyKey` uuid; file-field validation | H |
| T-SUB-2 | Submission init/complete contract | integration | `api/submissions/init|complete/route.ts` | gates order (enabled→ratelimit→size→zod→honeypot→turnstile); 201 vs 200 (idempotent resume) vs 409/500/503; signed-upload payload shape; complete returns `{reference}`; already-submitted short-circuit | H |
| T-SUB-3 | Author submission journey | e2e | `/submit`, local-submission-form | draft/save, upload, retry, final submit, tracking visibility | H |
| T-WF-1 | Workflow transitions | unit (exists) + integration | `editorial-workflow.ts`, `editorial-workflow-server.ts`, `transition_submission` | full stage path; invalid/terminal transitions; role gating; payment gate; activity emission | H |
| T-WF-2 | Editorial progression | e2e | admin SPA + `/api/admin/submissions/[id]/*` | verify→assign→status changes→production→schedule→publish; dashboard counters | H |
| T-ACT-1 | Activity visibility | integration | `workflow_events` writers, `/api/track` | author-visible vs internal events; `visibility` filtering; **author never sees internal events**; dedup by batch | H |
| T-NOTIF-1 | Notification creation/recipients | integration | notification creators (trace in Phase 2), `notifications` table | recipient selection; priority/private/team/admin types; read state; unread counts; no cross-privacy merging | H |
| T-JI-1 | Journal/issue rules | unit+integration | `journal-lifecycle.ts`, `api/journal-store/route.ts` | current-volume/issue derivation; journal-specific issue selection; INQUIRA↔LUMERA non-mixing; public consistency | H |
| T-PUB-1 | Publication access & contract | integration+e2e | `api/publications/[slug]/*`, public pages | metadata, author names, PDF access, cover, DOI/Zenodo display, search, metric increment | M |
| T-PRE-1 | Publication preflight | unit (exists) | `publication-preflight-rules.ts` | extend existing rules coverage | M |
| T-CERT-1 | Certificate data + numbering | unit+integration | `certificates.ts`, `render-certificate.ts`, `allocate_certificate_number` | linked-field consistency; **numbering stability (no renumber)**; cert number/ISSN/DOI/date formatting; access-link contract | H |
| T-CERT-2 | Certificate editor | e2e (exists) | `tests/certificate-convert-to-field.spec.ts` | keep passing; replace external example spec with app smoke test | M |
| T-SEC-1 | Admin API authorization audit | integration | every `/api/admin/*` handler | each handler rejects anonymous/viewer where required (catches SEC-1 dashboard gap) | H |
| T-TRACK-1 | Public tracking confidentiality | integration | `api/track/*` | what a reference-only lookup returns (document current exposure baseline before any change) | H |
| T-CONTRACT-1 | API error format | integration | `admin-api.ts` `apiErrorResponse` | ZodError→400 first-issue message; 401/403/404/409/500 shapes | M |

## 5. Sequencing rule

Before refactoring any area in Phase 4–8, the corresponding **H**-priority characterization tests above must exist and pass at baseline. A refactor that changes a characterization test result is a behavior change and must be stopped and reviewed (master instruction §16).

## 6. Gaps to close first (Phase 3 minimum)

1. T-AUTH-1 / T-SEC-1 (authorization) — highest risk, currently untested.
2. T-WF-1 integration + T-ACT-1 (workflow + activity visibility).
3. T-SUB-1 / T-SUB-2 (submission contract, incl. the snapshotted idempotency work).
4. T-NOTIF-1 (after Phase 2 traces notification creators).
5. T-CERT-1 (numbering stability).
