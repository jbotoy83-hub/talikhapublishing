-- Production certificate editor: a six-page, author-specific template model.
-- All assets remain private in certificate-assets and are accessed only by
-- authenticated editorial API routes.

alter table public.certificate_template_pages
  add column if not exists background_bucket text,
  add column if not exists background_path text,
  add column if not exists background_mime_type text,
  add column if not exists background_original_name text;

alter table public.certificate_template_fields
  add column if not exists source_key text,
  add column if not exists section text not null default 'custom';

-- The old shared-record index conflicts with a certificate for every author.
drop index if exists public.certificate_records_one_per_publication;
create unique index if not exists certificate_records_template_publication_author_unique
  on public.certificate_records(template_id, publication_id, author_id)
  where author_id is not null;

-- Private template images are deliberately limited to formats that the server
-- can embed into the official PDF without a lossy conversion step.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
where id = 'certificate-assets';

-- Preserve the existing publication guard, but require a final certificate for
-- every linked author when a publication has author profiles.
create or replace function private.require_issued_certificate_before_publication()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.current_stage = 'published' and old.current_stage is distinct from 'published' then
    if not exists (
      select 1 from public.certificate_records cr
      where cr.submission_id = new.id and cr.status = 'issued'
    ) then
      raise exception 'An issued certificate is required before this scheduled study can publish';
    end if;

    if exists (
      select 1
      from public.publication_records pr
      join public.publication_authors pa on pa.publication_id = pr.publication_id
      where pr.submission_id = new.id
        and not exists (
          select 1 from public.certificate_records cr
          where cr.publication_id = pr.publication_id
            and cr.author_id = pa.author_id
            and cr.status = 'issued'
        )
    ) then
      raise exception 'Every publication author needs an issued certificate before publication';
    end if;
  end if;
  return new;
end;
$$;

-- One idempotent starter template. Existing templates remain intact but this
-- becomes the default for all newly created certificate records.
do $$
declare
  general_id uuid;
  page_one uuid;
  page_two uuid;
begin
  select id into general_id
  from public.certificate_templates
  where name = 'General Template'
  order by created_at asc
  limit 1;

  if general_id is null then
    insert into public.certificate_templates (name, status, is_default, page_count)
    values ('General Template', 'published', true, 6)
    returning id into general_id;
  end if;

  update public.certificate_templates
  set is_default = (id = general_id),
      status = case when id = general_id then 'published' else status end,
      page_count = case when id = general_id then 6 else page_count end
  where is_default or id = general_id;

  insert into public.certificate_template_pages (template_id, page_number, width, height, page_type)
  select general_id, page_number, 842, 595, 'certificate'
  from generate_series(1, 6) as page_number
  on conflict (template_id, page_number) do nothing;

  insert into public.certificate_template_fields (template_id, field_key, label, field_type, required, source_key, section)
  values
    (general_id, 'author_name', 'Author name', 'text', true, 'author.name', 'author'),
    (general_id, 'author_affiliation', 'Author affiliation', 'text', false, 'author.affiliation', 'author'),
    (general_id, 'author_academic_title', 'Academic title', 'text', false, 'author.credentials', 'author'),
    (general_id, 'work_title', 'Work title', 'text', true, 'publication.title', 'publication'),
    (general_id, 'publication_name', 'Journal or magazine', 'text', true, 'journal.title', 'publication'),
    (general_id, 'volume_number', 'Volume', 'text', false, 'issue.volume', 'publication'),
    (general_id, 'issue_number', 'Issue', 'text', false, 'issue.number', 'publication'),
    (general_id, 'issue_date', 'Issue date', 'date', false, 'publication.date', 'publication'),
    (general_id, 'issn_online', 'ISSN online', 'text', false, null, 'publication'),
    (general_id, 'issn_print', 'ISSN print', 'text', false, null, 'publication'),
    (general_id, 'doi', 'DOI', 'doi', false, 'publication.doi', 'publication'),
    (general_id, 'date_issued', 'Date issued', 'date', true, null, 'certificate'),
    (general_id, 'certificate_number', 'Certificate number', 'certificate_number', true, null, 'certificate'),
    (general_id, 'publisher_name', 'Publisher', 'text', true, null, 'certificate'),
    (general_id, 'issuing_city', 'Issuing city', 'text', false, null, 'certificate')
  on conflict (template_id, field_key) do update
  set label = excluded.label, source_key = excluded.source_key, section = excluded.section;

  select id into page_one from public.certificate_template_pages where template_id = general_id and page_number = 1;
  select id into page_two from public.certificate_template_pages where template_id = general_id and page_number = 2;

  if not exists (select 1 from public.certificate_text_blocks where page_id = page_one) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (
      page_one,
      '{"type":"rich_text","segments":[{"t":"s","v":"serves as the "},{"t":"f","k":"author_name","style":{"fontWeight":700}},{"t":"s","v":" of the literary piece entitled “"},{"t":"f","k":"work_title","style":{"fontWeight":700}},{"t":"s","v":"” that has been published in the national magazine named "},{"t":"f","k":"publication_name","style":{"fontWeight":700}},{"t":"s","v":" (Volume "},{"t":"f","k":"volume_number"},{"t":"s","v":", Issue "},{"t":"f","k":"issue_number"},{"t":"s","v":", "},{"t":"f","k":"issue_date"},{"t":"s","v":") with ISSN (Online) "},{"t":"f","k":"issn_online"},{"t":"s","v":", ISSN (Print) "},{"t":"f","k":"issn_print"},{"t":"s","v":", registered to the ISSN International Center, the Global Index for Continuing Resources, & ISSN National Center of the Philippines, Bibliographic Services Division, National Library of the Philippines.\n\nDate Issued: "},{"t":"f","k":"date_issued"},{"t":"s","v":"\nCertificate No. "},{"t":"f","k":"certificate_number"},{"t":"s","v":"\nDOI "},{"t":"f","k":"doi"}]}'::jsonb,
      88, 170, 666, 280, 1,
      '{"fontFamily":"Helvetica","fontSize":18,"fontWeight":400,"color":"#152b21","textAlign":"justify","lineHeight":25,"letterSpacing":0,"opacity":1,"padding":0}'::jsonb,
      'auto_fit'
    );
  end if;

  if not exists (select 1 from public.certificate_text_blocks where page_id = page_two) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (
      page_two,
      '{"type":"rich_text","segments":[{"t":"s","v":"Is the duly recognized "},{"t":"f","k":"author_name","style":{"fontWeight":700}},{"t":"s","v":" of the article entitled “"},{"t":"f","k":"work_title","style":{"fontWeight":700}},{"t":"s","v":"”, submitted to Talikha Publishing.\n\nThis certification affirms the author’s sole and original authorship of the aforementioned work and recognizes their substantial intellectual and creative contribution to its composition, development, and publication. The author retains full moral and intellectual rights over the content, in accordance with the ethical and editorial standards upheld by Talikha Publishing.\n\nIssued to recognize the author’s integrity, creativity, and scholarly authorship in advancing research, innovation, and creative expression through Talikha Publishing.\n\nAwarded this "},{"t":"f","k":"date_issued"},{"t":"s","v":" at "},{"t":"f","k":"issuing_city"},{"t":"s","v":", Philippines."}]}'::jsonb,
      88, 130, 666, 350, 1,
      '{"fontFamily":"Helvetica","fontSize":18,"fontWeight":400,"color":"#152b21","textAlign":"justify","lineHeight":25,"letterSpacing":0,"opacity":1,"padding":0}'::jsonb,
      'auto_fit'
    );
  end if;
end;
$$;
