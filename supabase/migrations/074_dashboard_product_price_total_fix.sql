-- COMPANYMANAGER — 074 DASHBOARD PRODUCT PRICE TOTAL FIX
-- Utrwala pola produktu na wizycie, żeby zakończenie wizyty i raporty miały cenę produktu.

alter table public.appointments
add column if not exists product_name text,
add column if not exists product_quantity numeric(12,2) default 1,
add column if not exists product_price numeric(12,2) default 0;

notify pgrst, 'reload schema';
