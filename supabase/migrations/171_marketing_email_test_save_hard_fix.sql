-- COMPANYMANAGER — 095 MARKETING EMAIL TEST/SAVE HARD FIX
-- Naprawia 400 przy zapisie/test email: uzupełnia kolumny klientów i odświeża RPC marketingu.

alter table public.clients
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists full_name text,
  add column if not exists gender text,
  add column if not exists active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists marketing_email boolean default false,
  add column if not exists marketing_sms boolean default false;

update public.clients
set active = true
where active is null;

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
  v_has_filter boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;
  if v_channel not in ('email','sms') then raise exception 'Invalid channel'; end if;

  v_has_filter := coalesce((p_filters->>'allCustomers')::boolean, false)
    or coalesce((p_filters->>'allWomen')::boolean, false)
    or coalesce((p_filters->>'allMen')::boolean, false)
    or coalesce((p_filters->>'updatedRange')::boolean, false)
    or coalesce((p_filters->>'addedRange')::boolean, false)
    or (jsonb_typeof(p_filters->'clientIds') = 'array' and jsonb_array_length(p_filters->'clientIds') > 0);

  with base as (
    select
      c.id,
      c.company_id,
      c.email,
      c.phone,
      nullif(trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '') as joined_name,
      c.full_name,
      c.gender,
      c.created_at,
      c.updated_at,
      c.marketing_email,
      c.marketing_sms
    from public.clients c
    where c.company_id = me.company_id
      and coalesce(c.active, true) is true
      and (
        case when v_channel = 'email'
          then coalesce(c.marketing_email, false) is true and nullif(trim(coalesce(c.email,'')),'') is not null
          else coalesce(c.marketing_sms, false) is true and nullif(trim(coalesce(c.phone,'')),'') is not null
        end
      )
      and (
        v_has_filter is false
        or coalesce((p_filters->>'allCustomers')::boolean, false) is true
        or (coalesce((p_filters->>'allWomen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('kobieta','female','woman'))
        or (coalesce((p_filters->>'allMen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('mężczyzna','mezczyzna','male','man'))
        or (jsonb_typeof(p_filters->'clientIds') = 'array' and c.id::text in (select jsonb_array_elements_text(p_filters->'clientIds')))
        or (coalesce((p_filters->>'updatedRange')::boolean, false) is true and c.updated_at::date between coalesce(nullif(p_filters->>'updatedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'updatedTo','')::date, current_date))
        or (coalesce((p_filters->>'addedRange')::boolean, false) is true and c.created_at::date between coalesce(nullif(p_filters->>'addedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'addedTo','')::date, current_date))
      )
  )
  select jsonb_build_object(
    'count', count(*),
    'recipients', coalesce(jsonb_agg(jsonb_build_object(
      'client_id', id,
      'name', coalesce(joined_name, nullif(full_name,''), nullif(email,''), nullif(phone,''), 'Klient'),
      'email', email,
      'phone', phone
    ) order by coalesce(joined_name, full_name, email, phone)), '[]'::jsonb)
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
  v_count integer := 0;
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
  v_test := nullif(trim(coalesce(p_payload->>'test_recipient','')), '');

  if v_body = '' then raise exception 'Missing message body'; end if;
  if v_channel='email' and coalesce(v_subject,'') = '' then raise exception 'Missing email subject'; end if;
  if v_status = 'test' and v_test is null then raise exception 'Missing test recipient'; end if;

  v_recips := public.cm_marketing_recipients(v_channel, v_filters);
  v_count := coalesce((v_recips->>'count')::integer, 0);
  if v_status = 'test' then
    v_count := 1;
  end if;

  insert into public.marketing_campaigns(
    company_id, channel, sender_name, subject, body, audience_filter, recipient_count, status, test_recipient, created_by, created_at, updated_at, active
  ) values (
    me.company_id, v_channel, v_sender, v_subject, v_body, v_filters, v_count, v_status, v_test, auth.uid(), now(), now(), true
  ) returning id into v_campaign_id;

  if v_status = 'test' then
    insert into public.marketing_campaign_recipients(company_id, campaign_id, client_id, recipient_name, email, phone, channel, status, active)
    values (me.company_id, v_campaign_id, null, 'Test', case when v_channel='email' then v_test else null end, case when v_channel='sms' then v_test else null end, v_channel, 'test', true);
  else
    for r in select * from jsonb_array_elements(coalesce(v_recips->'recipients','[]'::jsonb)) loop
      insert into public.marketing_campaign_recipients(company_id, campaign_id, client_id, recipient_name, email, phone, channel, status, active)
      values (
        me.company_id,
        v_campaign_id,
        nullif(r->>'client_id','')::uuid,
        nullif(r->>'name',''),
        nullif(r->>'email',''),
        nullif(r->>'phone',''),
        v_channel,
        case when v_status='ready_to_send' then 'ready' else 'pending' end,
        true
      );
    end loop;
  end if;

  return jsonb_build_object('campaign_id', v_campaign_id, 'recipient_count', v_count, 'status', v_status);
end;
$$;

grant execute on function public.cm_marketing_save_campaign(jsonb) to authenticated;

notify pgrst, 'reload schema';
