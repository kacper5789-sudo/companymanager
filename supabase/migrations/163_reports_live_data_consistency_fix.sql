-- COMPANYMANAGER — 075 REPORTS LIVE DATA CONSISTENCY FIX
-- Spina karnety, sprzedaż, płatności i raporty po edycji/usunięciu.

alter table public.pass_templates
  add column if not exists stock_quantity integer not null default 1,
  add column if not exists sold_count integer not null default 0,
  add column if not exists remaining_stock integer not null default 1;

update public.pass_templates
set
  stock_quantity = greatest(coalesce(nullif(stock_quantity, 0), 1), 1),
  sold_count = greatest(coalesce(sold_count, 0), 0),
  remaining_stock = greatest(greatest(coalesce(nullif(stock_quantity, 0), 1), 1) - greatest(coalesce(sold_count, 0), 0), 0)
where company_id is not null;

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
  v_template_id uuid;
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
  v_sale_price numeric(12,2);
  v_pass_amount numeric(12,2);
  v_units numeric(12,2);
  v_sale_date date;
  v_sale_time text;
  v_valid_until date;
  v_payment_method text;
  v_description text;
  tpl public.pass_templates;
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

  v_template_id := nullif(p_payload->>'pass_template_id','')::uuid;
  if v_template_id is null then
    raise exception 'Missing pass template';
  end if;

  select * into tpl
  from public.pass_templates
  where id = v_template_id
    and company_id = final_company_id
    and active is true
  for update;

  if not found then
    raise exception 'Pass template not found';
  end if;

  tpl.stock_quantity := greatest(coalesce(tpl.stock_quantity, 1), 1);
  tpl.sold_count := greatest(coalesce(tpl.sold_count, 0), 0);
  tpl.remaining_stock := greatest(coalesce(tpl.remaining_stock, tpl.stock_quantity - tpl.sold_count), 0);

  if tpl.remaining_stock <= 0 or tpl.sold_count >= tpl.stock_quantity then
    raise exception 'Pass template pool is empty';
  end if;

  v_buyer_client_id := nullif(p_payload->>'buyer_client_id','')::uuid;
  v_beneficiary_client_id := nullif(p_payload->>'beneficiary_client_id','')::uuid;
  v_requested_employee_id := nullif(p_payload->>'employee_id','')::uuid;
  v_service_id := coalesce(nullif(p_payload->>'service_id','')::uuid, tpl.service_id);
  v_pass_type := lower(coalesce(nullif(p_payload->>'pass_type',''), tpl.pass_type, 'amount'));

  if v_pass_type in ('service', 'entries', 'entry') then
    v_pass_type := 'units';
  end if;
  if v_pass_type not in ('units', 'amount') then
    v_pass_type := 'amount';
  end if;

  v_sale_price := coalesce(nullif(p_payload->>'value','')::numeric, tpl.sale_price, 0);
  v_pass_amount := coalesce(nullif(p_payload->>'pass_amount','')::numeric, tpl.amount, v_sale_price, 0);
  v_units := coalesce(nullif(p_payload->>'total_units','')::numeric, tpl.total_units, 0);
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
  if v_pass_type = 'units' and coalesce(v_units, 0) <= 0 then
    raise exception 'Missing pass units';
  end if;
  if v_pass_type = 'amount' and coalesce(v_pass_amount, 0) <= 0 then
    raise exception 'Missing pass amount';
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

  v_employee_name := coalesce(nullif(v_employee_name,''), nullif(p_payload->>'employee_name',''), nullif(me.full_name,''), me.email, '');

  if v_service_id is not null then
    select name into v_service_name
    from public.services
    where id = v_service_id and company_id = final_company_id;
  end if;
  v_service_name := coalesce(nullif(v_service_name,''), tpl.service_name);

  v_number := coalesce(nullif(p_payload->>'number',''), public.cm_next_pass_number(final_company_id));
  v_name := coalesce(nullif(p_payload->>'name',''), tpl.name, case
    when v_pass_type = 'units' and v_units > 0 then 'Karnet ' || trim(to_char(v_units, 'FM999999990.##')) || 'x ' || coalesce(v_service_name, 'usługa')
    else 'Karnet kwotowy ' || trim(to_char(v_pass_amount, 'FM999999990.00')) || ' PLN'
  end);

  insert into public.sales(
    company_id, appointment_id, client_id, employee_id, employee_name, sale_number,
    total_net, total_tax, total_gross, discount_value, payment_status, status,
    note, created_at, updated_at
  ) values (
    final_company_id, null, v_buyer_client_id, v_requested_employee_id, nullif(v_employee_name,''), 'KARNET-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    v_sale_price, 0, v_sale_price, 0, 'paid', 'completed', v_description, now(), now()
  ) returning id into v_sale_id;

  insert into public.passes(
    company_id, customer_id, buyer_client_id, beneficiary_client_id, employee_id,
    pass_template_id, name, number, sale_date, sale_time, valid_until,
    payment_method, buyer, customer_name, employee_name, value, remaining,
    initial_amount, remaining_amount, sale_price, pass_type, service_id,
    service_name, total_units, remaining_units, description, status, active,
    sale_id, created_by, updated_at
  ) values (
    final_company_id, v_beneficiary_client_id, v_buyer_client_id, v_beneficiary_client_id, v_requested_employee_id,
    v_template_id, v_name, v_number, v_sale_date, v_sale_time, v_valid_until,
    v_payment_method, coalesce(nullif(v_buyer_name,''), '-'), coalesce(nullif(v_beneficiary_name,''), '-'), nullif(v_employee_name,''),
    v_sale_price,
    case when v_pass_type = 'amount' then v_pass_amount else 0 end,
    case when v_pass_type = 'amount' then v_pass_amount else 0 end,
    case when v_pass_type = 'amount' then v_pass_amount else 0 end,
    v_sale_price, v_pass_type, v_service_id, v_service_name,
    case when v_pass_type = 'units' then v_units else 0 end,
    case when v_pass_type = 'units' then v_units else 0 end,
    v_description, 'aktualne', true, v_sale_id, auth.uid(), now()
  ) returning id into v_pass_id;

  insert into public.sale_items(
    company_id, sale_id, item_type, pass_id, name, name_snapshot,
    quantity, unit_price, discount, total, total_price, created_at
  ) values (
    final_company_id, v_sale_id, 'pass', v_pass_id, v_name, v_name,
    1, v_sale_price, 0, v_sale_price, v_sale_price, now()
  ) returning id into v_sale_item_id;

  update public.passes
  set sale_item_id = v_sale_item_id
  where id = v_pass_id;

  insert into public.payments(
    company_id, sale_id, amount, method, status, paid_at, created_at
  ) values (
    final_company_id, v_sale_id, v_sale_price, v_payment_method, 'paid', now(), now()
  );

  update public.pass_templates
  set
    sold_count = least(coalesce(sold_count, 0) + 1, stock_quantity),
    remaining_stock = greatest(coalesce(stock_quantity, 0) - least(coalesce(sold_count, 0) + 1, stock_quantity), 0),
    updated_at = now()
  where id = v_template_id
    and company_id = final_company_id;

  return jsonb_build_object(
    'pass_id', v_pass_id,
    'sale_id', v_sale_id,
    'total', v_sale_price,
    'pass_type', v_pass_type,
    'pass_template_id', v_template_id,
    'pass_amount', v_pass_amount,
    'total_units', v_units,
    'employee_id', v_requested_employee_id,
    'employee_name', v_employee_name
  );
end;
$$;

grant execute on function public.cm_create_pass_sale(jsonb) to authenticated;



-- Gdy karnet zostanie usunięty/wyłączony, powiązana sprzedaż i płatności nie mogą dalej liczyć się w raportach.
create or replace function public.cm_sync_pass_sale_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_deleted boolean;
  v_value numeric(12,2);
begin
  v_is_deleted := coalesce(new.active, true) is false
    or lower(coalesce(new.status::text, '')) in ('void','deleted','usunięte','usuniete','cancelled','canceled','anulowane','anulowana');

  v_value := coalesce(new.sale_price, new.value, 0);

  if new.sale_id is not null then
    if v_is_deleted then
      update public.sales
      set payment_status = 'void', status = 'void', updated_at = now()
      where id = new.sale_id and company_id = new.company_id;

      update public.payments
      set status = 'void'
      where sale_id = new.sale_id and company_id = new.company_id;
    else
      update public.sales
      set
        employee_id = coalesce(new.employee_id, employee_id),
        employee_name = coalesce(nullif(new.employee_name,''), employee_name),
        client_id = coalesce(new.buyer_client_id, new.customer_id, client_id),
        total_net = v_value,
        total_gross = v_value,
        payment_status = case when lower(coalesce(payment_status::text,'')) = 'void' then 'paid' else payment_status end,
        status = case when lower(coalesce(status::text,'')) = 'void' then 'completed' else coalesce(status,'completed') end,
        updated_at = now()
      where id = new.sale_id and company_id = new.company_id;

      update public.sale_items
      set unit_price = v_value, total = v_value, total_price = v_value
      where sale_id = new.sale_id and company_id = new.company_id and (pass_id = new.id or lower(coalesce(item_type::text,'')) in ('pass','karnet'));

      update public.payments
      set amount = v_value, method = coalesce(new.payment_method, method), status = case when lower(coalesce(status::text,'')) = 'void' then 'paid' else coalesce(status,'paid') end
      where sale_id = new.sale_id and company_id = new.company_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cm_sync_pass_sale_consistency on public.passes;
create trigger trg_cm_sync_pass_sale_consistency
after insert or update on public.passes
for each row execute function public.cm_sync_pass_sale_consistency();

-- Jednorazowe czyszczenie historycznych danych po usuniętych karnetach.
update public.sales s
set payment_status = 'void', status = 'void', updated_at = now()
from public.passes p
where p.sale_id = s.id
  and p.company_id = s.company_id
  and (coalesce(p.active, true) is false or lower(coalesce(p.status::text,'')) in ('void','deleted','usunięte','usuniete','cancelled','canceled','anulowane','anulowana'));

update public.payments pay
set status = 'void'
from public.sales s
where pay.sale_id = s.id
  and pay.company_id = s.company_id
  and lower(coalesce(s.payment_status::text,'')) = 'void';

-- Aktywne karnety mają aktualizować powiązaną sprzedaż, żeby raporty pokazywały bieżącą wartość i sprzedawcę.
update public.sales s
set
  employee_id = coalesce(p.employee_id, s.employee_id),
  employee_name = coalesce(nullif(p.employee_name,''), s.employee_name),
  client_id = coalesce(p.buyer_client_id, p.customer_id, s.client_id),
  total_net = coalesce(p.sale_price, p.value, s.total_net, 0),
  total_gross = coalesce(p.sale_price, p.value, s.total_gross, 0),
  status = coalesce(nullif(s.status,''), 'completed'),
  updated_at = now()
from public.passes p
where p.sale_id = s.id
  and p.company_id = s.company_id
  and coalesce(p.active, true) is true
  and lower(coalesce(p.status::text,'')) not in ('void','deleted','usunięte','usuniete','cancelled','canceled','anulowane','anulowana');

update public.sale_items si
set
  unit_price = coalesce(p.sale_price, p.value, si.unit_price, 0),
  total = coalesce(p.sale_price, p.value, si.total, si.total_price, 0),
  total_price = coalesce(p.sale_price, p.value, si.total_price, si.total, 0)
from public.passes p
where p.sale_id = si.sale_id
  and p.company_id = si.company_id
  and (si.pass_id = p.id or lower(coalesce(si.item_type::text,'')) in ('pass','karnet'))
  and coalesce(p.active, true) is true
  and lower(coalesce(p.status::text,'')) not in ('void','deleted','usunięte','usuniete','cancelled','canceled','anulowane','anulowana');

update public.payments pay
set amount = coalesce(p.sale_price, p.value, pay.amount, 0), method = coalesce(p.payment_method, pay.method)
from public.passes p
where p.sale_id = pay.sale_id
  and p.company_id = pay.company_id
  and coalesce(p.active, true) is true
  and lower(coalesce(p.status::text,'')) not in ('void','deleted','usunięte','usuniete','cancelled','canceled','anulowane','anulowana')
  and lower(coalesce(pay.status::text,'')) <> 'void';

notify pgrst, 'reload schema';
