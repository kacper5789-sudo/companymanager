-- COMPANYMANAGER — 097 PASS TEMPLATES / PULA KARNETÓW
-- Model logiczny:
-- 1) pass_templates = katalog/pula typów karnetów, np. "Karnet 5x strzyżenie", pula 200 szt.
-- 2) passes = sprzedane egzemplarze klientom, schodzą przy wizytach.
-- 3) sprzedaż karnetu nadal tworzy sales / sale_items / payments.

create table if not exists public.pass_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  pass_type text not null default 'service',
  entries_count numeric(12,2) not null default 0,
  total_stock numeric(12,2) not null default 0,
  remaining_stock numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  valid_days integer not null default 30,
  description text,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.pass_templates to authenticated;

alter table public.pass_templates enable row level security;

drop policy if exists "pass_templates_select" on public.pass_templates;
create policy "pass_templates_select"
on public.pass_templates
for select
to authenticated
using (public.can_access_company_data(company_id, 'open_passes'));

drop policy if exists "pass_templates_insert" on public.pass_templates;
create policy "pass_templates_insert"
on public.pass_templates
for insert
to authenticated
with check (public.can_access_company_data(company_id, 'passes_add'));

drop policy if exists "pass_templates_update" on public.pass_templates;
create policy "pass_templates_update"
on public.pass_templates
for update
to authenticated
using (public.can_access_company_data(company_id, 'passes_edit') or public.can_access_company_data(company_id, 'passes_add'))
with check (public.can_access_company_data(company_id, 'passes_edit') or public.can_access_company_data(company_id, 'passes_add'));

drop policy if exists "pass_templates_delete" on public.pass_templates;
create policy "pass_templates_delete"
on public.pass_templates
for delete
to authenticated
using (public.can_access_company_data(company_id, 'passes_delete'));

create index if not exists pass_templates_company_id_idx on public.pass_templates(company_id);
create index if not exists pass_templates_service_id_idx on public.pass_templates(service_id);
create index if not exists pass_templates_active_idx on public.pass_templates(active);

alter table public.passes
add column if not exists template_id uuid references public.pass_templates(id) on delete set null;

create index if not exists passes_template_id_idx on public.passes(template_id);

-- Uzupełnienie nazwy usługi w typie karnetu po service_id.
create or replace function public.cm_pass_template_fill_service_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.service_id is not null then
    select s.name
    into new.service_name
    from public.services s
    where s.id = new.service_id
      and s.company_id = new.company_id;
  end if;

  new.name := coalesce(nullif(new.name, ''), 'Karnet');
  new.pass_type := coalesce(nullif(new.pass_type, ''), 'service');
  new.entries_count := coalesce(new.entries_count, 0);
  new.total_stock := coalesce(new.total_stock, 0);
  new.remaining_stock := coalesce(new.remaining_stock, new.total_stock, 0);
  new.price := coalesce(new.price, 0);
  new.valid_days := greatest(coalesce(new.valid_days, 30), 1);
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_pass_template_fill_service_name on public.pass_templates;
create trigger trg_pass_template_fill_service_name
before insert or update on public.pass_templates
for each row
execute function public.cm_pass_template_fill_service_name();

-- Finalna sprzedaż karnetu z puli.
create or replace function public.cm_create_pass_sale(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  tpl public.pass_templates;
  final_company_id uuid;
  v_template_id uuid;
  v_pass_id uuid;
  v_sale_id uuid;
  v_sale_item_id uuid;
  v_number text;
  v_buyer_client_id uuid;
  v_beneficiary_client_id uuid;
  v_requested_employee_id uuid;
  v_buyer_name text;
  v_beneficiary_name text;
  v_employee_name text;
  v_sale_date date;
  v_sale_time text;
  v_valid_until date;
  v_payment_method text;
  v_description text;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

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

  v_template_id := nullif(p_payload->>'template_id','')::uuid;
  if v_template_id is null then
    raise exception 'Wybierz typ karnetu z puli';
  end if;

  select *
  into tpl
  from public.pass_templates
  where id = v_template_id
    and company_id = final_company_id
    and active is true
  for update;

  if not found then
    raise exception 'Nie znaleziono typu karnetu';
  end if;

  if coalesce(tpl.remaining_stock, 0) <= 0 then
    raise exception 'Brak dostępnych karnetów w tej puli';
  end if;

  v_buyer_client_id := nullif(p_payload->>'buyer_client_id','')::uuid;
  v_beneficiary_client_id := nullif(p_payload->>'beneficiary_client_id','')::uuid;
  v_requested_employee_id := nullif(p_payload->>'employee_id','')::uuid;
  v_sale_date := coalesce(nullif(p_payload->>'sale_date','')::date, current_date);
  v_sale_time := left(coalesce(p_payload->>'sale_time',''), 5);
  v_valid_until := coalesce(nullif(p_payload->>'valid_until','')::date, v_sale_date + greatest(coalesce(tpl.valid_days, 30), 1));
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'gotówka');
  v_description := nullif(coalesce(p_payload->>'description', tpl.description), '');

  if v_beneficiary_client_id is null then
    raise exception 'Missing beneficiary client';
  end if;

  if v_buyer_client_id is null then
    v_buyer_client_id := v_beneficiary_client_id;
  end if;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
  into v_buyer_name
  from public.clients
  where id = v_buyer_client_id
    and company_id = final_company_id;

  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
  into v_beneficiary_name
  from public.clients
  where id = v_beneficiary_client_id
    and company_id = final_company_id;

  if v_requested_employee_id is not null then
    select full_name
    into v_employee_name
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

  v_number := coalesce(nullif(p_payload->>'number',''), public.cm_next_pass_number(final_company_id));

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
    coalesce(tpl.price, 0),
    0,
    coalesce(tpl.price, 0),
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
    template_id,
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
    tpl.id,
    tpl.name,
    v_number,
    v_sale_date,
    v_sale_time,
    v_valid_until,
    v_payment_method,
    coalesce(nullif(v_buyer_name,''), '-'),
    coalesce(nullif(v_beneficiary_name,''), '-'),
    nullif(v_employee_name,''),
    coalesce(tpl.price, 0),
    coalesce(tpl.price, 0),
    coalesce(tpl.pass_type, 'service'),
    tpl.service_id,
    tpl.service_name,
    coalesce(tpl.entries_count, 0),
    coalesce(tpl.entries_count, 0),
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
    tpl.name,
    tpl.name,
    1,
    coalesce(tpl.price, 0),
    0,
    coalesce(tpl.price, 0),
    coalesce(tpl.price, 0),
    now()
  ) returning id into v_sale_item_id;

  update public.passes
  set sale_item_id = v_sale_item_id,
      updated_at = now()
  where id = v_pass_id;

  update public.pass_templates
  set remaining_stock = greatest(coalesce(remaining_stock, 0) - 1, 0),
      updated_at = now()
  where id = tpl.id;

  insert into public.payments(
    company_id,
    sale_id,
    amount,
    method,
    paid_at,
    created_at
  ) values (
    final_company_id,
    v_sale_id,
    coalesce(tpl.price, 0),
    v_payment_method,
    now(),
    now()
  );

  return jsonb_build_object(
    'pass_id', v_pass_id,
    'template_id', tpl.id,
    'sale_id', v_sale_id,
    'value', coalesce(tpl.price, 0),
    'number', v_number,
    'remaining_stock', greatest(coalesce(tpl.remaining_stock, 0) - 1, 0)
  );
end;
$$;

grant execute on function public.cm_create_pass_sale(jsonb) to authenticated;

notify pgrst, 'reload schema';
