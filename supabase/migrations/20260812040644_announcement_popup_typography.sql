begin;

alter table public.announcements
  add column if not exists title_font_size integer not null default 48,
  add column if not exists description_font_size integer not null default 18;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_title_font_size_range'
  ) then
    alter table public.announcements
      add constraint announcements_title_font_size_range
      check (title_font_size between 28 and 72);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_description_font_size_range'
  ) then
    alter table public.announcements
      add constraint announcements_description_font_size_range
      check (description_font_size between 14 and 28);
  end if;
end
$$;

commit;
