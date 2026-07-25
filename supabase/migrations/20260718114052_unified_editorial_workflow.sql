begin;

-- A submission remains the single source record throughout review, production,
-- scheduling, and publication. The scheduled step is explicit: no transition
-- can publish an article immediately from the production dashboard.
do $$
begin
  create type public.workflow_stage as enum (
    'review_new',
    'review_in_progress',
    'review_final',
    'review_accepted',
    'production_ready',
    'production_preparation',
    'production_proof',
    'production_records',
    'production_ready_to_publish',
    'production_scheduled',
    'published',
    'closed'
  );
exception when duplicate_object then null;
end;
$$;

alter table public.submissions
  add column if not exists current_stage public.workflow_stage,
  add column if not exists tracking_number text,
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

update public.submissions
set current_stage = case status
  when 'submitted' then 'review_new'::public.workflow_stage
  when 'screening' then 'review_in_progress'::public.workflow_stage
  when 'under_review' then 'review_final'::public.workflow_stage
  when 'revision_requested' then 'review_in_progress'::public.workflow_stage
  when 'accepted' then 'review_accepted'::public.workflow_stage
  when 'archived' then 'closed'::public.workflow_stage
  when 'declined' then 'closed'::public.workflow_stage
  when 'withdrawn' then 'closed'::public.workflow_stage
  else 'review_new'::public.workflow_stage
end
where current_stage is null;

update public.submissions
set tracking_number = concat('TAL-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
where tracking_number is null;

alter table public.submissions
  alter column current_stage set default 'review_new',
  alter column current_stage set not null,
  alter column tracking_number set not null;

create unique index if not exists submissions_tracking_number_key on public.submissions (tracking_number);
create index if not exists submissions_current_stage_index on public.submissions (current_stage, created_at desc);
create index if not exists submissions_author_user_index on public.submissions (author_user_id);

alter table public.submission_files drop constraint if exists submission_files_file_kind_check;
alter table public.submission_files add constraint submission_files_file_kind_check check (
  file_kind in (
    'manuscript', 'authorPhoto', 'paymentProof', 'revision', 'contract', 'other',
    'production_manuscript', 'author_proof', 'editorial_comment', 'final_pdf',
    'receipt', 'author_certificate', 'publication_certificate'
  )
);
alter table public.submission_files
  add column if not exists storage_bucket text not null default 'submission-files';
alter table public.submission_files drop constraint if exists submission_files_storage_bucket_check;
alter table public.submission_files add constraint submission_files_storage_bucket_check check (
  storage_bucket in ('submission-files', 'submission-proofs', 'receipts', 'certificates')
);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) between 1 and 100),
  from_stage public.workflow_stage,
  to_stage public.workflow_stage,
  internal_title text not null default '',
  internal_description text not null default '',
  public_title text,
  public_description text,
  visibility text not null default 'internal' check (visibility in ('internal', 'author')),
  actor_type text not null check (actor_type in ('admin', 'editor', 'author', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_checklist_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  stage public.workflow_stage not null,
  item_key text not null,
  title text not null,
  required boolean not null default true,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id, stage, item_key)
);

create table if not exists public.author_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  workflow_event_id uuid references public.workflow_events(id) on delete set null,
  request_type text not null check (request_type in ('revision', 'proof_approval', 'information', 'consent', 'other')),
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('draft', 'open', 'responded', 'completed', 'cancelled')),
  visible_to_author boolean not null default true,
  due_at timestamptz,
  response text,
  response_choice text check (response_choice in ('yes', 'no') or response_choice is null),
  responded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  payment_reference text,
  provider text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PHP' check (char_length(currency) = 3),
  status text not null default 'pending' check (status in ('pending', 'awaiting_match', 'confirmed', 'refunded', 'void')),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_line_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  item_code text not null check (item_code in ('processing_fee', 'tax', 'promo_discount', 'custom_discount')),
  description text not null check (char_length(trim(description)) between 1 and 240),
  amount numeric(12, 2) not null check (amount between -50000 and 50000),
  created_at timestamptz not null default now(),
  unique (payment_id, position)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  receipt_number text not null unique,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PHP' check (char_length(currency) = 3),
  storage_bucket text not null default 'receipts',
  storage_path text,
  snapshot jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.publication_records (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete restrict,
  publication_id uuid unique references public.publications(id) on delete set null,
  journal_id uuid references public.journals(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  scheduled_for timestamptz,
  scheduled_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  public_article_url text,
  doi text,
  citation_data jsonb not null default '{}'::jsonb,
  final_pdf_file_id uuid references public.submission_files(id) on delete set null,
  certificate_file_id uuid references public.submission_files(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  recipient_type text not null check (recipient_type in ('author', 'editor', 'admin', 'system')),
  channel text not null default 'email' check (channel in ('email', 'in_app')),
  template_key text not null,
  title text not null,
  body text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'read')),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_events_submission_index on public.workflow_events (submission_id, created_at desc);
create index if not exists workflow_events_author_visibility_index on public.workflow_events (submission_id, visibility, created_at desc);
create index if not exists workflow_checklist_submission_stage_index on public.workflow_checklist_items (submission_id, stage, required, completed_at);
create index if not exists author_requests_submission_index on public.author_requests (submission_id, status, due_at);
create index if not exists payments_submission_index on public.payments (submission_id, status, created_at desc);
create index if not exists payment_line_items_payment_index on public.payment_line_items (payment_id, position);
create index if not exists receipts_submission_index on public.receipts (submission_id, issued_at desc);
create index if not exists publication_records_schedule_index on public.publication_records (scheduled_for) where scheduled_for is not null and published_at is null;
create index if not exists notifications_submission_index on public.notifications (submission_id, created_at desc);

create trigger author_requests_updated_at before update on public.author_requests for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger publication_records_updated_at before update on public.publication_records for each row execute function public.set_updated_at();

create or replace function private.prevent_workflow_event_mutation()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  raise exception 'workflow events are immutable';
end;
$$;

revoke all on function private.prevent_workflow_event_mutation() from public, anon, authenticated;

drop trigger if exists workflow_events_immutable on public.workflow_events;
create trigger workflow_events_immutable
before update or delete on public.workflow_events
for each row execute function private.prevent_workflow_event_mutation();

create or replace function private.seed_submission_workflow(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  insert into public.workflow_checklist_items (submission_id, stage, item_key, title, required)
  values
    (p_submission_id, 'review_final', 'editorial_review_complete', 'Editorial review is complete', true),
    (p_submission_id, 'review_accepted', 'decision_recorded', 'Acceptance decision is recorded', true),
    (p_submission_id, 'production_preparation', 'production_editor_assigned', 'Production editor is assigned', true),
    (p_submission_id, 'production_proof', 'production_manuscript_uploaded', 'Publication-ready manuscript is attached', true),
    (p_submission_id, 'production_proof', 'proof_approved', 'Author proof is approved or waived', true),
    (p_submission_id, 'production_records', 'publication_record_complete', 'Publication record and issue assignment are complete', true),
    (p_submission_id, 'production_ready_to_publish', 'metadata_complete', 'Publication metadata and citation are complete', true),
    (p_submission_id, 'production_ready_to_publish', 'final_pdf_attached', 'Final publication PDF is attached', true),
    (p_submission_id, 'production_scheduled', 'publication_schedule_confirmed', 'Publication schedule is confirmed', true)
  on conflict (submission_id, stage, item_key) do nothing;
end;
$$;

revoke all on function private.seed_submission_workflow(uuid) from public, anon, authenticated;

select private.seed_submission_workflow(id) from public.submissions;

create or replace function private.seed_submission_workflow_on_insert()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  perform private.seed_submission_workflow(new.id);
  return new;
end;
$$;

revoke all on function private.seed_submission_workflow_on_insert() from public, anon, authenticated;
drop trigger if exists submissions_seed_workflow on public.submissions;
create trigger submissions_seed_workflow after insert on public.submissions
for each row execute function private.seed_submission_workflow_on_insert();

create or replace function private.create_official_receipt()
returns trigger language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_receipt_number text;
  v_submission public.submissions;
  v_line_items jsonb;
begin
  if new.status <> 'confirmed' or new.confirmed_at is null then
    return new;
  end if;

  select receipt_number into v_receipt_number from public.receipts where payment_id = new.id;
  if v_receipt_number is not null then
    return new;
  end if;

  v_receipt_number := concat('TAL-REC-', to_char(now(), 'YYYYMMDD'), '-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
  select * into v_submission from public.submissions where id = new.submission_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', item_code,
    'description', description,
    'amount', amount
  ) order by position), '[]'::jsonb)
  into v_line_items
  from public.payment_line_items
  where payment_id = new.id;

  insert into public.receipts (submission_id, payment_id, receipt_number, amount, currency, snapshot)
  values (
    new.submission_id,
    new.id,
    v_receipt_number,
    new.amount,
    new.currency,
    jsonb_build_object(
      'version', 1,
      'receipt_number', v_receipt_number,
      'payment_reference', new.payment_reference,
      'provider', new.provider,
      'submission_reference', v_submission.reference,
      'manuscript_title', v_submission.title,
      'received_from', jsonb_build_object('name', v_submission.author_name, 'email', v_submission.author_email),
      'line_items', v_line_items,
      'pdf_status', 'pending'
    )
  );

  insert into public.workflow_events (
    submission_id, event_type, internal_title, internal_description, public_title, public_description,
    visibility, actor_type, actor_id, metadata
  ) values (
    new.submission_id, 'payment_confirmed', 'Payment confirmed', 'An official receipt was created automatically after payment confirmation.',
    'Payment confirmed', 'Your payment has been confirmed and an official receipt is available.',
    'author', case when new.confirmed_by is null then 'system' else 'editor' end, new.confirmed_by,
    jsonb_build_object('payment_id', new.id, 'receipt_number', v_receipt_number)
  );
  return new;
end;
$$;

revoke all on function private.create_official_receipt() from public, anon, authenticated;
drop trigger if exists payments_create_official_receipt on public.payments;
create trigger payments_create_official_receipt
after insert or update of status, confirmed_at on public.payments
for each row execute function private.create_official_receipt();

create or replace function public.transition_submission(
  p_submission_id uuid,
  p_to_stage public.workflow_stage,
  p_actor_id uuid,
  p_internal_title text default '',
  p_internal_description text default '',
  p_public_title text default null,
  p_public_description text default null,
  p_visibility text default 'internal',
  p_metadata jsonb default '{}'::jsonb
)
returns public.submissions
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_submission public.submissions;
  v_from_stage public.workflow_stage;
  v_actor_role text;
  v_scheduled_for timestamptz;
  v_publication_record public.publication_records;
  v_allowed boolean := false;
begin
  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  v_from_stage := v_submission.current_stage;

  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('admin', 'editor') then
    raise exception 'Only an authorized editor can transition a submission';
  end if;

  v_allowed := case v_submission.current_stage
    when 'review_new' then p_to_stage in ('review_in_progress', 'closed')
    when 'review_in_progress' then p_to_stage in ('review_final', 'closed')
    when 'review_final' then p_to_stage in ('review_in_progress', 'review_accepted', 'closed')
    when 'review_accepted' then p_to_stage in ('production_ready', 'closed')
    when 'production_ready' then p_to_stage in ('production_preparation', 'closed')
    when 'production_preparation' then p_to_stage in ('production_proof', 'closed')
    when 'production_proof' then p_to_stage in ('production_preparation', 'production_records', 'closed')
    when 'production_records' then p_to_stage in ('production_proof', 'production_ready_to_publish', 'closed')
    when 'production_ready_to_publish' then p_to_stage in ('production_records', 'production_scheduled', 'closed')
    when 'production_scheduled' then p_to_stage in ('published', 'production_records', 'closed')
    when 'published' then p_to_stage = 'closed'
    else false
  end;
  if not v_allowed then
    raise exception 'Transition from % to % is not allowed', v_submission.current_stage, p_to_stage;
  end if;

  if exists (
    select 1 from public.workflow_checklist_items
    where submission_id = p_submission_id
      and stage = v_from_stage
      and required
      and completed_at is null
  ) then
    raise exception 'Required checklist items for % are incomplete', p_to_stage;
  end if;

  if p_to_stage = 'production_proof' and not exists (
    select 1 from public.submission_files where submission_id = p_submission_id and file_kind = 'production_manuscript'
  ) then
    raise exception 'A publication-ready manuscript file is required before author proof';
  end if;

  if p_to_stage in ('production_ready_to_publish', 'production_scheduled', 'published') and not exists (
    select 1 from public.submission_files where submission_id = p_submission_id and file_kind = 'final_pdf'
  ) then
    raise exception 'A final PDF is required before scheduling or publishing';
  end if;

  if p_to_stage in ('production_scheduled', 'published') and not exists (
    select 1 from public.payments where submission_id = p_submission_id and status = 'confirmed'
  ) then
    raise exception 'A confirmed payment is required before scheduling or publishing';
  end if;

  select * into v_publication_record from public.publication_records where submission_id = p_submission_id for update;
  if p_to_stage in ('production_scheduled', 'published') and v_publication_record.id is null then
    raise exception 'A publication record is required before scheduling or publishing';
  end if;

  if p_to_stage in ('production_scheduled', 'published') and (
    v_publication_record.publication_id is null
    or coalesce(trim(v_publication_record.public_article_url), '') = ''
    or v_publication_record.final_pdf_file_id is null
    or v_publication_record.certificate_file_id is null
    or v_publication_record.citation_data = '{}'::jsonb
  ) then
    raise exception 'A complete public article, citation, final PDF, and publication certificate are required before scheduling';
  end if;

  if p_to_stage in ('production_scheduled', 'published') and not exists (
    select 1 from public.submission_files
    where id = v_publication_record.final_pdf_file_id
      and submission_id = p_submission_id
      and file_kind = 'final_pdf'
  ) then
    raise exception 'The selected final PDF does not belong to this submission';
  end if;

  if p_to_stage in ('production_scheduled', 'published') and not exists (
    select 1 from public.submission_files
    where id = v_publication_record.certificate_file_id
      and submission_id = p_submission_id
      and file_kind = 'publication_certificate'
  ) then
    raise exception 'The selected publication certificate does not belong to this submission';
  end if;

  if p_to_stage = 'production_scheduled' then
    v_scheduled_for := nullif(p_metadata ->> 'scheduled_for', '')::timestamptz;
    if v_scheduled_for is null or v_scheduled_for <= now() then
      raise exception 'A future publication date and time is required';
    end if;
    update public.publication_records
    set scheduled_for = v_scheduled_for, scheduled_by = p_actor_id
    where id = v_publication_record.id;
  end if;

  if p_to_stage = 'published' then
    if v_publication_record.scheduled_for is null or v_publication_record.scheduled_for > now() then
      raise exception 'This submission is not yet due for publication';
    end if;
    update public.publication_records set published_at = now() where id = v_publication_record.id;
    if v_publication_record.publication_id is not null then
      update public.publications
      set status = 'published', published_at = now(), publication_date = coalesce(publication_date, current_date)
      where id = v_publication_record.publication_id;
    end if;
    insert into public.notifications (submission_id, recipient_user_id, recipient_email, recipient_type, channel, template_key, title, body, metadata)
    values (
      p_submission_id, v_submission.author_user_id, v_submission.author_email, 'author', 'email', 'publication_published',
      'Your publication is now available', 'Your study has been published. Your final documents and publication certificate are available in your author record.',
      jsonb_build_object('publication_record_id', v_publication_record.id)
    );
  end if;

  update public.submissions
  set current_stage = p_to_stage,
      status = case
        when p_to_stage = 'review_new' then 'submitted'
        when p_to_stage in ('review_in_progress', 'review_final') then 'under_review'
        when p_to_stage = 'review_accepted' then 'accepted'
        when p_to_stage = 'closed' then 'archived'
        else status
      end
  where id = p_submission_id
  returning * into v_submission;

  insert into public.workflow_events (
    submission_id, event_type, from_stage, to_stage, internal_title, internal_description,
    public_title, public_description, visibility, actor_type, actor_id, metadata
  ) values (
    p_submission_id, 'stage_transition', v_from_stage, p_to_stage,
    coalesce(nullif(p_internal_title, ''), concat('Moved to ', replace(p_to_stage::text, '_', ' '))),
    coalesce(p_internal_description, ''), p_public_title, p_public_description,
    case when p_visibility = 'author' then 'author' else 'internal' end,
    case when v_actor_role = 'admin' then 'admin' else 'editor' end, p_actor_id, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_submission;
end;
$$;

revoke all on function public.transition_submission(uuid, public.workflow_stage, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.transition_submission(uuid, public.workflow_stage, uuid, text, text, text, text, text, jsonb) to service_role;

create or replace function public.complete_workflow_checklist_item(
  p_checklist_item_id uuid,
  p_actor_id uuid,
  p_completed boolean default true
)
returns public.workflow_checklist_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_role text;
  v_item public.workflow_checklist_items;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('admin', 'editor') then
    raise exception 'Only an authorized editor can update the checklist';
  end if;

  update public.workflow_checklist_items
  set completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then p_actor_id else null end
  where id = p_checklist_item_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'Checklist item not found';
  end if;

  insert into public.workflow_events (
    submission_id, event_type, internal_title, internal_description, visibility, actor_type, actor_id, metadata
  ) values (
    v_item.submission_id,
    case when p_completed then 'checklist_completed' else 'checklist_reopened' end,
    case when p_completed then 'Checklist item completed' else 'Checklist item reopened' end,
    v_item.title,
    'internal',
    case when v_actor_role = 'admin' then 'admin' else 'editor' end,
    p_actor_id,
    jsonb_build_object('checklist_item_id', v_item.id, 'item_key', v_item.item_key, 'stage', v_item.stage)
  );

  return v_item;
end;
$$;

revoke all on function public.complete_workflow_checklist_item(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.complete_workflow_checklist_item(uuid, uuid, boolean) to service_role;

create or replace function public.create_author_request(
  p_submission_id uuid,
  p_actor_id uuid,
  p_request_type text,
  p_title text,
  p_description text default '',
  p_due_at timestamptz default null
)
returns public.author_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_role text;
  v_request public.author_requests;
  v_event_id uuid;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('admin', 'editor') then
    raise exception 'Only an authorized editor can create an author request';
  end if;
  if p_request_type not in ('revision', 'proof_approval', 'information', 'consent', 'other') then
    raise exception 'Unsupported author request type';
  end if;
  if char_length(trim(p_title)) = 0 then
    raise exception 'An author request needs a title';
  end if;

  insert into public.author_requests (submission_id, request_type, title, description, status, visible_to_author, due_at, created_by)
  values (p_submission_id, p_request_type, trim(p_title), coalesce(p_description, ''), 'open', true, p_due_at, p_actor_id)
  returning * into v_request;

  insert into public.workflow_events (
    submission_id, event_type, internal_title, internal_description, public_title, public_description,
    visibility, actor_type, actor_id, metadata
  ) values (
    p_submission_id, 'author_request_created', 'Author action requested', v_request.title,
    v_request.title, v_request.description, 'author',
    case when v_actor_role = 'admin' then 'admin' else 'editor' end, p_actor_id,
    jsonb_build_object('author_request_id', v_request.id, 'request_type', v_request.request_type, 'due_at', v_request.due_at)
  ) returning id into v_event_id;

  update public.author_requests set workflow_event_id = v_event_id where id = v_request.id returning * into v_request;
  return v_request;
end;
$$;

revoke all on function public.create_author_request(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_author_request(uuid, uuid, text, text, text, timestamptz) to service_role;

-- This function is intentionally service-role only. The public tracking route
-- verifies the submission's tracking/receipt number and corresponding-author
-- email before calling it, so a browser client never receives write access to
-- author_requests or workflow_events directly.
create or replace function public.respond_to_author_request(
  p_submission_id uuid,
  p_request_id uuid,
  p_response_choice text
)
returns public.author_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_request public.author_requests;
  v_event_id uuid;
begin
  if p_response_choice not in ('yes', 'no') then
    raise exception 'Choose yes or no';
  end if;

  select * into v_request
  from public.author_requests
  where id = p_request_id
    and submission_id = p_submission_id
    and visible_to_author = true
  for update;

  if not found then
    raise exception 'Author request not found';
  end if;
  if v_request.status <> 'open' then
    raise exception 'This author request has already been answered or closed';
  end if;

  update public.author_requests
  set status = 'responded',
      response_choice = p_response_choice,
      response = case when p_response_choice = 'yes' then 'Approved by author' else 'Declined by author' end,
      responded_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.workflow_events (
    submission_id, event_type, internal_title, internal_description,
    public_title, public_description, visibility, actor_type, metadata
  ) values (
    p_submission_id,
    'author_request_responded',
    case when p_response_choice = 'yes' then 'Author approved request' else 'Author declined request' end,
    concat('Response to: ', v_request.title),
    'Response received',
    'Your response has been recorded.',
    'author',
    'author',
    jsonb_build_object('author_request_id', v_request.id, 'response_choice', p_response_choice)
  ) returning id into v_event_id;

  update public.author_requests
  set workflow_event_id = coalesce(workflow_event_id, v_event_id)
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_to_author_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.respond_to_author_request(uuid, uuid, text) to service_role;

create or replace function public.configure_submission_payment(
  p_submission_id uuid,
  p_payment_id uuid default null,
  p_actor_id uuid default null,
  p_provider text default null,
  p_payment_reference text default null,
  p_currency text default 'PHP',
  p_lines jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_role text;
  v_payment public.payments;
  v_line jsonb;
  v_item_code text;
  v_description text;
  v_amount numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_position integer := 0;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('admin', 'editor') then
    raise exception 'Only an authorized editor can configure a payment';
  end if;
  if not exists (select 1 from public.submissions where id = p_submission_id) then
    raise exception 'Submission not found';
  end if;
  if coalesce(trim(p_currency), '') !~ '^[A-Z]{3}$' then
    raise exception 'A three-letter currency code is required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 20 then
    raise exception 'A payment needs between one and twenty line items';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_position := v_position + 1;
    v_item_code := trim(coalesce(v_line ->> 'code', ''));
    v_description := trim(coalesce(v_line ->> 'description', ''));
    v_amount := round((v_line ->> 'amount')::numeric, 2);
    if v_item_code not in ('processing_fee', 'tax', 'promo_discount', 'custom_discount') then
      raise exception 'Unsupported payment line item';
    end if;
    if char_length(v_description) = 0 or char_length(v_description) > 240 then
      raise exception 'Each payment line needs a description';
    end if;
    if v_amount is null or v_amount < -50000 or v_amount > 50000 then
      raise exception 'A payment line amount is outside the allowed range';
    end if;
    if v_item_code in ('processing_fee', 'tax') and v_amount < 0 then
      raise exception 'Fees and tax cannot be negative';
    end if;
    if v_item_code in ('promo_discount', 'custom_discount') and v_amount > 0 then
      raise exception 'Discounts must reduce the total';
    end if;
    v_total := v_total + v_amount;
  end loop;
  if v_total < 0 then
    raise exception 'The payment total cannot be negative';
  end if;

  if p_payment_id is not null then
    select * into v_payment from public.payments
    where id = p_payment_id and submission_id = p_submission_id
    for update;
    if not found then
      raise exception 'Payment record not found';
    end if;
  else
    select * into v_payment from public.payments
    where submission_id = p_submission_id and status in ('pending', 'awaiting_match')
    order by created_at desc
    limit 1
    for update;
  end if;

  if found then
    if v_payment.status = 'confirmed' then
      raise exception 'A confirmed payment cannot be changed; issue a correction record instead';
    end if;
    update public.payments
    set provider = nullif(trim(coalesce(p_provider, '')), ''),
        payment_reference = nullif(trim(coalesce(p_payment_reference, '')), ''),
        amount = v_total,
        currency = upper(trim(p_currency)),
        metadata = coalesce(p_metadata, '{}'::jsonb)
    where id = v_payment.id
    returning * into v_payment;
  else
    insert into public.payments (submission_id, provider, payment_reference, amount, currency, status, metadata)
    values (
      p_submission_id,
      nullif(trim(coalesce(p_provider, '')), ''),
      nullif(trim(coalesce(p_payment_reference, '')), ''),
      v_total,
      upper(trim(p_currency)),
      'pending',
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_payment;
  end if;

  delete from public.payment_line_items where payment_id = v_payment.id;
  insert into public.payment_line_items (payment_id, position, item_code, description, amount)
  select
    v_payment.id,
    ordinal::smallint,
    trim(value ->> 'code'),
    trim(value ->> 'description'),
    round((value ->> 'amount')::numeric, 2)
  from jsonb_array_elements(p_lines) with ordinality as item(value, ordinal);

  insert into public.workflow_events (
    submission_id, event_type, internal_title, internal_description, visibility, actor_type, actor_id, metadata
  ) values (
    p_submission_id,
    'payment_quote_updated',
    'Payment quote updated',
    'The publication fee breakdown was updated before payment confirmation.',
    'internal',
    case when v_actor_role = 'admin' then 'admin' else 'editor' end,
    p_actor_id,
    jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount, 'currency', v_payment.currency, 'line_count', jsonb_array_length(p_lines))
  );

  return v_payment;
end;
$$;

revoke all on function public.configure_submission_payment(uuid, uuid, uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.configure_submission_payment(uuid, uuid, uuid, text, text, text, jsonb, jsonb) to service_role;

create or replace function public.confirm_submission_payment(
  p_payment_id uuid,
  p_actor_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_role text;
  v_payment public.payments;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('admin', 'editor') then
    raise exception 'Only an authorized editor can confirm a payment';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment record not found';
  end if;
  if v_payment.status = 'confirmed' then
    return v_payment;
  end if;
  if v_payment.status not in ('pending', 'awaiting_match') then
    raise exception 'This payment cannot be confirmed from its current state';
  end if;
  if v_payment.amount <= 0 then
    raise exception 'A positive payment amount is required before confirmation';
  end if;
  if coalesce(trim(v_payment.payment_reference), '') = '' then
    raise exception 'A payment reference is required before confirmation';
  end if;
  if not exists (select 1 from public.payment_line_items where payment_id = v_payment.id) then
    raise exception 'A payment breakdown is required before confirmation';
  end if;

  update public.payments
  set status = 'confirmed', confirmed_at = now(), confirmed_by = p_actor_id
  where id = v_payment.id
  returning * into v_payment;
  return v_payment;
end;
$$;

revoke all on function public.confirm_submission_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_submission_payment(uuid, uuid) to service_role;

commit;
