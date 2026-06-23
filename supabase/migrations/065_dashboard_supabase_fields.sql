-- COMPANYMANAGER — 065 DASHBOARD SUPABASE FIELDS
-- Dashboard korzysta z public.appointments jako źródła grafiku.
-- Dodajemy pola używane przez stary widok dashboardu, bez przebudowy istniejących modułów.

alter table public.appointments
add column if not exists product_id uuid,
add column if not exists total numeric(12,2) default 0,
add column if not exists payment_method text,
add column if not exists cancellation_reason text,
add column if not exists cancelled_at timestamptz;

create index if not exists appointments_product_id_idx on public.appointments(product_id);
create index if not exists appointments_cancelled_at_idx on public.appointments(cancelled_at);

grant select, insert, update, delete on public.appointments to authenticated;

notify pgrst, 'reload schema';
