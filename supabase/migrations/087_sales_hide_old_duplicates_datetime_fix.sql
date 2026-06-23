-- COMPANYMANAGER — 087 SALES HIDE OLD DUPLICATES + DATETIME FIX
-- Cel:
-- 1) Nie pokazujemy w raportach starych duplikatów sprzedaży usług po jednej wizycie.
-- 2) Nie ustawiamy sales.status = duplicate, bo status jest enumem.
-- 3) Oznaczamy duplikaty przez payment_status = 'void'.
-- 4) Uzupełniamy sales.employee_name z appointments/profiles tam, gdzie się da.

alter table public.sales
add column if not exists employee_name text;

update public.sales s
set employee_name = coalesce(
  nullif(s.employee_name, ''),
  nullif(a.employee_name, ''),
  nullif(p.full_name, ''),
  nullif(p.email, '')
)
from public.appointments a
left join public.profiles p on p.id = a.employee_id
where s.appointment_id = a.id;

-- Duplikaty po tym samym appointment_id: zostawiamy najnowszą sprzedaż,
-- starsze chowamy jako void.
with ranked as (
  select
    id,
    row_number() over (
      partition by company_id, appointment_id
      order by
        case when nullif(employee_name, '') is not null then 0 else 1 end,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.sales
  where appointment_id is not null
    and coalesce(payment_status, '') <> 'void'
)
update public.sales s
set
  payment_status = 'void',
  updated_at = now()
from ranked r
where s.id = r.id
  and r.rn > 1;

-- Stare testowe duplikaty bez appointment_id: jeśli mają tę samą firmę,
-- klienta, dzień, nazwę pozycji i kwotę, zostawiamy jeden najlepszy rekord.
with sale_service_rows as (
  select
    s.id as sale_id,
    s.company_id,
    coalesce(s.client_id::text, '') as client_key,
    date(coalesce(s.created_at, si.created_at)) as sale_day,
    lower(trim(coalesce(si.name, si.name_snapshot, ''))) as item_name,
    coalesce(si.total, si.total_price, si.unit_price, s.total_gross, s.total, 0)::numeric(12,2) as item_value,
    s.employee_name,
    s.created_at,
    s.payment_status
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  where lower(coalesce(si.item_type, '')) = 'service'
    and coalesce(s.payment_status, '') <> 'void'
), ranked as (
  select
    sale_id,
    row_number() over (
      partition by company_id, client_key, sale_day, item_name, item_value
      order by
        case when nullif(employee_name, '') is not null then 0 else 1 end,
        created_at desc nulls last,
        sale_id desc
    ) as rn
  from sale_service_rows
)
update public.sales s
set
  payment_status = 'void',
  updated_at = now()
from ranked r
where s.id = r.sale_id
  and r.rn > 1;

notify pgrst, 'reload schema';
