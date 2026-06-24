-- COMPANYMANAGER — 078 COMPANY AUDIT LOG / HISTORIA AKTYWNOŚCI
-- Globalny dziennik ruchów w firmie.
-- WAŻNE: działania OWNERA nie są zapisywane do audytu.
-- Ten patch zastępuje ryzykowne globalne triggerowanie z 076: raporty liczą aktywne dane,
-- a pełny ślad operacji zostaje w company_audit_logs.

-- 0) Wyłącz stare globalne triggery spójności, jeżeli zdążyły się utworzyć z 076.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','employees','services','products','appointments','sales','payments','passes','pass_templates',
    'sale_items','days_off','positions','service_categories','marketing_campaigns'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_cm_global_live_data_consistency on public.%I', t);
    end if;
  end loop;
end $$;

-- 1) Tabela audytu.
create table if not exists public.company_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  actor_user_id uuid,
  actor_profile_id uuid,
  actor_employee_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  module text not null,
  table_name text not null,
  action text not null,
  record_id uuid,
  record_label text,
  old_data jsonb,
  new_data jsonb,
  source text not null default 'db_trigger',
  created_at timestamptz not null default now()
);

alter table public.company_audit_logs
  add column if not exists company_id uuid,
  add column if not exists actor_user_id uuid,
  add column if not exists actor_profile_id uuid,
  add column if not exists actor_employee_id uuid,
  add column if not exists actor_name text,
  add column if not exists actor_email text,
  add column if not exists actor_role text,
  add column if not exists module text,
  add column if not exists table_name text,
  add column if not exists action text,
  add column if not exists record_id uuid,
  add column if not exists record_label text,
  add column if not exists old_data jsonb,
  add column if not exists new_data jsonb,
  add column if not exists source text not null default 'db_trigger',
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_company_audit_logs_company_created on public.company_audit_logs(company_id, created_at desc);
create index if not exists idx_company_audit_logs_actor on public.company_audit_logs(actor_user_id, created_at desc);
create index if not exists idx_company_audit_logs_module on public.company_audit_logs(company_id, module, created_at desc);
create index if not exists idx_company_audit_logs_action on public.company_audit_logs(company_id, action, created_at desc);

alter table public.company_audit_logs enable row level security;

drop policy if exists company_audit_logs_select on public.company_audit_logs;
create policy company_audit_logs_select
on public.company_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.login_allowed, true) is true
      and (
        upper(coalesce(p.role::text,'')) = 'OWNER'
        or (
          upper(coalesce(p.role::text,'')) = 'ADMIN'
          and p.company_id = company_audit_logs.company_id
        )
        or (
          p.company_id = company_audit_logs.company_id
          and coalesce((p.permissions->>'audit_view')::boolean, false) is true
        )
      )
  )
);

-- Brak polityki insert/update/delete dla zwykłych użytkowników. Wpisy tworzy tylko SECURITY DEFINER trigger.

grant select on public.company_audit_logs to authenticated;

-- 2) Funkcja pomocnicza: etykieta modułu.
create or replace function public.cm_audit_module_label(p_table_name text)
returns text
language sql
stable
as $$
  select case lower(coalesce(p_table_name,''))
    when 'positions' then 'Stanowiska pracy'
    when 'employees' then 'Zespół'
    when 'profiles' then 'Użytkownicy'
    when 'days_off' then 'Dni wolne pracowników'
    when 'clients' then 'Klienci'
    when 'services' then 'Usługi'
    when 'service_categories' then 'Kategorie usług'
    when 'products' then 'Produkty'
    when 'appointments' then 'Wizyty'
    when 'sales' then 'Sprzedaż'
    when 'sale_items' then 'Pozycje sprzedaży'
    when 'payments' then 'Płatności'
    when 'passes' then 'Karnety'
    when 'pass_templates' then 'Typy karnetów'
    when 'marketing_campaigns' then 'Marketing'
    when 'undo_actions' then 'Cofnij Czas'
    else coalesce(p_table_name, 'System')
  end;
$$;

-- 3) Funkcja pomocnicza do ręcznego dopisywania wpisów, np. z RPC.
create or replace function public.cm_write_company_audit_log(
  p_company_id uuid,
  p_module text,
  p_table_name text,
  p_action text,
  p_record_id uuid default null,
  p_record_label text default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  v_employee_id uuid;
  v_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    return null;
  end if;

  -- OWNER platformy nie jest zapisywany w dzienniku aktywności.
  if upper(coalesce(me.role::text,'')) = 'OWNER' then
    return null;
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.profile_id = me.id
     or e.id = me.id
  order by e.created_at nulls last
  limit 1;

  insert into public.company_audit_logs(
    company_id, actor_user_id, actor_profile_id, actor_employee_id,
    actor_name, actor_email, actor_role,
    module, table_name, action, record_id, record_label,
    old_data, new_data, source
  ) values (
    coalesce(p_company_id, me.company_id), auth.uid(), me.id, v_employee_id,
    coalesce(nullif(me.full_name,''), me.email, 'Użytkownik'), me.email, upper(coalesce(me.role::text,'')),
    coalesce(p_module, public.cm_audit_module_label(p_table_name)), p_table_name, upper(coalesce(p_action,'ACTION')),
    p_record_id, p_record_label, p_old_data, p_new_data, coalesce(p_source, 'manual')
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.cm_write_company_audit_log(uuid, text, text, text, uuid, text, jsonb, jsonb, text) to authenticated;

-- 4) Trigger audytowy dla całej platformy.
create or replace function public.cm_company_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  v_old jsonb;
  v_new jsonb;
  v_company_id uuid;
  v_record_id uuid;
  v_employee_id uuid;
  v_action text;
  v_label text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Nie zapisujemy ruchów OWNERA.
  if upper(coalesce(me.role::text,'')) = 'OWNER' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_old := null;
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    if v_new = v_old then
      return new;
    end if;
  else
    v_old := to_jsonb(old);
    v_new := null;
  end if;

  v_company_id := nullif(coalesce(v_new->>'company_id', v_old->>'company_id', me.company_id::text), '')::uuid;
  v_record_id := nullif(coalesce(v_new->>'id', v_old->>'id'), '')::uuid;

  v_action := case tg_op
    when 'INSERT' then 'CREATE'
    when 'UPDATE' then 'UPDATE'
    when 'DELETE' then 'DELETE'
    else tg_op
  end;

  -- Specjalny ślad Cofnij Czas.
  if tg_table_name = 'undo_actions' and tg_op = 'UPDATE' then
    if (v_old->>'undone_at') is null and (v_new->>'undone_at') is not null then
      v_action := 'UNDO';
    end if;
  end if;

  -- Statusy bardziej czytelne w audycie.
  if tg_op = 'UPDATE' then
    if coalesce((v_new->>'active')::boolean, true) is false or nullif(v_new->>'deleted_at','') is not null then
      v_action := 'DELETE';
    elsif lower(coalesce(v_new->>'status','')) in ('cancelled','canceled','odwołane','odwolane','anulowane','anulowana') then
      v_action := 'CANCEL';
    end if;
  end if;

  v_label := coalesce(
    nullif(v_new->>'name',''), nullif(v_old->>'name',''),
    nullif(v_new->>'full_name',''), nullif(v_old->>'full_name',''),
    nullif(v_new->>'title',''), nullif(v_old->>'title',''),
    nullif(v_new->>'email',''), nullif(v_old->>'email',''),
    nullif(v_new->>'sale_number',''), nullif(v_old->>'sale_number',''),
    nullif(v_new->>'number',''), nullif(v_old->>'number',''),
    nullif(v_new->>'service_name',''), nullif(v_old->>'service_name',''),
    nullif(v_new->>'customer_name',''), nullif(v_old->>'customer_name',''),
    v_record_id::text
  );

  select e.id into v_employee_id
  from public.employees e
  where e.profile_id = me.id
     or e.id = me.id
  order by e.created_at nulls last
  limit 1;

  insert into public.company_audit_logs(
    company_id, actor_user_id, actor_profile_id, actor_employee_id,
    actor_name, actor_email, actor_role,
    module, table_name, action, record_id, record_label,
    old_data, new_data, source
  ) values (
    v_company_id, auth.uid(), me.id, v_employee_id,
    coalesce(nullif(me.full_name,''), me.email, 'Użytkownik'), me.email, upper(coalesce(me.role::text,'')),
    public.cm_audit_module_label(tg_table_name), tg_table_name, v_action, v_record_id, v_label,
    v_old, v_new, 'db_trigger'
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- 5) Podpięcie triggerów audytowych do modułów.
do $$
declare
  t text;
begin
  foreach t in array array[
    'positions','employees','profiles','days_off','clients','services','service_categories','products',
    'appointments','sales','sale_items','payments','passes','pass_templates','marketing_campaigns','undo_actions'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_cm_company_audit on public.%I', t);
      execute format('create trigger trg_cm_company_audit after insert or update or delete on public.%I for each row execute function public.cm_company_audit_trigger()', t);
    end if;
  end loop;
end $$;

-- 6) Widok/RPC dla zakładki Historia aktywności.
create or replace function public.cm_list_company_audit_logs(
  p_company_id uuid default null,
  p_limit integer default 100,
  p_action text default null,
  p_module text default null,
  p_search text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table(
  id uuid,
  company_id uuid,
  created_at timestamptz,
  actor_name text,
  actor_email text,
  actor_role text,
  module text,
  table_name text,
  action text,
  record_id uuid,
  record_label text,
  old_data jsonb,
  new_data jsonb,
  source text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  final_company_id uuid;
  final_limit integer;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  final_company_id := coalesce(p_company_id, me.company_id);
  final_limit := least(greatest(coalesce(p_limit, 100), 1), 500);

  if upper(coalesce(me.role::text,'')) <> 'OWNER' then
    if final_company_id is null or me.company_id <> final_company_id then
      raise exception 'Permission denied';
    end if;

    if upper(coalesce(me.role::text,'')) <> 'ADMIN'
       and coalesce((me.permissions->>'audit_view')::boolean, false) is not true then
      raise exception 'Permission denied';
    end if;
  end if;

  return query
  select
    l.id, l.company_id, l.created_at, l.actor_name, l.actor_email, l.actor_role,
    l.module, l.table_name, l.action, l.record_id, l.record_label,
    l.old_data, l.new_data, l.source
  from public.company_audit_logs l
  where (final_company_id is null or l.company_id = final_company_id)
    and (p_action is null or p_action = '' or lower(l.action) = lower(p_action))
    and (p_module is null or p_module = '' or lower(l.module) = lower(p_module))
    and (p_date_from is null or l.created_at >= p_date_from)
    and (p_date_to is null or l.created_at <= p_date_to)
    and (
      p_search is null or p_search = ''
      or lower(coalesce(l.actor_name,'')) like '%' || lower(p_search) || '%'
      or lower(coalesce(l.actor_email,'')) like '%' || lower(p_search) || '%'
      or lower(coalesce(l.module,'')) like '%' || lower(p_search) || '%'
      or lower(coalesce(l.action,'')) like '%' || lower(p_search) || '%'
      or lower(coalesce(l.record_label,'')) like '%' || lower(p_search) || '%'
    )
  order by l.created_at desc
  limit final_limit;
end;
$$;

grant execute on function public.cm_list_company_audit_logs(uuid, integer, text, text, text, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
