begin;

alter table public.workflow_events enable row level security;
alter table public.workflow_checklist_items enable row level security;
alter table public.author_requests enable row level security;
alter table public.payments enable row level security;
alter table public.payment_line_items enable row level security;
alter table public.receipts enable row level security;
alter table public.publication_records enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "editorial manages submissions" on public.submissions;
create policy "editorial reads submissions" on public.submissions for select to authenticated using (private.is_editor());
create policy "authors read own submissions" on public.submissions for select to authenticated using ((select auth.uid()) = author_user_id);

drop policy if exists "editorial manages submission files" on public.submission_files;
create policy "editorial reads submission files" on public.submission_files for select to authenticated using (private.is_editor());
create policy "authors read own submission files" on public.submission_files for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);

drop policy if exists "editorial manages submission history" on public.submission_history;
create policy "editorial reads legacy submission history" on public.submission_history for select to authenticated using (private.is_editor());

create policy "editorial reads workflow events" on public.workflow_events for select to authenticated using (private.is_editor());
create policy "authors read visible workflow events" on public.workflow_events for select to authenticated using (
  visibility = 'author' and exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);
create policy "editorial reads workflow checklists" on public.workflow_checklist_items for select to authenticated using (private.is_editor());
create policy "authors read own requests" on public.author_requests for select to authenticated using (
  visible_to_author and exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);
create policy "editorial reads author requests" on public.author_requests for select to authenticated using (private.is_editor());
create policy "authors read own payments" on public.payments for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);
create policy "editorial reads payments" on public.payments for select to authenticated using (private.is_editor());
create policy "authors read own payment line items" on public.payment_line_items for select to authenticated using (
  exists (
    select 1 from public.payments p
    join public.submissions s on s.id = p.submission_id
    where p.id = public.payment_line_items.payment_id and s.author_user_id = (select auth.uid())
  )
);
create policy "editorial reads payment line items" on public.payment_line_items for select to authenticated using (private.is_editor());
create policy "authors read own receipts" on public.receipts for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);
create policy "editorial reads receipts" on public.receipts for select to authenticated using (private.is_editor());
create policy "authors read own publication records" on public.publication_records for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid()))
);
create policy "editorial reads publication records" on public.publication_records for select to authenticated using (private.is_editor());
create policy "authors read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = recipient_user_id);
create policy "editorial reads notifications" on public.notifications for select to authenticated using (private.is_editor());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submission-proofs', 'submission-proofs', false, 15728640, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']),
  ('receipts', 'receipts', false, 5242880, array['application/pdf']),
  ('certificates', 'certificates', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "editorial reads production private objects" on storage.objects for select to authenticated using (
  bucket_id in ('submission-proofs', 'receipts', 'certificates') and private.is_editor()
);
create policy "authors read own private submission objects" on storage.objects for select to authenticated using (
  bucket_id in ('submission-files', 'submission-proofs', 'receipts', 'certificates')
  and exists (
    select 1 from public.submissions s
    where s.author_user_id = (select auth.uid())
      and (storage.foldername(name))[1] = s.id::text
  )
);

grant select on public.workflow_events, public.workflow_checklist_items, public.author_requests, public.payments, public.payment_line_items, public.receipts, public.publication_records, public.notifications to authenticated;

commit;
