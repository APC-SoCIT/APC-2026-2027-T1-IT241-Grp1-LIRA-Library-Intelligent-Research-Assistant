begin;

create table public.book_summaries (
  id uuid primary key default gen_random_uuid(),
  book_id bigint not null check (book_id > 0),
  resource_id text not null check (resource_id ~ '^[a-f0-9]{64}$'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  book_title text not null check (char_length(book_title) between 1 and 500),
  source_language text not null default 'und',
  summary text,
  status text not null default 'generating'
    check (status in ('generating', 'pending_review', 'approved', 'rejected', 'failed')),
  generation_token uuid not null default gen_random_uuid(),
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  generation_started_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, resource_id, source_hash),
  check (summary is null or char_length(summary) <= 30000),
  check (reviewer_note is null or char_length(reviewer_note) <= 2000)
);

create index book_summaries_book_resource_updated_idx
  on public.book_summaries (book_id, resource_id, updated_at desc);
create index book_summaries_review_queue_idx
  on public.book_summaries (status, generated_at asc)
  where status = 'pending_review';

create table public.book_summary_generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  generation_count integer not null default 0 check (generation_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.book_summaries enable row level security;
alter table public.book_summary_generation_usage enable row level security;
revoke all on public.book_summaries, public.book_summary_generation_usage from public, anon, authenticated;
grant select, insert, update, delete on public.book_summaries, public.book_summary_generation_usage to service_role;

create function public.claim_book_summary_generation(
  p_book_id bigint,
  p_resource_id text,
  p_source_hash text,
  p_book_title text,
  p_source_language text,
  p_user_id uuid,
  p_generation_token uuid,
  p_daily_limit integer
)
returns setof public.book_summaries
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_summary public.book_summaries;
  inserted_summary boolean;
  used_count integer;
begin
  insert into public.book_summaries (
    book_id, resource_id, source_hash, book_title, source_language, generated_by, generation_token
  ) values (
    p_book_id, p_resource_id, p_source_hash, p_book_title, coalesce(nullif(p_source_language, ''), 'und'),
    p_user_id, p_generation_token
  )
  on conflict (book_id, resource_id, source_hash) do nothing
  returning * into current_summary;

  inserted_summary := found;

  if not inserted_summary then
    select * into current_summary
    from public.book_summaries
    where book_id = p_book_id
      and resource_id = p_resource_id
      and source_hash = p_source_hash
    for update;

    if current_summary.status in ('pending_review', 'approved') then
      return next current_summary;
      return;
    end if;

    if current_summary.status = 'generating'
      and current_summary.generation_started_at > clock_timestamp() - interval '30 minutes' then
      return next current_summary;
      return;
    end if;
  end if;

  insert into public.book_summary_generation_usage (user_id, usage_date, generation_count)
  values (p_user_id, (clock_timestamp() at time zone 'UTC')::date, 1)
  on conflict (user_id, usage_date) do update
    set generation_count = public.book_summary_generation_usage.generation_count + 1,
        updated_at = clock_timestamp()
    where public.book_summary_generation_usage.generation_count < p_daily_limit
  returning generation_count into used_count;

  if used_count is null then
    raise exception 'Daily summary generation limit reached.'
      using errcode = 'P0001';
  end if;

  if not inserted_summary then
    update public.book_summaries
    set book_title = p_book_title,
        source_language = coalesce(nullif(p_source_language, ''), 'und'),
        summary = null,
        status = 'generating',
        generated_by = p_user_id,
        generation_token = p_generation_token,
        generated_at = clock_timestamp(),
        generation_started_at = clock_timestamp(),
        reviewed_by = null,
        reviewed_at = null,
        reviewer_note = null,
        updated_at = clock_timestamp()
    where id = current_summary.id
    returning * into current_summary;
  end if;

  return next current_summary;
end;
$$;

revoke all on function public.claim_book_summary_generation(bigint, text, text, text, text, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_book_summary_generation(bigint, text, text, text, text, uuid, uuid, integer)
  to service_role;

commit;
