-- COMPANYMANAGER — 067 DASHBOARD APPOINTMENT STATUS + TOTAL FIX
-- Dodaje zgodność statusów dashboardu ze starym panelem localStorage.
-- Bezpieczne nawet jeśli enum już ma te wartości.

do $$
begin
  if exists (select 1 from pg_type where typname = 'appointment_status') then
    alter type public.appointment_status add value if not exists 'zaplanowane';
    alter type public.appointment_status add value if not exists 'niezakończone';
    alter type public.appointment_status add value if not exists 'zakończone';
    alter type public.appointment_status add value if not exists 'odwołana';
    alter type public.appointment_status add value if not exists 'odwołane';
    alter type public.appointment_status add value if not exists 'usunięte';
  end if;
end $$;

alter table public.appointments
add column if not exists total numeric(12,2) default 0,
add column if not exists price numeric(12,2) default 0,
add column if not exists payment_method text;

notify pgrst, 'reload schema';
