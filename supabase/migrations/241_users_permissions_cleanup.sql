-- CompanyManager 241_users_permissions_cleanup
-- Frontend cleanup of unused/non-working user permission checkboxes.
-- Removed from UI/effective permission checks:
-- appointments_unfinished_manage, sales_without_visit_history, marketing_delete,
-- sales_without_visit_edit, work_schedule_add, reports_access.
-- Existing stored values are ignored by the frontend and can remain safely in JSON permissions.
select '241 users permissions cleanup: frontend-only permission list cleanup' as info;
