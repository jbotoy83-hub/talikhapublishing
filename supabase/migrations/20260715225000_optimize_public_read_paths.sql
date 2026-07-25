begin;

-- Keep anonymous public reads on the indexable predicate. Editors retain access
-- through separate policies, without adding an authorization check to every row.
alter policy "public reads published publications" on public.publications
  using (status = 'published');

drop policy if exists "editorial reads all publications" on public.publications;
create policy "editorial reads all publications"
  on public.publications for select to authenticated
  using ((select private.is_editor()));

alter policy "public reads published author links" on public.publication_authors
  using (exists (
    select 1 from public.publications p
    where p.id = publication_id and p.status = 'published'
  ));

drop policy if exists "editorial reads all publication author links" on public.publication_authors;
create policy "editorial reads all publication author links"
  on public.publication_authors for select to authenticated
  using ((select private.is_editor()));

create index if not exists authors_portrait_media_index on public.authors (portrait_media_id);
create index if not exists editorial_notes_created_by_index on public.editorial_notes (created_by);
create index if not exists issues_cover_media_index on public.issues (cover_media_id);
create index if not exists journals_hero_media_index on public.journals (hero_media_id);
create index if not exists media_assets_created_by_index on public.media_assets (created_by);
create index if not exists media_placements_asset_index on public.media_placements (asset_id);

commit;
