-- COMPANYMANAGER — 073 SALES EMPLOYEE NAME REPORT FIX
-- Uzupełnia sales.employee_id z appointments, żeby raporty sprzedaży grupowały po pracowniku.
-- Bezpieczne: nie rusza statusów wizyt, sales ani payments poza brakującym employee_id/client_id.

update public.sales s
set
  employee_id = coalesce(s.employee_id, a.employee_id),
  client_id = coalesce(s.client_id, a.client_id),
  updated_at = now()
from public.appointments a
where s.appointment_id = a.id
  and (s.employee_id is null or s.client_id is null);

notify pgrst, 'reload schema';
