-- COMPANYMANAGER — 063 USERS RPC JSON SAFE FIX
-- Cel: ominąć problemy z przeciążonymi funkcjami RPC, typami uuid/time/jsonb
-- i cache PostgREST przy module Użytkownicy.

create or replace function public.admin_create_company_user_safe(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  final_user_id uuid;
  final_company_id uuid;
  final_position_id uuid;
  final_role text;
  final_permissions jsonb;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER','ADMIN') then
    raise exception 'Permission denied';
  end if;

  final_user_id := nullif(p_payload->>'p_user_id', '')::uuid;
  final_position_id := nullif(p_payload->>'p_position_id', '')::uuid;
  final_role := upper(coalesce(nullif(p_payload->>'p_role', ''), 'EMPLOYEE'));

  if final_user_id is null then
    raise exception 'Missing user id';
  end if;

  if final_role not in ('ADMIN','EMPLOYEE') then
    raise exception 'Invalid role';
  end if;

  if me.role = 'ADMIN' then
    final_company_id := me.company_id;
  else
    final_company_id := nullif(p_payload->>'p_company_id', '')::uuid;
  end if;

  if final_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if final_role = 'ADMIN' then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce((p_payload->'p_permissions')::jsonb, public.default_employee_permissions());
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
  ) values (
    final_user_id,
    final_company_id,
    lower(trim(p_payload->>'p_email')),
    nullif(p_payload->>'p_full_name', ''),
    nullif(p_payload->>'p_phone', ''),
    final_position_id,
    final_role,
    coalesce((p_payload->>'p_login_allowed')::boolean, true),
    coalesce((p_payload->>'p_login_hours_enabled')::boolean, false),
    case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_from', '')::time
      else null
    end,
    case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_to', '')::time
      else null
    end,
    final_permissions,
    now()
  )
  on conflict (id) do update set
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

  return final_user_id;
end;
$$;

grant execute on function public.admin_create_company_user_safe(jsonb) to authenticated;


create or replace function public.admin_update_company_user_safe(
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target public.profiles;
  final_user_id uuid;
  final_company_id uuid;
  final_position_id uuid;
  final_role text;
  final_permissions jsonb;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER','ADMIN') then
    raise exception 'Permission denied';
  end if;

  final_user_id := nullif(p_payload->>'p_user_id', '')::uuid;
  final_company_id := nullif(p_payload->>'p_company_id', '')::uuid;
  final_position_id := nullif(p_payload->>'p_position_id', '')::uuid;
  final_role := upper(coalesce(nullif(p_payload->>'p_role', ''), 'EMPLOYEE'));

  select * into target
  from public.profiles
  where id = final_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if target.role = 'OWNER' then
    raise exception 'Cannot edit OWNER';
  end if;

  if me.role <> 'OWNER' and target.company_id <> me.company_id then
    raise exception 'Cannot edit user from another company';
  end if;

  if me.role = 'OWNER'
     and final_company_id is not null
     and target.company_id <> final_company_id then
    raise exception 'Cannot edit user outside selected company';
  end if;

  if final_role not in ('ADMIN','EMPLOYEE') then
    raise exception 'Invalid role';
  end if;

  if final_role = 'ADMIN' then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce((p_payload->'p_permissions')::jsonb, public.default_employee_permissions());
  end if;

  update public.profiles
  set
    full_name = nullif(p_payload->>'p_full_name', ''),
    phone = nullif(p_payload->>'p_phone', ''),
    position_id = final_position_id,
    role = final_role,
    login_allowed = coalesce((p_payload->>'p_login_allowed')::boolean, true),
    login_hours_enabled = coalesce((p_payload->>'p_login_hours_enabled')::boolean, false),
    login_hour_from = case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_from', '')::time
      else null
    end,
    login_hour_to = case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_to', '')::time
      else null
    end,
    permissions = final_permissions,
    updated_at = now()
  where id = final_user_id;
end;
$$;

grant execute on function public.admin_update_company_user_safe(jsonb) to authenticated;

notify pgrst, 'reload schema';
