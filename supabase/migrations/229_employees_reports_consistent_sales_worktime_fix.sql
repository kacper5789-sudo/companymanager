-- COMPANYMANAGER — 229 EMPLOYEES REPORTS CONSISTENT SALES WORKTIME FIX
-- Informational migration.
-- Frontend report logic now counts employee reports consistently from appointments, sale_items and passes:
-- - completed appointment services count as services even when no sale_item exists,
-- - products attached directly to appointments count as products,
-- - passes table is included in employee sales totals,
-- - appointment time falls back to start_time/end_time when starts_at/ends_at are incomplete.
notify pgrst, 'reload schema';
