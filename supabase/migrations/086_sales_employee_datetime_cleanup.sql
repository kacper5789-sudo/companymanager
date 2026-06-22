-- COMPANYMANAGER — 086 SALES EMPLOYEE DATETIME CLEANUP
-- Sprzedaż usług ma pokazywać pracownika z wizyty/snapshotu oraz datę z godziną.
-- Stare duplikaty sprzedaży z tej samej wizyty są oznaczane jako duplicate/void i ukrywane w raporcie.

alter table public.sales
add column if not exists employee_name text;

-- Uzupełnij snapshot pracownika w sprzedaży z danych wizyty.
update public.sales s
set
  employee_name = coalesce(nullif(s.employee_name, ''), nullif(a.employee_name, '')),
  updated_at = now()
from public.appointments a
where s.appointment_id = a.id
  and s.company_id = a.company_id
  and coalesce(nullif(s.employee_name, ''), nullif(a.employee_name, '')) is not null;

-- Jeżeli sprzedaż nie ma employee_id, ale wizyta ma prawdziwy profil, uzupełnij FK.
update public.sales s
set
  employee_id = a.employee_id,
  updated_at = now()
from public.appointments a
join public.profiles p on p.id = a.employee_id
where s.appointment_id = a.id
  and s.company_id = a.company_id
  and s.employee_id is null
  and a.employee_id is not null;

-- Stare duplikaty z wcześniejszych testów: dla jednej wizyty zostawiamy najnowszą sprzedaż.
with ranked as (
  select
    s.id,
    row_number() over (
      partition by s.company_id, s.appointment_id
      order by s.created_at desc nulls last, s.id desc
    ) as rn
  from public.sales s
  where s.appointment_id is not null
)
update public.sales s
set
  status = 'duplicate',
  payment_status = 'void',
  note = coalesce(nullif(s.note, ''), 'Ukryty duplikat sprzedaży z wcześniejszego testu'),
  updated_at = now()
from ranked r
where s.id = r.id
  and r.rn > 1;

notify pgrst, 'reload schema';
