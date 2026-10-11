alter table public.profiles
  add column if not exists role text not null default 'student';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'librarian'));

create index if not exists profiles_role_idx on public.profiles (role);
