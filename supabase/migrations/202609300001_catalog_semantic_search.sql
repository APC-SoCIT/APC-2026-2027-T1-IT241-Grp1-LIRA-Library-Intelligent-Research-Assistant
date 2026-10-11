create extension if not exists vector with schema extensions;

create table public.catalog_embeddings (
  book_id bigint primary key,
  searchable_text text not null,
  embedding extensions.vector(768) not null,
  book_data jsonb not null,
  updated_at timestamptz not null default now(),
  index_run_id uuid
);

create index catalog_embeddings_embedding_hnsw_idx
  on public.catalog_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.catalog_embeddings enable row level security;
revoke all on public.catalog_embeddings from public, anon, authenticated;
grant all on public.catalog_embeddings to service_role;

create or replace function public.match_catalog_books(
  query_embedding extensions.vector(768),
  match_count integer default 50
)
returns table (book_data jsonb, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select
    catalog_embeddings.book_data,
    1 - (catalog_embeddings.embedding <=> query_embedding) as similarity
  from public.catalog_embeddings
  order by catalog_embeddings.embedding <=> query_embedding
  limit greatest(1, least(match_count, 1000));
$$;

revoke all on function public.match_catalog_books(extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.match_catalog_books(extensions.vector, integer) to service_role;

create or replace function public.delete_stale_catalog_embeddings(active_index_run uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.catalog_embeddings
  where index_run_id is distinct from active_index_run;
$$;

revoke all on function public.delete_stale_catalog_embeddings(uuid) from public, anon, authenticated;
grant execute on function public.delete_stale_catalog_embeddings(uuid) to service_role;
