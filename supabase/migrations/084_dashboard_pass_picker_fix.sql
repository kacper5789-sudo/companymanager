-- COMPANYMANAGER — 084 DASHBOARD PASS PICKER FIX
-- Karnet w Dashboardzie: wybór po kliencie/usłudze przy dodawaniu wpisu do grafiku.
-- Frontend patch. SQL tylko zabezpiecza wymagane kolumny, jeśli 079 nie było odpalone do końca.

alter table public.appointments
add column if not exists pass_id uuid references public.passes(id) on delete set null,
add column if not exists pass_name text,
add column if not exists pass_used_value numeric(12,2) default 0,
add column if not exists pass_used_units numeric(12,2) default 0;

alter table public.sale_items
add column if not exists pass_id uuid references public.passes(id) on delete set null;

create index if not exists appointments_pass_id_idx on public.appointments(pass_id);

notify pgrst, 'reload schema';
