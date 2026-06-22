-- COMPANYMANAGER — 075 GLOBAL MODAL BLUR CLEANUP FIX
-- Ten patch jest frontend-only.
-- Nie wymaga zmian w bazie danych.

notify pgrst, 'reload schema';
