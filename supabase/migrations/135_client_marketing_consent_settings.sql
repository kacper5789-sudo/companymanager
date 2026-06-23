-- COMPANYMANAGER 049D
-- Dodaj klienta — zgoda na reklamę SMS/Email

alter table public.companies
add column if not exists client_marketing_consent_enabled boolean default true,
add column if not exists client_marketing_consent_explicit boolean default true;

alter table public.clients
add column if not exists marketing_sms boolean default false,
add column if not exists marketing_email boolean default false;

grant select, update on public.companies to authenticated;
grant select, insert, update on public.clients to authenticated;

notify pgrst, 'reload schema';
