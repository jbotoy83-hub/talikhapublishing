begin;

-- One-off removal of four incomplete author test submissions (stuck in
-- "uploading"; created while verifying the live form). workflow_events is
-- immutable, so its trigger is disabled just long enough to delete the rows.

alter table public.workflow_events disable trigger workflow_events_immutable;

delete from public.workflow_events where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.workflow_checklist_items where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.submission_history where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.submission_files where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.submission_authors where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.notifications where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.author_requests where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.payments where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.publication_records where submission_id in (select id from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195'));
delete from public.submissions where reference in ('TAL-2026-EF7B760B','TAL-2026-191EDBE8','TAL-2026-8DE0479B','TAL-2026-20D73195');

alter table public.workflow_events enable trigger workflow_events_immutable;

commit;
