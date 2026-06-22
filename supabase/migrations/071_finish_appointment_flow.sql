-- COMPANYMANAGER — 071 FINISH APPOINTMENT FLOW
-- Zakończ wizytę -> status zakończone -> sprzedaż / płatność / raporty

alter type public.appointment_status add value if not exists 'zakończone';

alter table public.appointments
add column if not exists finished boolean not null default false,
add column if not exists finished_at timestamptz,
add column if not exists paid_amount numeric(12,2) default 0,
add column if not exists payment_method text,
add column if not exists payment_status text default 'unpaid',
add column if not exists total numeric(12,2) default 0;

alter table public.sales
add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
add column if not exists client_id uuid references public.clients(id) on delete set null,
add column if not exists employee_id uuid references public.profiles(id) on delete set null,
add column if not exists sale_number text,
add column if not exists total_net numeric(12,2) default 0,
add column if not exists total_tax numeric(12,2) default 0,
add column if not exists total_gross numeric(12,2) default 0,
add column if not exists discount_value numeric(12,2) default 0,
add column if not exists payment_status text default 'paid',
add column if not exists note text,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

alter table public.sale_items
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists sale_id uuid references public.sales(id) on delete cascade,
add column if not exists item_type text,
add column if not exists service_id uuid references public.services(id) on delete set null,
add column if not exists product_id uuid references public.products(id) on delete set null,
add column if not exists name text,
add column if not exists quantity numeric(12,2) default 1,
add column if not exists unit_price numeric(12,2) default 0,
add column if not exists discount numeric(12,2) default 0,
add column if not exists total numeric(12,2) default 0,
add column if not exists created_at timestamptz default now();

alter table public.payments
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists sale_id uuid references public.sales(id) on delete cascade,
add column if not exists amount numeric(12,2) default 0,
add column if not exists method text,
add column if not exists paid_at timestamptz default now(),
add column if not exists created_at timestamptz default now();

create index if not exists sales_appointment_id_idx on public.sales(appointment_id);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists payments_sale_id_idx on public.payments(sale_id);

-- Upewniamy się, że stare tabele z migracji localStorage nie blokują przepływu NOT NULL bez wartości.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='sales' and column_name='employee_id') then
    execute 'alter table public.sales alter column employee_id drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='sales' and column_name='sale_number') then
    execute 'alter table public.sales alter column sale_number drop not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='quantity') then
    execute 'alter table public.sale_items alter column quantity set default 1';
  end if;
end $$;

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
  service_price numeric(12,2);
  product_price numeric(12,2);
  service_name text;
  product_name text;
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

  final_total := coalesce(a.total, a.price, 0);

  if final_total = 0 then
    if a.service_id is not null then
      select coalesce(price_from, price, price_to, 0), name
      into service_price, service_name
      from public.services
      where id = a.service_id;
      final_total := final_total + coalesce(service_price, 0);
    end if;

    if a.product_id is not null then
      select coalesce(price, 0), name
      into product_price, product_name
      from public.products
      where id = a.product_id;
      final_total := final_total + coalesce(product_price, 0);
    end if;
  else
    if a.service_id is not null then
      select coalesce(price_from, price, price_to, 0), name
      into service_price, service_name
      from public.services
      where id = a.service_id;
    end if;

    if a.product_id is not null then
      select coalesce(price, 0), name
      into product_price, product_name
      from public.products
      where id = a.product_id;
    end if;
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
      company_id, sale_id, item_type, service_id, name, quantity, unit_price, discount, total, created_at
    ) values (
      final_company_id, v_sale_id, 'service', a.service_id, coalesce(service_name, a.service_name, 'Usługa'), 1, coalesce(service_price, final_total, 0), 0, coalesce(service_price, final_total, 0), now()
    );
  end if;

  if a.product_id is not null then
    insert into public.sale_items(
      company_id, sale_id, item_type, product_id, name, quantity, unit_price, discount, total, created_at
    ) values (
      final_company_id, v_sale_id, 'product', a.product_id, coalesce(product_name, a.product_name, 'Produkt'), coalesce(a.product_quantity, 1), coalesce(product_price, a.product_price, 0), 0, coalesce(product_price, a.product_price, 0) * coalesce(a.product_quantity, 1), now()
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
    total = final_total,
    updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'appointment_id', p_appointment_id,
    'sale_id', v_sale_id,
    'total', final_total,
    'paid_amount', final_paid,
    'status', 'zakończone'
  );
end;
$$;

grant execute on function public.finish_appointment_with_sale(uuid, uuid, numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
