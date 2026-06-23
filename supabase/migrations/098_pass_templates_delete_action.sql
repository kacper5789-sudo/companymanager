-- COMPANYMANAGER — 042F PASS TEMPLATES DELETE ACTION
-- Frontend-only UI patch. SQL is informational; pass_templates are soft-deleted by setting active=false.
notify pgrst, 'reload schema';
