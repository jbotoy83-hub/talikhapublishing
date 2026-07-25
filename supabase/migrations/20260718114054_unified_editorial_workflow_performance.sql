begin;

create index if not exists author_requests_created_by_index on public.author_requests (created_by);
create index if not exists author_requests_workflow_event_index on public.author_requests (workflow_event_id);
create index if not exists notifications_recipient_user_index on public.notifications (recipient_user_id);
create index if not exists payments_confirmed_by_index on public.payments (confirmed_by);
create index if not exists publication_records_certificate_file_index on public.publication_records (certificate_file_id);
create index if not exists publication_records_final_pdf_file_index on public.publication_records (final_pdf_file_id);
create index if not exists publication_records_issue_index on public.publication_records (issue_id);
create index if not exists publication_records_journal_index on public.publication_records (journal_id);
create index if not exists publication_records_scheduled_by_index on public.publication_records (scheduled_by);
create index if not exists workflow_checklist_items_completed_by_index on public.workflow_checklist_items (completed_by);
create index if not exists workflow_events_actor_index on public.workflow_events (actor_id);

drop policy if exists "editorial reads submissions" on public.submissions;
drop policy if exists "authors read own submissions" on public.submissions;
create policy "authors and editorial read submissions" on public.submissions for select to authenticated using (
  private.is_editor() or (select auth.uid()) = author_user_id
);

drop policy if exists "editorial reads submission files" on public.submission_files;
drop policy if exists "authors read own submission files" on public.submission_files;
create policy "authors and editorial read submission files" on public.submission_files for select to authenticated using (
  private.is_editor() or exists (
    select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
  )
);

drop policy if exists "editorial reads workflow events" on public.workflow_events;
drop policy if exists "authors read visible workflow events" on public.workflow_events;
create policy "authors and editorial read workflow events" on public.workflow_events for select to authenticated using (
  private.is_editor() or (
    visibility = 'author' and exists (
      select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "editorial reads author requests" on public.author_requests;
drop policy if exists "authors read own requests" on public.author_requests;
create policy "authors and editorial read requests" on public.author_requests for select to authenticated using (
  private.is_editor() or (
    visible_to_author and exists (
      select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "editorial reads payments" on public.payments;
drop policy if exists "authors read own payments" on public.payments;
create policy "authors and editorial read payments" on public.payments for select to authenticated using (
  private.is_editor() or exists (
    select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
  )
);

drop policy if exists "editorial reads payment line items" on public.payment_line_items;
drop policy if exists "authors read own payment line items" on public.payment_line_items;
create policy "authors and editorial read payment line items" on public.payment_line_items for select to authenticated using (
  private.is_editor() or exists (
    select 1 from public.payments p
    join public.submissions s on s.id = p.submission_id
    where p.id = payment_id and s.author_user_id = (select auth.uid())
  )
);

drop policy if exists "editorial reads receipts" on public.receipts;
drop policy if exists "authors read own receipts" on public.receipts;
create policy "authors and editorial read receipts" on public.receipts for select to authenticated using (
  private.is_editor() or exists (
    select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
  )
);

drop policy if exists "editorial reads publication records" on public.publication_records;
drop policy if exists "authors read own publication records" on public.publication_records;
create policy "authors and editorial read publication records" on public.publication_records for select to authenticated using (
  private.is_editor() or exists (
    select 1 from public.submissions s where s.id = submission_id and s.author_user_id = (select auth.uid())
  )
);

drop policy if exists "editorial reads notifications" on public.notifications;
drop policy if exists "authors read own notifications" on public.notifications;
create policy "authors and editorial read notifications" on public.notifications for select to authenticated using (
  private.is_editor() or (select auth.uid()) = recipient_user_id
);

commit;
