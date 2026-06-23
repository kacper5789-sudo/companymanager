-- COMPANYMANAGER 046B
-- Raport dzienny Supabase render boot fix
-- UI/JS patch, SQL tylko odświeża schemat i pilnuje kolumn używanych przez raport.

alter table public.sales
add column if not exists employee_name text;

alter table public.payments
add column if not exists status text default 'paid';

notify pgrst, 'reload schema';
