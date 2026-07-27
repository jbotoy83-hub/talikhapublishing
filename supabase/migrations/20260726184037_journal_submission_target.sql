begin;

alter table public.journals
  add column if not exists submission_issue_id uuid references public.issues(id) on delete set null;

create index if not exists journals_submission_issue_id_idx
  on public.journals(submission_issue_id);

comment on column public.journals.submission_issue_id is 'The single issue currently accepting new submissions; independent from the official current_issue_id.';

commit;
