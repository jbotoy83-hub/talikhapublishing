# Coding Conventions

**Analysis Date:** 2026-07-27

## Naming Patterns

**Files:**
- kebab-case for all source files: `publication-card.tsx`, `rate-limit.ts`, `journal-lifecycle.ts`
- Page routes follow Next.js App Router conventions: `page.tsx`, `layout.tsx`, `route.ts`, `not-found.tsx`
- Route groups use parentheses: `src/app/(public)/`, `src/app/admin/`
- Dynamic segments use brackets: `src/app/api/admin/certificates/[templateId]/route.ts`
- Generated types: `database.generated.ts` (suffix `.generated.ts`)

**Components:**
- PascalCase for React component functions: `PublicationCard`, `HomeFaq`, `FlipWords`
- File name matches the component in kebab-case: `publication-card.tsx` exports `PublicationCard`
- shadcn/ui primitives in `src/components/ui/` keep their lowercase file names: `button.tsx`, `dialog.tsx`

**Functions:**
- camelCase for all functions: `getSupabaseAdmin`, `createServerSupabase`, `allowRequest`
- Data-fetching functions prefixed with `get`: `getJournals`, `getHomePublications`, `getPublicContentCounts`
- Boolean helpers prefixed with `is` or `has`: `isSubmissionsEnabled`, `hasAdminSupabaseConfig`, `isLocalAdminBypassEnabled`
- Mapping helpers prefixed with `map`: `mapStoreJournal`, `mapStoreIssueSummary`

**Variables:**
- camelCase: `journalCards`, `submissionCounts`, `cookieStore`
- Constants in UPPER_SNAKE_CASE at module level: `JOURNAL_STORE_PATH`, `MAX_INIT_BODY_BYTES`, `JOURNAL_CATALOG_KEY`
- Short-lived destructured query results use descriptive names: `submissionCounts`, `recentSubmissions`

**Types:**
- PascalCase with `type` keyword (not `interface`): `type Publication = { ... }`, `type AdminUser = { ... }`
- Exported types live in `src/lib/types.ts` for shared domain models
- Route-local types defined inline at the top of the route file
- Zod-inferred types use `z.infer<typeof schema>`: `type SubmissionFileField = z.infer<typeof submissionFileFieldSchema>`

## Code Style

**Formatting:**
- No Prettier config detected; formatting is consistent but not enforced by tooling
- Double quotes for strings in TypeScript/TSX
- Semicolons used consistently
- 2-space indentation
- Trailing commas in multi-line objects and arrays

**Linting:**
- ESLint 9 flat config: `eslint.config.mjs`
- Extends: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Two react-hooks rules downgraded to `warn` (non-blocking): `set-state-in-effect`, `purity`
- `rules-of-hooks` remains an error
- Global ignores: `.next/`, `dist/`, `node_modules/`, `output/`, legacy JS files, `components/` (root-level)
- Run: `npm run lint`

**TypeScript Strictness:**
- `"strict": true` in both `tsconfig.json` (root) and `admin-panel/tsconfig.app.json`
- `"isolatedModules": true` in both
- `"skipLibCheck": true` in both
- Root allows JS (`"allowJs": true`); admin panel does not (`"allowJs": false`)
- Run: `npm run typecheck` (root), `npm run typecheck` (admin-panel via `tsc -b`)

## Import Organization

**Order (observed pattern):**
1. Node built-ins (`node:fs`, `node:path`, `node:crypto`)
2. Framework imports (`next/server`, `next/image`, `next/link`, `react`)
3. External packages (`@supabase/ssr`, `zod`, `class-variance-authority`)
4. Internal `@/lib/*` modules
5. Internal `@/components/*` modules
6. Relative imports (`./icon`, `../src/lib/apa-citation`)
7. Type-only imports use `import type { ... }` syntax

**Path Aliases:**
- `@/*` maps to `./src/*` in both root and admin-panel tsconfigs
- Admin panel also resolves `@/*` via Vite alias in `admin-panel/vite.config.ts`
- shadcn aliases defined in `components.json`: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`

**Cross-app imports:**
- Admin panel imports shared logic from the Next.js app via relative path: `import { createApa7JournalCitation } from "../../src/lib/apa-citation"` (`admin-panel/src/main.tsx:5`)

## Component Patterns

**shadcn/ui (radix-nova style):**
- Config: `components.json` (root) and `admin-panel/components.json`
- Style: `radix-nova`, icon library: `lucide`
- Root app: `rsc: true`; admin panel: `rsc: false`
- UI primitives in `src/components/ui/` and `admin-panel/src/components/ui/`
- Variants defined with `class-variance-authority` (CVA): see `src/components/ui/button.tsx`
- Class merging via `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- Radix primitives imported from the unified `radix-ui` package: `import { Slot } from "radix-ui"`
- Components use `data-slot` attributes for styling hooks: `data-slot="button"`

**cn() helper:**
```typescript
// src/lib/utils.ts (identical in admin-panel/src/lib/utils.ts)
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Icon system (public site):**
- Central `Icon` component at `src/components/icon.tsx` maps string names to animated icon components
- Individual icons in `src/components/icons/` (one file per icon)
- Usage: `<Icon name="arrow" className="h-4 w-4" />`
- Admin panel imports lucide-react icons directly by name from `@/components/icons` barrel

**Server vs Client components:**
- Server-only modules start with `import "server-only";` (e.g., `src/lib/supabase/server.ts`, `src/lib/auth.ts`, `src/lib/content.ts`)
- Client components start with `"use client";` directive (e.g., `src/lib/supabase/browser.ts`, `admin-panel/src/main.tsx`)
- Pages in `src/app/(public)/` are async Server Components by default

**Page component pattern:**
```typescript
// src/app/(public)/page.tsx
export const revalidate = 300;

export default async function HomePage() {
  const [journals, publications, counts] = await Promise.all([
    getJournals(),
    getHomePublications(),
    getPublicContentCounts(),
  ]);
  return <main id="main-content">...</main>;
}
```

## Styling Approach

**Public site (Tailwind CSS v3):**
- Config: `tailwind.config.js`
- Entry: `src/styles.css` with `@tailwind base/components/utilities` directives
- CSS variables for theme tokens: `--border`, `--primary`, `--background`, etc.
- Custom brand colors: `forest` (green scale), `clay` (terracotta scale), `parchment`, `ink`
- Custom fonts: `--font-inter` (sans), `--font-literata` (serif)
- Custom shadows: `paper`, `lift`
- Plugin: `tailwindcss-animate`
- Large custom CSS in `src/styles.css` (~5145 lines) with BEM-like class names: `.publication-folio-card`, `.journal-section-heading`, `.hero-stats-grid`
- SIZE MAP comment system in `src/styles.css` for locating font-size rules by visible text

**Admin panel (Tailwind CSS v4):**
- No `tailwind.config.js`; uses `@tailwindcss/vite` plugin
- Entry: `admin-panel/src/styles.css` with `@import "tailwindcss"` and `@theme inline` block
- CSS variables mapped via `@theme inline` for shadcn token system
- Custom component CSS in the same file (~10904 lines) with BEM-like naming: `.bank-page`, `.wallet-card`, `.jw-field`
- Dark mode via `@custom-variant dark (&:is(.dark *))`

**When to use what:**
- Use Tailwind utility classes for layout, spacing, responsive behavior
- Use `cn()` for conditional class merging in components
- Use custom CSS classes in `styles.css` for complex, multi-element component styling
- Use CSS variables for theme tokens; reference them via Tailwind color names (`bg-primary`, `text-muted-foreground`)

## Supabase Query Patterns

**Client factories (all in `src/lib/supabase/`):**
| Factory | File | Use case |
|---------|------|----------|
| `createServerSupabase()` | `src/lib/supabase/server.ts` | Authenticated user context (cookies) |
| `getSupabaseAdmin()` | `src/lib/supabase/admin.ts` | Service-role operations (bypasses RLS) |
| `getSupabaseBrowser()` | `src/lib/supabase/browser.ts` | Client-side queries |
| `getPublicSupabase()` | `src/lib/supabase/public.ts` | Anonymous server-side reads |
| `getPublicSupabaseConfig()` | `src/lib/supabase/config.ts` | Shared env-var validation |

**Null-guard pattern (all factories return `null` when env vars missing):**
```typescript
const admin = getSupabaseAdmin();
if (!admin) return NextResponse.json({ connected: false, data: null });
```

**Query structure:**
```typescript
// Parallel queries with Promise.all + destructured results
const [submissionCounts, recentSubmissions, journals] = await Promise.all([
  admin.from("submissions").select("current_stage").in("current_stage", [...]),
  admin.from("submissions").select("id, reference, title").order("created_at", { ascending: false }).limit(10),
  admin.from("journals").select("id, title, slug").eq("status", "published").order("title"),
]);
```

**Column selection:** Always explicit column lists in `.select()`, never `select("*")`

**Relations:** Inline join syntax: `"preferred_journal:journals(title)"`

**Fallback pattern (content layer):**
- Try Supabase admin query first
- On error or null client, fall back to local JSON store (`src/data/journal-store.json`) or demo content
- See `src/lib/content.ts` for the canonical example

**Generated types:**
- `src/types/database.generated.ts` via `npm run db:types` (supabase gen types)

## Validation

**Zod schemas for API input:**
- Schemas defined in `src/lib/submission.ts` (and similar domain modules)
- Use `.safeParse()` — never `.parse()` — in route handlers
- Return the first issue message on failure:
```typescript
const parsed = submissionInitSchema.safeParse(await request.json().catch(() => null));
if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0]?.message || "Please review the submission fields." },
    { status: 400 }
  );
}
```

## Error Handling

**API routes (`src/app/api/**/route.ts`):**
- Wrap entire handler in try/catch
- Return `NextResponse.json({ error: "..." }, { status: N })` on failure
- Common status codes: 400 (validation), 409 (conflict/stale state), 413 (payload too large), 429 (rate limit), 500 (server error), 503 (not configured)
- Catch blocks return a safe fallback, never leak internal errors:
```typescript
} catch {
  return NextResponse.json({ connected: false, data: null });
}
```

**Server components / lib functions:**
- Silent fallback with empty catch and comment:
```typescript
} catch {
  /* store missing or unreadable on this request — use the built-in default */
}
```
- React `cache()` wraps data-fetching functions for request deduplication: `export const getJournalIssues = cache(async (...) => { ... })`

**Client-side (admin panel):**
- `.catch((e) => { console.error("[journal-store] publish error", e); return false; })`
- Prefixed console.error with bracketed module name: `[journal-store]`

## API Route Conventions

**File location:** `src/app/api/{domain}/{action}/route.ts`

**Structure:**
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // 1. Feature flag check
  // 2. Rate limit check
  // 3. Client null-guard
  // 4. Body size check
  // 5. Zod validation
  // 6. Business logic + Supabase queries
  // 7. Return NextResponse.json({ ... })
}
```

**Rate limiting:** In-memory token bucket via `src/lib/rate-limit.ts` (`allowRequest(key, limit, windowMs)`)

**Security middleware (in `next.config.ts`):**
- CSP headers, X-Frame-Options DENY, HSTS, nosniff, Permissions-Policy
- `poweredByHeader: false`

## Logging

**Framework:** console (no structured logging library)

**Patterns:**
- `console.error("[module-name] description", error)` for failures
- No info/debug logging in production paths
- Dev server logs written to `dev-server.log` / `dev-server-error.log` (gitignored)

## Comments

**When to comment:**
- Explain WHY, not WHAT: `// Read-only Server Component context; the proxy keeps the session cookie fresh.`
- Mark intentional fallbacks: `/* store missing or unreadable on this request — use the built-in default */`
- ESLint rule suppressions include justification (see `eslint.config.mjs` lines 9-12)
- SIZE MAP comments in `src/styles.css` for locating font sizes by visible text

**JSDoc/TSDoc:**
- Rare; used only for exported helpers with non-obvious behavior (e.g., `isLocalAdminBypassEnabled` in `src/lib/auth.ts`)

## Function Design

**Size:** Functions range from 5-30 lines for utilities; page components and admin views can be 100+ lines (accepted pattern in this codebase)

**Parameters:** Destructured object params for components; positional params for utilities (max 3-4)

**Return Values:**
- Data functions return `T | null` (never throw)
- API routes return `NextResponse.json(...)`
- Components return JSX

## Module Design

**Exports:** Named exports preferred; default export only for page/layout/route files (Next.js requirement)

**Barrel files:** Not used except `admin-panel/src/components/icons` (re-exports lucide icons)

**Server-only enforcement:** Any module that touches `process.env` secrets, cookies, or service-role keys starts with `import "server-only";`

---

*Convention analysis: 2026-07-27*
