alter table public.email_messages add column rfc_message_id text;
create index email_messages_rfc_message_index on public.email_messages (rfc_message_id) where rfc_message_id is not null;
