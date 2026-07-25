begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.journals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  scope text not null default '',
  issn text,
  hero_image_url text,
  accent text not null default 'emerald',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  slug text not null,
  title text,
  volume text not null,
  issue_number text not null,
  publication_date date,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, slug),
  unique (journal_id, volume, issue_number)
);

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  bio text not null default '',
  affiliation text,
  credentials text,
  orcid text,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  legacy_url text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id),
  issue_id uuid references public.issues(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legacy_url text unique,
  title text not null,
  abstract text not null default '',
  keywords text[] not null default '{}',
  author_display text not null default '',
  publication_date date,
  volume text,
  issue_number text,
  pages text,
  doi text unique,
  pdf_url text,
  recommended_citation text not null default '',
  license_name text not null default 'All rights reserved',
  license_url text,
  copyright_holder text not null default 'The authors',
  featured boolean not null default false,
  content_type text not null default 'research' check (content_type in ('research', 'creative', 'commentary')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.publication_authors (
  publication_id uuid not null references public.publications(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete restrict,
  position integer not null check (position > 0),
  corresponding boolean not null default false,
  primary key (publication_id, author_id),
  unique (publication_id, position)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  title text not null,
  publication_type text not null,
  preferred_journal_id uuid references public.journals(id) on delete set null,
  abstract text not null,
  author_name text not null,
  author_email text not null,
  affiliation text,
  phone text,
  author_notes text,
  status text not null default 'uploading' check (status in ('uploading', 'upload_failed', 'submitted', 'screening', 'under_review', 'revision_requested', 'accepted', 'declined', 'withdrawn', 'archived')),
  consent_at timestamptz not null,
  source_ip_hash text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_kind text not null check (file_kind in ('manuscript', 'authorPhoto', 'paymentProof', 'revision', 'contract', 'other')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  created_at timestamptz not null default now()
);

create table public.submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index publications_public_index on public.publications (status, publication_date desc);
create index publications_journal_index on public.publications (journal_id, status, publication_date desc);
create index publications_search_index on public.publications using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, '') || ' ' || coalesce(author_display, '')));
create index authors_name_index on public.authors (lower(name));
create index submissions_status_index on public.submissions (status, created_at desc);
create index submission_files_submission_index on public.submission_files (submission_id);
create index submission_history_submission_index on public.submission_history (submission_id, created_at desc);
create index audit_events_entity_index on public.audit_events (entity_type, entity_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger journals_updated_at before update on public.journals for each row execute function public.set_updated_at();
create trigger issues_updated_at before update on public.issues for each row execute function public.set_updated_at();
create trigger authors_updated_at before update on public.authors for each row execute function public.set_updated_at();
create trigger publications_updated_at before update on public.publications for each row execute function public.set_updated_at();
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger newsletter_updated_at before update on public.newsletter_subscribers for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.journals enable row level security;
alter table public.issues enable row level security;
alter table public.authors enable row level security;
alter table public.publications enable row level security;
alter table public.publication_authors enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.submission_history enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles read own or editorial" on public.profiles for select to authenticated using (id = auth.uid() or public.is_editor());
create policy "profiles update own display name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "editorial manages profiles" on public.profiles for all to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "public reads published journals" on public.journals for select to anon, authenticated using (status = 'published' or public.is_editor());
create policy "editorial manages journals" on public.journals for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "public reads published issues" on public.issues for select to anon, authenticated using (status = 'published' or public.is_editor());
create policy "editorial manages issues" on public.issues for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "public reads published authors" on public.authors for select to anon, authenticated using (status = 'published' or public.is_editor());
create policy "editorial manages authors" on public.authors for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "public reads published publications" on public.publications for select to anon, authenticated using (status = 'published' or public.is_editor());
create policy "editorial manages publications" on public.publications for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "public reads published author links" on public.publication_authors for select to anon, authenticated using (exists (select 1 from public.publications p where p.id = publication_id and (p.status = 'published' or public.is_editor())));
create policy "editorial manages author links" on public.publication_authors for all to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "editorial manages submissions" on public.submissions for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editorial manages submission files" on public.submission_files for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editorial manages submission history" on public.submission_history for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editorial manages newsletter" on public.newsletter_subscribers for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editorial reads audit events" on public.audit_events for select to authenticated using (public.is_editor());
create policy "editorial inserts audit events" on public.audit_events for insert to authenticated with check (public.is_editor());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submission-files', 'submission-files', false, 15728640, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "editorial reads private submission objects" on storage.objects for select to authenticated using (bucket_id = 'submission-files' and public.is_editor());
create policy "editorial removes private submission objects" on storage.objects for delete to authenticated using (bucket_id = 'submission-files' and public.is_editor());

grant usage on schema public to anon, authenticated;
grant select on public.journals, public.issues, public.authors, public.publications, public.publication_authors to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant all on public.journals, public.issues, public.authors, public.publications, public.publication_authors, public.submissions, public.submission_files, public.submission_history, public.newsletter_subscribers, public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

commit;
