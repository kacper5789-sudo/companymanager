# send-marketing-sms

Edge Function do realnej wysyłki kampanii SMS przez SMSAPI.

Secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMSAPI_TOKEN`
- opcjonalnie `SMSAPI_FROM`
- opcjonalnie `SMS_DRY_RUN=true` do testów bez realnej wysyłki

Wywołanie z frontu:
```json
{ "campaign_id": "...", "mode": "campaign" }
```
