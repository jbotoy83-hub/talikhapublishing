create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete set null,
  gmail_thread_id text unique,
  subject text not null,
  participant_name text,
  participant_email text,
  snippet text not null default '',
  source text not null default 'automated' check (source in ('automated', 'admin', 'gmail')),
  starred boolean not null default false,
  unread boolean not null default false,
  needs_attention boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  gmail_message_id text unique,
  gmail_thread_id text,
  gmail_history_id text,
  idempotency_key text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  source text not null check (source in ('automated', 'admin', 'gmail')),
  sender_name text,
  sender_email text not null,
  recipients jsonb not null default '[]'::jsonb,
  subject text not null,
  body_text text not null default '',
  body_html text not null default '',
  status text not null check (status in ('queued', 'sending', 'sent', 'failed', 'unknown', 'received')),
  provider_error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  gmail_message_id text not null,
  provider_attachment_id text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (gmail_message_id, provider_attachment_id)
);

create table public.gmail_sync_state (
  account_email text primary key,
  phase text not null default 'disconnected' check (phase in ('disconnected', 'ready', 'importing', 'watching', 'error', 'oauth_expired')),
  history_id text,
  backfill_page_token text,
  backfill_complete boolean not null default false,
  watch_expiration timestamptz,
  imported_threads integer not null default 0,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_threads_latest_index on public.email_threads (last_message_at desc);
create index email_threads_submission_index on public.email_threads (submission_id, last_message_at desc);
create index email_threads_attention_index on public.email_threads (needs_attention, last_message_at desc);
create index email_messages_thread_index on public.email_messages (thread_id, created_at);
create index email_messages_delivery_index on public.email_messages (status, created_at) where direction = 'outbound';
create index email_messages_submission_index on public.email_messages (submission_id, created_at desc);
create index email_messages_search_index on public.email_messages using gin (
  to_tsvector('english', coalesce(sender_email, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(body_text, ''))
);

create trigger email_threads_updated_at before update on public.email_threads for each row execute function public.set_updated_at();
create trigger email_messages_updated_at before update on public.email_messages for each row execute function public.set_updated_at();
create trigger gmail_sync_state_updated_at before update on public.gmail_sync_state for each row execute function public.set_updated_at();

alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_attachments enable row level security;
alter table public.gmail_sync_state enable row level security;

revoke all on public.email_threads, public.email_messages, public.email_attachments, public.gmail_sync_state from anon, authenticated;
grant select, insert, update, delete on public.email_threads, public.email_messages, public.email_attachments, public.gmail_sync_state to service_role;
