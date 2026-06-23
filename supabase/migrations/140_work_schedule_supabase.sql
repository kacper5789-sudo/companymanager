-- COMPANYMANAGER 050A
-- Grafik pracy pracowników -> Supabase + Dashboard/Raporty.

create table if not exists public.employee_work_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text,
  day_of_week integer not null check (day_of_week between 0 and 6),
  is_working boolean not null default true,
  start_time time without time zone not null default '08:00',
  end_time time without time zone not null default '16:00',
  break_start time without time zone,
  break_end time without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_work_schedules_company_employee_day_key unique (company_id, employee_id, day_of_week)
);

alter table public.employee_work_schedules enable row level security;

grant select, insert, update, delete on public.employee_work_schedules to authenticated;

drop policy if exists "employee_work_schedules_select_company" on public.employee_work_schedules;
drop policy if exists "employee_work_schedules_insert_company" on public.employee_work_schedules;
drop policy if exists "employee_work_schedules_update_company" on public.employee_work_schedules;
drop policy if exists "employee_work_schedules_delete_company" on public.employee_work_schedules;

create policy "employee_work_schedules_select_company"
on public.employee_work_schedules
for select
to authenticated
using (
  company_id in (
    select p.company_id from public.profiles p where p.id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
);

create policy "employee_work_schedules_insert_company"
on public.employee_work_schedules
for insert
to authenticated
with check (
  company_id in (
    select p.company_id from public.profiles p where p.id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
);

create policy "employee_work_schedules_update_company"
on public.employee_work_schedules
for update
to authenticated
using (
  company_id in (
    select p.company_id from public.profiles p where p.id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
)
with check (
  company_id in (
    select p.company_id from public.profiles p where p.id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
);

create policy "employee_work_schedules_delete_company"
on public.employee_work_schedules
for delete
to authenticated
using (
  company_id in (
    select p.company_id from public.profiles p where p.id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
);

create index if not exists employee_work_schedules_company_idx on public.employee_work_schedules(company_id);
create index if not exists employee_work_schedules_employee_idx on public.employee_work_schedules(employee_id);

notify pgrst, 'reload schema';
