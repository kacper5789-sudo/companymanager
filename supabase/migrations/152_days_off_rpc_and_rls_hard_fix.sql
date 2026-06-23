-- COMPANYMANAGER — 152 DAYS OFF RPC/RLS HARD FIX
-- Naprawia zapis dni wolnych, gdy /rest/v1/rpc/add_day_off zwraca 400
-- oraz zapewnia fallback przez bezpośredni insert z RLS.

-- 1) Upewnij się, że tabela ma wszystkie pola używane przez frontend.
alter table public.days_off
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists employee_id uuid references public.profiles(id) on delete set null,
  add column if not exists employee_name text,
  add column if not exists type text default 'dzień wolny',
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists description text,
  add column if not exists status text default 'active',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

-- 2) Usuń wszystkie stare przeciążenia add_day_off, żeby PostgREST nie mylił sygnatur.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'add_day_off'
  loop
    execute 'drop function if exists ' || r.signature || ' cascade';
  end loop;
end $$;

-- 3) Trigger uzupełniający created_by / employee_name / daty.
create or replace function public.days_off_fill_employee_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_label text;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.employee_id is not null then
    select coalesce(nullif(full_name, ''), nullif(email, ''), 'Pracownik')
    into employee_label
    from public.profiles
    where id = new.employee_id
      and company_id = new.company_id;

    new.employee_name := coalesce(nullif(new.employee_name, ''), employee_label, 'Pracownik');
  else
    new.employee_name := coalesce(nullif(new.employee_name, ''), 'Pracownik');
  end if;

  new.type := coalesce(nullif(new.type, ''), 'dzień wolny');
  new.status := coalesce(nullif(new.status, ''), 'active');
  new.end_date := coalesce(new.end_date, new.start_date);

  if new.start_date is null then
    raise exception 'Missing start_date';
  end if;

  if new.end_date < new.start_date then
    raise exception 'Data końcowa nie może być wcześniejsza niż data początkowa';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_days_off_fill_employee_name on public.days_off;
create trigger trg_days_off_fill_employee_name
before insert or update on public.days_off
for each row
execute function public.days_off_fill_employee_name();

-- 4) RLS/grants — admin/owner przechodzą przez can_access_company_data.
alter table public.days_off enable row level security;

drop policy if exists days_off_select_policy on public.days_off;
drop policy if exists days_off_insert_policy on public.days_off;
drop policy if exists days_off_update_policy on public.days_off;
drop policy if exists days_off_delete_policy on public.days_off;

create policy days_off_select_policy
on public.days_off
for select
to authenticated
using (
  public.can_access_company_data(company_id, 'open_days_off')
  or public.can_access_company_data(company_id, 'days_off_add')
  or public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
);

create policy days_off_insert_policy
on public.days_off
for insert
to authenticated
with check (
  public.can_access_company_data(company_id, 'days_off_add')
  or public.can_access_company_data(company_id, 'open_days_off')
);

create policy days_off_update_policy
on public.days_off
for update
to authenticated
using (
  public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
)
with check (
  public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
);

create policy days_off_delete_policy
on public.days_off
for delete
to authenticated
using (
  public.can_access_company_data(company_id, 'days_off_delete')
);

grant select, insert, update, delete on public.days_off to authenticated;

-- 5) Jedna, czysta funkcja RPC zgodna z payloadem JS.
create or replace function public.add_day_off(
  p_company_id uuid,
  p_employee_id uuid default null,
  p_type text default 'dzień wolny',
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  employee_label text;
begin
  if p_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if public.can_access_company_data(p_company_id, 'days_off_add') is false
     and public.can_access_company_data(p_company_id, 'open_days_off') is false then
    raise exception 'Permission denied';
  end if;

  if p_start_date is null then
    raise exception 'Missing start_date';
  end if;

  p_end_date := coalesce(p_end_date, p_start_date);

  if p_end_date < p_start_date then
    raise exception 'Data końcowa nie może być wcześniejsza niż data początkowa';
  end if;

  if p_employee_id is not null then
    select coalesce(nullif(full_name, ''), nullif(email, ''), 'Pracownik')
    into employee_label
    from public.profiles
    where id = p_employee_id
      and company_id = p_company_id
      and coalesce(role::text, '') <> 'OWNER';
  end if;

  insert into public.days_off (
    company_id,
    employee_id,
    employee_name,
    type,
    start_date,
    end_date,
    description,
    status,
    created_by,
    created_at,
    updated_at
  ) values (
    p_company_id,
    p_employee_id,
    coalesce(employee_label, 'Pracownik'),
    coalesce(nullif(p_type, ''), 'dzień wolny'),
    p_start_date,
    p_end_date,
    nullif(trim(coalesce(p_description, '')), ''),
    'active',
    auth.uid(),
    now(),
    now()
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.add_day_off(uuid, uuid, text, date, date, text) to authenticated;

notify pgrst, 'reload schema';
