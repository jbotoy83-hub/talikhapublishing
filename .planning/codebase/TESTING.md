# Testing Patterns

**Analysis Date:** 2026-07-27

## Test Framework

**Runner:**
- No test framework is installed. Neither the root `package.json` nor `admin-panel/package.json` includes jest, vitest, playwright, cypress, or any other test runner.

**Assertion Library:**
- None present.

**Run Commands:**
```bash
# No test commands exist. The available verification commands are:
npm run typecheck        # tsc --noEmit (root app)
npm run lint             # eslint .
npm run build            # Builds admin panel + Next.js (catches compile errors)
npm run check            # typecheck + lint + build in sequence
npm run readiness        # scripts/check-launch-readiness.mjs (env/config validation)
```

## Test File Organization

**Location:**
- No test files exist anywhere in the repository.
- Searched patterns: `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**` — zero results.

**Naming:**
- Not applicable.

**Structure:**
- Not applicable.

## Existing Verification (Non-Test)

**Type checking:**
- `npm run typecheck` runs `tsc --noEmit` against `src/**/*.ts` and `src/**/*.tsx`
- Admin panel: `npm run typecheck` runs `tsc -b --pretty false`
- Both use `"strict": true`

**Linting:**
- `npm run lint` runs ESLint 9 with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Config: `eslint.config.mjs`

**Launch readiness script:**
- `scripts/check-launch-readiness.mjs` validates environment variables and configuration booleans
- Checks: required env vars present, boolean flags explicitly set, demo content disabled, indexing enabled, no local admin bypass in production
- This is a deployment gate, not a test suite — it validates config, not behavior

**Browser automation logs (NOT tests):**
- `.playwright-cli/` contains console logs and page snapshots from manual browser automation sessions (dev tools usage)
- These are diagnostic artifacts, not automated test suites
- No `playwright.config.ts` or `playwright.config.js` exists

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist.

**Patterns:**
- Not applicable.

## Mocking

**Framework:** None

**Patterns:**
- Not applicable.

**What to Mock (when tests are added):**
- Supabase clients (`src/lib/supabase/*.ts`) — all factories return `null` when env vars are missing, making them easy to stub
- `src/lib/rate-limit.ts` uses an in-memory Map — reset between tests
- `src/lib/launch.ts` feature flags read from `process.env` — set/unset in test setup

**What NOT to Mock:**
- Zod schemas (`src/lib/submission.ts`) — test them directly with valid/invalid inputs
- Pure utility functions (`src/lib/utils.ts`, `src/lib/apa-citation.ts`, `src/lib/author-display.ts`)

## Fixtures and Factories

**Test Data:**
- Demo content exists at `src/data/demo-content.ts` (used as runtime fallback, not test fixtures)
- Journal store seed data at `src/data/journal-store.json`
- Admin panel has inline seed data in `admin-panel/src/main.tsx` (lines 321-394)

**Location:**
- No dedicated test fixture directory exists.

## Coverage

**Requirements:** None enforced. No coverage tooling configured.

**Current state:** 0% — no automated tests exist.

## Test Types

**Unit Tests:**
- None exist.

**Integration Tests:**
- None exist.

**E2E Tests:**
- None exist. No Playwright/Cypress config present.

## Common Patterns

**Async Testing:**
- Not applicable.

**Error Testing:**
- Not applicable.

## Recommended Starting Points (When Adding Tests)

**Highest-value targets (pure logic, no external deps):**
| Module | Why | File |
|--------|-----|------|
| APA citation builder | Pure function, deterministic output | `src/lib/apa-citation.ts` |
| Author display formatting | Pure function | `src/lib/author-display.ts` |
| Rate limiter | In-memory, testable with fake timers | `src/lib/rate-limit.ts` |
| Zod submission schemas | Validation logic, edge cases matter | `src/lib/submission.ts` |
| Journal presentation helpers | Pure formatting logic | `src/lib/journal-presentation.ts` |
| cn() utility | Trivial but foundational | `src/lib/utils.ts` |

**Medium-value targets (need Supabase mock):**
| Module | Why | File |
|--------|-----|------|
| Content layer fallback logic | Supabase → JSON store fallback | `src/lib/content.ts` |
| Auth helpers | Role checks, bypass logic | `src/lib/auth.ts` |
| Journal lifecycle sync | State machine transitions | `src/lib/journal-lifecycle.ts` |

**API route testing (integration):**
- Routes in `src/app/api/` follow a consistent pattern: feature flag → rate limit → null-guard → zod validation → Supabase query → response
- Testable with Next.js `app-router` test utilities or direct handler invocation with mocked `NextRequest`

**Suggested tooling (not yet installed):**
- Vitest for unit/integration (aligns with Vite in admin panel, fast for Next.js app)
- Playwright for E2E (`.playwright-cli/` suggests familiarity with the tool)
- `@testing-library/react` for component tests if needed

---

*Testing analysis: 2026-07-27*
