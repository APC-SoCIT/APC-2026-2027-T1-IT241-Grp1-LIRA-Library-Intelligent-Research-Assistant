drop function if exists public.match_catalog_books(extensions.vector, integer);

drop index if exists public.catalog_embeddings_embedding_hnsw_idx;

truncate table public.catalog_embeddings;

alter table public.catalog_embeddings
  add column if not exists index_run_id uuid;

alter table public.catalog_embeddings
  alter column embedding type extensions.vector(768)
  using embedding::text::extensions.vector(768);

create index catalog_embeddings_embedding_hnsw_idx
  on public.catalog_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create function public.match_catalog_books(
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
