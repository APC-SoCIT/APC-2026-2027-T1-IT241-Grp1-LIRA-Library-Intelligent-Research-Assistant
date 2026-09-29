delete from public.reservations
where status <> 'pending';

alter table public.reservations
  drop constraint if exists reservations_status_check,
  drop column status;

alter table public.reservations
  rename column reserved_at to created_at;
