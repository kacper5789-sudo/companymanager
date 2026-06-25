# send-marketing-sms

Edge Function do ręcznej wysyłki kampanii SMS przez SMSPLANET.

Secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMS_PROVIDER=smsplanet`
- `SMS_PROVIDER_TOKEN` — token API z panelu SMSPLANET
- opcjonalnie `SMS_PROVIDER_URL=https://api2.smsplanet.pl/sms`
- opcjonalnie `SMS_DRY_RUN=true` do testów bez realnej wysyłki
- opcjonalnie `SMS_CLEAR_POLISH=true` — zamiana polskich znaków na zwykłe dla tańszych/krótszych SMS

Wywołanie z frontu:
```json
{ "campaign_id": "...", "mode": "campaign" }
```
