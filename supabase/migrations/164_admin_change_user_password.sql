-- CompanyManager 164 — ADMIN/OWNER: bezpieczna zmiana hasła użytkownika firmy
-- Rozszerza istniejący JSON-safe RPC admin_update_company_user_safe.

create or replace function public.admin_update_company_user_safe(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  me public.profiles;
  target public.profiles;
  final_user_id uuid;
  final_position_id uuid;
  final_company_id uuid;
  final_role public.user_role;
  final_permissions jsonb;
  new_password text;
begin
  final_user_id := nullif(p_payload->>'p_user_id', '')::uuid;
  final_position_id := nullif(p_payload->>'p_position_id', '')::uuid;
  final_company_id := nullif(p_payload->>'p_company_id', '')::uuid;
  final_role := upper(coalesce(nullif(p_payload->>'p_role', ''), 'EMPLOYEE'))::public.user_role;
  new_password := nullif(p_payload->>'p_password', '');

  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.role not in ('OWNER','ADMIN') then raise exception 'Permission denied'; end if;

  select * into target from public.profiles where id = final_user_id;
  if not found then raise exception 'User profile not found'; end if;
  if target.role = 'OWNER'::public.user_role then raise exception 'Cannot edit OWNER'; end if;

  if me.role <> 'OWNER'::public.user_role and target.company_id <> me.company_id then
    raise exception 'Cannot edit user from another company';
  end if;

  if me.role = 'OWNER'::public.user_role and final_company_id is not null and target.company_id <> final_company_id then
    raise exception 'Cannot edit user outside selected company';
  end if;

  if final_role = 'ADMIN'::public.user_role then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce(p_payload->'p_permissions', public.default_employee_permissions());
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
      then nullif(p_payload->>'p_login_hour_from', '')::time else null end,
    login_hour_to = case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_to', '')::time else null end,
    permissions = final_permissions,
    updated_at = now()
  where id = final_user_id;

  if new_password is not null then
    if char_length(new_password) < 8 then
      raise exception 'Password must have at least 8 characters';
    end if;

    update auth.users
    set
      encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
    where id = final_user_id;

    if not found then
      raise exception 'Auth user not found';
    end if;
  end if;
end;
$$;

grant execute on function public.admin_update_company_user_safe(jsonb) to authenticated;
notify pgrst, 'reload schema';
