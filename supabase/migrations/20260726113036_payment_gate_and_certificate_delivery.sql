-- Payment verification is the only entry point into editorial review.
-- The trigger protects the rule even when a caller bypasses the browser UI.
create or replace function private.prevent_unpaid_review_start()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.current_stage = 'review_new'
     and new.current_stage = 'review_in_progress'
     and not exists (
       select 1 from public.payments
       where submission_id = new.id and status = 'confirmed'
     ) then
    raise exception 'A confirmed payment is required before editorial review can begin';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_unpaid_review_start() from public, anon, authenticated;
drop trigger if exists submissions_require_payment_before_review on public.submissions;
create trigger submissions_require_payment_before_review
before update of current_stage on public.submissions
for each row execute function private.prevent_unpaid_review_start();

create or replace function public.confirm_payment_and_start_review(
  p_submission_id uuid,
  p_payment_id uuid,
  p_actor_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_payment public.payments;
  v_submission public.submissions;
begin
  select role into v_role from public.profiles where id = p_actor_id;
  if v_role <> 'admin' then
    raise exception 'Only an administrator can confirm a payment';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;

  select * into v_payment from public.payments
  where id = p_payment_id and submission_id = p_submission_id for update;
  if not found then raise exception 'Payment record not found for this submission'; end if;

  if v_payment.status <> 'confirmed' then
    if v_payment.status not in ('pending', 'awaiting_match') then
      raise exception 'This payment cannot be confirmed from its current state';
    end if;
    if v_payment.amount <= 0 then raise exception 'A positive payment amount is required before confirmation'; end if;
    if coalesce(trim(v_payment.payment_reference), '') = '' then raise exception 'A payment reference is required before confirmation'; end if;
    if not exists (select 1 from public.payment_line_items where payment_id = v_payment.id) then
      raise exception 'A payment breakdown is required before confirmation';
    end if;
    update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = p_actor_id
    where id = v_payment.id
    returning * into v_payment;
  end if;

  if v_submission.current_stage = 'review_new' then
    update public.submissions set current_stage = 'review_in_progress' where id = v_submission.id;
    insert into public.workflow_events (
      submission_id, event_type, from_stage, to_stage, internal_title, internal_description,
      public_title, public_description, visibility, actor_type, actor_id, metadata
    ) values (
      v_submission.id, 'payment_approved_review_opened', 'review_new', 'review_in_progress',
      'Payment approved and review opened', 'Payment was confirmed and the manuscript entered editorial review.',
      'Payment approved — In review', 'Your payment has been verified and your manuscript is now in editorial review.',
      'author', 'admin', p_actor_id, jsonb_build_object('payment_id', v_payment.id)
    );
  end if;
  return v_payment;
end;
$$;

revoke all on function public.confirm_payment_and_start_review(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_payment_and_start_review(uuid, uuid, uuid) to service_role;

alter table public.submission_files drop constraint if exists submission_files_file_kind_check;
alter table public.submission_files add constraint submission_files_file_kind_check check (
  file_kind in (
    'manuscript', 'authorPhoto', 'paymentProof', 'revision', 'contract', 'other',
    'production_manuscript', 'author_proof', 'editorial_comment', 'final_pdf',
    'receipt', 'author_certificate', 'publication_certificate', 'certificate_preview'
  )
);
