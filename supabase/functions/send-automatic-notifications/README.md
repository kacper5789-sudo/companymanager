# send-automatic-notifications

Automatyczne powiadomienia EMAIL CompanyManager przez Resend.

Obsługuje:
- `visit_24` — przypomnienie 24h przed wizytą,
- `after_add` — email po dodaniu wizyty,
- `after_visit` — email po zakończeniu wizyty,
- `birthday` — życzenia urodzinowe.

Sekrety Supabase:
- `RESEND_API_KEY` — wymagany,
- `EMAIL_FROM_ADDRESS` — opcjonalny, domyślnie `no-reply@companymanager.com.pl`,
- `SUPABASE_SERVICE_ROLE_KEY` — zalecany dla cron/automatyki,
- `AUTOMATION_CRON_SECRET` — opcjonalny, jeśli chcesz zabezpieczyć wywołania cron nagłówkiem `x-cron-secret`.

Deploy:

```bash
supabase functions deploy send-automatic-notifications
```

Ręczny test:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/send-automatic-notifications" \
  -H "Content-Type: application/json" \
  -d '{}'
```
