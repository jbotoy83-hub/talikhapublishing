begin;

alter table public.journals
  add column if not exists editorial_metadata jsonb not null default '{}'::jsonb;

alter table public.issues
  add column if not exists editorial_metadata jsonb not null default '{}'::jsonb;

comment on column public.journals.editorial_metadata is 'Journal-management fields that are not part of the public journal contract.';
comment on column public.issues.editorial_metadata is 'Issue-management fields such as SEO, scheduling, article order, and changelog.';

commit;
