-- COMPANYMANAGER — 088 EMPLOYEES / TEAM SUPABASE
-- Zakładka Zespół (employees.html) jako podgląd pracowników/użytkowników firmy z Supabase.
-- Użytkownicy pozostają miejscem tworzenia i edycji kont. Zespół tylko czyta dane operacyjne.

alter table public.profiles
add column if not exists phone text,
add column if not exists position_id uuid references public.positions(id) on delete set null,
add column if not exists login_allowed boolean default true,
add column if not exists login_hours_enabled boolean default false,
add column if not exists login_hour_from time,
add column if not exists login_hour_to time,
add column if not exists updated_at timestamptz default now();

create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists profiles_position_id_idx on public.profiles(position_id);

grant select on table public.profiles to authenticated;
grant select on table public.positions to authenticated;

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
     and public.can_access_company_data(target_company_id, 'open_employees') is false then
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

notify pgrst, 'reload schema';
