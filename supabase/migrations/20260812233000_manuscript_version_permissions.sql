begin;

revoke all on public.manuscript_documents, public.manuscript_drafts, public.manuscript_versions from anon, authenticated, service_role;

grant select, insert, update, delete on public.manuscript_documents, public.manuscript_drafts to service_role;
grant select, insert on public.manuscript_versions to service_role;

commit;
