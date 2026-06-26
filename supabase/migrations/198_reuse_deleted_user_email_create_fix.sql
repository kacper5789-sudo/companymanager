-- COMPANYMANAGER — 198 REUSE DELETED USER EMAIL CREATE FIX
-- Naprawia przypadek: usunięty/anonymizowany użytkownik nadal blokuje ponowne dodanie tego samego emaila.
-- admin_create_company_user_safe przed insertem zwalnia email w starych, usuniętych profilach.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists anonymized_at timestamptz,
add column if not exists original_email_hash text,
add column if not exists active boolean default true;

create or replace function public.admin_create_company_user_safe(p_payload jsonb)
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
  final_role public.user_role;
  final_permissions jsonb;
  final_email text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.role not in ('OWNER','ADMIN') then raise exception 'Permission denied'; end if;

  final_user_id := nullif(p_payload->>'p_user_id', '')::uuid;
  final_position_id := nullif(p_payload->>'p_position_id', '')::uuid;
  final_role := upper(coalesce(nullif(p_payload->>'p_role', ''), 'EMPLOYEE'))::public.user_role;
  final_email := lower(trim(coalesce(p_payload->>'p_email', '')));

  if final_user_id is null then raise exception 'Missing user_id'; end if;
  if final_email = '' then raise exception 'Missing email'; end if;

  if me.role = 'ADMIN'::public.user_role then
    final_company_id := me.company_id;
  else
    final_company_id := nullif(p_payload->>'p_company_id', '')::uuid;
  end if;

  if final_company_id is null then raise exception 'Missing company_id'; end if;

  if final_role = 'ADMIN'::public.user_role then
    final_permissions := public.admin_permissions();
  else
    final_permissions := coalesce(p_payload->'p_permissions', public.default_employee_permissions());
  end if;

  -- Jeżeli stary/usunięty profil nadal ma ten sam email, zwalniamy go przed dodaniem nowego profilu.
  update public.profiles p
  set
    email = 'deleted+' || replace(p.id::text, '-', '') || '@companymanager.local',
    original_email_hash = coalesce(p.original_email_hash, encode(extensions.digest(coalesce(p.email, '')::bytea, 'sha256'), 'hex')),
    updated_at = now()
  where lower(trim(coalesce(p.email, ''))) = final_email
    and p.id <> final_user_id
    and (
      p.deleted_at is not null
      or p.anonymized_at is not null
      or coalesce(p.active, true) = false
      or coalesce(p.login_allowed, true) = false
    );

  insert into public.profiles (
    id, company_id, email, full_name, phone, position_id, role,
    login_allowed, login_hours_enabled, login_hour_from, login_hour_to,
    permissions, active, deleted_at, deleted_by, anonymized_at, original_email_hash, updated_at
  ) values (
    final_user_id,
    final_company_id,
    final_email,
    nullif(p_payload->>'p_full_name', ''),
    nullif(p_payload->>'p_phone', ''),
    final_position_id,
    final_role,
    coalesce((p_payload->>'p_login_allowed')::boolean, true),
    coalesce((p_payload->>'p_login_hours_enabled')::boolean, false),
    case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_from', '')::time else null end,
    case when coalesce((p_payload->>'p_login_hours_enabled')::boolean, false)
      then nullif(p_payload->>'p_login_hour_to', '')::time else null end,
    final_permissions,
    true,
    null,
    null,
    null,
    null,
    now()
  ) on conflict (id) do update set
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
    active = true,
    deleted_at = null,
    deleted_by = null,
    anonymized_at = null,
    original_email_hash = null,
    updated_at = now();

  return final_user_id;
exception
  when unique_violation then
    raise exception 'Email is still used by another active profile. Check deleted/anonymized user cleanup.' using errcode = '23505';
end;
$$;

grant execute on function public.admin_create_company_user_safe(jsonb) to authenticated;

-- Jednorazowe uporządkowanie usuniętych profili, które mogły nadal trzymać realny email.
update public.profiles p
set
  email = 'deleted+' || replace(p.id::text, '-', '') || '@companymanager.local',
  original_email_hash = coalesce(p.original_email_hash, encode(extensions.digest(coalesce(p.email, '')::bytea, 'sha256'), 'hex')),
  updated_at = now()
where (
    p.deleted_at is not null
    or p.anonymized_at is not null
    or coalesce(p.active, true) = false
  )
  and p.email not like 'deleted+%@companymanager.local';

notify pgrst, 'reload schema';
