-- COMPANYMANAGER — 089 WALKINS SUPABASE SALES
-- Sprzedaż bez wizyty -> sales / sale_items / payments.
-- Nie używa localStorage. Rekordy są oznaczone sale_source = 'walkin'.

alter table public.sales
add column if not exists employee_name text,
add column if not exists payment_method text,
add column if not exists sale_source text,
add column if not exists sale_date date,
add column if not exists sale_time time;

alter table public.sale_items
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists sale_id uuid references public.sales(id) on delete cascade,
add column if not exists item_type text,
add column if not exists service_id uuid references public.services(id) on delete set null,
add column if not exists product_id uuid references public.products(id) on delete set null,
add column if not exists name text,
add column if not exists name_snapshot text,
add column if not exists quantity numeric(12,2) default 1,
add column if not exists unit_price numeric(12,2) default 0,
add column if not exists discount numeric(12,2) default 0,
add column if not exists total numeric(12,2) default 0,
add column if not exists total_price numeric(12,2) default 0,
add column if not exists created_at timestamptz default now();

alter table public.products
add column if not exists price numeric(12,2) default 0,
add column if not exists sale_price numeric(12,2),
add column if not exists gross_price numeric(12,2),
add column if not exists net_price numeric(12,2),
add column if not exists retail_price numeric(12,2),
add column if not exists selling_price numeric(12,2),
add column if not exists sale_gross_price numeric(12,2),
add column if not exists unit_price numeric(12,2),
add column if not exists last_purchase_price numeric(12,2) default 0;

alter table public.services
add column if not exists price numeric(12,2),
add column if not exists price_from numeric(12,2),
add column if not exists price_to numeric(12,2);

alter table public.payments
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists sale_id uuid references public.sales(id) on delete cascade,
add column if not exists amount numeric(12,2) default 0,
add column if not exists method text,
add column if not exists status text default 'paid',
add column if not exists paid_at timestamptz default now(),
add column if not exists created_at timestamptz default now();

create index if not exists sales_sale_source_idx on public.sales(sale_source);
create index if not exists sales_sale_date_idx on public.sales(sale_date);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists payments_sale_id_idx on public.payments(sale_id);

create or replace function public.cm_money_first(variadic p_values numeric[])
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

create or replace function public.cm_create_walkin_sale(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  final_company_id uuid;
  v_client_id uuid;
  v_requested_employee_id uuid;
  v_employee_id uuid;
  v_employee_name text;
  v_sale_date date;
  v_sale_time time;
  v_sale_ts timestamptz;
  v_payment_method text;
  v_description text;
  v_service_id uuid;
  v_product_id uuid;
  v_service_name text;
  v_product_name text;
  v_service_price numeric(12,2) := 0;
  v_product_price numeric(12,2) := 0;
  v_amount numeric(12,2) := 0;
  v_sale_id uuid;
  v_sale_number text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  final_company_id := nullif(p_payload->>'company_id','')::uuid;
  if final_company_id is null then
    final_company_id := me.company_id;
  end if;
  if final_company_id is null then
    raise exception 'Missing company context';
  end if;

  if me.role <> 'OWNER' and me.company_id <> final_company_id then
    raise exception 'Cannot create walk-in sale for another company';
  end if;

  if not public.can_access_company_data(final_company_id, 'sales_without_visit_add') then
    raise exception 'Missing sales_without_visit_add permission';
  end if;

  v_client_id := nullif(p_payload->>'client_id','')::uuid;
  if v_client_id is null then
    raise exception 'Missing client';
  end if;

  if not exists (select 1 from public.clients where id = v_client_id and company_id = final_company_id) then
    raise exception 'Client not found in company';
  end if;

  v_requested_employee_id := nullif(p_payload->>'employee_id','')::uuid;
  if v_requested_employee_id is not null then
    select id, coalesce(nullif(full_name,''), email)
    into v_employee_id, v_employee_name
    from public.profiles
    where id = v_requested_employee_id
      and (company_id = final_company_id or me.role = 'OWNER')
    limit 1;
  end if;

  v_employee_name := coalesce(nullif(v_employee_name,''), nullif(p_payload->>'employee_name',''), nullif(me.full_name,''), me.email, '');
  v_sale_date := coalesce(nullif(p_payload->>'sale_date','')::date, current_date);
  v_sale_time := coalesce(nullif(p_payload->>'sale_time','')::time, current_time::time);
  v_sale_ts := (v_sale_date::text || ' ' || v_sale_time::text)::timestamp at time zone current_setting('TIMEZONE');
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'gotówka');
  v_description := nullif(p_payload->>'description','');
  v_service_id := nullif(p_payload->>'service_id','')::uuid;
  v_product_id := nullif(p_payload->>'product_id','')::uuid;
  v_service_name := nullif(p_payload->>'service_custom','');
  v_product_name := nullif(p_payload->>'product_custom','');

  if v_service_id is not null then
    select
      coalesce(nullif(s.name,''), v_service_name, 'Usługa'),
      public.cm_money_first(s.price, s.price_from, s.price_to, 0)
    into v_service_name, v_service_price
    from public.services s
    where s.id = v_service_id and s.company_id = final_company_id;
  end if;

  if v_product_id is not null then
    select
      coalesce(nullif(p.name,''), v_product_name, 'Produkt'),
      public.cm_money_first(p.price, p.sale_price, p.gross_price, p.net_price, p.retail_price, p.selling_price, p.sale_gross_price, p.unit_price, p.last_purchase_price, 0)
    into v_product_name, v_product_price
    from public.products p
    where p.id = v_product_id and p.company_id = final_company_id;
  end if;

  v_service_name := coalesce(v_service_name, nullif(p_payload->>'service_name',''));
  v_product_name := coalesce(v_product_name, nullif(p_payload->>'product_name',''));
  v_amount := coalesce(nullif(p_payload->>'amount','')::numeric, 0);
  if v_amount <= 0 then
    v_amount := coalesce(v_service_price, 0) + coalesce(v_product_price, 0);
  end if;

  if coalesce(v_service_name, '') = '' and coalesce(v_product_name, '') = '' then
    raise exception 'Missing product or service';
  end if;

  -- Jeśli wpisano ręcznie jedną pozycję i kwotę, przypisz pełną kwotę do tej pozycji,
  -- żeby raporty usług/produktów nie pokazywały 0.00.
  if coalesce(v_service_name, '') <> '' and coalesce(v_product_name, '') = '' and coalesce(v_service_price, 0) <= 0 then
    v_service_price := v_amount;
  end if;
  if coalesce(v_product_name, '') <> '' and coalesce(v_service_name, '') = '' and coalesce(v_product_price, 0) <= 0 then
    v_product_price := v_amount;
  end if;

  v_sale_number := 'BW-' || to_char(now(), 'YYYYMMDDHH24MISSMS');

  insert into public.sales(
    company_id,
    appointment_id,
    client_id,
    employee_id,
    employee_name,
    sale_number,
    sale_source,
    sale_date,
    sale_time,
    total_net,
    total_tax,
    total_gross,
    discount_value,
    payment_status,
    payment_method,
    note,
    created_at,
    updated_at
  ) values (
    final_company_id,
    null,
    v_client_id,
    v_employee_id,
    nullif(v_employee_name,''),
    v_sale_number,
    'walkin',
    v_sale_date,
    v_sale_time,
    v_amount,
    0,
    v_amount,
    0,
    'paid',
    v_payment_method,
    v_description,
    v_sale_ts,
    now()
  ) returning id into v_sale_id;

  if coalesce(v_service_name, '') <> '' then
    insert into public.sale_items(company_id, sale_id, item_type, service_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'service', v_service_id, v_service_name, v_service_name, 1, coalesce(v_service_price, v_amount, 0), 0, coalesce(v_service_price, v_amount, 0), coalesce(v_service_price, v_amount, 0), v_sale_ts);
  end if;

  if coalesce(v_product_name, '') <> '' then
    insert into public.sale_items(company_id, sale_id, item_type, product_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'product', v_product_id, v_product_name, v_product_name, 1, coalesce(v_product_price, 0), 0, coalesce(v_product_price, 0), coalesce(v_product_price, 0), v_sale_ts);
  end if;

  insert into public.payments(company_id, sale_id, amount, method, status, paid_at, created_at)
  values (final_company_id, v_sale_id, v_amount, v_payment_method, 'paid', v_sale_ts, now());

  return jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number, 'total', v_amount, 'payment_method', v_payment_method);
end;
$$;

grant execute on function public.cm_create_walkin_sale(jsonb) to authenticated;

create or replace function public.cm_void_walkin_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  s public.sales;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  select * into s from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;

  if coalesce(s.sale_source, '') <> 'walkin' then
    raise exception 'This sale is not a walk-in sale';
  end if;

  if me.role <> 'OWNER' and me.company_id <> s.company_id then
    raise exception 'Cannot delete sale from another company';
  end if;

  if not public.can_access_company_data(s.company_id, 'sales_without_visit_delete') then
    raise exception 'Missing sales_without_visit_delete permission';
  end if;

  update public.sales
  set payment_status = 'void', updated_at = now()
  where id = p_sale_id;

  update public.payments
  set status = 'void'
  where sale_id = p_sale_id;

  return jsonb_build_object('sale_id', p_sale_id, 'status', 'void');
end;
$$;

grant execute on function public.cm_void_walkin_sale(uuid) to authenticated;

notify pgrst, 'reload schema';
