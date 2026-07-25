begin;

insert into public.journals (slug, title, description, scope, accent, status)
values ('special', 'Special Issue', 'Conference collections, special issues, and proceedings.', 'Collections & proceedings', 'emerald', 'published')
on conflict (slug) do nothing;

with j as (select id from public.journals where slug = 'special')
insert into public.issues (journal_id, slug, title, volume, issue_number, status)
select j.id, 'vol-1-issue-1', 'Inaugural collection', '1', '1', 'published'
from j
where not exists (select 1 from public.issues where journal_id = j.id and slug = 'vol-1-issue-1');

update public.journals
set current_issue_id = (select id from public.issues where journal_id = public.journals.id and slug = 'vol-1-issue-1')
where slug = 'special' and current_issue_id is null;

commit;
