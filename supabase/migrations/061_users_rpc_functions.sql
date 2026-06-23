-- COMPANYMANAGER — 061 USERS RPC FUNCTIONS
-- Wymaga wcześniejszego 060B_users_permissions_model_fixed.sql.

create or replace function public.admin_list_company_users(
  p_company_id uuid default null
)
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  role text,
  company_id uuid,
  position_id uuid,
  position_name text,
  login_allowed boolean,
  login_hours_enabled boolean,
  login_hour_from time,
  login_hour_to time,
  permissions jsonb,
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
  select * into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER', 'ADMIN') then
    raise exception 'Only OWNER or ADMIN can list users';
  end if;

  target_company_id := case
    when me.role = 'OWNER' then p_company_id
    else me.company_id
  end;

  if target_company_id is null then
    raise exception 'Missing company context';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role::text,
    p.company_id,
    p.position_id,
    pos.name as position_name,
    p.login_allowed,
    p.login_hours_enabled,
    p.login_hour_from,
    p.login_hour_to,
    p.permissions,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join public.positions pos on pos.id = p.position_id
  where p.company_id = target_company_id
    and p.role in ('ADMIN', 'EMPLOYEE')
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_company_users(uuid) to authenticated;


create or replace function public.admin_create_company_user(
  p_user_id uuid,
  p_company_id uuid,
  p_email text,
  p_full_name text,
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
  final_role text;
  final_permissions jsonb;
begin
  select * into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER', 'ADMIN') then
    raise exception 'Only OWNER or ADMIN can create users';
  end if;

  final_company_id := case
    when me.role = 'OWNER' then p_company_id
    else me.company_id
  end;

  if final_company_id is null then
    raise exception 'Missing company context';
  end if;

  final_role := upper(trim(coalesce(p_role, 'EMPLOYEE')));

  if final_role not in ('ADMIN', 'EMPLOYEE') then
    raise exception 'Invalid role';
  end if;

  if me.role = 'ADMIN' and final_role = 'ADMIN' then
    -- ADMIN może tworzyć ADMINA tylko jeśli świadomie zostawiamy tę możliwość.
    -- Na tym etapie SaaS pozwalamy, bo ADMIN zarządza firmą.
    null;
  end if;

  if final_role = 'ADMIN' then
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
    role,
    position_id,
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
    final_role,
    p_position_id,
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
    role = excluded.role,
    position_id = excluded.position_id,
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
  uuid, uuid, text, text, text, uuid, text, boolean, boolean, time, time, jsonb
) to authenticated;


create or replace function public.admin_update_company_user(
  p_user_id uuid,
  p_full_name text,
  p_phone text default null,
  p_position_id uuid default null,
  p_role text default 'EMPLOYEE',
  p_login_allowed boolean default true,
  p_login_hours_enabled boolean default false,
  p_login_hour_from time default null,
  p_login_hour_to time default null,
  p_permissions jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target public.profiles;
  final_role text;
  final_permissions jsonb;
begin
  select * into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER', 'ADMIN') then
    raise exception 'Only OWNER or ADMIN can update users';
  end if;

  select * into target
  from public.profiles
  where profiles.id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if target.role = 'OWNER' then
    raise exception 'Cannot edit OWNER here';
  end if;

  if me.role <> 'OWNER' and target.company_id <> me.company_id then
    raise exception 'Cannot update user from another company';
  end if;

  final_role := upper(trim(coalesce(p_role, 'EMPLOYEE')));

  if final_role not in ('ADMIN', 'EMPLOYEE') then
    raise exception 'Invalid role';
  end if;

  if final_role = 'ADMIN' then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce(p_permissions, public.default_employee_permissions());
  end if;

  update public.profiles
  set
    full_name = p_full_name,
    phone = p_phone,
    position_id = p_position_id,
    role = final_role,
    login_allowed = p_login_allowed,
    login_hours_enabled = p_login_hours_enabled,
    login_hour_from = p_login_hour_from,
    login_hour_to = p_login_hour_to,
    permissions = final_permissions,
    updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_update_company_user(
  uuid, text, text, uuid, text, boolean, boolean, time, time, jsonb
) to authenticated;


create or replace function public.admin_disable_company_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target public.profiles;
begin
  select * into me
  from public.profiles
  where profiles.id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER', 'ADMIN') then
    raise exception 'Only OWNER or ADMIN can disable users';
  end if;

  select * into target
  from public.profiles
  where profiles.id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if target.role = 'OWNER' then
    raise exception 'Cannot disable OWNER';
  end if;

  if me.role <> 'OWNER' and target.company_id <> me.company_id then
    raise exception 'Cannot disable user from another company';
  end if;

  update public.profiles
  set
    login_allowed = false,
    updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_disable_company_user(uuid) to authenticated;
