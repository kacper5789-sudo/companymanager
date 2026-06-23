-- COMPANYMANAGER 046A
-- Raport dzienny Supabase
-- daily-report.html czyta realne dane z: sales, sale_items, payments, appointments, clients, profiles.
-- Ten SQL tylko dopasowuje brakujące snapshoty/kolumny i odświeża PostgREST.

alter table public.sales
add column if not exists employee_name text;

alter table public.payments
add column if not exists status text default 'paid';

update public.payments
set status = coalesce(status, 'paid')
where status is null;

grant select on table public.sales to authenticated;
grant select on table public.sale_items to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.appointments to authenticated;
grant select on table public.clients to authenticated;
grant select on table public.profiles to authenticated;

notify pgrst, 'reload schema';
