# send-marketing-email

Supabase Edge Function wysyłająca kampanie EMAIL przez Resend.

Wymagane sekrety w Supabase:

- `RESEND_API_KEY` — klucz z Resend
- opcjonalnie `EMAIL_FROM_ADDRESS` — domyślnie `no-reply@companymanager.com.pl`

Deploy:

```bash
supabase functions deploy send-marketing-email
```
