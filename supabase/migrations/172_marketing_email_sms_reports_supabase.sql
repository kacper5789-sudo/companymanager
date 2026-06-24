-- COMPANYMANAGER — 096 MARKETING EMAIL/SMS REPORTS SUPABASE
-- Podpina zakładki Email i SMS pod dane kampanii/odbiorców z Supabase.

create extension if not exists pgcrypto;

-- Pełne wyrównanie tabel marketingu pod stare i nowe instalacje.
alter table public.marketing_campaigns
add column if not exists company_id uuid,
add column if not exists created_by uuid,
add column if not exists channel text default 'email',
add column if not exists sender_name text,
add column if not exists subject text,
add column if not exists body text,
add column if not exists audience_filter jsonb default '{}'::jsonb,
add column if not exists recipient_count integer default 0,
add column if not exists test_recipient text,
add column if not exists status text default 'draft',
add column if not exists sent_at timestamptz,
add column if not exists active boolean default true,
add column if not exists deleted_at timestamptz,
add column if not exists updated_at timestamptz default now(),
add column if not exists last_error text;

-- Jeżeli tabela była stara i ma name NOT NULL, zostawiamy ją kompatybilnie.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='marketing_campaigns' and column_name='name'
  ) then
    alter table public.marketing_campaigns alter column name drop not null;
    alter table public.marketing_campaigns alter column name set default 'Kampania';
  end if;
end $$;

alter table public.marketing_campaign_recipients
add column if not exists company_id uuid,
add column if not exists campaign_id uuid,
add column if not exists client_id uuid,
add column if not exists recipient_name text,
add column if not exists email text,
add column if not exists phone text,
add column if not exists channel text default 'email',
add column if not exists status text default 'pending',
add column if not exists sent_at timestamptz,
add column if not exists provider_message_id text,
add column if not exists error_message text,
add column if not exists active boolean default true,
add column if not exists deleted_at timestamptz,
add column if not exists updated_at timestamptz default now();

update public.marketing_campaigns
set active = true
where active is null;

update public.marketing_campaign_recipients
set active = true
where active is null;

create index if not exists idx_marketing_campaigns_company_channel_created
on public.marketing_campaigns(company_id, channel, created_at desc);

create index if not exists idx_marketing_campaign_recipients_company_campaign_status
on public.marketing_campaign_recipients(company_id, campaign_id, status);

create or replace function public.cm_marketing_report(p_channel text default 'email')
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
  if not found then
    raise exception 'Profile not found';
  end if;
  if me.company_id is null then
    raise exception 'Missing company_id';
  end if;
  if v_channel not in ('email','sms') then
    raise exception 'Invalid channel';
  end if;

  with recipient_stats as (
    select
      r.campaign_id,
      count(*)::int as total_recipients,
      count(*) filter (where lower(coalesce(r.status,'')) = 'sent')::int as sent_count,
      count(*) filter (where lower(coalesce(r.status,'')) = 'failed')::int as failed_count,
      count(*) filter (where lower(coalesce(r.status,'')) = 'skipped')::int as skipped_count,
      count(*) filter (where lower(coalesce(r.status,'')) in ('pending','ready','test'))::int as pending_count,
      max(r.sent_at) as last_sent_at
    from public.marketing_campaign_recipients r
    where r.company_id = me.company_id
      and lower(coalesce(r.channel, v_channel)) = v_channel
      and coalesce(r.active, true) is true
      and r.deleted_at is null
    group by r.campaign_id
  ), campaigns as (
    select
      mc.id,
      mc.company_id,
      lower(coalesce(mc.channel, 'email')) as channel,
      mc.sender_name,
      mc.subject,
      mc.body,
      mc.status,
      mc.recipient_count,
      mc.created_at,
      mc.sent_at,
      mc.updated_at,
      coalesce(rs.total_recipients, mc.recipient_count, 0)::int as total_recipients,
      coalesce(rs.sent_count, 0)::int as sent_count,
      coalesce(rs.failed_count, 0)::int as failed_count,
      coalesce(rs.skipped_count, 0)::int as skipped_count,
      coalesce(rs.pending_count, 0)::int as pending_count,
      rs.last_sent_at
    from public.marketing_campaigns mc
    left join recipient_stats rs on rs.campaign_id = mc.id
    where mc.company_id = me.company_id
      and lower(coalesce(mc.channel, 'email')) = v_channel
      and coalesce(mc.active, true) is true
      and mc.deleted_at is null
  )
  select jsonb_build_object(
    'company_id', me.company_id,
    'channel', v_channel,
    'campaigns', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'channel', channel,
      'sender_name', sender_name,
      'subject', subject,
      'body', body,
      'status', status,
      'recipient_count', recipient_count,
      'created_at', created_at,
      'sent_at', sent_at,
      'updated_at', updated_at,
      'total_recipients', total_recipients,
      'sent_count', sent_count,
      'failed_count', failed_count,
      'skipped_count', skipped_count,
      'pending_count', pending_count,
      'last_sent_at', last_sent_at
    ) order by coalesce(sent_at, created_at) desc), '[]'::jsonb),
    'summary', jsonb_build_object(
      'campaigns', count(*),
      'recipients', coalesce(sum(total_recipients), 0),
      'sent', coalesce(sum(sent_count), 0),
      'failed', coalesce(sum(failed_count), 0),
      'skipped', coalesce(sum(skipped_count), 0),
      'pending', coalesce(sum(pending_count), 0)
    )
  ) into result
  from campaigns;

  return coalesce(result, jsonb_build_object(
    'company_id', me.company_id,
    'channel', v_channel,
    'campaigns', '[]'::jsonb,
    'summary', jsonb_build_object('campaigns',0,'recipients',0,'sent',0,'failed',0,'skipped',0,'pending',0)
  ));
end;
$$;

grant execute on function public.cm_marketing_report(text) to authenticated;

notify pgrst, 'reload schema';
