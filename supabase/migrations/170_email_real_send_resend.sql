-- COMPANYMANAGER — 094 EMAIL REAL SEND RESEND
-- Uzupełnia tabele marketingowe o pola używane przez Edge Function send-marketing-email.

alter table public.marketing_campaigns
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists last_error text;

alter table public.marketing_campaign_recipients
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists provider_message_id text,
  add column if not exists error_message text,
  add column if not exists sent_at timestamptz;

-- Jeżeli check constraint statusu był ze starej wersji, zostawiamy statusy już używane przez 092/093.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marketing_campaigns'::regclass
      and conname = 'marketing_campaigns_status_check'
  ) then
    alter table public.marketing_campaigns drop constraint marketing_campaigns_status_check;
  end if;

  alter table public.marketing_campaigns
    add constraint marketing_campaigns_status_check
    check (status in ('draft','test','ready_to_send','sent','cancelled','deleted'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marketing_campaign_recipients'::regclass
      and conname = 'marketing_campaign_recipients_status_check'
  ) then
    alter table public.marketing_campaign_recipients drop constraint marketing_campaign_recipients_status_check;
  end if;

  alter table public.marketing_campaign_recipients
    add constraint marketing_campaign_recipients_status_check
    check (status in ('pending','ready','sent','failed','skipped','test'));
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_marketing_recipients_campaign_status
on public.marketing_campaign_recipients(campaign_id, status);

notify pgrst, 'reload schema';
