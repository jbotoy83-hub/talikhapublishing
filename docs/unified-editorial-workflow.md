# Unified editorial workflow

## Decision

The production admin is part of the existing Next.js application. It shares the
same authentication, server-side authorization, Supabase clients, and deployment
as the public publishing site. The Vite panel remains a fast UI prototype only;
it must not become a second data source or hold privileged credentials.

One row in `submissions` is the source record from intake through publication.
Acceptance changes its `current_stage`; it never creates a copied submission.
`publication_records` is a one-to-one production extension of that row.

## Workflow stages

| Stage | Workspace | Purpose | Primary action |
| --- | --- | --- | --- |
| `review_new` | Submission Review | New intake awaiting an editor | Start review |
| `review_in_progress` | Submission Review | Editorial screening and follow-up | Send to final review |
| `review_final` | Submission Review | Decision-ready review | Accept to production |
| `review_accepted` | Submission Review | Accepted and awaiting handoff | Open production record |
| `production_ready` | Publication Production | Accepted study enters production | Start preparation |
| `production_preparation` | Publication Production | Edit manuscript and collect production material | Send author proof |
| `production_proof` | Publication Production | Author proof and response cycle | Record proof decision |
| `production_records` | Publication Production | Complete DOI, citation, issue, certificate, and final files | Prepare for publishing |
| `production_ready_to_publish` | Publication Production | Editorially complete but not yet scheduled | Schedule publication |
| `production_scheduled` | Schedule | Explicitly approved publication date/time | Publish when due |
| `published` | Publication Production | Public record and final files are available | Close record |
| `closed` | Closed | Final, withdrawn, declined, or archived record | No further transition |

The `production_scheduled` stage is deliberately separate from `published`.
Scheduling requires a future timestamp, payment confirmation, a final PDF,
publication metadata, and the final checklist. Scheduling does not publish the
article. At or after the scheduled time, an authorized editor must make the
separate final publication action, which repeats validation and creates the
final event.

## Admin routes

| Route | Role | Contents |
| --- | --- | --- |
| `/admin/submissions` | Editor/admin | Review tabs: New, In Progress, Final Review, Accepted, Closed |
| `/admin/submissions/[id]` | Editor/admin | Header, stage action, overview, files, tasks, payment, publication, activity, notes, and timeline |
| `/admin/production` | Editor/admin | Production tabs: Ready, Preparation, Author Proof, Records, Ready to Publish, Published |
| `/admin/schedule` | Editor/admin | Scheduled records grouped by publication date and issue |
| `/track` | Author/public lookup | Tracking/receipt number plus matching author email; no receipt-only lookup |

## Record and file model

- `submissions.current_stage` is the only active-stage value.
- `workflow_events` is append-only. It records all transitions, payment
  confirmation, author requests, schedule decisions, publication, and related
  metadata.
- `workflow_checklist_items` holds stage gates. A stage cannot be left while
  its required items are incomplete.
- `submission_files` retains original files and adds production manuscript,
  proof, final PDF, receipt, and certificate types.
- `payments` creates a `receipts` record automatically when a payment becomes
  confirmed. `payment_line_items` keeps the processing fee, tax, and discount
  breakdown that the receipt snapshots. A receipt PDF is then stored in the
  private `receipts` bucket.
- `publication_records` contains the scheduled time, issue/journal, DOI,
  citation metadata, public URL, final PDF, and publication certificate.
- `notifications` is an outbox. Database state is recorded even when an email
  provider has not yet been configured.

## Timeline and author experience

Editors see every event, including internal notes and checklist activity.
Authors see only events marked `author` plus their requests, receipts, proofs,
and published documents. An open author request can be answered Yes or No from
the tracking page; the server rechecks the tracking/receipt number and matching
author email, records the response, and creates an author-visible event in the
same database transaction. The tracking page returns only safe public details
after both the tracking or receipt number and matching author email are given.

The author progress header has five stable steps:

1. Submitted
2. Editorial Review
3. Publication Production
4. Ready to Publish
5. Published

The detailed vertical timeline below it uses the append-only event stream. It
shows completed milestones, the current stage, upcoming milestones,
action-required items, event actor, date/time, and related files.

## Security model

- Browser clients never update `current_stage`.
- A server-only `transitionSubmission` action calls one database transition
  function, which locks the submission, validates the allowed transition,
  checklists, files, payment state, publication data, and schedule, then writes
  the new stage and event in the same transaction.
- `workflow_events` rejects updates and deletes in the database.
- All workflow tables use RLS. Editors and admins receive controlled access;
  authenticated authors can read only records tied to their user ID and
  author-visible events.
- Submission files, proofs, receipts, and certificates remain in private
  buckets. Authorized server routes generate short-lived signed links.
- The public tracking route is server-controlled and rate-limited. It never
  grants a broad database select policy to anonymous users.

## Payment and receipt policy

Before payment confirmation, an editor can revise the quote: the standard
processing-fee choices are Literature (PHP 500), Research (PHP 2,500), Extended
(PHP 3,000), and Premium (PHP 5,000), with an approved custom fee when needed.
Tax, a PHP 150 or PHP 350 promotion, and a custom discount are separate lines,
so the total is always explainable.

Confirmation is a server-only action. It requires a reference number and a
positive breakdown, writes the confirmed payment, creates the receipt snapshot,
renders a PDF, and stores that PDF privately. A confirmed receipt is not edited
silently. If a name or payment detail needs correcting afterwards, the intended
next addition is a documented receipt-revision record that references the
original; this preserves a credible financial trail.

## Delivery sequence

1. Apply and verify the workflow migration on the intended Talikha Supabase
   project - not the unrelated preview project.
2. Add the server transition service and protected signed-download routes.
3. Build the review, production, detail, and schedule views in the existing
   Next.js admin shell.
4. Add the author tracking view and author-visible activity feed.
5. Connect production PDF/certificate rendering and the email provider to the
   outbox.
6. Configure a scheduled server job for due records, then test the complete
   review-to-schedule-to-publish flow with representative data.
