# Coding Conventions

**Analysis Date:** 2026-07-30

## Naming Patterns

**Files:**
- Use lowercase kebab-case for new application files, for example `src/lib/editorial-workflow.ts` and `src/app/api/submissions/init/route.ts`.
- Keep Next.js route segment conventions such as `page.tsx`, `layout.tsx`, `route.ts`, and bracketed dynamic folders such as `src/app/api/admin/submissions/[id]/`.
- Admin feature files follow the same lowercase style, with feature folders such as `admin-panel/src/components/certificates/` and `admin-panel/src/components/inbox/`.

**Functions:**
- Use camelCase for functions and handlers: `getAdminUser`, `synchronizeJournalLifecycles`, and `validateCertificate`.
- Use PascalCase for React components: `CertificateWorkspace`, `InboxWorkspace`, and `SubmissionWorkspace`.
- Short pure helpers may be arrow functions, especially in admin utility modules such as `admin-panel/src/lib/date.ts` and `admin-panel/src/lib/journal-catalog.ts`.

**Variables:**
- Use camelCase for local variables and object properties.
- Use descriptive constants in `UPPER_SNAKE_CASE` for limits, storage keys, and static configuration, for example `MAX_INIT_BODY_BYTES` in `src/app/api/submissions/init/route.ts`.

**Types:**
- Use PascalCase for `type`, `interface`, and inferred public type names.
- Prefer string unions for finite workflow and UI states, as in `src/lib/editorial-workflow.ts` and `admin-panel/src/components/certificates/types.ts`.
- Use `type` imports for type-only dependencies where practical.

## Code Style

**Formatting:**
- No Prettier or Biome configuration is present. Preserve the local file style when editing.
- Root application files commonly use semicolons and double quotes; generated/admin UI files contain both semicolon-terminated and semicolon-free styles, so do not reformat unrelated code.
- TypeScript is strict in the root app (`tsconfig.json`) and the admin app (`admin-panel/tsconfig.app.json`).

**Linting:**
- Root linting is configured in `eslint.config.mjs` with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- `react-hooks/set-state-in-effect` and `react-hooks/purity` are warnings; `react-hooks/rules-of-hooks` remains enforced by the Next configuration.
- Generated output, `node_modules`, selected legacy files, and `components/**` are ignored by `eslint.config.mjs`.
- Keep lint scope in mind: the root `npm run lint` command scans the repository, while admin correctness is separately covered by TypeScript/Vite build checks.

## Import Organization

**Order:**
1. External packages and framework imports.
2. Root aliases such as `@/lib/...`, `@/components/...`, and `@/types/...`.
3. Relative feature imports such as `./types` and `../ui/...`.
4. CSS imports and type-only imports follow the surrounding file's established style.

There is no import-order plugin or formatter enforcing this order. Match the nearby module rather than performing broad import reordering.

**Path Aliases:**
- Root app: `@/*` maps to `src/*` through `tsconfig.json`.
- Admin app: `@/*` maps to `admin-panel/src/*` through `admin-panel/tsconfig.app.json` and `admin-panel/vite.config.ts`.

## Validation and Data Boundaries

- Define reusable Zod schemas in `src/lib/` and validate external input at the boundary. `src/lib/submission.ts` contains shared submission/file schemas.
- Use `safeParse` when an API should return a controlled field-level error, as in `src/app/api/submissions/init/route.ts` and `src/app/api/submissions/complete/route.ts`.
- Use `.parse` inside trusted server workflow functions when invalid input should enter the route's error path, as in `src/lib/editorial-workflow-server.ts`.
- Treat Supabase clients as nullable. Call `getSupabaseAdmin()` or the appropriate factory and return a clear unavailable/configuration response when it is absent.
- Keep server-only modules explicit with `import "server-only"` when they access secrets, cookies, or service-role clients; see `src/lib/auth.ts`, `src/lib/turnstile.ts`, and `src/lib/certificate-import.ts`.

## Error Handling

**API routes:**
- Return early from route handlers with `NextResponse.json({ error: ... }, { status: ... })` for feature flags, authentication, rate limits, malformed input, missing records, and service failures.
- Use status codes consistently: `400` for invalid input, `401`/`403` for access failures, `404` for missing records, `409` for state conflicts, `413` for oversized bodies, `429` for rate limits, `500` for internal failures, and `503` when a required service is unavailable.
- Shared admin routes use `requireEditorApi`, `readJsonBody`, `isApiError`, and `apiErrorResponse` from `src/lib/admin-api.ts`; follow that pattern for new workflow mutations.

**Server/domain logic:**
- Throw user-readable `Error` instances from workflow/domain functions when a transaction cannot proceed; `src/lib/editorial-workflow-server.ts` is the main example.
- Preserve already-completed state when a secondary operation fails, and make the error explain the partial outcome when necessary.

**Client code:**
- Check `response.ok`, parse JSON defensively, and expose a concise user-facing message; log unexpected failures with a scoped prefix where useful, as in `admin-panel/src/lib/journal-catalog.ts` and `admin-panel/src/main.tsx`.
- For localStorage-backed admin helpers, catch malformed JSON/storage failures and retain server state as authoritative; see `admin-panel/src/lib/journal-catalog.ts` and `admin-panel/src/components/inbox/mock-data.ts`.

## Logging

**Framework:** `console` only. No external error-tracking or structured logging package is configured.

**Patterns:**
- Use `console.error` for failures that need diagnosis, preferably with a scoped prefix such as `[journal-store]` or `[content]`.
- Do not log secrets, payment details, raw tokens, or private file contents.
- User-facing API errors should be returned through the response contract; console logging is supplementary diagnostics, not the user notification mechanism.

## Comments

**When to Comment:**
- Comment only non-obvious security, compatibility, or architectural decisions. Examples include the server-only/local-admin explanation in `src/lib/auth.ts` and the unified read-model explanation in `src/app/api/admin/workspace/route.ts`.
- Avoid comments that restate a function name or obvious control flow. Do not add broad documentation blocks to routine code.

**JSDoc/TSDoc:**
- JSDoc is occasional and explanatory rather than systematic. There is no required API documentation format.

## Function Design

**Size:**
- Keep pure helpers small and deterministic, as in `src/lib/apa-citation.ts` and `admin-panel/src/components/certificates/field-engine.ts`.
- Route handlers may coordinate several boundary checks and persistence steps. Large React views remain in the admin monolith `admin-panel/src/main.tsx`; extract new reusable behavior to feature modules when adding code.

**Parameters:**
- Use typed object props for React components and positional parameters for small pure helpers.
- Use explicit request/route parameter types in Next route handlers, including `Promise<{ id: string }>` for dynamic segments.

**Return Values:**
- Pure utilities return typed values and use `null` for an expected absence, as in `src/lib/apa-citation.ts` and `src/lib/certificate-security.ts`.
- Server data helpers commonly return nullable results or throw a user-readable error, depending on whether absence is expected.
- API handlers always return a `Response`, normally through `NextResponse.json`.

## Module Design

**Exports:**
- Prefer named exports for shared functions, schemas, types, and React components.
- Use default exports where Next.js requires them, such as pages and metadata functions in `src/app/`.

**Barrel Files:**
- Keep barrel usage limited. `admin-panel/src/components/icons/index.tsx` is the main intentional re-export surface.

**State and persistence:**
- Public/server workflows use Supabase through `src/lib/` clients and server route handlers.
- The admin UI consumes the unified workspace endpoint at `src/app/api/admin/workspace/route.ts`; localStorage remains a fallback/UX store for selected admin surfaces such as journals and Inbox mock data.
- Keep workflow transitions centralized in `src/lib/editorial-workflow.ts` and `src/lib/editorial-workflow-server.ts` rather than duplicating state rules in components.

---

*Convention analysis: 2026-07-30*
