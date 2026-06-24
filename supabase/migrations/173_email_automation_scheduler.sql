-- COMPANYMANAGER — 097 EMAIL AUTOMATION SCHEDULER
-- Automatyczne powiadomienia EMAIL z Panelu firmy:
-- 24h przed wizytą, po dodaniu wizyty, po zakończeniu wizyty, urodziny.
-- SMS zostaje przygotowany strukturalnie pod kolejny etap.

create extension if not exists pgcrypto;

-- Bezpieczne kolumny kompatybilności, żeby automaty miały na czym pracować.
alter table public.clients
  add column if not exists date_of_birth date,
  add column if not exists birth_date date,
  add column if not exists birthday date,
  add column if not exists marketing_email boolean default false,
  add column if not exists marketing_sms boolean default false,
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz;

alter table public.appointments
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists notification_created_email_sent_at timestamptz,
  add column if not exists notification_after_visit_email_sent_at timestamptz,
  add column if not exists notification_reminder_email_sent_at timestamptz;

-- Logi powiadomień automatycznych.
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  visit_id uuid,
  channel text not null default 'email' check (channel in ('email','sms')),
  type text not null,
  recipient text,
  recipient_name text,
  sender_name text,
  subject text,
  content text,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider text,
  provider_message_id text,
  error_message text,
  dedupe_key text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_logs
  add column if not exists visit_id uuid,
  add column if not exists appointment_id uuid,
  add column if not exists recipient_name text,
  add column if not exists sender_name text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists error_message text,
  add column if not exists dedupe_key text,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_notification_logs_company_created
on public.notification_logs(company_id, created_at desc);

create index if not exists idx_notification_logs_company_type
on public.notification_logs(company_id, type, created_at desc);

create unique index if not exists ux_notification_logs_dedupe_key
on public.notification_logs(dedupe_key)
where dedupe_key is not null;

alter table public.notification_logs enable row level security;

drop policy if exists notification_logs_select on public.notification_logs;
create policy notification_logs_select
on public.notification_logs
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = notification_logs.company_id
      )
  )
);

drop policy if exists notification_logs_insert_service on public.notification_logs;
create policy notification_logs_insert_service
on public.notification_logs
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = notification_logs.company_id
      )
  )
);

grant select, insert, update on public.notification_logs to authenticated;

-- Uzupełnienie struktury ustawień firm pod tematy email, jeśli starsze środowisko ich nie miało.
alter table public.companies
  add column if not exists visit_email_subject text,
  add column if not exists birthday_email_subject text,
  add column if not exists after_add_email_subject text,
  add column if not exists after_visit_email_subject text;

notify pgrst, 'reload schema';
