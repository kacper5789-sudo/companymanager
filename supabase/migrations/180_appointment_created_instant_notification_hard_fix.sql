-- 180_appointment_created_instant_notification_hard_fix
-- Front wywołuje Edge Function send-automatic-notifications natychmiast po INSERT appointments.
-- SQL nie zmienia danych. Po odpaleniu deploy send-automatic-notifications.
select '180 appointment_created instant notification hard fix: deploy send-automatic-notifications and upload updated supabaseAppointments.js' as info;
