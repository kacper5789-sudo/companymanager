-- COMPANYMANAGER — 062 USERS CREATE COMPANY CONTEXT FIX
-- Fix: OWNER ma profiles.company_id = NULL, więc tworzenie użytkownika musi dostać p_company_id
-- z aktywnego kontekstu firmy. ADMIN zawsze używa swojej firmy i ignoruje obcy p_company_id.

drop function if exists public.admin_create_company_user(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  boolean,
  boolean,
  time without time zone,
  time without time zone,
  jsonb
);

drop function if exists public.admin_create_company_user(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  boolean,
  boolean,
  time without time zone,
  time without time zone,
  jsonb
);

create or replace function public.admin_create_company_user(
  p_user_id uuid,
  p_company_id uuid default null,
  p_email text default null,
  p_full_name text default null,
  p_phone text default null,
  p_position_id uuid default null,
  p_role text default 'EMPLOYEE',
  p_login_allowed boolean default true,
  p_login_hours_enabled boolean default false,
  p_login_hour_from time default null,
  p_login_hour_to time default null,
  p_permissions jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  final_company_id uuid;
  final_permissions jsonb;
begin
  select * into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER', 'ADMIN') then
    raise exception 'Permission denied';
  end if;

  if p_role not in ('ADMIN', 'EMPLOYEE') then
    raise exception 'Invalid role';
  end if;

  if me.role = 'OWNER' then
    final_company_id := p_company_id;
  else
    final_company_id := me.company_id;
  end if;

  if final_company_id is null then
    raise exception 'Missing company context';
  end if;

  if not exists (select 1 from public.companies c where c.id = final_company_id) then
    raise exception 'Company not found';
  end if;

  if p_role = 'ADMIN' then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce(p_permissions, public.default_employee_permissions());
  end if;

  insert into public.profiles (
    id,
    company_id,
    email,
    full_name,
    phone,
    position_id,
    role,
    login_allowed,
    login_hours_enabled,
    login_hour_from,
    login_hour_to,
    permissions,
    updated_at
  )
  values (
    p_user_id,
    final_company_id,
    lower(trim(p_email)),
    p_full_name,
    p_phone,
    p_position_id,
    p_role,
    p_login_allowed,
    p_login_hours_enabled,
    p_login_hour_from,
    p_login_hour_to,
    final_permissions,
    now()
  )
  on conflict (id) do update
  set
    company_id = excluded.company_id,
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    position_id = excluded.position_id,
    role = excluded.role,
    login_allowed = excluded.login_allowed,
    login_hours_enabled = excluded.login_hours_enabled,
    login_hour_from = excluded.login_hour_from,
    login_hour_to = excluded.login_hour_to,
    permissions = excluded.permissions,
    updated_at = now();

  return p_user_id;
end;
$$;

grant execute on function public.admin_create_company_user(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  boolean,
  boolean,
  time without time zone,
  time without time zone,
  jsonb
) to authenticated;
