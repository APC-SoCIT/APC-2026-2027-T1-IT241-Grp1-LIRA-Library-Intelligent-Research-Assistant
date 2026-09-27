alter table public.profiles
  add column first_name text,
  add column middle_initial text,
  add column last_name text,
  add column suffix text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    first_name,
    middle_initial,
    last_name,
    suffix,
    school
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_initial', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'suffix', ''),
    coalesce(new.raw_user_meta_data ->> 'school', '')
  );
  return new;
end;
$$;
