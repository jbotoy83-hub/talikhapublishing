create index if not exists submission_files_created_by_idx
  on public.submission_files(created_by) where created_by is not null;
create index if not exists publication_preflight_runs_created_by_idx
  on public.publication_preflight_runs(created_by) where created_by is not null;
create index if not exists publication_preflight_runs_submitted_by_idx
  on public.publication_preflight_runs(submitted_by) where submitted_by is not null;
create index if not exists publication_preflight_checks_confirmed_by_idx
  on public.publication_preflight_checks(confirmed_by) where confirmed_by is not null;
create index if not exists publication_records_social_media_file_idx
  on public.publication_records(social_media_file_id) where social_media_file_id is not null;
create index if not exists publication_records_latest_preflight_idx
  on public.publication_records(latest_preflight_run_id) where latest_preflight_run_id is not null;
create index if not exists publication_records_submitted_preflight_idx
  on public.publication_records(submitted_preflight_run_id) where submitted_preflight_run_id is not null;
create index if not exists publication_records_approved_preflight_idx
  on public.publication_records(approved_preflight_run_id) where approved_preflight_run_id is not null;
