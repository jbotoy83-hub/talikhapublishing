begin;

create table public.submission_authors (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  position integer not null check (position > 0),
  first_name text not null default '',
  middle_initial text,
  surname text not null default '',
  position_title text,
  academic_title text,
  email text not null default '',
  institution text,
  location text,
  orcid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, position)
);

create table public.editorial_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('submission', 'publication', 'author', 'journal', 'issue')),
  entity_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'editorial-media',
  storage_path text not null unique,
  public_url text not null,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text not null default '',
  credit text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.media_placements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  entity_type text not null check (entity_type in ('author', 'journal', 'issue')),
  entity_id uuid not null,
  placement_key text not null check (placement_key in ('author_portrait', 'journal_hero', 'issue_cover')),
  crop jsonb not null default '{"zoom":1,"x":50,"y":50}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, placement_key)
);

alter table public.publications
  add column if not exists source_submission_id uuid references public.submissions(id) on delete set null,
  add column if not exists sort_order integer not null default 0;

alter table public.issues
  add column if not exists description text not null default '',
  add column if not exists sort_order integer not null default 0,
  add column if not exists cover_media_id uuid references public.media_assets(id) on delete set null;

alter table public.journals
  add column if not exists hero_media_id uuid references public.media_assets(id) on delete set null;

alter table public.authors
  add column if not exists portrait_media_id uuid references public.media_assets(id) on delete set null;

create index submission_authors_submission_index on public.submission_authors (submission_id, position);
create index editorial_notes_entity_index on public.editorial_notes (entity_type, entity_id, created_at desc);
create index media_placements_entity_index on public.media_placements (entity_type, entity_id);
create index publications_source_submission_index on public.publications (source_submission_id);
create index publications_issue_order_index on public.publications (issue_id, sort_order, publication_date desc);

create trigger submission_authors_updated_at before update on public.submission_authors for each row execute function public.set_updated_at();
create trigger media_placements_updated_at before update on public.media_placements for each row execute function public.set_updated_at();

alter table public.submission_authors enable row level security;
alter table public.editorial_notes enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_placements enable row level security;

create policy "editorial manages submission authors" on public.submission_authors for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages notes" on public.editorial_notes for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "public reads editorial media" on public.media_assets for select to anon, authenticated using (true);
create policy "editorial manages media assets" on public.media_assets for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "public reads media placements" on public.media_placements for select to anon, authenticated using (true);
create policy "editorial manages media placements" on public.media_placements for all to authenticated using (private.is_editor()) with check (private.is_editor());

grant select on public.media_assets, public.media_placements to anon;
grant all on public.submission_authors, public.editorial_notes, public.media_assets, public.media_placements to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editorial-media', 'editorial-media', true, 12582912, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads published editorial media" on storage.objects for select to public using (bucket_id = 'editorial-media');

insert into public.submission_authors (
  submission_id, position, first_name, middle_initial, surname, position_title,
  academic_title, email, institution, location, orcid
)
select
  submission.id,
  detail.position::integer,
  coalesce(detail.author ->> 'firstName', ''),
  nullif(detail.author ->> 'middleInitial', ''),
  coalesce(detail.author ->> 'surname', ''),
  nullif(detail.author ->> 'position', ''),
  nullif(detail.author ->> 'academicTitle', ''),
  coalesce(detail.author ->> 'email', ''),
  nullif(detail.author ->> 'institution', ''),
  nullif(detail.author ->> 'location', ''),
  nullif(detail.author ->> 'orcid', '')
from public.submissions as submission
cross join lateral jsonb_array_elements(submission.author_details) with ordinality as detail(author, position)
where jsonb_typeof(submission.author_details) = 'array'
on conflict (submission_id, position) do nothing;

commit;
