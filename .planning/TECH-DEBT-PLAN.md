# Tech Debt Remediation Plan

**Created:** 2026-07-28
**Scope:** Items 6–11 from the concerns audit

---

## Phase A: Admin Panel Decomposition (Item 6)

The file is 7,196 lines. Two views are already extracted (Certificates, Inbox) — follow their pattern.

### Target structure

```
admin-panel/src/
├── main.tsx                    ← shell only: App + routing + data loading (~600 lines)
├── types.ts                    ← all shared types (EditorialSubmission, PublicationRecord, etc.)
├── data/
│   └── seed.ts                 ← seed/demo data (or delete entirely if API covers it)
├── lib/
│   ├── utils.ts                ← existing cn() helper
│   ├── journal-catalog.ts      ← JOURNAL_CATALOG singleton + all jw* helpers
│   ├── date.ts                 ← workspaceDate, workspaceDisplayDate, jwFmtDate, formatTime
│   ├── receipt-pdf.ts          ← downloadReceiptPdf
│   └── authors.ts              ← authorsFor, buildUnifiedAuthors, authorsCsvHref, authorPhotoUrlForIndex
├── components/
│   ├── ui/                     ← existing 14 shadcn primitives (untouched)
│   ├── icons/                  ← existing (untouched)
│   ├── shared/
│   │   ├── avatar.tsx
│   │   ├── page-heading.tsx
│   │   ├── metric.tsx
│   │   ├── setting-row.tsx
│   │   ├── review-field.tsx
│   │   ├── search-palette.tsx
│   │   ├── workspace-skeleton.tsx
│   │   └── task-editor.tsx
│   ├── overview/
│   │   └── overview-dashboard.tsx      (617 lines)
│   ├── submissions/
│   │   ├── submission-workspace.tsx    (list + filter)
│   │   ├── submission-review.tsx       (744 lines, the big one)
│   │   ├── publication-record-editor.tsx
│   │   ├── publication-schedule-panel.tsx
│   │   ├── publication-materials.tsx
│   │   ├── manuscript-viewer.tsx
│   │   ├── payment-proof-viewer.tsx
│   │   └── receipt-preview.tsx
│   ├── production/
│   │   ├── production-workspace.tsx
│   │   └── production-view-tabs.tsx
│   ├── journals/
│   │   └── journals-view.tsx           (737 lines)
│   ├── schedule/
│   │   └── schedule-view.tsx           (FunctionalScheduleView)
│   ├── authors/
│   │   ├── authors-view.tsx
│   │   └── author-detail-panel.tsx
│   ├── studies/
│   │   └── studies-view.tsx
│   ├── announcements/
│   │   ├── announcement-workspace.tsx
│   │   └── announcement-controls.tsx   (AnxCard, AnxField, AnxSegmented, AnxSwitch, AnxSelect)
│   ├── settings/
│   │   └── settings-view.tsx
│   ├── reports/
│   │   └── reports-view.tsx
│   ├── activity/
│   │   └── activity-log-view.tsx
│   ├── bank/
│   │   └── bank-view.tsx
│   ├── featured/
│   │   └── featured-view.tsx
│   ├── media/
│   │   └── media-workspace.tsx
│   ├── support/
│   │   └── support-view.tsx
│   ├── sidebar/
│   │   └── admin-sidebar.tsx
│   ├── certificates/           ← existing (untouched)
│   ├── inbox/                  ← existing (untouched)
│   ├── floating-dock.tsx       ← existing (untouched)
│   └── team-accounts.tsx       ← existing (untouched)
```

### Execution order (by risk, lowest first)

| Wave | What | Lines moved | Risk |
|------|------|-------------|------|
| 1 | `types.ts` + `lib/` helpers + `data/seed.ts` | ~500 | None (pure extracts, no JSX) |
| 2 | `shared/` components (Avatar, PageHeading, Metric, etc.) | ~300 | Low |
| 3 | Small views: Bank, Featured, Reports, Support, Media, Activity, Settings | ~900 | Low |
| 4 | Medium views: Authors, Studies, Announcements, Schedule | ~800 | Low |
| 5 | Sidebar + SearchPalette + Skeleton | ~400 | Low |
| 6 | Production workspace + tabs | ~200 | Medium (cross-references submissions) |
| 7 | JournalsView + journal-catalog lib | ~900 | Medium (module singleton) |
| 8 | Submissions cluster (review, pub record, materials, viewers) | ~1,500 | High (most complex, most cross-refs) |
| 9 | OverviewDashboard | ~620 | Medium (touches many data sources) |
| 10 | App shell cleanup (remove dead code, final wiring) | net -500 | Medium |

### Dead code to delete during extraction
- `ScheduleView` (3622–3808) — replaced by FunctionalScheduleView
- `ProductionWorkspace` (1703–1706) — replaced by V2
- `publicationCitation` (2981–2993) — unreachable code after first return
- `initialEditorialSubmissions` (318–391) — API now provides data
- `bankTransactions` (402–443) — prototype data
- `studyRecords` (667–746) — prototype data (verify search palette still works)

### Verification gate after each wave
```bash
cd admin-panel && npm run typecheck && npm run build
```

---

## Phase B: Workspace Endpoint Pagination (Item 7)

### Current problem
`/api/admin/workspace` loads ALL submissions, publication records, journals, issues, authors, certificates, and media in one request. No `.limit()`.

### Plan

1. **Split into per-view endpoints** (the admin panel already has discrete views):
   - `/api/admin/workspace/overview` — counts + recent 5 only
   - `/api/admin/workspace/submissions?page=&limit=&status=` — paginated
   - `/api/admin/workspace/production?page=&limit=` — paginated
   - `/api/admin/workspace/journals` — small dataset, keep as-is
   - `/api/admin/workspace/authors?page=&limit=` — paginated
   - `/api/admin/workspace/certificates` — small dataset, keep as-is
   - `/api/admin/workspace/media?page=&limit=` — paginated

2. **Keep the unified endpoint as a lightweight bootstrap** that returns only:
   - User info + role
   - Counts per view (for sidebar badges)
   - Journals + issues (small, needed globally)

3. **Admin panel changes:**
   - Each view fetches its own data on mount (lazy loading)
   - Add a simple `useWorkspaceView(endpoint)` hook with loading/error states
   - Infinite scroll or "Load more" for submissions/production lists

4. **Database:** Add composite indexes for common filter patterns:
   - `submissions(current_stage, created_at DESC)`
   - `submission_files(submission_id, file_kind)`

### Migration needed
```sql
create index if not exists idx_submissions_stage_created
  on public.submissions (current_stage, created_at desc);
```

---

## Phase C: Test Suite (Item 8)

### Strategy: Start narrow, expand outward

**Tooling:**
- Root app: Vitest + @testing-library/react (already has Next.js, Vitest integrates cleanly)
- Admin panel: Vitest (already has Vite, zero config needed)
- API integration: Vitest + supabase-js local client (or msw for mocking)

### Priority order

| Priority | What | Why |
|----------|------|-----|
| 1 | Auth guard tests | Verify `/api/admin/dashboard` rejects unauthenticated (after we fix it) |
| 2 | Workflow transition tests | Verify allowed/blocked transitions match the DB function |
| 3 | Tracking endpoint tests | Verify author only sees `visibility='author'` events |
| 4 | Payment flow tests | Verify confirmation gates |
| 5 | Admin panel component smoke tests | Verify each extracted view renders without crash |

### File structure
```
src/__tests__/
├── auth.test.ts
├── workflow-transitions.test.ts
├── tracking.test.ts
└── payment.test.ts

admin-panel/src/__tests__/
├── setup.ts
├── overview.test.tsx
├── submissions.test.tsx
└── production.test.tsx
```

### package.json additions (root)
```json
"devDependencies": {
  "vitest": "^3.x",
  "@vitejs/plugin-react": "^4.x",
  "@testing-library/react": "^16.x",
  "@testing-library/jest-dom": "^6.x"
}
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## Phase D: Pin Dependencies (Item 9)

### Current `"latest"` pins in `admin-panel/package.json`:
- `@vitejs/plugin-react`
- `lucide-react`
- `typescript`
- `vite`

### Fix
```bash
cd admin-panel
npm ls @vitejs/plugin-react lucide-react typescript vite
# Note installed versions, then pin:
```

Replace with caret ranges based on currently installed versions:
```json
"@vitejs/plugin-react": "^4.5.0",
"lucide-react": "^0.525.0",
"typescript": "^5.8.0",
"vite": "^7.0.0"
```

Then commit the updated `package-lock.json`.

**Risk:** None. This is a one-line-per-dep change.

---

## Phase E: Deduplicate Icons (Item 10)

### Current state
- Root: 75 icon files in `src/components/icons/`
- Admin: 62 icon files in `admin-panel/src/components/icons/` (subset of root)
- Both apps import from their own copy via `@/components/icons`

### Options

| Option | Effort | Risk |
|--------|--------|------|
| A: Shared package (`packages/icons`) | High (monorepo tooling) | Low |
| B: Admin imports from root via relative path | Low | Medium (Vite alias config) |
| C: Delete admin copy, add Vite alias `@/components/icons` → `../../src/components/icons` | Low | Low |

**Recommended: Option C.**

```ts
// admin-panel/vite.config.ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@/components/icons": path.resolve(__dirname, "../src/components/icons"),
  }
}
```

Then delete `admin-panel/src/components/icons/` (62 files gone).

**Verification:** `cd admin-panel && npm run typecheck && npm run build`

---

## Phase F: Audit PDF Libraries (Item 11)

### Current state
| Library | Root | Admin | Used? |
|---------|------|-------|-------|
| `jspdf` | No | Yes | Yes (receipts, certificates) |
| `pdfjs-dist` | Yes | Yes | Yes (certificate canvas preview) |
| `html2canvas` | No | Yes | Yes (certificate export) |
| `mammoth` | Yes | Yes | Yes (DOCX preview) |
| `@react-pdf/renderer` | Yes | No | **Check usage** |
| `pdf-lib` | Yes | No | **Check usage** |
| `@embedpdf/*` (13 pkgs) | Yes | No | **Check usage** |

### Action
1. Grep root `src/` for imports of `@react-pdf/renderer`, `pdf-lib`, `@embedpdf`
2. If unused → remove from root `package.json`
3. If used only in receipt-pdf.ts → keep only what's needed
4. `pdfjs-dist` is declared in both packages but admin dynamically imports it — verify the root copy is actually needed or if admin's own copy suffices

### Expected savings
If `@react-pdf/renderer` + `pdf-lib` + `@embedpdf/*` are unused: ~2MB removed from node_modules, faster installs, smaller lockfile.

---

## Sequencing

| Order | Phase | Effort | Dependency |
|-------|-------|--------|------------|
| 1 | D: Pin deps | 10 min | None |
| 2 | E: Deduplicate icons | 20 min | None |
| 3 | F: Audit PDF libs | 30 min | None |
| 4 | C: Test suite setup + auth/workflow tests | 2–3 hrs | None |
| 5 | A: Admin decomposition (waves 1–10) | 4–6 hrs | D done (stable builds) |
| 6 | B: Workspace pagination | 2–3 hrs | A wave 10 done (views fetch own data) |

Phases D, E, F are independent quick wins. Phase C can run in parallel with A. Phase B depends on A being complete (views need to be separate modules to lazy-load their own data).

---

## Success Criteria

- [ ] `admin-panel/src/main.tsx` is under 700 lines (shell + routing only)
- [ ] No `"latest"` pins in any package.json
- [ ] Admin panel has zero icon files of its own
- [ ] Unused PDF libraries removed from root
- [ ] `npm run test` passes with ≥10 meaningful test cases
- [ ] Workspace bootstrap payload is under 50KB (currently unbounded)
- [ ] Each admin view loads its own data lazily
- [ ] `npm run check` passes after every phase
