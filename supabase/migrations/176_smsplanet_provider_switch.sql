-- COMPANYMANAGER — 099 SMSPLANET PROVIDER SWITCH
-- Ten etap nie wymaga przebudowy tabel. Zmienia provider SMS w Edge Functions na SMSPLANET.
-- W Supabase Edge Function Secrets ustaw:
-- SMS_PROVIDER = smsplanet
-- SMS_PROVIDER_TOKEN = token z panelu SMSPLANET
-- SMS_DRY_RUN = true na test bez realnej wysyłki, potem false/usunąć
-- Opcjonalnie: SMS_CLEAR_POLISH = true

notify pgrst, 'reload schema';
