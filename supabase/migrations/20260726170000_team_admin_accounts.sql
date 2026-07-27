begin;

alter table public.profiles
  add column if not exists username text,
  add column if not exists access_views text[] not null default '{}',
  add column if not exists requires_account_setup boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists last_signed_in_at timestamptz,
  add column if not exists last_opened_at timestamptz;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

commit;
