-- Add view/download counters to publications and a service_role-only atomic increment function.
-- Idempotent: safe to re-run (if not exists / create or replace).

alter table public.publications
  add column if not exists views integer not null default 0,
  add column if not exists downloads integer not null default 0;

create or replace function public.increment_publication_metric(p_publication_id uuid, p_field text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.publications
  set
    views = case when p_field = 'views' then views + 1 else views end,
    downloads = case when p_field = 'downloads' then downloads + 1 else downloads end
  where id = p_publication_id;
$$;

revoke execute on function public.increment_publication_metric(uuid, text) from public, anon, authenticated;
grant execute on function public.increment_publication_metric(uuid, text) to service_role;
