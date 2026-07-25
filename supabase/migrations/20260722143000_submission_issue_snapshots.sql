begin;

alter table public.submissions
  add column if not exists assigned_issue_id uuid references public.issues(id) on delete set null,
  add column if not exists journal_title_snapshot text not null default '',
  add column if not exists volume_snapshot text not null default '',
  add column if not exists issue_snapshot text not null default '';

create index if not exists submissions_assigned_issue_index
  on public.submissions (assigned_issue_id);

commit;
