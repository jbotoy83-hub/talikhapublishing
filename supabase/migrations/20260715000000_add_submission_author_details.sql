alter table public.submissions
  add column if not exists author_details jsonb not null default '[]'::jsonb;
