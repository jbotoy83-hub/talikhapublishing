-- Certificate import data is sourced from the approved publication workflow.
-- Keep the counter in the private schema; only server-side service-role calls
-- may allocate official certificate numbers.

alter table public.journals
  add column if not exists issn_online text,
  add column if not exists issn_print text;

update public.journals
set issn_online = coalesce(nullif(issn_online, ''), nullif(issn, ''))
where coalesce(nullif(issn_online, ''), '') = '';

create table if not exists private.certificate_number_counters (
  year integer primary key check (year between 2000 and 9999),
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.allocate_certificate_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value bigint;
begin
  if p_year < 2000 or p_year > 9999 then
    raise exception 'Certificate year is invalid';
  end if;

  insert into private.certificate_number_counters as counter (year, last_value)
  values (p_year, 1)
  on conflict (year) do update
  set last_value = counter.last_value + 1,
      updated_at = now()
  returning last_value into v_value;

  return format('TLK-REV-%s-%s', p_year, lpad(v_value::text, 6, '0'));
end;
$$;

revoke all on function public.allocate_certificate_number(integer) from public, anon, authenticated;
grant execute on function public.allocate_certificate_number(integer) to service_role;

do $$
declare
  general_id uuid;
begin
  select id into general_id
  from public.certificate_templates
  where is_default = true
  order by created_at
  limit 1;

  if general_id is not null then
    insert into public.certificate_template_fields (template_id, field_key, label, field_type, required, source_key, section)
    values (general_id, 'author_role', 'Role or occupation', 'text', false, 'submission_author.position_title', 'author')
    on conflict (template_id, field_key) do update
    set label = excluded.label,
        source_key = excluded.source_key,
        section = excluded.section;
  end if;
end;
$$;
