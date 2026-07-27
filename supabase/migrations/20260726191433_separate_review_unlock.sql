-- Payment confirmation is intentionally separate from opening editorial review.
-- The editor must explicitly choose Start review before submission contents unlock.
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
    update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = p_actor_id
    where id = v_payment.id
    returning * into v_payment;
  end if;

  return v_payment;
end;
$$;
