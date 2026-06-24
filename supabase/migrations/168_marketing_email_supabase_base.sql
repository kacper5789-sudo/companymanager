-- COMPANYMANAGER — 092 MARKETING EMAIL SUPABASE BASE
-- Fundament marketingu EMAIL/SMS w Supabase. Realna wysyłka przez provider będzie w kolejnym kroku.

create extension if not exists pgcrypto;

-- 1) Ustawienia powiadomień per firma.
create table if not exists public.company_notification_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_notification_settings enable row level security;

drop policy if exists company_notification_settings_select on public.company_notification_settings;
create policy company_notification_settings_select
on public.company_notification_settings
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = company_notification_settings.company_id
      )
  )
);

drop policy if exists company_notification_settings_write on public.company_notification_settings;
create policy company_notification_settings_write
on public.company_notification_settings
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or (p.company_id = company_notification_settings.company_id and lower(p.role::text) = 'admin')
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or (p.company_id = company_notification_settings.company_id and lower(p.role::text) = 'admin')
      )
  )
);

-- 2) Kolumny ustawień na companies, żeby obecny Panel firmy działał bez przebudowy.
alter table public.companies
  add column if not exists visit_email_subject text,
  add column if not exists birthday_email_subject text,
  add column if not exists after_add_email_subject text,
  add column if not exists after_visit_email_subject text,
  add column if not exists updated_at timestamptz default now();

-- Sender w emailach traktujemy jako nazwę wyświetlaną firmy/marki, nie techniczny adres SMTP.
comment on column public.companies.visit_email_sender is 'Email display sender name, e.g. PWC Studio';
comment on column public.companies.birthday_email_sender is 'Email display sender name, e.g. PWC Studio';
comment on column public.companies.after_add_email_sender is 'Email display sender name, e.g. PWC Studio';
comment on column public.companies.after_visit_email_sender is 'Email display sender name, e.g. PWC Studio';

-- 3) Zgody klientów.
alter table public.clients
  add column if not exists marketing_sms boolean default false,
  add column if not exists marketing_email boolean default false;

-- 4) Kampanie i odbiorcy.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  sender_name text,
  subject text,
  body text not null,
  audience_filter jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft','test','ready_to_send','sent','cancelled','deleted')),
  test_recipient text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,
  sent_at timestamptz,
  active boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid
);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  recipient_name text,
  email text,
  phone text,
  channel text not null check (channel in ('email','sms')),
  status text not null default 'pending' check (status in ('pending','ready','sent','failed','skipped','test')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_marketing_campaigns_company_created
on public.marketing_campaigns(company_id, created_at desc);

create index if not exists idx_marketing_campaign_recipients_campaign
on public.marketing_campaign_recipients(campaign_id, created_at desc);

create index if not exists idx_clients_company_marketing_email
on public.clients(company_id, marketing_email) where marketing_email is true;

create index if not exists idx_clients_company_marketing_sms
on public.clients(company_id, marketing_sms) where marketing_sms is true;

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;

drop policy if exists marketing_campaigns_company_access on public.marketing_campaigns;
create policy marketing_campaigns_company_access
on public.marketing_campaigns
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = marketing_campaigns.company_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = marketing_campaigns.company_id
      )
  )
);

drop policy if exists marketing_campaign_recipients_company_access on public.marketing_campaign_recipients;
create policy marketing_campaign_recipients_company_access
on public.marketing_campaign_recipients
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = marketing_campaign_recipients.company_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.role::text) = 'owner'
        or p.company_id = marketing_campaign_recipients.company_id
      )
  )
);

grant select, insert, update on public.marketing_campaigns to authenticated;
grant select, insert, update on public.marketing_campaign_recipients to authenticated;
grant select, insert, update on public.company_notification_settings to authenticated;
grant select, update on public.companies to authenticated;
grant select, update on public.clients to authenticated;

-- 5) Helpers.
create or replace function public.cm_marketing_sender_name(p_value text, p_fallback text default null)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := trim(coalesce(p_value, p_fallback, 'CompanyManager'));
  v := regexp_replace(v, '[<>"'';\\]', '', 'g');
  v := regexp_replace(v, '\s+', ' ', 'g');
  if length(v) > 50 then
    v := left(v, 50);
  end if;
  if v = '' then
    v := 'CompanyManager';
  end if;
  return v;
end;
$$;

create or replace function public.cm_marketing_subject(p_value text, p_fallback text default 'Wiadomość')
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := trim(coalesce(p_value, p_fallback, 'Wiadomość'));
  v := regexp_replace(v, '[\r\n]+', ' ', 'g');
  v := regexp_replace(v, '\s+', ' ', 'g');
  if length(v) > 120 then
    v := left(v, 120);
  end if;
  if v = '' then
    v := 'Wiadomość';
  end if;
  return v;
end;
$$;

-- 6) company_panel_update z tematami email i mirrorem do company_notification_settings.
create or replace function public.company_panel_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target_company_id uuid;
  updated_company public.companies;
  v_settings jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  target_company_id := me.company_id;
  if target_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if not (
    lower(me.role::text) = 'owner'
    or lower(me.role::text) = 'admin'
    or public.can_access_company_data(target_company_id, 'open_company_manager')
  ) then
    raise exception 'Permission denied';
  end if;

  update public.companies
  set
    name = coalesce(nullif(p_payload->>'name', ''), name),
    address = coalesce(nullif(p_payload->>'address', ''), address),
    postal_code = coalesce(nullif(p_payload->>'postal_code', ''), postal_code),
    city = coalesce(nullif(p_payload->>'city', ''), city),
    company_phone = coalesce(nullif(p_payload->>'company_phone', ''), company_phone),
    company_email = coalesce(nullif(p_payload->>'company_email', ''), company_email),
    contact_person = coalesce(nullif(p_payload->>'contact_person', ''), contact_person),
    contact_phone = coalesce(nullif(p_payload->>'contact_phone', ''), contact_phone),
    contact_email = coalesce(nullif(p_payload->>'contact_email', ''), contact_email),
    billing_name = coalesce(nullif(p_payload->>'billing_name', ''), billing_name),
    billing_address = coalesce(nullif(p_payload->>'billing_address', ''), billing_address),
    billing_postal_code = coalesce(nullif(p_payload->>'billing_postal_code', ''), billing_postal_code),
    billing_city = coalesce(nullif(p_payload->>'billing_city', ''), billing_city),
    billing_nip = coalesce(nullif(p_payload->>'billing_nip', ''), billing_nip),
    invoice_email = coalesce(nullif(p_payload->>'invoice_email', ''), invoice_email),
    message_sender = coalesce(nullif(p_payload->>'message_sender', ''), message_sender),
    sms_sender = coalesce(nullif(p_payload->>'sms_sender', ''), sms_sender),
    visit_sms_24 = coalesce((p_payload->>'visit_sms_24')::boolean, visit_sms_24),
    visit_sms_sender = coalesce(nullif(p_payload->>'visit_sms_sender', ''), visit_sms_sender),
    visit_sms_template = coalesce(nullif(p_payload->>'visit_sms_template', ''), visit_sms_template),
    birthday_sms = coalesce((p_payload->>'birthday_sms')::boolean, birthday_sms),
    birthday_sms_sender = coalesce(nullif(p_payload->>'birthday_sms_sender', ''), birthday_sms_sender),
    birthday_sms_template = coalesce(nullif(p_payload->>'birthday_sms_template', ''), birthday_sms_template),
    after_add_sms = coalesce((p_payload->>'after_add_sms')::boolean, after_add_sms),
    after_add_sms_sender = coalesce(nullif(p_payload->>'after_add_sms_sender', ''), after_add_sms_sender),
    after_add_sms_template = coalesce(nullif(p_payload->>'after_add_sms_template', ''), after_add_sms_template),
    after_visit_sms = coalesce((p_payload->>'after_visit_sms')::boolean, after_visit_sms),
    after_visit_sms_sender = coalesce(nullif(p_payload->>'after_visit_sms_sender', ''), after_visit_sms_sender),
    after_visit_sms_template = coalesce(nullif(p_payload->>'after_visit_sms_template', ''), after_visit_sms_template),
    visit_email_24 = coalesce((p_payload->>'visit_email_24')::boolean, visit_email_24),
    visit_email_sender = coalesce(nullif(public.cm_marketing_sender_name(p_payload->>'visit_email_sender', name), ''), visit_email_sender),
    visit_email_subject = coalesce(nullif(public.cm_marketing_subject(p_payload->>'visit_email_subject', 'Przypomnienie o wizycie'), ''), visit_email_subject),
    visit_email_template = coalesce(nullif(p_payload->>'visit_email_template', ''), visit_email_template),
    birthday_email = coalesce((p_payload->>'birthday_email')::boolean, birthday_email),
    birthday_email_sender = coalesce(nullif(public.cm_marketing_sender_name(p_payload->>'birthday_email_sender', name), ''), birthday_email_sender),
    birthday_email_subject = coalesce(nullif(public.cm_marketing_subject(p_payload->>'birthday_email_subject', 'Wszystkiego najlepszego'), ''), birthday_email_subject),
    birthday_email_template = coalesce(nullif(p_payload->>'birthday_email_template', ''), birthday_email_template),
    after_add_email = coalesce((p_payload->>'after_add_email')::boolean, after_add_email),
    after_add_email_sender = coalesce(nullif(public.cm_marketing_sender_name(p_payload->>'after_add_email_sender', name), ''), after_add_email_sender),
    after_add_email_subject = coalesce(nullif(public.cm_marketing_subject(p_payload->>'after_add_email_subject', 'Potwierdzenie rezerwacji'), ''), after_add_email_subject),
    after_add_email_template = coalesce(nullif(p_payload->>'after_add_email_template', ''), after_add_email_template),
    after_visit_email = coalesce((p_payload->>'after_visit_email')::boolean, after_visit_email),
    after_visit_email_sender = coalesce(nullif(public.cm_marketing_sender_name(p_payload->>'after_visit_email_sender', name), ''), after_visit_email_sender),
    after_visit_email_subject = coalesce(nullif(public.cm_marketing_subject(p_payload->>'after_visit_email_subject', 'Dziękujemy za wizytę'), ''), after_visit_email_subject),
    after_visit_email_template = coalesce(nullif(p_payload->>'after_visit_email_template', ''), after_visit_email_template),
    language = coalesce(nullif(p_payload->>'language', ''), language),
    currency = coalesce(nullif(p_payload->>'currency', ''), currency),
    timezone = coalesce(nullif(p_payload->>'timezone', ''), timezone),
    client_marketing_consent_enabled = coalesce((p_payload->>'client_marketing_consent_enabled')::boolean, client_marketing_consent_enabled),
    client_marketing_consent_explicit = coalesce((p_payload->>'client_marketing_consent_explicit')::boolean, client_marketing_consent_explicit),
    payment_methods = case
      when p_payload ? 'payment_methods' and jsonb_typeof(p_payload->'payment_methods') = 'array'
        then p_payload->'payment_methods'
      else payment_methods
    end,
    working_day_start = coalesce(nullif(p_payload->>'working_day_start', '')::time, working_day_start),
    working_day_end = coalesce(nullif(p_payload->>'working_day_end', '')::time, working_day_end),
    default_visit_duration_minutes = coalesce(nullif(p_payload->>'default_visit_duration_minutes', '')::integer, default_visit_duration_minutes),
    appointment_break_minutes = case
      when nullif(p_payload->>'appointment_break_minutes', '') is null then appointment_break_minutes
      when (p_payload->>'appointment_break_minutes')::integer in (0,5,15,30,45,60) then (p_payload->>'appointment_break_minutes')::integer
      else appointment_break_minutes
    end,
    updated_at = now()
  where id = target_company_id
  returning * into updated_company;

  v_settings := jsonb_build_object(
    'email', jsonb_build_object(
      'visit_24', jsonb_build_object('enabled', updated_company.visit_email_24, 'sender_name', updated_company.visit_email_sender, 'subject', updated_company.visit_email_subject, 'body', updated_company.visit_email_template),
      'birthday', jsonb_build_object('enabled', updated_company.birthday_email, 'sender_name', updated_company.birthday_email_sender, 'subject', updated_company.birthday_email_subject, 'body', updated_company.birthday_email_template),
      'after_add', jsonb_build_object('enabled', updated_company.after_add_email, 'sender_name', updated_company.after_add_email_sender, 'subject', updated_company.after_add_email_subject, 'body', updated_company.after_add_email_template),
      'after_visit', jsonb_build_object('enabled', updated_company.after_visit_email, 'sender_name', updated_company.after_visit_email_sender, 'subject', updated_company.after_visit_email_subject, 'body', updated_company.after_visit_email_template)
    ),
    'sms', jsonb_build_object(
      'visit_24', jsonb_build_object('enabled', updated_company.visit_sms_24, 'sender_name', updated_company.visit_sms_sender, 'body', updated_company.visit_sms_template),
      'birthday', jsonb_build_object('enabled', updated_company.birthday_sms, 'sender_name', updated_company.birthday_sms_sender, 'body', updated_company.birthday_sms_template),
      'after_add', jsonb_build_object('enabled', updated_company.after_add_sms, 'sender_name', updated_company.after_add_sms_sender, 'body', updated_company.after_add_sms_template),
      'after_visit', jsonb_build_object('enabled', updated_company.after_visit_sms, 'sender_name', updated_company.after_visit_sms_sender, 'body', updated_company.after_visit_sms_template)
    )
  );

  insert into public.company_notification_settings(company_id, settings, updated_at)
  values (target_company_id, v_settings, now())
  on conflict (company_id) do update set settings = excluded.settings, updated_at = now();

  return jsonb_build_object('company', to_jsonb(updated_company));
end;
$$;

grant execute on function public.company_panel_update(jsonb) to authenticated;

-- 7) Kontekst marketingu.
create or replace function public.cm_marketing_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  c public.companies;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;

  if not (
    lower(me.role::text) in ('owner','admin')
    or public.can_access_company_data(me.company_id, 'open_marketing')
  ) then
    raise exception 'Permission denied';
  end if;

  select * into c from public.companies where id = me.company_id;

  return jsonb_build_object(
    'profile', to_jsonb(me),
    'company', to_jsonb(c),
    'campaigns', coalesce((
      select jsonb_agg(to_jsonb(mc) order by mc.created_at desc)
      from public.marketing_campaigns mc
      where mc.company_id = me.company_id
        and coalesce(mc.active, true) is true
        and mc.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.cm_marketing_context() to authenticated;

create or replace function public.cm_marketing_recipients(p_channel text, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  v_channel text := lower(coalesce(p_channel, 'email'));
  result jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;

  if v_channel not in ('email','sms') then raise exception 'Invalid channel'; end if;

  with base as (
    select
      c.id,
      c.company_id,
      c.email,
      c.phone,
      trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) as client_name,
      c.gender,
      c.created_at,
      c.updated_at,
      c.marketing_email,
      c.marketing_sms
    from public.clients c
    where c.company_id = me.company_id
      and coalesce(c.active, true) is true
      and (case when v_channel = 'email' then coalesce(c.marketing_email, false) is true and nullif(trim(c.email),'') is not null
                else coalesce(c.marketing_sms, false) is true and nullif(trim(c.phone),'') is not null end)
      and (
        coalesce((p_filters->>'allCustomers')::boolean, false) is true
        or (coalesce((p_filters->>'allWomen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('kobieta','female','woman'))
        or (coalesce((p_filters->>'allMen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('mężczyzna','mezczyzna','male','man'))
        or (jsonb_typeof(p_filters->'clientIds') = 'array' and c.id::text in (select jsonb_array_elements_text(p_filters->'clientIds')))
        or (coalesce((p_filters->>'updatedRange')::boolean, false) is true and c.updated_at::date between coalesce(nullif(p_filters->>'updatedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'updatedTo','')::date, current_date))
        or (coalesce((p_filters->>'addedRange')::boolean, false) is true and c.created_at::date between coalesce(nullif(p_filters->>'addedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'addedTo','')::date, current_date))
      )
  )
  select jsonb_build_object(
    'count', count(*),
    'recipients', coalesce(jsonb_agg(jsonb_build_object('client_id', id, 'name', nullif(client_name,''), 'email', email, 'phone', phone) order by client_name), '[]'::jsonb)
  ) into result
  from base;

  return coalesce(result, jsonb_build_object('count',0,'recipients','[]'::jsonb));
end;
$$;

grant execute on function public.cm_marketing_recipients(text, jsonb) to authenticated;

create or replace function public.cm_marketing_save_campaign(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  v_channel text := lower(coalesce(p_payload->>'channel', 'email'));
  v_status text := coalesce(nullif(p_payload->>'status',''), 'draft');
  v_sender text;
  v_subject text;
  v_body text;
  v_filters jsonb;
  v_test text;
  v_recips jsonb;
  v_campaign_id uuid;
  r jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;
  if v_channel not in ('email','sms') then raise exception 'Invalid channel'; end if;
  if v_status not in ('draft','test','ready_to_send') then raise exception 'Invalid status'; end if;

  if not (
    lower(me.role::text) in ('owner','admin')
    or public.can_access_company_data(me.company_id, case when v_channel='email' then 'marketing_email' else 'marketing_sms' end)
  ) then
    raise exception 'Permission denied';
  end if;

  v_sender := public.cm_marketing_sender_name(p_payload->>'sender_name', null);
  v_subject := case when v_channel='email' then public.cm_marketing_subject(p_payload->>'subject', 'Wiadomość') else null end;
  v_body := trim(coalesce(p_payload->>'body',''));
  v_filters := coalesce(p_payload->'filters', '{}'::jsonb);
  v_test := nullif(p_payload->>'test_recipient','');

  if v_body = '' then raise exception 'Missing message body'; end if;
  if v_channel='email' and v_subject = '' then raise exception 'Missing email subject'; end if;

  v_recips := public.cm_marketing_recipients(v_channel, v_filters);

  insert into public.marketing_campaigns(
    company_id, channel, sender_name, subject, body, audience_filter, recipient_count, status, test_recipient, created_by, created_at, updated_at
  ) values (
    me.company_id, v_channel, v_sender, v_subject, v_body, v_filters, coalesce((v_recips->>'count')::integer,0), v_status, v_test, auth.uid(), now(), now()
  ) returning id into v_campaign_id;

  if v_status = 'test' and v_test is not null then
    insert into public.marketing_campaign_recipients(company_id, campaign_id, client_id, recipient_name, email, phone, channel, status)
    values (me.company_id, v_campaign_id, null, 'Test', case when v_channel='email' then v_test else null end, case when v_channel='sms' then v_test else null end, v_channel, 'test');
  else
    for r in select * from jsonb_array_elements(coalesce(v_recips->'recipients','[]'::jsonb)) loop
      insert into public.marketing_campaign_recipients(company_id, campaign_id, client_id, recipient_name, email, phone, channel, status)
      values (
        me.company_id,
        v_campaign_id,
        nullif(r->>'client_id','')::uuid,
        nullif(r->>'name',''),
        nullif(r->>'email',''),
        nullif(r->>'phone',''),
        v_channel,
        case when v_status='ready_to_send' then 'ready' else 'pending' end
      );
    end loop;
  end if;

  return jsonb_build_object('campaign_id', v_campaign_id, 'recipient_count', coalesce((v_recips->>'count')::integer,0), 'status', v_status);
end;
$$;

grant execute on function public.cm_marketing_save_campaign(jsonb) to authenticated;

notify pgrst, 'reload schema';
