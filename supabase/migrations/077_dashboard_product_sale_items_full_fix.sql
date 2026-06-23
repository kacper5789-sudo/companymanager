-- COMPANYMANAGER — 077 DASHBOARD PRODUCT SALE ITEMS FULL FIX
-- Produkt wybrany w Dashboardzie ma doliczać cenę, zapisywać się na wizycie
-- i po kliknięciu "Zakończ wizytę" trafiać do sale_items / raportów sprzedaży.

alter table public.products
add column if not exists sale_price numeric(12,2),
add column if not exists gross_price numeric(12,2),
add column if not exists net_price numeric(12,2),
add column if not exists retail_price numeric(12,2),
add column if not exists selling_price numeric(12,2),
add column if not exists sale_gross_price numeric(12,2),
add column if not exists unit_price numeric(12,2);

alter table public.appointments
add column if not exists service_name text,
add column if not exists product_id uuid references public.products(id) on delete set null,
add column if not exists product_name text,
add column if not exists product_price numeric(12,2),
add column if not exists product_quantity numeric(12,2) default 1,
add column if not exists price numeric(12,2) default 0,
add column if not exists total numeric(12,2) default 0;

alter table public.sale_items
add column if not exists name_snapshot text,
add column if not exists total_price numeric(12,2);

alter table public.sale_items
alter column name set default 'Pozycja sprzedaży';

alter table public.sale_items
alter column name_snapshot set default 'Pozycja sprzedaży';

create or replace function public.cm_first_money(variadic values numeric[])
returns numeric
language plpgsql
immutable
as $$
declare
  v numeric;
begin
  foreach v in array values loop
    if coalesce(v, 0) > 0 then
      return v;
    end if;
  end loop;
  return 0;
end;
$$;

create or replace function public.finish_appointment_with_sale(
  p_appointment_id uuid,
  p_company_id uuid default null,
  p_paid_amount numeric default null,
  p_payment_method text default 'gotówka',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  a public.appointments;
  final_company_id uuid;
  final_total numeric(12,2);
  final_paid numeric(12,2);
  v_sale_id uuid;
  service_price numeric(12,2) := 0;
  product_unit_price numeric(12,2) := 0;
  product_qty numeric(12,2) := 1;
  product_total numeric(12,2) := 0;
  service_item_name text;
  product_item_name text;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  select * into a
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;

  final_company_id := a.company_id;

  if p_company_id is not null and p_company_id <> final_company_id then
    raise exception 'Wrong company context';
  end if;

  if me.role <> 'OWNER' and me.company_id <> final_company_id then
    raise exception 'Cannot finish appointment from another company';
  end if;

  if not public.can_access_company_data(final_company_id, 'appointments_finish') then
    raise exception 'Missing appointments_finish permission';
  end if;

  if a.service_id is not null then
    select
      public.cm_first_money(s.price_from, s.price, s.price_to, 0),
      coalesce(nullif(s.name, ''), nullif(a.service_name, ''), 'Usługa')
    into service_price, service_item_name
    from public.services s
    where s.id = a.service_id;
  end if;

  if a.product_id is not null then
    select
      public.cm_first_money(a.product_price, p.price, p.sale_price, p.gross_price, p.net_price, p.retail_price, p.selling_price, p.sale_gross_price, p.unit_price, p.last_purchase_price, 0),
      coalesce(nullif(a.product_name, ''), nullif(p.name, ''), 'Produkt')
    into product_unit_price, product_item_name
    from public.products p
    where p.id = a.product_id;
  end if;

  product_qty := greatest(coalesce(a.product_quantity, 1), 1);
  product_total := coalesce(product_unit_price, 0) * product_qty;

  final_total := public.cm_first_money(a.total, a.price, 0);
  if final_total = 0 then
    final_total := coalesce(service_price, 0) + coalesce(product_total, 0);
  end if;

  final_paid := coalesce(p_paid_amount, final_total, 0);

  select id into v_sale_id
  from public.sales
  where appointment_id = p_appointment_id
    and company_id = final_company_id
  order by created_at desc
  limit 1;

  if v_sale_id is null then
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
      p_appointment_id,
      coalesce(a.client_id, a.customer_id),
      a.employee_id,
      'WIZ-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      final_total,
      0,
      final_total,
      0,
      case when final_paid >= final_total then 'paid' else 'partial' end,
      nullif(p_note, ''),
      now(),
      now()
    ) returning id into v_sale_id;
  else
    update public.sales
    set
      client_id = coalesce(a.client_id, a.customer_id),
      employee_id = a.employee_id,
      total_net = final_total,
      total_tax = 0,
      total_gross = final_total,
      payment_status = case when final_paid >= final_total then 'paid' else 'partial' end,
      note = nullif(p_note, ''),
      updated_at = now()
    where id = v_sale_id;

    delete from public.sale_items where public.sale_items.sale_id = v_sale_id;
    delete from public.payments where public.payments.sale_id = v_sale_id;
  end if;

  if a.service_id is not null then
    insert into public.sale_items(
      company_id, sale_id, item_type, service_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at
    ) values (
      final_company_id, v_sale_id, 'service', a.service_id,
      coalesce(service_item_name, a.service_name, 'Usługa'), coalesce(service_item_name, a.service_name, 'Usługa'),
      1, coalesce(service_price, 0), 0, coalesce(service_price, 0), coalesce(service_price, 0), now()
    );
  end if;

  if a.product_id is not null then
    insert into public.sale_items(
      company_id, sale_id, item_type, product_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at
    ) values (
      final_company_id, v_sale_id, 'product', a.product_id,
      coalesce(product_item_name, a.product_name, 'Produkt'), coalesce(product_item_name, a.product_name, 'Produkt'),
      product_qty, coalesce(product_unit_price, 0), 0, product_total, product_total, now()
    );
  end if;

  insert into public.payments(
    company_id, sale_id, amount, method, paid_at, created_at
  ) values (
    final_company_id, v_sale_id, final_paid, coalesce(nullif(p_payment_method, ''), 'gotówka'), now(), now()
  );

  update public.appointments
  set
    status = 'zakończone'::public.appointment_status,
    finished = true,
    finished_at = now(),
    paid_amount = final_paid,
    payment_method = coalesce(nullif(p_payment_method, ''), 'gotówka'),
    payment_status = case when final_paid >= final_total then 'paid' else 'partial' end,
    product_price = case when a.product_id is not null then coalesce(a.product_price, product_unit_price, 0) else a.product_price end,
    product_name = case when a.product_id is not null then coalesce(a.product_name, product_item_name, 'Produkt') else a.product_name end,
    product_quantity = case when a.product_id is not null then product_qty else a.product_quantity end,
    total = final_total,
    price = final_total,
    updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'appointment_id', p_appointment_id,
    'sale_id', v_sale_id,
    'total', final_total,
    'paid_amount', final_paid,
    'product_total', product_total,
    'status', 'zakończone'
  );
end;
$$;

grant execute on function public.finish_appointment_with_sale(uuid, uuid, numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
