-- CompanyManager 177 — SMS force live env fix
-- Ten patch nie zmienia tabel. Dodaje tylko dokumentację secretów dla Edge Functions.
-- W Supabase Secrets ustaw:
-- SMS_PROVIDER = smsplanet
-- SMS_PROVIDER_TOKEN = <token SMSPLANET>
-- SMS_FORCE_LIVE = true
-- Usuń SMS_DRY_RUN albo ustaw SMS_DRY_RUN = false.

select '177_sms_force_live_env_fix: deploy Edge Functions send-marketing-sms and send-automatic-notifications, set SMS_FORCE_LIVE=true' as info;
