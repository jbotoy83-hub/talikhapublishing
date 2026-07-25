-- The active editorial catalogue is intentionally limited to these two journals.
-- Existing journal and publication records are retained and archived for citation integrity.
insert into public.journals (slug, title, description, scope, accent, status)
values
  ('inquira', 'InQuira', 'A Talikha Publishing journal for inquiry-led scholarship.', '', 'emerald', 'published'),
  ('lumera', 'Lumera', 'A Talikha Publishing journal for research and creative scholarship.', '', 'emerald', 'published')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  status = 'published',
  updated_at = now();

update public.journals
set status = 'archived', updated_at = now()
where slug not in ('inquira', 'lumera')
  and status <> 'archived';
