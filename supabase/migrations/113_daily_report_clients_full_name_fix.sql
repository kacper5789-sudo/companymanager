-- COMPANYMANAGER 113
-- daily_report_clients_full_name_fix
-- UI/JS fix: clients.full_name is not used because clients table uses first_name + last_name.

notify pgrst, 'reload schema';
