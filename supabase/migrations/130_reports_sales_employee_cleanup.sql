-- COMPANYMANAGER 048H
-- Reports/sales employee cleanup: fill employee snapshots and hide old duplicate rows without employee.

alter table public.sales
add column if not exists employee_name text;

-- Fill sales employee from linked appointment/profile where possible.
update public.sales s
set
  employee_id = coalesce(s.employee_id, a.employee_id),
  employee_name = coalesce(
    nullif(s.employee_name, ''),
    nullif(a.employee_name, ''),
    nullif(p.full_name, ''),
    nullif(p.email, '')
  ),
  updated_at = now()
from public.appointments a
left join public.profiles p on p.id = a.employee_id
where s.appointment_id = a.id
  and (
    s.employee_id is null
    or coalesce(nullif(s.employee_name, ''), '') = ''
  );

-- If there are old duplicate sales for the same day/client/amount without employee,
-- hide the copies when a matching row with employee exists.
with sale_base as (
  select
    s.id,
    s.company_id,
    s.client_id,
    date(s.created_at) as sale_day,
    coalesce(s.total_gross, s.total_net, 0)::numeric(12,2) as amount,
    lower(coalesce(si.name_snapshot, si.name, '')) as item_name,
    coalesce(nullif(s.employee_name, ''), nullif(a.employee_name, ''), nullif(p.full_name, ''), nullif(p.email, '')) as resolved_employee
  from public.sales s
  left join public.sale_items si on si.sale_id = s.id
  left join public.appointments a on a.id = s.appointment_id
  left join public.profiles p on p.id = coalesce(s.employee_id, a.employee_id)
  where coalesce(s.payment_status, '') <> 'void'
), named as (
  select distinct company_id, client_id, sale_day, amount, item_name
  from sale_base
  where coalesce(resolved_employee, '') <> ''
), duplicates_without_employee as (
  select b.id
  from sale_base b
  join named n on n.company_id = b.company_id
    and coalesce(n.client_id::text, '') = coalesce(b.client_id::text, '')
    and n.sale_day = b.sale_day
    and n.amount = b.amount
    and n.item_name = b.item_name
  where coalesce(b.resolved_employee, '') = ''
)
update public.sales s
set payment_status = 'void', updated_at = now()
where s.id in (select id from duplicates_without_employee);

notify pgrst, 'reload schema';
