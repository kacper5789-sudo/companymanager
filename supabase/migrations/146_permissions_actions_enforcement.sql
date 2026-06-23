-- COMPANYMANAGER 051D
-- Permissions action enforcement
-- UI/JS patch. Database schema is already covered by 144_users_permissions_full_scope.sql.

notify pgrst, 'reload schema';
