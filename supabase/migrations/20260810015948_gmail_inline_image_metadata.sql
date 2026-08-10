alter table public.email_attachments
  add column content_id text,
  add column is_inline boolean not null default false;

create index email_attachments_content_id_index
  on public.email_attachments (message_id, content_id)
  where content_id is not null;
