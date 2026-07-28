# Admin Workflow Alignment Plan

## Your Desired Flow (as described)

```
SUBMISSION REVIEW                          PRODUCTION PRODUCTION
─────────────────                          ─────────────────────
Submit → [Locked]                          Accepted arrives here
         │                                 Status: "In progress"
         ▼                                 │
   Admin opens/unlocks                     ▼
   (auto = Start review)             Add manuscript, peer review,
         │                           certificate, etc.
         ▼                                 │
   Status: "In progress"                   ▼
   (reviewing)                       Status: "For approval"
         │                                 │
         ▼                                 ├──→ Schedule for publication
   All good? → Accept                      │         │
         │                                 │         ▼
         ▼                                 │    Date arrives → PUBLISH
   Moves to Production                     │
                                           └──→ Return to revise
                                                     │
                                                     ▼
                                              Back to "Needs action"
                                              (In progress + HIGH PRIORITY)
```

### Rules
- All of this is admin-internal. NO tracking trigger, NO activity log visible to author.
- At "For approval": admin has exactly TWO choices → Schedule OR Revise.
- "Return to revise" = silent, just moves back to production "Needs action" with high priority flag.
- Author tracking only updates at major milestones (accepted, scheduled, published).

---

## Current System (what exists)

### Database stages (12 total)
```
review_new → review_in_progress → review_final → review_accepted
→ production_ready → production_preparation → production_proof → production_records
→ production_ready_to_publish → production_scheduled → published → closed
```

### Admin UI display mapping
| DB Stage | UI Shows |
|----------|----------|
| review_new | "New" |
| review_in_progress | "In progress" |
| review_final | "Review" |
| review_accepted | "Accepted" |
| production_ready | "In progress" |
| production_preparation | "In progress" |
| production_proof | "In progress" |
| production_records | "In progress" |
| production_ready_to_publish | "For approval" |
| production_scheduled | "Scheduled for publishing" |
| published | "Published" |
| closed | "Rejected" |

### Current actions per status (statusActions in main.tsx:2036)
| Status | Actions |
|--------|---------|
| New | Start review, Reject |
| In progress | Send to review, Request revision, Reject |
| Review | Accept & start production, Request revision, Reject |
| Revise | Return to review, Reject |
| Accepted | Ready to publish |
| For approval | Publish |
| Scheduled for publishing | Publish |

### Current tracking triggers
- `transitionSubmission` calls `emitProgressActivity` at progress boundaries → creates author-visible events
- Progress boundaries: 0→1 (review start), 1→2 (production start), 2→3 (ready to publish), 3→4 (published)
- Every transition writes a `workflow_events` row (some internal, some author-visible)

---

## Gap Analysis

### GAP 1: Auto-start review on open
- **You want:** Opening a "New" submission in review auto-transitions to "In progress"
- **Current:** Manual "Start review" button click required
- **Fix:** When admin opens a submission with status "New" in the review panel, fire the transition automatically (review_new → review_in_progress)

### GAP 2: Simplified review path
- **You want:** New → In progress → Accept (2 visible steps)
- **Current:** New → In progress → Review → Accepted (3 visible steps, "Review" is a separate status)
- **Fix:** Remove "Review" (review_final) as a visible intermediate. When admin clicks "Accept" from "In progress", auto-advance through review_final → review_accepted in one action. The DB still steps through internally, but the UI shows a single "Accept" button.

### GAP 3: "For approval" actions wrong
- **You want:** "Schedule for publication" + "Return to revise"
- **Current:** Only "Publish" button
- **Fix:** Replace "Publish" with two actions:
  - "Schedule for publication" → transitions to production_scheduled (opens date picker)
  - "Return to revise" → transitions back to production_records + sets priority flag

### GAP 4: No priority/flag system
- **You want:** Returned items show in "Needs action" with HIGH PRIORITY indicator
- **Current:** No priority field exists on submissions
- **Fix:** Add a `priority` column (or use metadata JSONB) on submissions. Set to "high" when returned for revision. "Needs action" tab sorts high-priority first and shows a visual badge.

### GAP 5: Tracking leaks on admin moves
- **You want:** Admin production moves are SILENT to author tracking
- **Current:** `emitProgressActivity` fires at boundary 2→3 (production → ready to publish), which creates an author-visible "Publication preparation completed" event
- **Fix:** Suppress author-visible progress events for:
  - All internal production transitions (production_ready → preparation → proof → records → ready_to_publish)
  - "Return to revise" transitions
  - Only emit author-visible events at: acceptance (1→2), scheduling, and publishing

### GAP 6: Schedule → Publish flow
- **You want:** For approval → Schedule (pick date) → date arrives → Publish
- **Current:** "For approval" jumps straight to "Publish". The DB enforces scheduled time must arrive, but the UI doesn't expose scheduling as a separate step from "For approval".
- **Fix:** "Schedule for publication" button opens a date picker, saves the date, transitions to production_scheduled. Then "Publish" becomes available only when the date has arrived.

---

## Implementation Plan

### Phase 1: Database (migration)
1. Add `priority` column to `submissions` table (text, default 'normal', check in ('normal','high','urgent'))
2. Update `transition_submission` function: add a `p_silent` boolean parameter. When true, skip author-visible event emission (still writes internal event for audit).
3. Allow transition: `production_ready_to_publish` → `production_records` (already allowed, confirmed in migration)

### Phase 2: Server logic (editorial-workflow-server.ts)
4. Add `silent` option to `transitionSubmission` input schema
5. When `silent: true`, pass `p_visibility: 'internal'` and skip `emitProgressActivity` call
6. Add `setSubmissionPriority(submissionId, priority)` function
7. Modify progress boundary emission: only emit author-visible at boundaries 0→1, 1→2, and for scheduling/publishing. Suppress 2→3 boundary emission (or make it internal-only).

### Phase 3: API routes
8. Update `/api/admin/submissions/[id]/transition` to accept `silent` flag
9. Add `/api/admin/submissions/[id]/priority` endpoint (or include priority in transition call)

### Phase 4: Admin panel UI (main.tsx)
10. **Auto-start review:** When a "New" submission is opened in the review panel, auto-fire transition to review_in_progress (silent, internal only)
11. **Simplify review actions:**
    - "In progress" → show "Accept" button (internally advances through review_final → review_accepted → production_ready in one call using the advance endpoint)
    - Remove "Send to review" as a visible action
12. **For approval actions:** Replace single "Publish" with:
    - "Schedule for publication" (primary) → opens date picker inline → calls transition to production_scheduled + saves date
    - "Return to revise" (danger) → calls transition to production_records + sets priority='high' + silent
13. **Priority badge:** In "Needs action" tab, show a red/amber "HIGH PRIORITY" badge on submissions with priority='high'. Sort them to the top.
14. **Publish gate:** "Publish" button on "Scheduled for publishing" items should be disabled until scheduled_for date has arrived. Show countdown or "Available on {date}" text.

### Phase 5: Tracking isolation
15. Verify `/api/track` only returns events with `visibility = 'author'` (already does — confirmed in route.ts:50-53)
16. Ensure all admin-internal transitions use `visibility: 'internal'`
17. Author tracking should only show:
    - "Under review" (when review starts)
    - "In production" (when accepted/production starts)
    - "Scheduled" (when scheduled)
    - "Published" (when published)
    - Revision requests (if admin explicitly creates one via author_requests)

---

## Summary: What changes where

| Layer | Change | Risk |
|-------|--------|------|
| DB migration | Add priority column, add silent param to transition fn | Low |
| editorial-workflow-server.ts | Silent mode, suppress 2→3 boundary, priority setter | Medium |
| API routes | Accept silent flag, priority endpoint | Low |
| Admin UI (main.tsx) | Auto-start, simplified actions, schedule flow, priority badge | Medium |
| Tracking (no change needed) | Already filters by visibility='author' | None |

---

## What stays the same
- The 12-stage DB enum (no schema change to workflow_stage)
- The publication record editor (already has DOI, files, certificate upload)
- The checklist system (still enforces gates before transitions)
- The payment confirmation gate (still required before scheduling)
- The author_requests system (still available if admin wants to explicitly notify author)
