create index email_attachments_message_index on public.email_attachments (message_id);
create index email_messages_actor_index on public.email_messages (actor_id) where actor_id is not null;
