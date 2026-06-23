-- COMPANYMANAGER — 083 GLOBAL DATEPICKER REINIT FIX
-- Brak zmian w bazie.
-- Fix jest frontendowy: ponowne podpięcie natywnych input[type=date]
-- po dynamicznym renderze Supabase/modali.

notify pgrst, 'reload schema';
