-- Remove the old Supabase list storage only after every saved item has been
-- copied to Koha by the one-time migration in the catalog service.
do $$
declare
  pending_lists bigint;
  pending_bookmarks bigint;
begin
  select count(*)
    into pending_lists
    from public.reading_lists as lists
    left join public.profiles as profiles on profiles.id = lists.user_id
   where profiles.koha_lists_migrated_at is null;

  select count(*)
    into pending_bookmarks
    from public.bookmarks as bookmarks
    left join public.profiles as profiles on profiles.id = bookmarks.user_id
   where profiles.koha_lists_migrated_at is null;

  if pending_lists > 0 or pending_bookmarks > 0 then
    raise exception
      'Cannot drop legacy list tables: % reading lists and % bookmarks still belong to users whose Koha migration is incomplete.',
      pending_lists,
      pending_bookmarks;
  end if;
end
$$;

drop table if exists public.bookmarks;
drop table if exists public.reading_lists;
