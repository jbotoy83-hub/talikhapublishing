alter table public.submissions
  add column if not exists priority text not null default 'normal'
  check (priority in ('normal', 'high', 'urgent'));

create index if not exists idx_submissions_priority
  on public.submissions (priority)
  where priority <> 'normal';
