begin;

create index if not exists submission_authors_updated_by_index on public.submission_authors (updated_by) where updated_by is not null;
create index if not exists manuscript_documents_current_version_index on public.manuscript_documents (current_version_id) where current_version_id is not null;
create index if not exists manuscript_documents_lease_owner_index on public.manuscript_documents (lease_owner_id) where lease_owner_id is not null;
create index if not exists manuscript_documents_created_by_index on public.manuscript_documents (created_by) where created_by is not null;
create index if not exists manuscript_documents_updated_by_index on public.manuscript_documents (updated_by) where updated_by is not null;
create index if not exists manuscript_drafts_updated_by_index on public.manuscript_drafts (updated_by) where updated_by is not null;
create index if not exists manuscript_versions_parent_index on public.manuscript_versions (parent_version_id) where parent_version_id is not null;
create index if not exists manuscript_versions_docx_file_index on public.manuscript_versions (docx_file_id) where docx_file_id is not null;
create index if not exists manuscript_versions_pdf_file_index on public.manuscript_versions (pdf_file_id) where pdf_file_id is not null;
create index if not exists manuscript_versions_created_by_index on public.manuscript_versions (created_by) where created_by is not null;

commit;
