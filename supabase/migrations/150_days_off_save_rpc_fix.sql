-- COMPANYMANAGER — 150 DAYS OFF SAVE RPC FIX
-- Fix: przycisk „Zapisz dni wolne” nie zapisuje wpisu przez bezpośredni insert/RLS.
-- Rozwiązanie: dedykowane RPC security definer + poprawka company_team_members dla modułu Dni wolne.

create or replace function public.company_team_members(p_company_id uuid default null)
returns table (
  id uuid,
  company_id uuid,
  email text,
  full_name text,
  phone text,
  role text,
  position_id uuid,
  position_name text,
  position_description text,
  login_allowed boolean,
  login_hours_enabled boolean,
  login_hour_from time,
  login_hour_to time,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target_company_id uuid;
begin
  select *
  into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if coalesce(me.login_allowed, true) is false then
    raise exception 'Login disabled';
  end if;

  target_company_id := coalesce(p_company_id, me.company_id);

  if target_company_id is null then
    raise exception 'Missing company context';
  end if;

  if me.role::text <> 'OWNER' and me.company_id <> target_company_id then
    raise exception 'Permission denied';
  end if;

  if public.can_access_company_data(target_company_id, 'open_team') is false
     and public.can_access_company_data(target_company_id, 'open_employees') is false
     and public.can_access_company_data(target_company_id, 'open_days_off') is false
     and public.can_access_company_data(target_company_id, 'days_off_add') is false
     and public.can_access_company_data(target_company_id, 'days_off_edit') is false
     and public.can_access_company_data(target_company_id, 'days_off_delete') is false then
    raise exception 'Permission denied';
  end if;

  return query
  select
    p.id,
    p.company_id,
    p.email::text,
    coalesce(nullif(p.full_name, ''), p.email)::text as full_name,
    p.phone::text,
    p.role::text,
    p.position_id,
    pos.name::text as position_name,
    pos.description::text as position_description,
    coalesce(p.login_allowed, true) as login_allowed,
    coalesce(p.login_hours_enabled, false) as login_hours_enabled,
    p.login_hour_from,
    p.login_hour_to,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join public.positions pos on pos.id = p.position_id
  where p.company_id = target_company_id
    and coalesce(p.role::text, '') <> 'OWNER'
  order by
    case p.role::text when 'ADMIN' then 1 when 'EMPLOYEE' then 2 else 3 end,
    coalesce(nullif(p.full_name, ''), p.email),
    p.created_at;
end;
$$;

grant execute on function public.company_team_members(uuid) to authenticated;

create or replace function public.add_day_off(
  p_company_id uuid,
  p_employee_id uuid,
  p_type text,
  p_start_date date,
  p_end_date date,
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

  if public.can_access_company_data(p_company_id, 'days_off_add') is false then
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

    if employee_label is null then
      raise exception 'Pracownik nie istnieje w tej firmie';
    end if;
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
  )
  values (
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

create or replace function public.update_day_off(
  p_day_off_id uuid,
  p_company_id uuid,
  p_employee_id uuid,
  p_type text,
  p_start_date date,
  p_end_date date,
  p_description text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_label text;
begin
  if p_day_off_id is null or p_company_id is null then
    raise exception 'Missing day_off_id or company_id';
  end if;

  if public.can_access_company_data(p_company_id, 'days_off_edit') is false then
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

    if employee_label is null then
      raise exception 'Pracownik nie istnieje w tej firmie';
    end if;
  end if;

  update public.days_off
  set
    employee_id = p_employee_id,
    employee_name = coalesce(employee_label, 'Pracownik'),
    type = coalesce(nullif(p_type, ''), 'dzień wolny'),
    start_date = p_start_date,
    end_date = p_end_date,
    description = nullif(trim(coalesce(p_description, '')), ''),
    updated_at = now()
  where id = p_day_off_id
    and company_id = p_company_id
    and deleted_at is null;

  if not found then
    raise exception 'Nie znaleziono wpisu dni wolnych';
  end if;

  return true;
end;
$$;

grant execute on function public.update_day_off(uuid, uuid, uuid, text, date, date, text) to authenticated;

create or replace function public.delete_day_off(
  p_day_off_id uuid,
  p_company_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_day_off_id is null or p_company_id is null then
    raise exception 'Missing day_off_id or company_id';
  end if;

  if public.can_access_company_data(p_company_id, 'days_off_delete') is false then
    raise exception 'Permission denied';
  end if;

  update public.days_off
  set
    status = 'deleted',
    deleted_at = now(),
    updated_at = now()
  where id = p_day_off_id
    and company_id = p_company_id
    and deleted_at is null;

  if not found then
    raise exception 'Nie znaleziono wpisu dni wolnych';
  end if;

  return true;
end;
$$;

grant execute on function public.delete_day_off(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
