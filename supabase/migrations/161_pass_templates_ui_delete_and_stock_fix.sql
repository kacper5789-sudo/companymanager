-- COMPANYMANAGER — 161 PASS TEMPLATES UI DELETE AND STOCK FIX
-- Ujednolica pulę karnetów: stock_quantity / sold_count / remaining_stock oraz pozwala miękko usuwać typy karnetów.

alter table public.pass_templates
  add column if not exists stock_quantity integer not null default 1,
  add column if not exists sold_count integer not null default 0,
  add column if not exists remaining_stock integer not null default 1;

update public.pass_templates
set
  stock_quantity = greatest(coalesce(nullif(stock_quantity, 0), 1), 1),
  sold_count = greatest(coalesce(sold_count, 0), 0),
  remaining_stock = greatest(coalesce(nullif(remaining_stock, 0), greatest(coalesce(nullif(stock_quantity, 0), 1) - coalesce(sold_count, 0), 0), 1), 0)
where company_id is not null;

-- Jeśli wpis ma stock, ale remaining było 0 po starym błędzie, przelicz prawidłowo.
update public.pass_templates
set remaining_stock = greatest(stock_quantity - sold_count, 0)
where company_id is not null
  and stock_quantity > 0
  and remaining_stock > stock_quantity;

grant select, insert, update, delete on public.pass_templates to authenticated;

notify pgrst, 'reload schema';
