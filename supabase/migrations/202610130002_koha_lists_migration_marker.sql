alter table public.profiles
  add column if not exists koha_lists_migrated_at timestamptz;
