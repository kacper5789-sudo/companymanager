-- COMPANYMANAGER 104
-- Klienci - raporty Supabase
-- Logika raportów jest w supabaseCustomersReports.js.
-- Ten plik zachowuje numerację migracji i odświeża schema cache.

grant select on table public.clients to authenticated;
grant select on table public.appointments to authenticated;
grant select on table public.services to authenticated;
grant select on table public.service_categories to authenticated;
grant select on table public.profiles to authenticated;

notify pgrst, 'reload schema';
