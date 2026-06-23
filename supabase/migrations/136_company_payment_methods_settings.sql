-- COMPANYMANAGER 049E
-- Panel firmy: metody płatności z flagami obrotu i prowizji

alter table public.companies
add column if not exists payment_methods jsonb default '[{"name":"gotówka","turnover":true,"commission":true,"default":true}]'::jsonb,
add column if not exists client_marketing_consent_enabled boolean default true,
add column if not exists client_marketing_consent_explicit boolean default true,
add column if not exists appointment_break_minutes integer default 0;

update public.companies
set payment_methods = coalesce(
  payment_methods,
  '[{"name":"gotówka","turnover":true,"commission":true,"default":true}]'::jsonb
);

grant select, update on public.companies to authenticated;

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
    me.role = 'OWNER'
    or me.role = 'ADMIN'
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
    visit_email_sender = coalesce(nullif(p_payload->>'visit_email_sender', ''), visit_email_sender),
    visit_email_template = coalesce(nullif(p_payload->>'visit_email_template', ''), visit_email_template),
    birthday_email = coalesce((p_payload->>'birthday_email')::boolean, birthday_email),
    birthday_email_sender = coalesce(nullif(p_payload->>'birthday_email_sender', ''), birthday_email_sender),
    birthday_email_template = coalesce(nullif(p_payload->>'birthday_email_template', ''), birthday_email_template),
    after_add_email = coalesce((p_payload->>'after_add_email')::boolean, after_add_email),
    after_add_email_sender = coalesce(nullif(p_payload->>'after_add_email_sender', ''), after_add_email_sender),
    after_add_email_template = coalesce(nullif(p_payload->>'after_add_email_template', ''), after_add_email_template),
    after_visit_email = coalesce((p_payload->>'after_visit_email')::boolean, after_visit_email),
    after_visit_email_sender = coalesce(nullif(p_payload->>'after_visit_email_sender', ''), after_visit_email_sender),
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
    end
  where id = target_company_id
  returning * into updated_company;

  return jsonb_build_object('company', to_jsonb(updated_company));
end;
$$;

grant execute on function public.company_panel_update(jsonb) to authenticated;

notify pgrst, 'reload schema';
