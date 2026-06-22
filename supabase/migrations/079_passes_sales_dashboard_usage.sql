-- COMPANYMANAGER — 079 PASSES SALES + DASHBOARD USAGE
-- Karnety jako sprzedaż przedpłacona + osoba korzystająca + użycie karnetu przy zakończeniu wizyty.

alter table public.passes
add column if not exists buyer_client_id uuid references public.clients(id) on delete set null,
add column if not exists beneficiary_client_id uuid references public.clients(id) on delete set null,
add column if not exists service_id uuid references public.services(id) on delete set null,
add column if not exists service_name text,
add column if not exists pass_type text default 'amount',
add column if not exists total_units numeric(12,2) default 0,
add column if not exists remaining_units numeric(12,2) default 0,
add column if not exists sale_id uuid references public.sales(id) on delete set null,
add column if not exists sale_item_id uuid references public.sale_items(id) on delete set null,
add column if not exists used_value numeric(12,2) default 0,
add column if not exists used_units numeric(12,2) default 0,
add column if not exists last_used_at timestamptz;

-- kompatybilność: stare customer_id traktujemy jako osobę korzystającą
update public.passes
set beneficiary_client_id = coalesce(beneficiary_client_id, customer_id),
    buyer_client_id = coalesce(buyer_client_id, customer_id),
    remaining_units = case when coalesce(remaining_units,0) = 0 and coalesce(total_units,0) > 0 then total_units else remaining_units end
where beneficiary_client_id is null or buyer_client_id is null;

alter table public.appointments
add column if not exists pass_id uuid references public.passes(id) on delete set null,
add column if not exists pass_name text,
add column if not exists pass_used_value numeric(12,2) default 0,
add column if not exists pass_used_units numeric(12,2) default 0;

alter table public.sale_items
add column if not exists pass_id uuid references public.passes(id) on delete set null,
add column if not exists name_snapshot text,
add column if not exists total_price numeric(12,2);

alter table public.sale_items
alter column name set default 'Pozycja sprzedaży';

alter table public.sale_items
alter column name_snapshot set default 'Pozycja sprzedaży';

create index if not exists passes_buyer_client_id_idx on public.passes(buyer_client_id);
create index if not exists passes_beneficiary_client_id_idx on public.passes(beneficiary_client_id);
create index if not exists passes_service_id_idx on public.passes(service_id);
create index if not exists appointments_pass_id_idx on public.appointments(pass_id);

create or replace function public.cm_first_money(variadic p_values numeric[])
returns numeric
language plpgsql
immutable
as $$
declare
  v numeric;
begin
  foreach v in array p_values loop
    if coalesce(v, 0) > 0 then
      return v;
    end if;
  end loop;
  return 0;
end;
$$;

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
  v_employee_id uuid;
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
  if not found then raise exception 'Profile not found'; end if;

  final_company_id := coalesce((p_payload->>'company_id')::uuid, me.company_id);
  if final_company_id is null then raise exception 'Missing company_id'; end if;

  if not public.can_access_company_data(final_company_id, 'passes_add') then
    raise exception 'Missing passes_add permission';
  end if;

  v_buyer_client_id := nullif(p_payload->>'buyer_client_id','')::uuid;
  v_beneficiary_client_id := nullif(p_payload->>'beneficiary_client_id','')::uuid;
  v_employee_id := nullif(p_payload->>'employee_id','')::uuid;
  v_service_id := nullif(p_payload->>'service_id','')::uuid;
  v_pass_type := coalesce(nullif(p_payload->>'pass_type',''), 'amount');
  v_value := coalesce(nullif(p_payload->>'value','')::numeric, 0);
  v_units := coalesce(nullif(p_payload->>'total_units','')::numeric, 0);
  v_sale_date := coalesce(nullif(p_payload->>'sale_date','')::date, current_date);
  v_sale_time := left(coalesce(p_payload->>'sale_time',''), 5);
  v_valid_until := nullif(p_payload->>'valid_until','')::date;
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'gotówka');
  v_description := nullif(p_payload->>'description','');

  if v_beneficiary_client_id is null then raise exception 'Missing beneficiary client'; end if;
  if v_buyer_client_id is null then v_buyer_client_id := v_beneficiary_client_id; end if;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into v_buyer_name
  from public.clients where id = v_buyer_client_id and company_id = final_company_id;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into v_beneficiary_name
  from public.clients where id = v_beneficiary_client_id and company_id = final_company_id;

  if v_employee_id is not null then
    select full_name into v_employee_name from public.profiles where id = v_employee_id;
  end if;

  if v_service_id is not null then
    select name into v_service_name from public.services where id = v_service_id and company_id = final_company_id;
  end if;

  v_number := coalesce(nullif(p_payload->>'number',''), public.cm_next_pass_number(final_company_id));
  v_name := coalesce(nullif(p_payload->>'name',''), case
    when v_pass_type in ('service','units') and v_units > 0 then 'Karnet ' || trim(to_char(v_units, 'FM999999990.##')) || 'x ' || coalesce(v_service_name, 'usługa')
    else 'Karnet'
  end);

  insert into public.sales(
    company_id, appointment_id, client_id, employee_id, sale_number,
    total_net, total_tax, total_gross, discount_value, payment_status, note, created_at, updated_at
  ) values (
    final_company_id, null, v_buyer_client_id, v_employee_id, 'KARNET-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    v_value, 0, v_value, 0, 'paid', v_description, now(), now()
  ) returning id into v_sale_id;

  insert into public.passes(
    company_id, customer_id, buyer_client_id, beneficiary_client_id, employee_id,
    name, number, sale_date, sale_time, valid_until, payment_method,
    buyer, customer_name, employee_name, value, remaining,
    pass_type, service_id, service_name, total_units, remaining_units,
    description, status, active, sale_id, created_by, updated_at
  ) values (
    final_company_id, v_beneficiary_client_id, v_buyer_client_id, v_beneficiary_client_id, v_employee_id,
    v_name, v_number, v_sale_date, v_sale_time, v_valid_until, v_payment_method,
    coalesce(nullif(v_buyer_name,''), '-'), coalesce(nullif(v_beneficiary_name,''), '-'), v_employee_name,
    v_value, v_value, v_pass_type, v_service_id, v_service_name, v_units, v_units,
    v_description, 'aktualne', true, v_sale_id, auth.uid(), now()
  ) returning id into v_pass_id;

  insert into public.sale_items(
    company_id, sale_id, item_type, pass_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at
  ) values (
    final_company_id, v_sale_id, 'pass', v_pass_id, v_name, v_name, 1, v_value, 0, v_value, v_value, now()
  ) returning id into v_sale_item_id;

  update public.passes set sale_item_id = v_sale_item_id where id = v_pass_id;

  insert into public.payments(company_id, sale_id, amount, method, paid_at, created_at)
  values (final_company_id, v_sale_id, v_value, v_payment_method, now(), now());

  return jsonb_build_object('pass_id', v_pass_id, 'sale_id', v_sale_id, 'value', v_value, 'number', v_number);
end;
$$;

grant execute on function public.cm_create_pass_sale(jsonb) to authenticated;

create or replace function public.finish_appointment_with_sale(
  p_appointment_id uuid,
  p_company_id uuid default null,
  p_paid_amount numeric default null,
  p_payment_method text default 'gotówka',
  p_note text default null,
  p_pass_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  a public.appointments;
  pass public.passes;
  final_company_id uuid;
  final_total numeric(12,2) := 0;
  final_paid numeric(12,2) := 0;
  v_sale_id uuid;
  service_unit_price numeric(12,2) := 0;
  product_unit_price numeric(12,2) := 0;
  product_qty numeric(12,2) := 1;
  product_total numeric(12,2) := 0;
  service_item_name text;
  product_item_name text;
  service_charge numeric(12,2) := 0;
  pass_used_value numeric(12,2) := 0;
  pass_used_units numeric(12,2) := 0;
  effective_pass_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;

  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;

  final_company_id := a.company_id;
  if p_company_id is not null and p_company_id <> final_company_id then raise exception 'Wrong company context'; end if;
  if me.role <> 'OWNER' and me.company_id <> final_company_id then raise exception 'Cannot finish appointment from another company'; end if;
  if not public.can_access_company_data(final_company_id, 'appointments_finish') then raise exception 'Missing appointments_finish permission'; end if;

  effective_pass_id := coalesce(p_pass_id, a.pass_id);

  if a.service_id is not null then
    select public.cm_first_money(s.price_from, s.price, s.price_to, 0), coalesce(nullif(s.name,''), nullif(a.service_name,''), 'Usługa')
    into service_unit_price, service_item_name
    from public.services s where s.id = a.service_id;
  end if;

  if a.product_id is not null then
    select public.cm_first_money(a.product_price, p.price, p.sale_price, p.gross_price, p.net_price, p.retail_price, p.selling_price, p.sale_gross_price, p.unit_price, p.last_purchase_price, 0),
           coalesce(nullif(a.product_name,''), nullif(p.name,''), 'Produkt')
    into product_unit_price, product_item_name
    from public.products p where p.id = a.product_id;
  end if;

  product_qty := greatest(coalesce(a.product_quantity, 1), 1);
  product_total := coalesce(product_unit_price, 0) * product_qty;
  service_charge := coalesce(service_unit_price, 0);

  if effective_pass_id is not null then
    select * into pass from public.passes
    where id = effective_pass_id and company_id = final_company_id and active = true
    for update;

    if not found then raise exception 'Karnet nie istnieje albo jest nieaktywny'; end if;
    if coalesce(pass.beneficiary_client_id, pass.customer_id) <> coalesce(a.client_id, a.customer_id) then
      raise exception 'Karnet jest przypisany do innego klienta';
    end if;
    if pass.valid_until is not null and pass.valid_until < current_date then
      raise exception 'Karnet jest po terminie';
    end if;
    if pass.service_id is not null and a.service_id is not null and pass.service_id <> a.service_id then
      raise exception 'Karnet dotyczy innej usługi';
    end if;

    if pass.pass_type in ('service','units') then
      if coalesce(pass.remaining_units,0) <= 0 then raise exception 'Brak wejść na karnecie'; end if;
      pass_used_units := 1;
      pass_used_value := least(service_charge, coalesce(pass.remaining, service_charge));
      service_charge := 0;
    else
      if coalesce(pass.remaining,0) <= 0 then raise exception 'Brak środków na karnecie'; end if;
      pass_used_value := least(service_charge, coalesce(pass.remaining,0));
      service_charge := greatest(service_charge - pass_used_value, 0);
    end if;
  end if;

  final_total := service_charge + product_total;
  if final_total = 0 and effective_pass_id is null then
    final_total := public.cm_first_money(a.total, a.price, 0);
  end if;
  final_paid := coalesce(p_paid_amount, final_total, 0);

  select id into v_sale_id from public.sales
  where appointment_id = p_appointment_id and company_id = final_company_id
  order by created_at desc limit 1;

  if v_sale_id is null then
    insert into public.sales(company_id, appointment_id, client_id, employee_id, sale_number, total_net, total_tax, total_gross, discount_value, payment_status, note, created_at, updated_at)
    values (final_company_id, p_appointment_id, coalesce(a.client_id, a.customer_id), a.employee_id, 'WIZ-' || to_char(now(), 'YYYYMMDDHH24MISS'), final_total, 0, final_total, 0, case when final_paid >= final_total then 'paid' else 'partial' end, nullif(p_note,''), now(), now())
    returning id into v_sale_id;
  else
    update public.sales set client_id = coalesce(a.client_id, a.customer_id), employee_id = a.employee_id, total_net = final_total, total_tax = 0, total_gross = final_total, payment_status = case when final_paid >= final_total then 'paid' else 'partial' end, note = nullif(p_note,''), updated_at = now()
    where id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.payments where sale_id = v_sale_id;
  end if;

  if a.service_id is not null then
    insert into public.sale_items(company_id, sale_id, item_type, service_id, pass_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'service', a.service_id, effective_pass_id, coalesce(service_item_name, a.service_name, 'Usługa'), coalesce(service_item_name, a.service_name, 'Usługa'), 1, service_unit_price, pass_used_value, service_charge, service_charge, now());
  end if;

  if a.product_id is not null then
    insert into public.sale_items(company_id, sale_id, item_type, product_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'product', a.product_id, coalesce(product_item_name, a.product_name, 'Produkt'), coalesce(product_item_name, a.product_name, 'Produkt'), product_qty, product_unit_price, 0, product_total, product_total, now());
  end if;

  if final_paid > 0 then
    insert into public.payments(company_id, sale_id, amount, method, paid_at, created_at)
    values (final_company_id, v_sale_id, final_paid, coalesce(nullif(p_payment_method,''), 'gotówka'), now(), now());
  end if;

  if effective_pass_id is not null then
    update public.passes
    set remaining = greatest(coalesce(remaining,0) - pass_used_value, 0),
        remaining_units = greatest(coalesce(remaining_units,0) - pass_used_units, 0),
        used_value = coalesce(used_value,0) + pass_used_value,
        used_units = coalesce(used_units,0) + pass_used_units,
        last_used_at = now(),
        status = case
          when pass.pass_type in ('service','units') and greatest(coalesce(remaining_units,0) - pass_used_units, 0) <= 0 then 'zrealizowane'
          when pass.pass_type not in ('service','units') and greatest(coalesce(remaining,0) - pass_used_value, 0) <= 0 then 'zrealizowane'
          else status
        end,
        updated_at = now()
    where id = effective_pass_id;
  end if;

  update public.appointments
  set status = 'zakończone'::public.appointment_status,
      finished = true,
      finished_at = now(),
      paid_amount = final_paid,
      payment_method = coalesce(nullif(p_payment_method,''), case when effective_pass_id is not null then 'karnet' else 'gotówka' end),
      payment_status = case when final_paid >= final_total then 'paid' else 'partial' end,
      pass_id = effective_pass_id,
      pass_name = case when effective_pass_id is not null then pass.name else pass_name end,
      pass_used_value = pass_used_value,
      pass_used_units = pass_used_units,
      product_price = case when a.product_id is not null then coalesce(a.product_price, product_unit_price, 0) else a.product_price end,
      product_name = case when a.product_id is not null then coalesce(a.product_name, product_item_name, 'Produkt') else a.product_name end,
      product_quantity = case when a.product_id is not null then product_qty else a.product_quantity end,
      total = final_total,
      price = final_total,
      updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object('appointment_id', p_appointment_id, 'sale_id', v_sale_id, 'pass_id', effective_pass_id, 'total', final_total, 'paid_amount', final_paid, 'pass_used_value', pass_used_value, 'pass_used_units', pass_used_units, 'status', 'zakończone');
end;
$$;

grant execute on function public.finish_appointment_with_sale(uuid, uuid, numeric, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
