begin;

-- New submissions must receive a tracking number at insert time. Existing
-- records were backfilled by the core migration, but the database default is
-- also required for future website and admin submissions.
alter table public.submissions
  alter column tracking_number set default concat(
    'TAL-',
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

commit;
