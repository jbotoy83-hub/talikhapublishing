-- Certificates are issued once per publication reference. The record belongs to
-- the study, rather than to a single author, so every author can use the same
-- private reference-linked download.
alter table public.certificate_templates
  add column if not exists is_default boolean not null default false;

create unique index if not exists certificate_templates_one_default
  on public.certificate_templates (is_default)
  where is_default;

alter table public.certificate_records
  alter column author_id drop not null,
  add column if not exists reference_number text;

update public.certificate_records
set reference_number = certificate_number
where reference_number is null;

alter table public.certificate_records
  alter column reference_number set not null;

alter table public.certificate_records
  drop constraint if exists certificate_records_template_id_publication_id_author_id_key;

create unique index if not exists certificate_records_one_per_publication
  on public.certificate_records (publication_id);

create unique index if not exists certificate_records_reference_number_unique
  on public.certificate_records (reference_number);

alter table public.certificate_text_blocks
  add column if not exists block_type text not null default 'text'
    check (block_type in ('text', 'image')),
  add column if not exists asset_bucket text,
  add column if not exists asset_path text;

create index if not exists certificate_records_submission_index
  on public.certificate_records (submission_id, status);

-- This is deliberately a database-level gate, so a due-date job or any future
-- admin interface cannot publish a scheduled study while its shared certificate
-- is still a draft.
create or replace function private.require_issued_certificate_before_publication()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.current_stage = 'published' and old.current_stage is distinct from 'published'
    and not exists (
      select 1 from public.certificate_records
      where submission_id = new.id and status = 'issued'
    ) then
    raise exception 'An issued certificate is required before this scheduled study can publish';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_require_issued_certificate on public.submissions;
create trigger submissions_require_issued_certificate
  before update of current_stage on public.submissions
  for each row execute function private.require_issued_certificate_before_publication();
