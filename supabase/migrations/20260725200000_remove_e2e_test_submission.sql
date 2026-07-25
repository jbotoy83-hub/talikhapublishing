begin;

-- One-off removal of the end-to-end test submission (TAL-2026-07A71D0F).
-- workflow_events is immutable, so its trigger is disabled just long enough to
-- delete the test rows, then re-enabled. On a database without this record the
-- statements simply affect zero rows.

alter table public.workflow_events disable trigger workflow_events_immutable;

delete from public.workflow_events where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.workflow_checklist_items where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.submission_history where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.submission_files where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.submission_authors where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.notifications where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.author_requests where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.payments where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.publication_records where submission_id = '45c7447c-fd5f-4185-a4c4-137f5383f324';
delete from public.submissions where id = '45c7447c-fd5f-4185-a4c4-137f5383f324';

alter table public.workflow_events enable trigger workflow_events_immutable;

commit;
