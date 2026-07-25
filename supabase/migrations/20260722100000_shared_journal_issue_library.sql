begin;

alter table public.journals
  add column if not exists current_issue_id uuid references public.issues(id) on delete set null;

create index if not exists journals_current_issue_index on public.journals (current_issue_id) where current_issue_id is not null;

commit;
