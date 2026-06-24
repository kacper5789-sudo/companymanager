-- COMPANYMANAGER — 098 SMS REAL SEND + AUTOMATIC SMS
-- Ręczne SMS-y z Marketingu oraz automatyczne SMS-y korzystają z Edge Functions.
-- Provider: SMSAPI przez secret SMSAPI_TOKEN.

create extension if not exists pgcrypto;

-- 1) Wyrównanie tabel kampanii/odbiorców pod statusy i provider_message_id.
alter table public.marketing_campaigns
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists sent_at timestamptz,
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz;

alter table public.marketing_campaign_recipients
  add column if not exists provider_message_id text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz;

-- 2) Deduplikacja automatycznych SMS/Email w notification_logs.
alter table public.notification_logs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists dedupe_key text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_notification_logs_dedupe_key
on public.notification_logs(dedupe_key)
where dedupe_key is not null;

create index if not exists idx_notification_logs_company_channel_created
on public.notification_logs(company_id, channel, created_at desc);

-- 3) Granty dla Edge Functions/service_role — bez wywalania SQL, gdy stara instalacja nie ma którejś tabeli.
do $$
begin
  if to_regclass('public.companies') is not null then grant select on public.companies to service_role; end if;
  if to_regclass('public.clients') is not null then grant select on public.clients to service_role; end if;
  if to_regclass('public.appointments') is not null then grant select on public.appointments to service_role; end if;
  if to_regclass('public.services') is not null then grant select on public.services to service_role; end if;
  if to_regclass('public.employees') is not null then grant select on public.employees to service_role; end if;
  if to_regclass('public.notification_logs') is not null then grant select, insert, update on public.notification_logs to service_role; end if;
  if to_regclass('public.marketing_campaigns') is not null then grant select, insert, update on public.marketing_campaigns to service_role; end if;
  if to_regclass('public.marketing_campaign_recipients') is not null then grant select, insert, update on public.marketing_campaign_recipients to service_role; end if;
end $$;

-- 4) Granty dla frontu/RPC.
grant execute on function public.cm_marketing_save_campaign(jsonb) to authenticated;
grant execute on function public.cm_marketing_recipients(text, jsonb) to authenticated;
grant execute on function public.cm_marketing_report(text) to authenticated;

notify pgrst, 'reload schema';
