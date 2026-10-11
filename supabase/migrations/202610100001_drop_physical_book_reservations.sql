-- The app now supports e-book reading only. Remove the old physical-book
-- reservation/cart data after deploying the corresponding frontend changes.
drop table if exists public.reservations;
