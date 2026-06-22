-- COMPANYMANAGER — 081 PASSES FORCE SALES EMPLOYEE NULL FIX
-- Twardy fix: sales.employee_id przy sprzedaży karnetu ustawiamy na NULL,
-- bo w aktualnej bazie FK sales_employee_id_fkey nie pasuje do listy pracowników z UI.
-- Nazwa sprzedawcy zostaje zapisana jako snapshot w passes.employee_name.

create or replace function public.cm_create_pass_sale(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  final_company_id uuid;
  v_pass_id uuid;
  v_sale_id uuid;
  v_sale_item_id uuid;
  v_number text;
  v_buyer_client_id uuid;
  v_beneficiary_client_id uuid;
  v_requested_employee_id uuid;
  v_service_id uuid;
  v_service_name text;
  v_buyer_name text;
  v_beneficiary_name text;
  v_employee_name text;
  v_name text;
  v_pass_type text;
  v_value numeric(12,2);
  v_units numeric(12,2);
  v_sale_date date;
  v_sale_time text;
  v_valid_until date;
  v_payment_method text;
  v_description text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  final_company_id := coalesce(nullif(p_payload->>'company_id','')::uuid, me.company_id);
  if final_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if not public.can_access_company_data(final_company_id, 'passes_add') then
    raise exception 'Missing passes_add permission';
  end if;

  v_buyer_client_id := nullif(p_payload->>'buyer_client_id','')::uuid;
  v_beneficiary_client_id := nullif(p_payload->>'beneficiary_client_id','')::uuid;
  v_requested_employee_id := nullif(p_payload->>'employee_id','')::uuid;
  v_service_id := nullif(p_payload->>'service_id','')::uuid;
  v_pass_type := coalesce(nullif(p_payload->>'pass_type',''), 'amount');
  v_value := coalesce(nullif(p_payload->>'value','')::numeric, 0);
  v_units := coalesce(nullif(p_payload->>'total_units','')::numeric, 0);
  v_sale_date := coalesce(nullif(p_payload->>'sale_date','')::date, current_date);
  v_sale_time := left(coalesce(p_payload->>'sale_time',''), 5);
  v_valid_until := nullif(p_payload->>'valid_until','')::date;
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'gotówka');
  v_description := nullif(p_payload->>'description','');

  if v_beneficiary_client_id is null then
    raise exception 'Missing beneficiary client';
  end if;
  if v_buyer_client_id is null then
    v_buyer_client_id := v_beneficiary_client_id;
  end if;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into v_buyer_name
  from public.clients
  where id = v_buyer_client_id and company_id = final_company_id;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into v_beneficiary_name
  from public.clients
  where id = v_beneficiary_client_id and company_id = final_company_id;

  if v_requested_employee_id is not null then
    select full_name into v_employee_name
    from public.profiles
    where id = v_requested_employee_id
    limit 1;
  end if;

  v_employee_name := coalesce(
    nullif(v_employee_name,''),
    nullif(p_payload->>'employee_name',''),
    nullif(me.full_name,''),
    me.email,
    ''
  );

  if v_service_id is not null then
    select name into v_service_name
    from public.services
    where id = v_service_id and company_id = final_company_id;
  end if;

  v_number := coalesce(nullif(p_payload->>'number',''), public.cm_next_pass_number(final_company_id));
  v_name := coalesce(nullif(p_payload->>'name',''), case
    when v_pass_type in ('service','units') and v_units > 0 then 'Karnet ' || trim(to_char(v_units, 'FM999999990.##')) || 'x ' || coalesce(v_service_name, 'usługa')
    else 'Karnet kwotowy'
  end);

  insert into public.sales(
    company_id,
    appointment_id,
    client_id,
    employee_id,
    sale_number,
    total_net,
    total_tax,
    total_gross,
    discount_value,
    payment_status,
    note,
    created_at,
    updated_at
  ) values (
    final_company_id,
    null,
    v_buyer_client_id,
    null,
    'KARNET-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    v_value,
    0,
    v_value,
    0,
    'paid',
    v_description,
    now(),
    now()
  ) returning id into v_sale_id;

  insert into public.passes(
    company_id,
    customer_id,
    buyer_client_id,
    beneficiary_client_id,
    employee_id,
    name,
    number,
    sale_date,
    sale_time,
    valid_until,
    payment_method,
    buyer,
    customer_name,
    employee_name,
    value,
    remaining,
    pass_type,
    service_id,
    service_name,
    total_units,
    remaining_units,
    description,
    status,
    active,
    sale_id,
    created_by,
    updated_at
  ) values (
    final_company_id,
    v_beneficiary_client_id,
    v_buyer_client_id,
    v_beneficiary_client_id,
    null,
    v_name,
    v_number,
    v_sale_date,
    v_sale_time,
    v_valid_until,
    v_payment_method,
    coalesce(nullif(v_buyer_name,''), '-'),
    coalesce(nullif(v_beneficiary_name,''), '-'),
    nullif(v_employee_name,''),
    v_value,
    v_value,
    v_pass_type,
    v_service_id,
    v_service_name,
    v_units,
    v_units,
    v_description,
    'aktualne',
    true,
    v_sale_id,
    auth.uid(),
    now()
  ) returning id into v_pass_id;

  insert into public.sale_items(
    company_id,
    sale_id,
    item_type,
    pass_id,
    name,
    name_snapshot,
    quantity,
    unit_price,
    discount,
    total,
    total_price,
    created_at
  ) values (
    final_company_id,
    v_sale_id,
    'pass',
    v_pass_id,
    v_name,
    v_name,
    1,
    v_value,
    0,
    v_value,
    v_value,
    now()
  ) returning id into v_sale_item_id;

  update public.passes
  set sale_item_id = v_sale_item_id
  where id = v_pass_id;

  insert into public.payments(
    company_id,
    sale_id,
    amount,
    method,
    status,
    paid_at,
    created_at
  ) values (
    final_company_id,
    v_sale_id,
    v_value,
    v_payment_method,
    'paid',
    now(),
    now()
  );

  return jsonb_build_object(
    'pass_id', v_pass_id,
    'sale_id', v_sale_id,
    'total', v_value,
    'employee_id', null,
    'employee_name', v_employee_name
  );
end;
$$;

grant execute on function public.cm_create_pass_sale(jsonb) to authenticated;

notify pgrst, 'reload schema';
