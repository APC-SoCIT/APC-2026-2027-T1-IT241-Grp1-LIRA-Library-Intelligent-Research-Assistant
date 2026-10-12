alter table public.profiles
  add column koha_patron_id bigint;

alter table public.profiles
  add constraint profiles_koha_patron_id_positive
  check (koha_patron_id is null or koha_patron_id > 0);
