create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  background_bucket text not null default 'certificate-assets',
  background_path text,
  page_count integer not null default 6 check (page_count between 1 and 24),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificate_template_pages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  width numeric(10,2) not null default 595.28,
  height numeric(10,2) not null default 841.89,
  page_type text not null default 'certificate' check (page_type in ('certificate', 'authorship', 'publication', 'recognition', 'social_media')),
  unique (template_id, page_number)
);

create table public.certificate_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  label text not null check (char_length(trim(label)) between 1 and 120),
  field_type text not null default 'text' check (field_type in ('text', 'date', 'doi', 'certificate_number', 'url')),
  required boolean not null default false,
  default_value text,
  validation_rule jsonb not null default '{}'::jsonb,
  unique (template_id, field_key)
);

create table public.certificate_text_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.certificate_template_pages(id) on delete cascade,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  x numeric(10,2) not null default 40,
  y numeric(10,2) not null default 40,
  width numeric(10,2) not null default 300 check (width > 0),
  height numeric(10,2) not null default 48 check (height > 0),
  rotation numeric(8,2) not null default 0,
  z_index integer not null default 0,
  style jsonb not null default '{}'::jsonb,
  overflow_behavior text not null default 'auto_height' check (overflow_behavior in ('auto_height', 'auto_fit', 'manual')),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificate_fonts (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  weight integer not null default 400 check (weight between 100 and 900),
  style text not null default 'normal' check (style in ('normal', 'italic')),
  storage_bucket text not null default 'certificate-assets',
  storage_path text not null unique,
  embedding_allowed boolean not null default false,
  license_note text not null default '',
  active boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.certificate_records (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  publication_id uuid not null references public.publications(id) on delete restrict,
  author_id uuid not null references public.authors(id) on delete restrict,
  submission_id uuid references public.submissions(id) on delete set null,
  certificate_number text not null unique,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'issued', 'revoked')),
  field_values jsonb not null default '{}'::jsonb,
  layout_overrides jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, publication_id, author_id)
);

create table public.certificate_output_versions (
  id uuid primary key default gen_random_uuid(),
  certificate_record_id uuid not null references public.certificate_records(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  field_values jsonb not null,
  layout_overrides jsonb not null,
  pdf_path text,
  preview_path text,
  file_hash text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (certificate_record_id, version_number)
);

create table public.certificate_access_links (
  id uuid primary key default gen_random_uuid(),
  certificate_record_id uuid not null references public.certificate_records(id) on delete cascade,
  output_version_id uuid references public.certificate_output_versions(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index certificate_template_pages_template_index on public.certificate_template_pages(template_id, page_number);
create index certificate_text_blocks_page_index on public.certificate_text_blocks(page_id, z_index);
create index certificate_records_publication_author_index on public.certificate_records(publication_id, author_id);
create index certificate_access_links_lookup_index on public.certificate_access_links(token_hash, expires_at) where revoked_at is null;

create trigger certificate_templates_updated_at before update on public.certificate_templates for each row execute function public.set_updated_at();
create trigger certificate_text_blocks_updated_at before update on public.certificate_text_blocks for each row execute function public.set_updated_at();
create trigger certificate_records_updated_at before update on public.certificate_records for each row execute function public.set_updated_at();

alter table public.certificate_templates enable row level security;
alter table public.certificate_template_pages enable row level security;
alter table public.certificate_template_fields enable row level security;
alter table public.certificate_text_blocks enable row level security;
alter table public.certificate_fonts enable row level security;
alter table public.certificate_records enable row level security;
alter table public.certificate_output_versions enable row level security;
alter table public.certificate_access_links enable row level security;

create policy "editorial manages certificate templates" on public.certificate_templates for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate template pages" on public.certificate_template_pages for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate template fields" on public.certificate_template_fields for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate text blocks" on public.certificate_text_blocks for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate fonts" on public.certificate_fonts for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate records" on public.certificate_records for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate outputs" on public.certificate_output_versions for all to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial manages certificate links" on public.certificate_access_links for all to authenticated using (private.is_editor()) with check (private.is_editor());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-assets', 'certificate-assets', false, 26214400, array['application/pdf','font/ttf','font/otf','font/woff','font/woff2','image/png','image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "editorial manages certificate assets" on storage.objects for all to authenticated using (bucket_id = 'certificate-assets' and private.is_editor()) with check (bucket_id = 'certificate-assets' and private.is_editor());
