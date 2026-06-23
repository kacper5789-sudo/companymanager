-- COMPANYMANAGER — 069 FIX APPOINTMENT ALL STATUSES

-- Stary CompanyManager/localStorage miał pełny cykl statusów wizyty.
-- Supabase ma odwzorować logikę aplikacji, nie odwrotnie.

alter type public.appointment_status
add value if not exists 'odwołane';

alter type public.appointment_status
add value if not exists 'usunięte';

notify pgrst, 'reload schema';
