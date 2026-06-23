-- COMPANYMANAGER 131
-- Hide cancelled/deleted payments from payment reports.
-- This keeps accounting history in DB, but removed sales/payments do not appear in UI reports.

alter table public.payments
add column if not exists status text default 'paid';

update public.payments p
set status = 'void'
where p.sale_id is not null
  and exists (
    select 1
    from public.sales s
    where s.id = p.sale_id
      and coalesce(s.payment_status, '') = 'void'
  );

update public.payments
set status = coalesce(nullif(status, ''), 'paid');

notify pgrst, 'reload schema';
