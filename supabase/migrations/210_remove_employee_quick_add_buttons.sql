-- 210_remove_employee_quick_add_buttons.sql
-- Informacyjna migracja: patch 136 usuwa przyciski szybkiego dodawania pracownika
-- z formularzy wizyt/grafiku/sprzedaży bez wizyty. Dodawanie pracowników pozostaje
-- wyłącznie w module administracyjnym użytkowników/pracowników.
select '210 remove employee quick add buttons: no database changes' as info;
