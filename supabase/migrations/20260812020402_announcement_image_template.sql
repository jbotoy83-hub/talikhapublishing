begin;

alter table public.announcements
  add column if not exists image_url text,
  add column if not exists image_alt text not null default '',
  add column if not exists layout text not null default 'image-led';

-- PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`. Use guarded
-- catalog checks so a partially-applied migration can be safely resumed.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_image_url_length'
  ) then
    alter table public.announcements
      add constraint announcements_image_url_length
      check (image_url is null or char_length(image_url) <= 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_image_alt_length'
  ) then
    alter table public.announcements
      add constraint announcements_image_alt_length
      check (char_length(image_alt) <= 160);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname = 'announcements_layout_check'
  ) then
    alter table public.announcements
      add constraint announcements_layout_check
      check (layout in ('image-led', 'split'));
  end if;
end
$$;

commit;
