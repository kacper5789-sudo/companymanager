-- 201_employee_archive_label_cleanup
-- Zmiana UX: przycisk „Usuń pracownika” oznacza przeniesienie do archiwum.
-- Bez zmian struktury bazy. Logika pozostaje soft-delete/anonymize dla bezpieczeństwa historii.
select '201 employee archive label cleanup: no database changes required' as info;
