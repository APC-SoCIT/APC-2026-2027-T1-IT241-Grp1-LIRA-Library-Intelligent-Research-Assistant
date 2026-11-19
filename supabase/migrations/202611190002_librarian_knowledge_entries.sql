-- Staff-maintained FAQs and policies only. Publication and student access are separate future work.
begin;

create table public.librarian_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('faq', 'policy')),
  category text not null check (category in ('hours', 'services', 'rules', 'contact')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  source_url text check (source_url is null or (char_length(source_url) <= 2000 and source_url ~* '^https?://')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index librarian_knowledge_entries_updated_idx
  on public.librarian_knowledge_entries (updated_at desc, id);

create function public.touch_librarian_knowledge_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger touch_librarian_knowledge_entry_before_update
before update on public.librarian_knowledge_entries
for each row execute function public.touch_librarian_knowledge_entry();

-- All browser clients, including librarians, must use the guarded Nest API.
-- There are deliberately no anon/authenticated policies or direct table privileges.
alter table public.librarian_knowledge_entries enable row level security;
revoke all on public.librarian_knowledge_entries from public, anon, authenticated;
grant select, insert, update on public.librarian_knowledge_entries to service_role;

commit;
