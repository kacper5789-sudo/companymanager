-- COMPANYMANAGER — 091 WALKINS CONNECTED PRODUCT/SERVICE BUTTONS
-- UI-only patch.
-- Sprzedaż bez wizyty dostała przyciski:
-- - Dodaj nowy produkt -> zapis do public.products
-- - Dodaj nową usługę -> zapis do public.services / public.service_categories
-- Nie wymaga zmian w schemacie bazy.

notify pgrst, 'reload schema';
