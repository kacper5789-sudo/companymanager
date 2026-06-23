-- COMPANYMANAGER — 078 PASSES SUPABASE CORE
-- Karnety: Supabase table + RLS + pola zgodne ze starym modułem localStorage.

create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.clients(id) on delete set null,
  employee_id uuid references public.profiles(id) on delete set null,
  name text not null default 'Karnet',
  number text,
  sale_date date not null default current_date,
  sale_time text,
  valid_until date,
  payment_method text default 'gotówka',
  buyer text,
  customer_name text,
  employee_name text,
  value numeric(12,2) not null default 0,
  remaining numeric(12,2) not null default 0,
  description text,
  status text not null default 'aktualne',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.passes
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists customer_id uuid references public.clients(id) on delete set null,
add column if not exists employee_id uuid references public.profiles(id) on delete set null,
add column if not exists name text default 'Karnet',
add column if not exists number text,
add column if not exists sale_date date default current_date,
add column if not exists sale_time text,
add column if not exists valid_until date,
add column if not exists payment_method text default 'gotówka',
add column if not exists buyer text,
add column if not exists customer_name text,
add column if not exists employee_name text,
add column if not exists value numeric(12,2) default 0,
add column if not exists remaining numeric(12,2) default 0,
add column if not exists description text,
add column if not exists status text default 'aktualne',
add column if not exists active boolean default true,
add column if not exists created_by uuid,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists passes_company_id_idx on public.passes(company_id);
create index if not exists passes_customer_id_idx on public.passes(customer_id);
create index if not exists passes_employee_id_idx on public.passes(employee_id);
create index if not exists passes_sale_date_idx on public.passes(sale_date);
create index if not exists passes_valid_until_idx on public.passes(valid_until);
create index if not exists passes_status_idx on public.passes(status);
create unique index if not exists passes_company_number_idx on public.passes(company_id, number) where number is not null;

grant select, insert, update, delete on public.passes to authenticated;

alter table public.passes enable row level security;

drop policy if exists "passes select by permission" on public.passes;
drop policy if exists "passes insert by permission" on public.passes;
drop policy if exists "passes update by permission" on public.passes;
drop policy if exists "passes delete by permission" on public.passes;

create policy "passes select by permission"
on public.passes
for select
to authenticated
using (public.can_access_company_data(company_id, 'open_passes'));

create policy "passes insert by permission"
on public.passes
for insert
to authenticated
with check (public.can_access_company_data(company_id, 'passes_add'));

create policy "passes update by permission"
on public.passes
for update
to authenticated
using (public.can_access_company_data(company_id, 'passes_edit'))
with check (public.can_access_company_data(company_id, 'passes_edit'));

create policy "passes delete by permission"
on public.passes
for delete
to authenticated
using (public.can_access_company_data(company_id, 'passes_delete'));

create or replace function public.cm_next_pass_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.can_access_company_data(p_company_id, 'passes_add') then
    raise exception 'Permission denied';
  end if;

  select coalesce(max(nullif(regexp_replace(number, '\\D', '', 'g'), '')::integer), 0) + 1
  into n
  from public.passes
  where company_id = p_company_id
    and number is not null;

  return 'KARNET-' || lpad(n::text, 4, '0');
end;
$$;

grant execute on function public.cm_next_pass_number(uuid) to authenticated;

notify pgrst, 'reload schema';
