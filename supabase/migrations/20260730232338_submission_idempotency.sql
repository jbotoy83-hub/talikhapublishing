alter table public.submissions
  add column if not exists idempotency_key text;

create unique index if not exists submissions_idempotency_key
  on public.submissions (idempotency_key)
  where idempotency_key is not null;
