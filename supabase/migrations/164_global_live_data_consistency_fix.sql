-- COMPANYMANAGER — 076 GLOBAL LIVE DATA CONSISTENCY FIX
-- Globalna zasada raportów i sprzedaży:
-- active/completed/paid = liczy się
-- deleted/void/cancelled/inactive = nie liczy się

-- 1) Wspólne kolumny bezpieczeństwa dla modułów operacyjnych.
do $$
declare
  t text;
begin
  foreach t in array array[
    'positions','employees','days_off','clients','services','service_categories',
    'products','appointments','sales','sale_items','payments','passes','pass_templates','marketing_campaigns'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I add column if not exists active boolean not null default true', t);
      execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
      execute format('alter table public.%I add column if not exists deleted_by uuid', t);
      if t = 'appointments' then execute 'alter table public.appointments add column if not exists deleted boolean not null default false'; end if;
      execute format('alter table public.%I add column if not exists updated_at timestamptz default now()', t);
      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name=t and column_name='status'
      ) then
        execute format('alter table public.%I add column status text', t);
      end if;
    end if;
  end loop;
end $$;

-- 2) Helpery statusów.
create or replace function public.cm_is_inactive_json(row_data jsonb)
returns boolean
language sql
stable
as $$
  select
    coalesce((row_data->>'active')::boolean, true) is false
    or nullif(row_data->>'deleted_at','') is not null
    or lower(coalesce(row_data->>'status','')) in (
      'void','deleted','delete','usunięte','usuniete','usunięty','usuniety','usunięta','usunieta',
      'cancelled','canceled','odwołane','odwolane','odwołana','odwolana','anulowane','anulowana',
      'inactive','nieaktywny','nieaktywna'
    )
    or lower(coalesce(row_data->>'payment_status','')) in ('void','deleted','cancelled','canceled');
$$;

create or replace function public.cm_is_live_status(p_status text, p_payment_status text default null, p_active boolean default true, p_deleted_at timestamptz default null)
returns boolean
language sql
stable
as $$
  select coalesce(p_active, true) is true
    and p_deleted_at is null
    and lower(coalesce(p_status,'')) not in (
      'void','deleted','delete','usunięte','usuniete','usunięty','usuniety','usunięta','usunieta',
      'cancelled','canceled','odwołane','odwolane','odwołana','odwolana','anulowane','anulowana',
      'inactive','nieaktywny','nieaktywna'
    )
    and lower(coalesce(p_payment_status,'')) not in ('void','deleted','cancelled','canceled','unpaid','pending','nieopłacone','nieoplacone');
$$;

-- 3) Jedno miejsce do unieważniania sprzedaży i płatności.
create or replace function public.cm_void_sale_and_payments(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_sale_id is null then
    return;
  end if;

  update public.sales
  set
    status = 'void',
    payment_status = 'void',
    active = false,
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where id = p_sale_id;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='status') then
    update public.sale_items
    set status = 'void', active = false, deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where sale_id = p_sale_id;
  else
    update public.sale_items
    set active = false, deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where sale_id = p_sale_id;
  end if;

  update public.payments
  set status = 'void', active = false, deleted_at = coalesce(deleted_at, now()), updated_at = now()
  where sale_id = p_sale_id;
end;
$$;

grant execute on function public.cm_void_sale_and_payments(uuid) to authenticated;

-- 4) Trigger globalny: gdy rekord zostaje usunięty/wyłączony/anulowany,
-- powiązana sprzedaż/raporty przestają go liczyć.
create or replace function public.cm_global_live_data_consistency_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j_old jsonb;
  j_new jsonb;
  row_id uuid;
  company uuid;
  sale_id uuid;
begin
  j_old := to_jsonb(old);
  j_new := case when tg_op = 'DELETE' then j_old else to_jsonb(new) end;
  row_id := nullif(j_old->>'id','')::uuid;
  company := nullif(coalesce(j_new->>'company_id', j_old->>'company_id'),'')::uuid;

  if tg_op = 'UPDATE' and public.cm_is_inactive_json(j_new) is false then
    return new;
  end if;

  -- Sprzedaż: płatności i pozycje sprzedaży też muszą wypaść z raportów.
  -- Nie aktualizujemy tu samej tabeli sales, żeby nie zrobić rekurencji triggera.
  if tg_table_name = 'sales' then
    update public.sale_items
    set status = 'void', active = false, deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where sale_id = row_id;

    update public.payments
    set status = 'void', active = false, deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where sale_id = row_id;

    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Płatność: jeżeli płatność znika, powiązana sprzedaż nie jest już opłacona/aktywna.
  if tg_table_name = 'payments' then
    perform public.cm_void_sale_and_payments(nullif(j_old->>'sale_id','')::uuid);
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Karnety.
  if tg_table_name = 'passes' then
    perform public.cm_void_sale_and_payments(nullif(j_old->>'sale_id','')::uuid);
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Wizyta: odwołana/usunięta = powiązana sprzedaż i kasa void.
  if tg_table_name = 'appointments' then
    for sale_id in select s.id from public.sales s where s.appointment_id = row_id loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Klient usunięty/wyłączony: nie zostaje w aktywnych raportach/sprzedaży.
  if tg_table_name = 'clients' then
    for sale_id in select s.id from public.sales s where s.client_id = row_id loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    for sale_id in select p.sale_id from public.passes p where p.sale_id is not null and (p.customer_id = row_id or p.buyer_client_id = row_id or p.beneficiary_client_id = row_id) loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    update public.passes set active=false, status='deleted', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where customer_id = row_id or buyer_client_id = row_id or beneficiary_client_id = row_id;
    update public.appointments set active=false, deleted=true, status='usunięte', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where client_id = row_id or customer_id = row_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Pracownik/zespół usunięty/wyłączony.
  if tg_table_name = 'employees' then
    for sale_id in select s.id from public.sales s where s.employee_id = row_id loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    update public.appointments set active=false, deleted=true, status='usunięte', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where employee_id = row_id;
    update public.days_off set active=false, status='deleted', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where employee_id = row_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Usługa/produkt: powiązane pozycje sprzedaży i raporty nie liczą starych danych po usunięciu.
  if tg_table_name = 'services' then
    for sale_id in select distinct si.sale_id from public.sale_items si where si.service_id = row_id and si.sale_id is not null loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    update public.appointments set active=false, deleted=true, status='usunięte', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where service_id = row_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'products' then
    for sale_id in select distinct si.sale_id from public.sale_items si where si.product_id = row_id and si.sale_id is not null loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    update public.appointments set active=false, deleted=true, status='usunięte', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where product_id = row_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Typ karnetu z puli.
  if tg_table_name = 'pass_templates' then
    for sale_id in select p.sale_id from public.passes p where p.pass_template_id = row_id and p.sale_id is not null loop
      perform public.cm_void_sale_and_payments(sale_id);
    end loop;
    update public.passes set active=false, status='deleted', deleted_at=coalesce(deleted_at, now()), updated_at=now()
    where pass_template_id = row_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

-- 5) Podpięcie triggerów do modułów.
do $$
declare
  t text;
begin
  foreach t in array array['clients','employees','services','products','appointments','sales','payments','passes','pass_templates'] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_cm_global_live_data_consistency on public.%I', t);
      execute format('create trigger trg_cm_global_live_data_consistency before update or delete on public.%I for each row execute function public.cm_global_live_data_consistency_trigger()', t);
    end if;
  end loop;
end $$;

-- 6) RPC do miękkiego usuwania z frontu.
create or replace function public.cm_soft_delete_record(
  p_table_name text,
  p_record_id uuid,
  p_company_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_table text;
  final_company uuid;
begin
  safe_table := lower(trim(p_table_name));
  if safe_table not in ('positions','employees','days_off','clients','services','service_categories','products','appointments','sales','payments','passes','pass_templates','marketing_campaigns') then
    raise exception 'Unsupported table: %', p_table_name;
  end if;

  final_company := coalesce(p_company_id, public.my_company_id());
  if final_company is null then
    raise exception 'Missing company_id';
  end if;

  execute format(
    'update public.%I set active=false, status=''deleted'', deleted_at=coalesce(deleted_at, now()), deleted_by=auth.uid(), updated_at=now() where id=$1 and company_id=$2',
    safe_table
  ) using p_record_id, final_company;

  return true;
end;
$$;

grant execute on function public.cm_soft_delete_record(text, uuid, uuid) to authenticated;

-- 7) Jednorazowe sprzątanie historyczne: sprzedaż/płatności po anulowanych/usuniętych danych.
update public.sales s
set status='void', payment_status='void', active=false, deleted_at=coalesce(s.deleted_at, now()), updated_at=now()
from public.appointments a
where s.appointment_id = a.id
  and public.cm_is_inactive_json(to_jsonb(a));

update public.sales s
set status='void', payment_status='void', active=false, deleted_at=coalesce(s.deleted_at, now()), updated_at=now()
from public.passes p
where s.id = p.sale_id
  and public.cm_is_inactive_json(to_jsonb(p));

update public.sales s
set status='void', payment_status='void', active=false, deleted_at=coalesce(s.deleted_at, now()), updated_at=now()
from public.clients c
where s.client_id = c.id
  and public.cm_is_inactive_json(to_jsonb(c));

update public.sales s
set status='void', payment_status='void', active=false, deleted_at=coalesce(s.deleted_at, now()), updated_at=now()
from public.employees e
where s.employee_id = e.id
  and public.cm_is_inactive_json(to_jsonb(e));

update public.sales s
set status='void', payment_status='void', active=false, deleted_at=coalesce(s.deleted_at, now()), updated_at=now()
where exists (
  select 1
  from public.sale_items si
  left join public.services sv on sv.id = si.service_id
  left join public.products pr on pr.id = si.product_id
  where si.sale_id = s.id
    and (
      (sv.id is not null and public.cm_is_inactive_json(to_jsonb(sv)))
      or (pr.id is not null and public.cm_is_inactive_json(to_jsonb(pr)))
      or public.cm_is_inactive_json(to_jsonb(si))
    )
);

update public.payments p
set status='void', active=false, deleted_at=coalesce(p.deleted_at, now()), updated_at=now()
from public.sales s
where p.sale_id = s.id
  and public.cm_is_inactive_json(to_jsonb(s));

notify pgrst, 'reload schema';
