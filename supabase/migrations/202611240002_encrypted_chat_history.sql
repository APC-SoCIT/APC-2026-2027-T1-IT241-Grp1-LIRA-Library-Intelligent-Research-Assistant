begin;

create table public.chat_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_history boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_title text not null,
  title_iv text not null,
  title_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year'),
  unique (id, user_id),
  check (char_length(encrypted_title) <= 8192),
  check (char_length(title_iv) = 16),
  check (char_length(title_tag) = 24)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  encrypted_payload text not null,
  payload_iv text not null,
  payload_tag text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.chat_sessions (id, user_id) on delete cascade,
  check (char_length(encrypted_payload) <= 65536),
  check (char_length(payload_iv) = 16),
  check (char_length(payload_tag) = 24)
);

create index chat_sessions_owner_updated_idx
  on public.chat_sessions (user_id, updated_at desc);
create index chat_sessions_expiry_idx
  on public.chat_sessions (expires_at);
create index chat_messages_owner_session_created_idx
  on public.chat_messages (user_id, session_id, created_at);

create function public.touch_chat_session_after_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_sessions
  set updated_at = clock_timestamp()
  where id = new.session_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger touch_chat_session_after_message
after insert on public.chat_messages
for each row execute function public.touch_chat_session_after_message();

alter table public.chat_preferences enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_preferences, public.chat_sessions, public.chat_messages from public, anon, authenticated;
grant select, insert, update, delete on public.chat_preferences, public.chat_sessions, public.chat_messages to service_role;

create extension if not exists pg_cron;
select cron.schedule(
  'lira-purge-expired-chat-history',
  '17 3 * * *',
  $job$delete from public.chat_sessions where expires_at <= clock_timestamp();$job$
);

commit;
