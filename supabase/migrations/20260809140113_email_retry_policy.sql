alter table public.email_messages add column retryable boolean not null default false;
drop index public.email_messages_delivery_index;
create index email_messages_delivery_index on public.email_messages (status, created_at) where direction = 'outbound' and (status = 'queued' or (status = 'failed' and retryable));
