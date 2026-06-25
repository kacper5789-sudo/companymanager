-- 181_notifications_jsonb_settings_sms_after_add_fix
-- Edge Function send-automatic-notifications czyta ustawienia automatycznych SMS/Email z public.company_notification_settings.settings JSONB.
-- Wymagane granty dla service_role i zgodność logów pod historię kampanii SMS/Email.

grant select on public.company_notification_settings to service_role;
grant select on public.companies to service_role;
grant select on public.appointments to service_role;
grant select on public.clients to service_role;
grant select on public.services to service_role;
grant select on public.employees to service_role;
grant select, insert, update on public.notification_logs to service_role;

notify pgrst, 'reload schema';

select '181 notifications jsonb settings sms after_add fix: deploy send-automatic-notifications' as info;
