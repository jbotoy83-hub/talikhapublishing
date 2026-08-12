# Testing Patterns

**Analysis Date:** 2026-08-12 (manuscript-editor coverage refreshed)

## Test Framework

**Unit runner:**
- Vitest `^4.1.10`, configured in `vitest.config.ts`.
- Environment: `jsdom` with global `describe`, `it`, and `expect` APIs.
- Setup: `src/__tests__/setup.ts` loads `@testing-library/jest-dom/vitest`.
- Include pattern: `src/__tests__/**/*.test.{ts,tsx}`.

**Browser runner:**
- Playwright Test `^1.62.0`, configured in `playwright.config.ts`.
- Browser project: Chromium by default, with HTML reporting and trace capture on first retry.
- E2E directory: `tests/`.
- The config does not define `baseURL` or `webServer`; tests must provide their own URL and require the relevant local app/server to be running.

**Assertion libraries:**
- Vitest assertions plus `@testing-library/jest-dom` matchers.
- Playwright's built-in `expect` assertions.

## Run Commands

```bash
npm run test                 # Run Vitest unit tests once
npm run test:watch           # Run Vitest in watch mode
npx playwright test          # Run Playwright tests in tests/
$env:PLAYWRIGHT_CHANNEL='chrome'; npx.cmd playwright test tests/manuscript-editor.spec.ts tests/certificate-convert-to-field.spec.ts --project=chromium --workers=1
npx playwright show-report  # Open the Playwright HTML report
npm run typecheck            # Root TypeScript check
npm run lint                 # ESLint check (now functional — react-hooks plugin resolved)
npm run build                # Build admin assets, copy them, then build Next.js
npm run check                # typecheck + lint + build
npm run readiness             # Validate deployment environment/configuration
cd admin-panel; npm run typecheck  # Admin TypeScript project-reference check
```

The root `package.json` owns Vitest and Playwright dependencies and scripts. `admin-panel/package.json` provides the Vite build/typecheck scripts but has no separate test runner.

## Test File Organization

**Location:**
- Unit tests are co-located under `src/__tests__/`.
- Browser tests are separated under the repository-level `tests/` folder.
- No admin-panel-specific unit test directory is configured.

**Naming:**
- Unit files use `*.test.ts` or `*.test.tsx`.
- Playwright files use `*.spec.ts`.

**Current inventory (7 unit files + 3 E2E specs):**
- `src/__tests__/workflow-transitions.test.ts` — 25 assertions covering editorial workflow transitions and author progress.
- `src/__tests__/citation-format.test.ts` — citation formatting logic.
- `src/__tests__/display-formatting.test.ts` — author-display and journal-presentation formatting (added 2026-07-31).
- `src/__tests__/publication-preflight-rules.test.ts` — preflight rule evaluation.
- `src/__tests__/submission-schema.test.ts` — submission Zod schema characterization (added 2026-07-31).
- `src/__tests__/email-correspondence.test.ts` — correspondence formatting and event behavior.
- `src/__tests__/manuscript-editor.test.tsx` — document contract, DOCX/PDF import, sanitization, comparison, serialization, and a representative 100-page worker conversion fixture.
- `tests/certificate-convert-to-field.spec.ts` — certificate editor interaction (requires running Vite dev server).
- `tests/manuscript-editor.spec.ts` — Editors hub, direct route, import/comparison, formatting, fields, autosave/reload, conflicts, lease takeover, mobile review, and finalization confirmations.
- `tests/example.spec.ts` — default Playwright example against `playwright.dev` (not a Talikha feature test).

## Test Structure

**Unit suite organization:**

```typescript
describe("progressIndexOf", () => {
  it("maps review stages to progress 0-1", () => {
    expect(progressIndexOf("review_new")).toBe(0);
  });
});
```

- Group related behavior with `describe`.
- Use one behavior-focused `it` block per assertion group.
- Prefer deterministic pure-function inputs and explicit expected values.
- The current unit suite imports production functions directly from `@/lib/editorial-workflow`, `@/lib/apa-citation`, `@/lib/author-display`, `@/lib/journal-presentation`, `@/lib/publication-preflight-rules`, and `@/lib/submission`.

**Browser suite organization:**
- Use `test.describe` for a feature area.
- Use `test.beforeEach` to navigate to the required local route and wait for stable feature selectors.
- Interact through semantic roles where available, and use stable feature-specific classes for canvas/editor details; see `tests/certificate-convert-to-field.spec.ts`.

## Mocking

**Framework:** No mocking library is configured.

**Current pattern:**
- Most Vitest tests exercise pure workflow logic and schema validation; manuscript tests also exercise generated DOCX/PDF bytes and the browser import adapter with deterministic fixtures.
- Playwright feature tests route protected manuscript API calls to deterministic browser fixtures so the UI, persistence states, conflict behavior, and Certificate regression path can be exercised without mutating production records.
- `src/__tests__/setup.ts` only installs DOM matchers; it does not create fixtures or replace services.

**When adding unit tests:**
- Prefer direct tests for pure modules such as `src/lib/apa-citation.ts`, `src/lib/author-display.ts`, `src/lib/journal-presentation.ts`, `src/lib/citation-format.ts`, `src/lib/publication-preflight-rules.ts`, and `admin-panel/src/components/certificates/field-engine.ts`.
- Mock Supabase/client boundaries only when testing server orchestration; keep Zod schemas and pure transformations real.
- Reset process/environment state and in-memory rate-limit state between tests if those modules become test targets.

## Fixtures and Factories

**Test data:**
- No dedicated fixture or factory directory exists.
- Tests currently construct small values inline.
- Runtime seed data such as `src/data/demo-content.ts`, `src/data/journal-store.json`, and admin seed data in `admin-panel/src/main.tsx` are application data, not test fixtures.

**Location:**
- Add shared test-only fixtures under `src/__tests__/fixtures/` if multiple tests need them.
- Keep feature-specific browser setup close to the relevant `tests/*.spec.ts` file unless it becomes reusable.

## Coverage

**Requirements:** None enforced. No coverage provider or threshold is configured.

**Current coverage posture:**
- Automated coverage is narrow but growing: workflow transition logic, citation formatting, display formatting, preflight rules, and submission schema validation have unit coverage.
- Most public routes, Supabase operations, auth, payment handling, file uploads, and admin workspaces do not have automated tests.
- `playwright-report/` and `.playwright-cli/` are diagnostic/report artifacts, not coverage output.

## Test Types

**Unit tests:**
- Use Vitest for deterministic domain and utility logic. Manuscript coverage spans the shared editor contract, export rendering, import verification, sanitization, paragraph comparison, and large-document conversion in addition to the existing workflow/citation/preflight/submission suites.

**Integration tests:**
- None detected. Supabase queries and Next route handlers are not currently exercised by an automated integration suite.

**E2E tests:**
- Playwright covers the Manuscript and Certificate editors in `tests/manuscript-editor.spec.ts` and `tests/certificate-convert-to-field.spec.ts`.
- Both suites expect the admin Vite app at `http://localhost:5173/admin`; the system Chrome channel can be selected with `PLAYWRIGHT_CHANNEL=chrome` when the bundled Chromium runtime is unavailable.
- There is no configured automated server startup or authenticated production write suite; a real accepted-record walkthrough remains a separate release sign-off step.

## Verification Practices

- `npm run typecheck` currently passes the strict root TypeScript check.
- `npm run test` is the complete Vitest gate, including manuscript import/export and the 100-page fixture.
- `npm run lint` is now functional (the `eslint-plugin-react-hooks` import was resolved on 2026-07-31). Several rules are warnings rather than errors.
- `npm run build` is the production compile gate for both apps: `build:admin` runs Vite, `copy:admin` places the static admin bundle under `public/admin`, and `next build` compiles the public app.
- `npm run readiness` is a deployment/configuration gate implemented by `scripts/check-launch-readiness.mjs`; it validates required environment values, explicit boolean flags, launch approvals, URL/config consistency, and production safety checks. Known bug: it checks `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` instead of the actual runtime variable names (see CONCERNS.md).
- Manual browser verification artifacts may be captured under `.playwright-cli/`, but they do not replace repeatable Playwright tests.

## Common Patterns

**Async testing:**
- Use Playwright's async fixtures and web-first assertions: `await page.goto(...)`, `await page.waitForSelector(...)`, and `await expect(locator).toBeVisible()`.
- For future Vitest async tests, await the production promise directly and assert the resolved value or thrown error; no custom async helper is present.

**Error testing:**
- Current unit tests cover invalid workflow values and terminal/edge states, for example `null`, `undefined`, `""`, unknown progress, and `closed` in `src/__tests__/workflow-transitions.test.ts`.
- Submission schema tests cover missing fields, invalid file kinds, oversized payloads, and edge-case string inputs.
- API error response behavior is not currently automated. New route tests should cover malformed input, unauthorized access, unavailable services, state conflicts, and successful responses using the route's public response contract.

**Recommended next coverage targets:**
- Auth/role gates in `src/lib/auth.ts` and `src/lib/admin-api.ts`.
- Public submission progression through `/submit`, including `src/app/api/submissions/init/route.ts` and `src/app/api/submissions/complete/route.ts`.
- Admin workflow transitions and publication-record gates through the API handlers under `src/app/api/admin/submissions/[id]/`.
- Rate-limit behavior with and without Redis configuration.

---

*Testing analysis: 2026-08-12 (targeted manuscript-editor refresh)*
