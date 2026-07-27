create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  presentation text not null default 'banner' check (presentation in ('banner', 'popup', 'both')),
  category text not null default 'Announcement',
  message text not null default '' check (char_length(message) <= 240),
  action_label text not null default '',
  action_href text not null default '',
  target text not null default 'all' check (target in ('all', 'home', 'journals', 'submit')),
  display_trigger text not null default 'load' check (display_trigger in ('load', 'scroll')),
  delay_seconds integer not null default 0 check (delay_seconds >= 0),
  dismissible boolean not null default true,
  frequency text not null default 'visit' check (frequency in ('visit', 'session')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

create policy announcements_public_read
  on public.announcements
  for select
  to anon, authenticated
  using (true);

alter table public.submissions
  add column if not exists review_settings jsonb not null default '{}'::jsonb;

alter table public.publications
  add column if not exists featured boolean not null default false;

create index if not exists publications_featured_index
  on public.publications (featured)
  where featured = true;
