begin;

-- Anonymous public requests stay on the simple, indexable policy. Authenticated
-- editorial requests retain their broader visibility in a separate policy.
alter policy "public reads published publications" on public.publications
  to anon
  using (status = 'published');

drop policy if exists "editorial reads all publications" on public.publications;
create policy "authenticated reads publications"
  on public.publications for select to authenticated
  using (status = 'published' or (select private.is_editor()));

alter policy "public reads published author links" on public.publication_authors
  to anon
  using (exists (
    select 1 from public.publications p
    where p.id = publication_id and p.status = 'published'
  ));

drop policy if exists "editorial reads all publication author links" on public.publication_authors;
create policy "authenticated reads publication author links"
  on public.publication_authors for select to authenticated
  using (
    (select private.is_editor()) or exists (
      select 1 from public.publications p
      where p.id = publication_id and p.status = 'published'
    )
  );

commit;
