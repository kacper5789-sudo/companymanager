-- CompanyManager v77
-- Polityka raportowa: sprzedaż karnetu jest przychodem firmy, nie wynikiem pracownika.
-- Frontend zapisuje passes.employee_id = NULL i passes.employee_name = nazwa firmy.
-- Ten patch czyści historyczne rekordy karnetów, żeby raporty nie przypisywały ich do pracowników.

update public.passes p
set employee_id = null,
    employee_name = coalesce(c.name, p.employee_name, 'Firma'),
    updated_at = now()
from public.companies c
where p.company_id = c.id
  and p.active is distinct from false
  and p.employee_id is not null;

update public.sales s
set employee_id = null,
    employee_name = coalesce(c.name, s.employee_name, 'Firma'),
    updated_at = now()
from public.companies c
where s.company_id = c.id
  and exists (
    select 1
    from public.passes p
    where p.sale_id = s.id
      and p.company_id = s.company_id
  );
