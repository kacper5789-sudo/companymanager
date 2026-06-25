-- CompanyManager 107 — general settings global sync
-- Język programu -> PL/ENG, waluta/strefa czasowa per firma, kursy pod przeliczenia.

alter table public.companies
  add column if not exists exchange_rates jsonb default '{"PLN":1,"EUR":0.23,"USD":0.27}'::jsonb;

alter table public.companies
  add column if not exists currency_converted_at timestamptz,
  add column if not exists previous_currency text,
  add column if not exists exchange_rate_used numeric;

create or replace function public.cm_update_general_settings(
  p_language text default null,
  p_currency text default null,
  p_timezone text default null,
  p_exchange_rates jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  c public.companies;
  v_language text;
  v_currency text;
  v_timezone text;
  v_rates jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;

  if not (
    lower(me.role::text) in ('owner','admin')
    or public.can_access_company_data(me.company_id, 'open_company_manager')
  ) then
    raise exception 'Permission denied';
  end if;

  v_language := lower(coalesce(nullif(p_language, ''), 'pl'));
  if v_language in ('en','eng','english','en-gb') then v_language := 'en-gb'; else v_language := 'pl'; end if;

  v_currency := upper(coalesce(nullif(p_currency, ''), 'PLN'));
  if v_currency not in ('PLN','EUR','USD') then v_currency := 'PLN'; end if;

  v_timezone := coalesce(nullif(p_timezone, ''), 'Europe/Warsaw');
  if lower(v_timezone) in ('warsaw/poland','poland/warsaw','warszawa','polska') then v_timezone := 'Europe/Warsaw'; end if;

  v_rates := coalesce(p_exchange_rates, '{"PLN":1,"EUR":0.23,"USD":0.27}'::jsonb);
  v_rates := jsonb_build_object(
    'PLN', 1,
    'EUR', coalesce(nullif(v_rates->>'EUR','')::numeric, 0.23),
    'USD', coalesce(nullif(v_rates->>'USD','')::numeric, 0.27)
  );

  select * into c from public.companies where id = me.company_id for update;
  if not found then raise exception 'Company not found'; end if;

  update public.companies
  set
    language = v_language,
    currency = v_currency,
    timezone = v_timezone,
    exchange_rates = v_rates,
    previous_currency = case when coalesce(currency,'PLN') is distinct from v_currency then currency else previous_currency end,
    exchange_rate_used = case when coalesce(currency,'PLN') is distinct from v_currency then coalesce(nullif(v_rates->>v_currency,'')::numeric, 1) else exchange_rate_used end,
    currency_converted_at = case when coalesce(currency,'PLN') is distinct from v_currency then now() else currency_converted_at end,
    updated_at = now()
  where id = me.company_id
  returning * into c;

  return jsonb_build_object('company', to_jsonb(c));
end;
$$;

grant execute on function public.cm_update_general_settings(text,text,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
