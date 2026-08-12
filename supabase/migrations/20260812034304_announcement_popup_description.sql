begin;

alter table public.announcements
  add column if not exists popup_description text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_popup_description_length'
  ) then
    alter table public.announcements
      add constraint announcements_popup_description_length
      check (char_length(popup_description) <= 500);
  end if;
end
$$;

commit;
