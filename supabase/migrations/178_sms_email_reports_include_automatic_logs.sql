-- CompanyManager 102 — SMS/Email reports include automatic notifications
-- Kampanie marketingowe + automatyczne SMS/Email z notification_logs są liczone razem w zakładkach SMS/Email.

create index if not exists idx_notification_logs_company_channel_status_created
on public.notification_logs(company_id, channel, status, created_at desc);

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
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;
  if v_channel not in ('email','sms') then raise exception 'Invalid channel'; end if;

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
  ), manual_campaigns as (
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
      rs.last_sent_at,
      'manual'::text as source
    from public.marketing_campaigns mc
    left join recipient_stats rs on rs.campaign_id = mc.id
    where mc.company_id = me.company_id
      and lower(coalesce(mc.channel, 'email')) = v_channel
      and coalesce(mc.active, true) is true
      and mc.deleted_at is null
  ), automatic_logs as (
    select
      nl.id,
      nl.company_id,
      lower(coalesce(nl.channel, v_channel)) as channel,
      nl.sender_name,
      coalesce(nl.subject, 'Automatyczne powiadomienie') as subject,
      nl.content as body,
      nl.status,
      1::int as recipient_count,
      nl.created_at,
      nl.sent_at,
      nl.updated_at,
      1::int as total_recipients,
      case when lower(coalesce(nl.status,'')) = 'sent' then 1 else 0 end as sent_count,
      case when lower(coalesce(nl.status,'')) = 'failed' then 1 else 0 end as failed_count,
      case when lower(coalesce(nl.status,'')) = 'skipped' then 1 else 0 end as skipped_count,
      case when lower(coalesce(nl.status,'')) in ('pending','ready','test') then 1 else 0 end as pending_count,
      nl.sent_at as last_sent_at,
      'automatic'::text as source
    from public.notification_logs nl
    where nl.company_id = me.company_id
      and lower(coalesce(nl.channel, v_channel)) = v_channel
  ), campaigns as (
    select * from manual_campaigns
    union all
    select * from automatic_logs
  )
  select jsonb_build_object(
    'company_id', me.company_id,
    'channel', v_channel,
    'campaigns', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'channel', channel,
      'sender_name', sender_name,
      'subject', case when source = 'automatic' then 'Automat: ' || coalesce(subject, 'Powiadomienie') else subject end,
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
      'last_sent_at', last_sent_at,
      'source', source
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
