-- COMPANYMANAGER — 085 SALES PENDING APPOINTMENTS NOT REVENUE
-- Zaplanowana wizyta może być widoczna w sprzedaży jako oczekująca,
-- ale nie może być oznaczona jako paid ani liczona do realnego przychodu.

update public.sales s
set
  payment_status = 'unpaid',
  updated_at = now()
from public.appointments a
where s.appointment_id = a.id
  and s.company_id = a.company_id
  and coalesce(a.finished, false) is false
  and coalesce(a.status::text, '') <> 'zakończone'
  and coalesce(s.payment_status, '') = 'paid';

notify pgrst, 'reload schema';
