-- Usuwa zbędny drugi indeks unikalny na work_schedule.
-- Zostaje constraint work_schedule_company_id_employee_id_date_key używany przez upsert/logikę zapisu.
drop index if exists public.work_schedule_company_employee_date_uidx;
