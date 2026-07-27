-- A proof, method, and reference are the author-provided evidence. The
-- administrator's explicit confirmation is the payment decision; a fee quote
-- may be added later and must not block editorial review.
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
  if v_role <> 'admin' then raise exception 'Only an administrator can confirm a payment'; end if;

  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into v_payment from public.payments where id = p_payment_id and submission_id = p_submission_id for update;
  if not found then raise exception 'Payment record not found for this submission'; end if;

  if v_payment.status <> 'confirmed' then
    if v_payment.status not in ('pending', 'awaiting_match') then raise exception 'This payment cannot be confirmed from its current state'; end if;
    if coalesce(trim(v_payment.payment_reference), '') = '' or coalesce(trim(v_payment.provider), '') = '' then
      raise exception 'A payment method and reference are required before confirmation';
    end if;
    update public.payments set status = 'confirmed', confirmed_at = now(), confirmed_by = p_actor_id
    where id = v_payment.id returning * into v_payment;
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
