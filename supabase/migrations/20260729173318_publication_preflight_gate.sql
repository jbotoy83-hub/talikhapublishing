alter table public.submission_files
  add column if not exists sha256 text,
  add column if not exists version_number integer not null default 1 check (version_number > 0),
  add column if not exists supersedes_file_id uuid references public.submission_files(id) on delete set null,
  add column if not exists validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'invalid')),
  add column if not exists validated_at timestamptz,
  add column if not exists validation_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists submission_files_submission_kind_version_idx
  on public.submission_files(submission_id, file_kind, version_number);
create index if not exists submission_files_sha256_idx on public.submission_files(sha256);
create index if not exists submission_files_supersedes_idx on public.submission_files(supersedes_file_id);

alter table public.submission_files drop constraint if exists submission_files_file_kind_check;
alter table public.submission_files add constraint submission_files_file_kind_check check (
  file_kind in (
    'manuscript', 'authorPhoto', 'paymentProof', 'revision', 'contract', 'other',
    'production_manuscript', 'author_proof', 'editorial_comment', 'final_pdf',
    'receipt', 'author_certificate', 'publication_certificate', 'certificate_preview',
    'peer_review', 'social_media_artwork'
  )
);

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
where id = 'certificates';

create table if not exists public.publication_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  publication_record_id uuid not null references public.publication_records(id) on delete cascade,
  ruleset_version text not null,
  source_fingerprint text not null,
  status text not null default 'in_review'
    check (status in ('not_started', 'in_review', 'blocked', 'ready', 'submitted', 'stale')),
  automatic_blocker_count integer not null default 0 check (automatic_blocker_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  source_snapshot jsonb not null default '{}'::jsonb,
  final_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  submitted_at timestamptz,
  invalidated_at timestamptz
);

create table if not exists public.publication_preflight_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.publication_preflight_runs(id) on delete cascade,
  check_key text not null,
  check_group text not null,
  title text not null,
  mode text not null check (mode in ('automatic', 'manual', 'calculated')),
  blocking boolean not null default true,
  status text not null default 'not_reviewed'
    check (status in ('not_reviewed', 'pass', 'confirmed', 'warning', 'fail')),
  expected_summary text,
  observed_summary text,
  evidence jsonb not null default '{}'::jsonb,
  blocker jsonb,
  issue_note text,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, check_key)
);

create index if not exists publication_preflight_runs_submission_idx
  on public.publication_preflight_runs(submission_id, created_at desc);
create index if not exists publication_preflight_runs_publication_idx
  on public.publication_preflight_runs(publication_record_id, created_at desc);
create index if not exists publication_preflight_checks_run_group_idx
  on public.publication_preflight_checks(run_id, check_group);

alter table public.publication_records
  add column if not exists social_media_file_id uuid references public.submission_files(id) on delete set null,
  add column if not exists latest_preflight_run_id uuid references public.publication_preflight_runs(id) on delete set null,
  add column if not exists submitted_preflight_run_id uuid references public.publication_preflight_runs(id) on delete restrict,
  add column if not exists approved_preflight_run_id uuid references public.publication_preflight_runs(id) on delete restrict,
  add column if not exists doi_registration_status text not null default 'assigned'
    check (doi_registration_status in ('assigned', 'reserved', 'registered'));

alter table public.publication_preflight_runs enable row level security;
alter table public.publication_preflight_checks enable row level security;

revoke all on public.publication_preflight_runs from anon, authenticated;
revoke all on public.publication_preflight_checks from anon, authenticated;
grant select on public.publication_preflight_runs to authenticated;
grant select on public.publication_preflight_checks to authenticated;
grant all on public.publication_preflight_runs to service_role;
grant all on public.publication_preflight_checks to service_role;

create policy "editorial reads publication preflight runs"
  on public.publication_preflight_runs for select to authenticated
  using ((select private.is_editor()));
create policy "editorial reads publication preflight checks"
  on public.publication_preflight_checks for select to authenticated
  using ((select private.is_editor()));

create or replace function private.protect_submitted_preflight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status = 'submitted' then
    raise exception 'Submitted preflight evidence is immutable';
  end if;
  if old.status = 'submitted' and (
    new.status <> 'stale'
    or new.id <> old.id
    or new.submission_id <> old.submission_id
    or new.publication_record_id <> old.publication_record_id
    or new.ruleset_version <> old.ruleset_version
    or new.source_fingerprint <> old.source_fingerprint
    or new.source_snapshot <> old.source_snapshot
    or new.final_snapshot <> old.final_snapshot
    or new.created_by is distinct from old.created_by
    or new.submitted_by is distinct from old.submitted_by
    or new.created_at <> old.created_at
    or new.completed_at is distinct from old.completed_at
    or new.submitted_at is distinct from old.submitted_at
  ) then
    raise exception 'Submitted preflight evidence is immutable';
  end if;
  return new;
end;
$$;

create or replace function private.protect_submitted_preflight_check()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.publication_preflight_runs
    where id = old.run_id and status = 'submitted'
  ) then
    raise exception 'Checks in a submitted preflight run are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_submitted_preflight on public.publication_preflight_runs;
create trigger protect_submitted_preflight
before update or delete on public.publication_preflight_runs
for each row execute function private.protect_submitted_preflight();

drop trigger if exists protect_submitted_preflight_check on public.publication_preflight_checks;
create trigger protect_submitted_preflight_check
before update or delete on public.publication_preflight_checks
for each row execute function private.protect_submitted_preflight_check();

create or replace function public.admin_transition_publication(
  p_submission_id uuid,
  p_to_stage public.workflow_stage,
  p_actor_id uuid,
  p_reason text default '',
  p_scheduled_for timestamptz default null,
  p_preflight_run_id uuid default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_role text;
  v_record public.publication_records%rowtype;
  v_run public.publication_preflight_runs%rowtype;
begin
  select role into v_role from public.profiles where id = p_actor_id;
  if coalesce(v_role, '') <> 'admin' then
    raise exception 'Only an administrator may return, schedule, reschedule, or publish a production record';
  end if;

  if p_to_stage not in ('production_records', 'production_scheduled', 'published') then
    raise exception 'Unsupported administrator publication action';
  end if;

  select * into v_record from public.publication_records where submission_id = p_submission_id for update;

  if p_to_stage in ('production_scheduled', 'published') then
    if v_record.submitted_preflight_run_id is null then
      raise exception 'A submitted publication preflight is required';
    end if;
    select * into v_run from public.publication_preflight_runs where id = v_record.submitted_preflight_run_id;
    if v_run.status <> 'submitted' or v_run.invalidated_at is not null
      or (p_preflight_run_id is not null and v_run.id <> p_preflight_run_id) then
      raise exception 'The submitted publication preflight is stale';
    end if;
    if p_to_stage = 'published' and v_record.doi_registration_status <> 'registered' then
      raise exception 'The DOI must be registered before publication';
    end if;
  end if;

  return public.transition_submission(
    p_submission_id,
    p_to_stage,
    p_actor_id,
    case when p_to_stage = 'production_records' then 'Returned to production' else '' end,
    coalesce(p_reason, ''),
    null,
    null,
    'internal',
    jsonb_strip_nulls(jsonb_build_object(
      'scheduled_for', p_scheduled_for,
      'preflight_run_id', coalesce(p_preflight_run_id, v_record.submitted_preflight_run_id)
    ))
  );
end;
$$;

revoke all on function public.admin_transition_publication(uuid, public.workflow_stage, uuid, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_transition_publication(uuid, public.workflow_stage, uuid, text, timestamptz, uuid)
  to service_role;
