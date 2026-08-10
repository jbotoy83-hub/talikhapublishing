begin;

alter table public.profiles
  add column if not exists headline text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists location text not null default '',
  add column if not exists website text not null default '',
  add column if not exists pronouns text not null default '',
  add column if not exists avatar_url text,
  add column if not exists cover_url text;

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) between 2 and 80),
  add constraint profiles_headline_length check (char_length(headline) <= 80),
  add constraint profiles_bio_length check (char_length(bio) <= 300),
  add constraint profiles_location_length check (char_length(location) <= 80),
  add constraint profiles_website_length check (char_length(website) <= 160),
  add constraint profiles_pronouns_length check (char_length(pronouns) <= 30),
  add constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 1000),
  add constraint profiles_cover_url_length check (cover_url is null or char_length(cover_url) <= 1000);

commit;
