-- COMPANYMANAGER — 076 PRODUCTS MODAL RERENDER FIX
-- Frontend-only fix.
-- Naprawia błąd JS po zapisie produktu: brak funkcji rerenderProductsAfterSuccess().
-- SQL nie wymaga zmian.

notify pgrst, 'reload schema';
