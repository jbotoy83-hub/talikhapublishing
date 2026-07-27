update public.certificate_template_fields
set label = 'Manuscript Title'
where field_key = 'work_title' and label in ('Work title', 'Article Title', 'Work Title');
