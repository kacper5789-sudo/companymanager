-- COMPANYMANAGER — 200 ADMIN CREATE USER EMAIL CONFLICT HARD FIX
-- Twardy fix konfliktu 409 przy ponownym dodawaniu użytkownika tym samym emailem.
-- Problem: wcześniejsze usunięcie mogło zostawić profil/auth user w stanie blokującym unique constraint.
-- Rozwiązanie: admin_create_company_user_safe przed insertem zwalnia WSZYSTKIE inne profile z tym emailem,
-- a jeśli profil o final_user_id już istnieje, reaktywuje go zamiast próbować tworzyć duplikat.

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
set search_path = public, auth, extensions
as $$
declare
  me public.profiles;
  final_user_id uuid;
  final_company_id uuid;
  final_position_id uuid;
  final_role public.user_role;
  final_permissions jsonb;
  final_email text;
  existing_same_id uuid;
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

  -- 200: Najpierw zwolnij email ze WSZYSTKICH innych profili.
  -- Dzięki temu unique(email) nie blokuje ponownego dodania nawet jeśli poprzedni delete nie ustawił deleted_at.
  update public.profiles p
  set
    email = 'released+' || replace(p.id::text, '-', '') || '@companymanager.local',
    original_email_hash = coalesce(p.original_email_hash, encode(extensions.digest(coalesce(p.email, '')::bytea, 'sha256'), 'hex')),
    active = false,
    login_allowed = false,
    deleted_at = coalesce(p.deleted_at, now()),
    anonymized_at = coalesce(p.anonymized_at, now()),
    updated_at = now()
  where lower(trim(coalesce(p.email, ''))) = final_email
    and p.id <> final_user_id;

  -- Jeżeli profil z tym id już istnieje, traktujemy to jako reaktywację.
  select p.id into existing_same_id
  from public.profiles p
  where p.id = final_user_id
  limit 1;

  if existing_same_id is not null then
    update public.profiles
    set
      company_id = final_company_id,
      email = final_email,
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
      active = true,
      deleted_at = null,
      deleted_by = null,
      anonymized_at = null,
      original_email_hash = null,
      updated_at = now()
    where id = final_user_id;

    return final_user_id;
  end if;

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
  );

  return final_user_id;
exception
  when unique_violation then
    raise exception 'User create conflict after cleanup. Check profiles unique constraints for email/user id.' using errcode = '23505';
end;
$$;

grant execute on function public.admin_create_company_user_safe(jsonb) to authenticated;

-- Naprawa danych historycznych: zwolnij emaile ukrytych/usuniętych profili.
update public.profiles p
set
  email = 'released+' || replace(p.id::text, '-', '') || '@companymanager.local',
  original_email_hash = coalesce(p.original_email_hash, encode(extensions.digest(coalesce(p.email, '')::bytea, 'sha256'), 'hex')),
  active = false,
  login_allowed = false,
  deleted_at = coalesce(p.deleted_at, now()),
  anonymized_at = coalesce(p.anonymized_at, now()),
  updated_at = now()
where (
    p.deleted_at is not null
    or p.anonymized_at is not null
    or coalesce(p.active, true) = false
  )
  and p.email not like 'released+%@companymanager.local'
  and p.email not like 'deleted+%@companymanager.local';

notify pgrst, 'reload schema';
