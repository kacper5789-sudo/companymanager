-- COMPANYMANAGER — 082 PASSES UNIQUE NUMBER FIX
-- Naprawa: duplicate key value violates unique constraint "passes_company_number_idx".
-- Numer karnetu nie może być brany ze starego formularza/cache.
-- Jeśli numer jest pusty albo już istnieje w firmie, baza nadaje nowy unikalny numer.

create table if not exists public.pass_number_counters (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.pass_number_counters to authenticated;

alter table public.pass_number_counters enable row level security;

drop policy if exists "pass number counters select" on public.pass_number_counters;
create policy "pass number counters select"
on public.pass_number_counters
for select
to authenticated
using (public.can_access_company_data(company_id, 'passes_add') or public.can_access_company_data(company_id, 'passes_edit'));

drop policy if exists "pass number counters insert" on public.pass_number_counters;
create policy "pass number counters insert"
on public.pass_number_counters
for insert
to authenticated
with check (public.can_access_company_data(company_id, 'passes_add'));

drop policy if exists "pass number counters update" on public.pass_number_counters;
create policy "pass number counters update"
on public.pass_number_counters
for update
to authenticated
using (public.can_access_company_data(company_id, 'passes_add'))
with check (public.can_access_company_data(company_id, 'passes_add'));

create or replace function public.cm_existing_max_pass_number(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(nullif(regexp_replace(number, '\\D', '', 'g'), '')::integer), 0)
  from public.passes
  where company_id = p_company_id
    and number is not null;
$$;

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

  insert into public.pass_number_counters(company_id, last_number, updated_at)
  values (p_company_id, public.cm_existing_max_pass_number(p_company_id) + 1, now())
  on conflict (company_id)
  do update set
    last_number = greatest(public.pass_number_counters.last_number, public.cm_existing_max_pass_number(p_company_id)) + 1,
    updated_at = now()
  returning last_number into n;

  return 'KARNET-' || lpad(n::text, 4, '0');
end;
$$;

grant execute on function public.cm_existing_max_pass_number(uuid) to authenticated;
grant execute on function public.cm_next_pass_number(uuid) to authenticated;

create or replace function public.cm_passes_force_unique_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null then
    return new;
  end if;

  if new.number is null
     or btrim(new.number) = ''
     or exists (
       select 1
       from public.passes p
       where p.company_id = new.company_id
         and p.number = new.number
         and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     ) then
    new.number := public.cm_next_pass_number(new.company_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_passes_force_unique_number on public.passes;
create trigger trg_passes_force_unique_number
before insert or update of number, company_id on public.passes
for each row
execute function public.cm_passes_force_unique_number();

notify pgrst, 'reload schema';
