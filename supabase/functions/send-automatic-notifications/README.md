# send-automatic-notifications

Automatyczne powiadomienia EMAIL dla CompanyManager.

Wymagane sekrety Edge Functions:
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS` opcjonalnie, np. `no-reply@companymanager.com.pl`

Autoryzacja crona:
- funkcja może użyć `SUPABASE_SERVICE_ROLE_KEY` z Secrets,
- albo klucza `secret/service_role` przekazanego w nagłówku `Authorization: Bearer ...` przez pg_cron.

Wersja 097_fix dodaje czytelne błędy JSON przy statusie 500.
