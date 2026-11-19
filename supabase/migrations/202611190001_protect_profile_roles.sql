-- Prerequisite for trusting profiles.role in librarian-only APIs.
-- Preserve normal profile editing and privileged role administration.
begin;

create function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and current_user not in ('postgres', 'supabase_admin', 'service_role')
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only a privileged administrator can change account roles.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role_before_update
before update of role on public.profiles
for each row execute function public.protect_profile_role();

commit;
