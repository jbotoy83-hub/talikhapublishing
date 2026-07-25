begin;

-- Public image URLs remain readable through the public editorial-media bucket.
-- The asset catalogue itself contains storage paths, original filenames, and
-- editor identifiers, so only authenticated editors should enumerate it.
drop policy if exists "public reads editorial media" on public.media_assets;
drop policy if exists "public reads media placements" on public.media_placements;

revoke select on public.media_assets from anon;
revoke select on public.media_placements from anon;

commit;
