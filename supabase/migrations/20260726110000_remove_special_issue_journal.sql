begin;

delete from public.publications
where journal_id in (select id from public.journals where slug = 'special');

delete from public.issues
where journal_id in (select id from public.journals where slug = 'special');

delete from public.journals
where slug = 'special';

commit;
