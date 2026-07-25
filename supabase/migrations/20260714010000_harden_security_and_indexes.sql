begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('editor', 'admin')
  );
$$;

revoke all on function private.is_editor() from public;
grant execute on function private.is_editor() to anon, authenticated;

alter policy "profiles read own or editorial" on public.profiles
  using (id = (select auth.uid()) or private.is_editor());
alter policy "profiles update own display name" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "editorial manages profiles" on public.profiles;

alter policy "public reads published journals" on public.journals
  using (status = 'published' or private.is_editor());
drop policy if exists "editorial manages journals" on public.journals;
create policy "editorial inserts journals" on public.journals for insert to authenticated with check (private.is_editor());
create policy "editorial updates journals" on public.journals for update to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial deletes journals" on public.journals for delete to authenticated using (private.is_editor());

alter policy "public reads published issues" on public.issues
  using (status = 'published' or private.is_editor());
drop policy if exists "editorial manages issues" on public.issues;
create policy "editorial inserts issues" on public.issues for insert to authenticated with check (private.is_editor());
create policy "editorial updates issues" on public.issues for update to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial deletes issues" on public.issues for delete to authenticated using (private.is_editor());

alter policy "public reads published authors" on public.authors
  using (status = 'published' or private.is_editor());
drop policy if exists "editorial manages authors" on public.authors;
create policy "editorial inserts authors" on public.authors for insert to authenticated with check (private.is_editor());
create policy "editorial updates authors" on public.authors for update to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial deletes authors" on public.authors for delete to authenticated using (private.is_editor());

alter policy "public reads published publications" on public.publications
  using (status = 'published' or private.is_editor());
drop policy if exists "editorial manages publications" on public.publications;
create policy "editorial inserts publications" on public.publications for insert to authenticated with check (private.is_editor());
create policy "editorial updates publications" on public.publications for update to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial deletes publications" on public.publications for delete to authenticated using (private.is_editor());

alter policy "public reads published author links" on public.publication_authors
  using (exists (select 1 from public.publications p where p.id = publication_id and (p.status = 'published' or private.is_editor())));
drop policy if exists "editorial manages author links" on public.publication_authors;
create policy "editorial inserts author links" on public.publication_authors for insert to authenticated with check (private.is_editor());
create policy "editorial updates author links" on public.publication_authors for update to authenticated using (private.is_editor()) with check (private.is_editor());
create policy "editorial deletes author links" on public.publication_authors for delete to authenticated using (private.is_editor());

alter policy "editorial manages submissions" on public.submissions using (private.is_editor()) with check (private.is_editor());
alter policy "editorial manages submission files" on public.submission_files using (private.is_editor()) with check (private.is_editor());
alter policy "editorial manages submission history" on public.submission_history using (private.is_editor()) with check (private.is_editor());
alter policy "editorial manages newsletter" on public.newsletter_subscribers using (private.is_editor()) with check (private.is_editor());
alter policy "editorial reads audit events" on public.audit_events using (private.is_editor());
alter policy "editorial inserts audit events" on public.audit_events with check (private.is_editor());
alter policy "editorial reads private submission objects" on storage.objects using (bucket_id = 'submission-files' and private.is_editor());
alter policy "editorial removes private submission objects" on storage.objects using (bucket_id = 'submission-files' and private.is_editor());

drop function if exists public.is_editor();
revoke all on function public.handle_new_user() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

create index if not exists audit_events_actor_index on public.audit_events (actor_id);
create index if not exists publication_authors_author_index on public.publication_authors (author_id);
create index if not exists publications_issue_index on public.publications (issue_id);
create index if not exists submission_history_actor_index on public.submission_history (actor_id);
create index if not exists submissions_journal_index on public.submissions (preferred_journal_id);

commit;
