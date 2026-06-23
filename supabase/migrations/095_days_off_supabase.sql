-- COMPANYMANAGER — 095 DAYS OFF SUPABASE
-- panel/days-off.html -> public.days_off

create table if not exists public.days_off (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  employee_name text,
  type text not null default 'dzień wolny',
  start_date date not null,
  end_date date not null,
  description text,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.days_off
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists employee_id uuid references public.profiles(id) on delete set null,
add column if not exists employee_name text,
add column if not exists type text default 'dzień wolny',
add column if not exists start_date date,
add column if not exists end_date date,
add column if not exists description text,
add column if not exists status text default 'active',
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now(),
add column if not exists deleted_at timestamptz;

create index if not exists days_off_company_id_idx on public.days_off(company_id);
create index if not exists days_off_employee_id_idx on public.days_off(employee_id);
create index if not exists days_off_start_date_idx on public.days_off(start_date);
create index if not exists days_off_end_date_idx on public.days_off(end_date);
create index if not exists days_off_status_idx on public.days_off(status);

alter table public.days_off enable row level security;

drop policy if exists days_off_select_policy on public.days_off;
drop policy if exists days_off_insert_policy on public.days_off;
drop policy if exists days_off_update_policy on public.days_off;
drop policy if exists days_off_delete_policy on public.days_off;

create policy days_off_select_policy
on public.days_off
for select
to authenticated
using (
  public.can_access_company_data(company_id, 'open_days_off')
  or public.can_access_company_data(company_id, 'days_off_add')
  or public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
);

create policy days_off_insert_policy
on public.days_off
for insert
to authenticated
with check (
  public.can_access_company_data(company_id, 'days_off_add')
);

create policy days_off_update_policy
on public.days_off
for update
to authenticated
using (
  public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
)
with check (
  public.can_access_company_data(company_id, 'days_off_edit')
  or public.can_access_company_data(company_id, 'days_off_delete')
);

create policy days_off_delete_policy
on public.days_off
for delete
to authenticated
using (
  public.can_access_company_data(company_id, 'days_off_delete')
);

grant select, insert, update, delete on public.days_off to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_days_off_updated_at on public.days_off;
create trigger trg_days_off_updated_at
before update on public.days_off
for each row
execute function public.touch_updated_at();

create or replace function public.days_off_fill_employee_name()
returns trigger
language plpgsql
as $$
declare
  employee_label text;
begin
  if new.employee_id is not null then
    select coalesce(nullif(full_name, ''), nullif(email, ''), 'Pracownik')
    into employee_label
    from public.profiles
    where id = new.employee_id;

    new.employee_name := coalesce(nullif(new.employee_name, ''), employee_label, 'Pracownik');
  end if;

  new.type := coalesce(nullif(new.type, ''), 'dzień wolny');
  new.status := coalesce(nullif(new.status, ''), 'active');
  new.end_date := coalesce(new.end_date, new.start_date);

  if new.end_date < new.start_date then
    raise exception 'Data końcowa nie może być wcześniejsza niż data początkowa';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_days_off_fill_employee_name on public.days_off;
create trigger trg_days_off_fill_employee_name
before insert or update on public.days_off
for each row
execute function public.days_off_fill_employee_name();

notify pgrst, 'reload schema';
