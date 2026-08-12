begin;

alter table public.submissions
  add column if not exists source_manuscript_file_id uuid references public.submission_files(id) on delete set null;

alter table public.submission_authors
  add column if not exists affiliation text,
  add column if not exists photo_file_id uuid references public.submission_files(id) on delete set null,
  add column if not exists row_revision integer not null default 1 check (row_revision > 0),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create table public.manuscript_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  source_file_id uuid not null references public.submission_files(id) on delete restrict,
  source_sha256 text,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  schema_version integer not null default 1 check (schema_version > 0),
  current_revision integer not null default 0 check (current_revision >= 0),
  current_version_id uuid,
  lease_owner_id uuid references auth.users(id) on delete set null,
  lease_expires_at timestamptz,
  imported_at timestamptz,
  finalized_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manuscript_drafts (
  document_id uuid primary key references public.manuscript_documents(id) on delete cascade,
  editor_state jsonb not null default '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'::jsonb check (jsonb_typeof(editor_state) = 'object'),
  page_settings jsonb not null default '{"size":"A4","orientation":"portrait","marginTopMm":25.4,"marginRightMm":25.4,"marginBottomMm":25.4,"marginLeftMm":25.4,"headerText":"","footerText":"","pageNumbers":true}'::jsonb check (jsonb_typeof(page_settings) = 'object'),
  field_bindings jsonb not null default '[]'::jsonb check (jsonb_typeof(field_bindings) = 'array'),
  field_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(field_snapshot) = 'object'),
  import_report jsonb not null default '{}'::jsonb check (jsonb_typeof(import_report) = 'object'),
  source_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(source_snapshot) = 'object'),
  manual_confirmations jsonb not null default '{}'::jsonb check (jsonb_typeof(manual_confirmations) = 'object'),
  content_text text not null default '',
  content_hash text not null default '',
  revision integer not null default 0 check (revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.manuscript_documents(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_kind text not null check (version_kind in ('import', 'checkpoint', 'restore', 'final')),
  parent_version_id uuid references public.manuscript_versions(id) on delete set null,
  revision integer not null check (revision >= 0),
  editor_state jsonb not null check (jsonb_typeof(editor_state) = 'object'),
  page_settings jsonb not null check (jsonb_typeof(page_settings) = 'object'),
  field_bindings jsonb not null default '[]'::jsonb check (jsonb_typeof(field_bindings) = 'array'),
  field_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(field_snapshot) = 'object'),
  import_report jsonb not null default '{}'::jsonb check (jsonb_typeof(import_report) = 'object'),
  source_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(source_snapshot) = 'object'),
  manual_confirmations jsonb not null default '{}'::jsonb check (jsonb_typeof(manual_confirmations) = 'object'),
  content_text text not null default '',
  content_hash text not null,
  change_summary text not null default '' check (char_length(change_summary) <= 500),
  docx_file_id uuid references public.submission_files(id) on delete set null,
  pdf_file_id uuid references public.submission_files(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

alter table public.manuscript_documents
  add constraint manuscript_documents_current_version_fkey
  foreign key (current_version_id) references public.manuscript_versions(id) on delete set null;

create index if not exists submissions_source_manuscript_file_index
  on public.submissions (source_manuscript_file_id)
  where source_manuscript_file_id is not null;
create index if not exists submission_authors_photo_file_index
  on public.submission_authors (photo_file_id)
  where photo_file_id is not null;
create index if not exists submission_authors_updated_by_index
  on public.submission_authors (updated_by)
  where updated_by is not null;
create index if not exists manuscript_documents_source_file_index
  on public.manuscript_documents (source_file_id);
create index if not exists manuscript_documents_current_version_index
  on public.manuscript_documents (current_version_id)
  where current_version_id is not null;
create index if not exists manuscript_documents_lease_owner_index
  on public.manuscript_documents (lease_owner_id)
  where lease_owner_id is not null;
create index if not exists manuscript_documents_created_by_index
  on public.manuscript_documents (created_by)
  where created_by is not null;
create index if not exists manuscript_documents_updated_by_index
  on public.manuscript_documents (updated_by)
  where updated_by is not null;
create index if not exists manuscript_documents_lease_index
  on public.manuscript_documents (lease_expires_at)
  where lease_owner_id is not null;
create index if not exists manuscript_drafts_updated_by_index
  on public.manuscript_drafts (updated_by)
  where updated_by is not null;
create index if not exists manuscript_versions_document_created_index
  on public.manuscript_versions (document_id, created_at desc);
create index if not exists manuscript_versions_submission_index
  on public.manuscript_versions (submission_id, created_at desc);
create index if not exists manuscript_versions_parent_index
  on public.manuscript_versions (parent_version_id)
  where parent_version_id is not null;
create index if not exists manuscript_versions_docx_file_index
  on public.manuscript_versions (docx_file_id)
  where docx_file_id is not null;
create index if not exists manuscript_versions_pdf_file_index
  on public.manuscript_versions (pdf_file_id)
  where pdf_file_id is not null;
create index if not exists manuscript_versions_created_by_index
  on public.manuscript_versions (created_by)
  where created_by is not null;

create trigger manuscript_documents_updated_at
  before update on public.manuscript_documents
  for each row execute function public.set_updated_at();

create or replace function public.bump_submission_author_row_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.row_revision := old.row_revision + 1;
  return new;
end;
$$;

drop trigger if exists submission_authors_row_revision on public.submission_authors;
create trigger submission_authors_row_revision
  before update on public.submission_authors
  for each row execute function public.bump_submission_author_row_revision();

alter table public.manuscript_documents enable row level security;
alter table public.manuscript_drafts enable row level security;
alter table public.manuscript_versions enable row level security;

revoke all on public.manuscript_documents, public.manuscript_drafts, public.manuscript_versions from anon, authenticated, service_role;
grant select, insert, update, delete on public.manuscript_documents, public.manuscript_drafts to service_role;
grant select, insert on public.manuscript_versions to service_role;

insert into public.submission_authors (
  submission_id,
  position,
  first_name,
  middle_initial,
  surname,
  position_title,
  academic_title,
  email,
  institution,
  affiliation,
  location,
  orcid
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
  coalesce(nullif(detail.author ->> 'affiliation', ''), nullif(detail.author ->> 'institution', '')),
  nullif(detail.author ->> 'location', ''),
  nullif(detail.author ->> 'orcid', '')
from public.submissions as submission
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(submission.author_details) = 'array' then submission.author_details
    else '[]'::jsonb
  end
) with ordinality as detail(author, position)
on conflict (submission_id, position) do update set
  first_name = coalesce(nullif(submission_authors.first_name, ''), excluded.first_name),
  middle_initial = coalesce(submission_authors.middle_initial, excluded.middle_initial),
  surname = coalesce(nullif(submission_authors.surname, ''), excluded.surname),
  position_title = coalesce(submission_authors.position_title, excluded.position_title),
  academic_title = coalesce(submission_authors.academic_title, excluded.academic_title),
  email = coalesce(nullif(submission_authors.email, ''), excluded.email),
  institution = coalesce(submission_authors.institution, excluded.institution),
  affiliation = coalesce(submission_authors.affiliation, excluded.affiliation),
  location = coalesce(submission_authors.location, excluded.location),
  orcid = coalesce(submission_authors.orcid, excluded.orcid),
  updated_at = now();

update public.submission_authors as author
set photo_file_id = (
  select file.id
  from public.submission_files as file
  where file.submission_id = author.submission_id
    and file.file_kind = 'authorPhoto'
    and lower(file.original_name) like 'author-' || lpad(author.position::text, 3, '0') || '%'
  order by file.created_at desc
  limit 1
)
where author.photo_file_id is null
  and exists (
    select 1
    from public.submission_files as file
    where file.submission_id = author.submission_id
      and file.file_kind = 'authorPhoto'
      and lower(file.original_name) like 'author-' || lpad(author.position::text, 3, '0') || '%'
  );

update public.submissions as submission
set source_manuscript_file_id = (
  select file.id
  from public.submission_files as file
  where file.submission_id = submission.id
    and file.file_kind = 'manuscript'
  order by file.created_at desc
  limit 1
)
where submission.source_manuscript_file_id is null
  and exists (
    select 1
    from public.submission_files as file
    where file.submission_id = submission.id
      and file.file_kind = 'manuscript'
  );

update public.publication_authors
set metadata = jsonb_strip_nulls(metadata - 'email' - 'author_email')
where metadata ? 'email' or metadata ? 'author_email';

alter table public.publication_authors
  drop constraint if exists publication_authors_metadata_private_email_check,
  add constraint publication_authors_metadata_private_email_check
  check (not (metadata ? 'email') and not (metadata ? 'author_email'));

commit;
