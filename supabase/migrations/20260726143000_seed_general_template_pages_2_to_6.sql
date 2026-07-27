-- Fill the General Template with the six-page certificate copy. Variable
-- information remains rich-text field tokens and resolves per record.
do $$
declare
  general_id uuid;
  p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  body_style jsonb := '{"fontFamily":"Helvetica","fontSize":18,"fontWeight":400,"color":"#152b21","textAlign":"justify","lineHeight":25,"letterSpacing":0,"opacity":1,"padding":0}'::jsonb;
begin
  select id into general_id from public.certificate_templates where is_default = true order by created_at limit 1;
  if general_id is null then raise exception 'General Template was not found'; end if;

  insert into public.certificate_template_fields (template_id, field_key, label, field_type, required, section)
  values (general_id, 'author_location', 'Author location', 'text', false, 'author')
  on conflict (template_id, field_key) do update set label = excluded.label, section = excluded.section;

  select id into p2 from public.certificate_template_pages where template_id = general_id and page_number = 2;
  select id into p3 from public.certificate_template_pages where template_id = general_id and page_number = 3;
  select id into p4 from public.certificate_template_pages where template_id = general_id and page_number = 4;
  select id into p5 from public.certificate_template_pages where template_id = general_id and page_number = 5;
  select id into p6 from public.certificate_template_pages where template_id = general_id and page_number = 6;

  -- Replace the seeded second-page copy with the supplied text. The layout is
  -- kept in one responsive, auto-fit text area for predictable output.
  delete from public.certificate_text_blocks where page_id = p2;
  insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
  values (p2,
    '{"type":"rich_text","segments":[{"t":"s","v":"Is the duly recognized "},{"t":"f","k":"author_name"},{"t":"s","v":" of the article entitled \u201c"},{"t":"f","k":"work_title"},{"t":"s","v":"\u201d, submitted to Lakbay-Diwa Publishing.\n\nThis certification affirms the author\u2019s sole and original authorship of the aforementioned work and recognizes their substantial intellectual and creative contribution to its composition, development, and publication. The author retains full moral and intellectual rights over the content, in accordance with the ethical and editorial standards upheld by Lakbay-Diwa Publishing.\n\nIssued to recognize the author\u2019s integrity, creativity, and scholarly authorship in advancing research, innovation, and creative expression through Lakbay-Diwa Publishing.\n\nAwarded this "},{"t":"f","k":"date_issued"},{"t":"s","v":" at "},{"t":"f","k":"issuing_city"},{"t":"s","v":", Philippines."}]}'::jsonb,
    88, 130, 666, 350, 1, body_style, 'auto_fit');

  if not exists (select 1 from public.certificate_text_blocks where page_id = p3) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (p3,
      '{"type":"rich_text","segments":[{"t":"f","k":"author_name"},{"t":"s","v":" is the author of the article entitled \u201c"},{"t":"f","k":"work_title"},{"t":"s","v":"\u201d, which has undergone formal evaluation under the editorial and peer review standards of Lakbay-Diwa Publishing.\n\nThe article was assessed for its originality, scholarly merit, clarity of presentation, and adherence to ethical and formatting guidelines. Based on the evaluation results, the work has satisfactorily met the criteria set forth by the publication for quality assurance and academic integrity.\n\nThis certification is issued to affirm that the manuscript has been duly evaluated and verified as part of the official editorial and peer review process conducted by Lakbay-Diwa Publishing.\n\nAwarded this "},{"t":"f","k":"date_issued"},{"t":"s","v":" at "},{"t":"f","k":"issuing_city"},{"t":"s","v":", Philippines."}]}'::jsonb,
      88, 130, 666, 350, 1, body_style, 'auto_fit');
  end if;

  if not exists (select 1 from public.certificate_text_blocks where page_id = p4) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (p4,
      '{"type":"rich_text","segments":[{"t":"s","v":"for the literary work entitled \u201c"},{"t":"f","k":"work_title"},{"t":"s","v":"\u201d\n\nThe article has been reviewed and recognized for its quality, originality, and alignment with academic and literary standards. It is hereby acknowledged as suitable for publication and dissemination in the national magazine "},{"t":"f","k":"publication_name"},{"t":"s","v":" (Volume "},{"t":"f","k":"volume_number"},{"t":"s","v":", Issue "},{"t":"f","k":"issue_number"},{"t":"s","v":", "},{"t":"f","k":"issue_date"},{"t":"s","v":"), with ISSN (Online) "},{"t":"f","k":"issn_online"},{"t":"s","v":" and ISSN (Print) "},{"t":"f","k":"issn_print"},{"t":"s","v":", registered with the ISSN International Center and the ISSN National Center of the Philippines under the Bibliographic Services Division of the National Library of the Philippines.\n\nGiven this "},{"t":"f","k":"date_issued"},{"t":"s","v":" at "},{"t":"f","k":"issuing_city"},{"t":"s","v":", Philippines."}]}'::jsonb,
      88, 130, 666, 350, 1, body_style, 'auto_fit');
  end if;

  if not exists (select 1 from public.certificate_text_blocks where page_id = p5) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (p5,
      '{"type":"rich_text","segments":[{"t":"f","k":"author_name"},{"t":"s","v":" is a bonafide member of LAKBAY-DIWA PUBLISHING, a licensed and duly registered national publisher in the Philippines.\n\nAwarded this "},{"t":"f","k":"date_issued"},{"t":"s","v":", at "},{"t":"f","k":"issuing_city"},{"t":"s","v":", Philippines."}]}'::jsonb,
      88, 180, 666, 220, 1, body_style, 'auto_fit');
  end if;

  if not exists (select 1 from public.certificate_text_blocks where page_id = p6) then
    insert into public.certificate_text_blocks (page_id, content, x, y, width, height, z_index, style, overflow_behavior)
    values (p6,
      '{"type":"rich_text","segments":[{"t":"f","k":"work_title"},{"t":"s","v":"\nDOI "},{"t":"f","k":"doi"},{"t":"s","v":"\n\n"},{"t":"f","k":"author_name"},{"t":"s","v":"\n"},{"t":"f","k":"author_academic_title"},{"t":"s","v":"\n"},{"t":"f","k":"author_affiliation"},{"t":"s","v":"\n"},{"t":"f","k":"author_location"}]}'::jsonb,
      130, 130, 582, 330, 1, '{"fontFamily":"Helvetica","fontSize":22,"fontWeight":400,"color":"#152b21","textAlign":"center","lineHeight":1.45,"letterSpacing":0,"opacity":1,"padding":0}'::jsonb, 'auto_fit');
  end if;
end;
$$;
