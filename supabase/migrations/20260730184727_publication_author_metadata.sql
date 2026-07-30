begin;

alter table public.publication_authors
  add column if not exists given_name text,
  add column if not exists middle_name text,
  add column if not exists family_name text,
  add column if not exists academic_title text,
  add column if not exists position_title text,
  add column if not exists affiliation text,
  add column if not exists orcid text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.publication_authors as publication_author
set
  affiliation = coalesce(publication_author.affiliation, author.affiliation),
  orcid = coalesce(publication_author.orcid, author.orcid),
  academic_title = coalesce(publication_author.academic_title, author.credentials)
from public.authors as author
where author.id = publication_author.author_id;

create index if not exists publication_authors_orcid_index
  on public.publication_authors (orcid)
  where orcid is not null and orcid <> '';

commit;
