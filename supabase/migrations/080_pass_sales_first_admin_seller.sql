-- CompanyManager 080 — karnety zawsze na właściciela firmy / pierwszego ADMINA
-- Uruchom w Supabase SQL Editor po wdrożeniu paczki.
-- Cel: stare sprzedane karnety przypisać do pierwszego ADMINA firmy,
-- bez robienia z firmy sztucznego użytkownika.

with first_admin as (
  select distinct on (p.company_id)
    p.company_id,
    p.id as admin_id,
    coalesce(nullif(p.full_name, ''), p.email, 'Właściciel firmy') as admin_name
  from public.profiles p
  where p.company_id is not null
    and lower(p.role::text) = 'admin'
    and coalesce(p.login_allowed, true) = true
  order by p.company_id, p.created_at asc nulls last, p.id asc
)
update public.passes pa
set
  employee_id = fa.admin_id,
  employee_name = fa.admin_name,
  updated_at = now()
from first_admin fa
where pa.company_id = fa.company_id
  and coalesce(pa.active, true) = true;

-- Snapshot nazwy sprzedawcy w sales dla sprzedaży karnetów.
-- Nie wymuszamy sales.employee_id, bo w części baz FK sales.employee_id może być inną relacją.
with first_admin as (
  select distinct on (p.company_id)
    p.company_id,
    coalesce(nullif(p.full_name, ''), p.email, 'Właściciel firmy') as admin_name
  from public.profiles p
  where p.company_id is not null
    and lower(p.role::text) = 'admin'
    and coalesce(p.login_allowed, true) = true
  order by p.company_id, p.created_at asc nulls last, p.id asc
)
update public.sales s
set
  employee_name = fa.admin_name,
  updated_at = now()
from public.passes pa
join first_admin fa on fa.company_id = pa.company_id
where s.id = pa.sale_id
  and s.company_id = pa.company_id;

notify pgrst, 'reload schema';
