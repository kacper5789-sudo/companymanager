-- COMPANYMANAGER — 043 APPOINTMENTS MODULE SUPABASE

alter table public.appointments
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists date date,
add column if not exists time time,
add column if not exists start_time time,
add column if not exists end_time time,
add column if not exists customer_id uuid,
add column if not exists client_id uuid,
add column if not exists employee_id uuid,
add column if not exists service_id uuid,
add column if not exists position_id uuid,
add column if not exists status text not null default 'niezakończone',
add column if not exists deleted boolean not null default false,
add column if not exists note text,
add column if not exists price numeric(12,2),
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists appointments_company_id_idx on public.appointments(company_id);
create index if not exists appointments_date_idx on public.appointments(date);
create index if not exists appointments_customer_id_idx on public.appointments(customer_id);
create index if not exists appointments_client_id_idx on public.appointments(client_id);
create index if not exists appointments_employee_id_idx on public.appointments(employee_id);
create index if not exists appointments_service_id_idx on public.appointments(service_id);
create index if not exists appointments_position_id_idx on public.appointments(position_id);
create index if not exists appointments_status_idx on public.appointments(status);

grant select, insert, update, delete on public.appointments to authenticated;

alter table public.appointments enable row level security;

drop policy if exists "appointments select by permission" on public.appointments;
drop policy if exists "appointments insert by permission" on public.appointments;
drop policy if exists "appointments update by permission" on public.appointments;
drop policy if exists "appointments delete by permission" on public.appointments;

create policy "appointments select by permission"
on public.appointments
for select
to authenticated
using (public.can_access_company_data(company_id, 'open_appointments'));

create policy "appointments insert by permission"
on public.appointments
for insert
to authenticated
with check (public.can_access_company_data(company_id, 'appointments_add'));

create policy "appointments update by permission"
on public.appointments
for update
to authenticated
using (public.can_access_company_data(company_id, 'appointments_edit'))
with check (public.can_access_company_data(company_id, 'appointments_edit'));

create policy "appointments delete by permission"
on public.appointments
for delete
to authenticated
using (public.can_access_company_data(company_id, 'appointments_delete'));

-- Dropdown pracowników/użytkowników dla modułu Wizyty.
-- Funkcja jest SECURITY DEFINER, bo profiles może mieć twardsze RLS niż zwykłe selecty.
create or replace function public.company_users_for_dropdown(target_company_id uuid)
returns table (
  id uuid,
  email text,
  full_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.can_access_company_data(target_company_id, 'open_appointments')
    or public.can_access_company_data(target_company_id, 'appointments_add')
    or public.can_access_company_data(target_company_id, 'appointments_edit')
  ) then
    raise exception 'No access to company users dropdown';
  end if;

  return query
  select
    p.id,
    p.email,
    coalesce(p.full_name, p.email, '') as full_name,
    p.role::text as role
  from public.profiles p
  where p.company_id = target_company_id
    and coalesce(p.login_allowed, true) = true
    and coalesce(p.role::text, '') <> 'OWNER'
  order by coalesce(p.full_name, p.email, '');
end;
$$;

grant execute on function public.company_users_for_dropdown(uuid) to authenticated;
