-- 157_days_off_start_date_and_employee_mapping_fix.sql
-- CompanyManager: Dni wolne pracowników
-- Fix: frontend/profiles.id -> employees.id + safe date_from/date_to handling.

drop function if exists public.add_day_off(uuid, uuid, text, date, date, text);

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
  v_employee_id uuid;
  v_profile public.profiles;
  v_start_date date;
  v_end_date date;
  new_id uuid;
begin
  if p_company_id is null then
    raise exception 'Missing company_id';
  end if;

  v_start_date := coalesce(p_start_date, p_end_date, current_date);
  v_end_date := coalesce(p_end_date, v_start_date);

  if v_end_date < v_start_date then
    raise exception 'Data końcowa nie może być wcześniejsza niż data początkowa';
  end if;

  select e.id
  into v_employee_id
  from public.employees e
  where e.id = p_employee_id
    and e.company_id = p_company_id
  limit 1;

  if v_employee_id is null then
    select e.id
    into v_employee_id
    from public.employees e
    where e.profile_id = p_employee_id
      and e.company_id = p_company_id
  limit 1;
  end if;

  if v_employee_id is null and p_employee_id is not null then
    select *
    into v_profile
    from public.profiles p
    where p.id = p_employee_id
      and p.company_id = p_company_id;

    if found then
      insert into public.employees (
        company_id,
        profile_id,
        full_name,
        phone,
        position,
        role,
        active
      )
      values (
        v_profile.company_id,
        v_profile.id,
        coalesce(nullif(v_profile.full_name, ''), 'Pracownik'),
        v_profile.phone,
        null,
        v_profile.role,
        true
      )
      on conflict do nothing;

      select e.id
      into v_employee_id
      from public.employees e
      where e.profile_id = v_profile.id
        and e.company_id = p_company_id
      limit 1;
    end if;
  end if;

  if v_employee_id is null then
    raise exception 'Employee not found for profile/employee id: %', p_employee_id;
  end if;

  insert into public.days_off (
    company_id,
    employee_id,
    type,
    date_from,
    date_to,
    reason,
    created_by
  )
  values (
    p_company_id,
    v_employee_id,
    coalesce(nullif(p_type, ''), 'dzień wolny'),
    v_start_date,
    v_end_date,
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.add_day_off(uuid, uuid, text, date, date, text) to authenticated;

notify pgrst, 'reload schema';
