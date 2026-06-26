-- COMPANYMANAGER — 197 USERS DELETE OR ANONYMIZE FIX
create extension if not exists pgcrypto with schema extensions;
-- Rozdziela blokowanie logowania od usuwania pracownika.
-- Usuń pracownika:
-- 1) jeśli nie ma powiązań biznesowych -> twarde usunięcie profilu i próba zwolnienia emaila w auth.users,
-- 2) jeśli ma powiązania -> anonimizacja profilu, ukrycie z listy aktywnych, blokada logowania i próba zwolnienia emaila w auth.users.

alter table public.profiles
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists anonymized_at timestamptz,
add column if not exists original_email_hash text,
add column if not exists active boolean default true;

-- Lista użytkowników nie pokazuje usuniętych/anonymizowanych rekordów.
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
    and p.deleted_at is null
    and coalesce(p.active, true) = true
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_company_users(uuid) to authenticated;

create or replace function public.cm_user_has_business_links(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_links boolean := false;
begin
  -- Każdy blok jest odporny na brak tabel/kolumn, bo projekt był migrowany etapami.
  begin
    execute 'select exists(select 1 from public.appointments where employee_id = $1 or created_by = $1 or cancelled_by = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.employee_days_off where employee_id = $1 or created_by = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.work_schedules where employee_id = $1 or created_by = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.sales where employee_id = $1 or created_by = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.sale_items where employee_id = $1 or created_by = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.activity_logs where actor_id = $1 or user_id = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  begin
    execute 'select exists(select 1 from public.login_logs where user_id = $1 limit 1)' into has_links using p_user_id;
    if has_links then return true; end if;
  exception when others then null; end;

  return false;
end;
$$;

grant execute on function public.cm_user_has_business_links(uuid) to authenticated;

create or replace function public.admin_delete_company_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target public.profiles;
  has_links boolean := true;
  deleted_email text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.role not in ('OWNER','ADMIN') then raise exception 'Only OWNER or ADMIN can delete users'; end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then raise exception 'User profile not found'; end if;
  if target.role = 'OWNER'::public.user_role then raise exception 'Cannot delete OWNER'; end if;
  if p_user_id = auth.uid() then raise exception 'Cannot delete your own account'; end if;

  if me.role <> 'OWNER'::public.user_role and target.company_id <> me.company_id then
    raise exception 'Cannot delete user from another company';
  end if;

  has_links := public.cm_user_has_business_links(p_user_id);
  deleted_email := 'deleted+' || replace(p_user_id::text, '-', '') || '@companymanager.local';

  -- Próba zwolnienia emaila w Supabase Auth, aby można było ponownie założyć konto na ten sam adres.
  -- Jeśli instancja nie pozwoli modyfikować auth.users z tej funkcji, profil i tak zostanie usunięty/anonymizowany.
  begin
    update auth.users
    set
      email = deleted_email,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('companymanager_deleted', true, 'companymanager_original_email', target.email),
      updated_at = now()
    where id = p_user_id;
  exception when others then
    null;
  end;

  if has_links = false then
    delete from public.profiles where id = p_user_id;
    return 'hard_deleted';
  end if;

  update public.profiles
  set
    email = deleted_email,
    full_name = 'Usunięty użytkownik',
    phone = null,
    position_id = null,
    login_allowed = false,
    login_hours_enabled = false,
    login_hour_from = null,
    login_hour_to = null,
    permissions = '{}'::jsonb,
    active = false,
    deleted_at = now(),
    deleted_by = auth.uid(),
    anonymized_at = now(),
    original_email_hash = encode(extensions.digest(coalesce(target.email, '')::bytea, 'sha256'), 'hex'),
    updated_at = now()
  where id = p_user_id;

  return 'anonymized';
end;
$$;

grant execute on function public.admin_delete_company_user(uuid) to authenticated;

-- Stara funkcja zostaje jako blokada logowania, nie jako usunięcie.
create or replace function public.admin_disable_company_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  target public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.role not in ('OWNER','ADMIN') then raise exception 'Only OWNER or ADMIN can disable users'; end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then raise exception 'User profile not found'; end if;
  if target.role = 'OWNER'::public.user_role then raise exception 'Cannot disable OWNER'; end if;
  if me.role <> 'OWNER'::public.user_role and target.company_id <> me.company_id then
    raise exception 'Cannot disable user from another company';
  end if;

  update public.profiles
  set login_allowed = false, updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_disable_company_user(uuid) to authenticated;

notify pgrst, 'reload schema';
