alter table public.certificate_template_fields
  drop constraint if exists certificate_template_fields_field_type_check,
  add constraint certificate_template_fields_field_type_check
  check (field_type in ('text', 'date', 'doi', 'certificate_number', 'url', 'image'));

do $$
declare
  general_id uuid;
  page_six uuid;
begin
  select id into general_id
  from public.certificate_templates
  where name = 'General Template'
  order by created_at asc
  limit 1;

  if general_id is null then
    return;
  end if;

  insert into public.certificate_template_fields (template_id, field_key, label, field_type, required, source_key, section)
  values (general_id, 'author_photo', 'Author photo', 'image', false, null, 'author')
  on conflict (template_id, field_key) do update
  set label = excluded.label, field_type = excluded.field_type, section = excluded.section;

  select id into page_six
  from public.certificate_template_pages
  where template_id = general_id and page_number = 6;

  if page_six is not null and not exists (
    select 1 from public.certificate_text_blocks
    where page_id = page_six and style->>'linkedFieldKey' = 'author_photo'
  ) then
    insert into public.certificate_text_blocks (page_id, block_type, content, x, y, width, height, z_index, style, overflow_behavior)
    values (
      page_six,
      'image',
      '{"type":"rich_text","segments":[{"t":"s","v":""}]}'::jsonb,
      241, 60, 360, 360, 1,
      '{"objectFit":"cover","linkedFieldKey":"author_photo","padding":0,"opacity":1,"borderRadius":0}'::jsonb,
      'manual'
    );
  end if;
end;
$$;
