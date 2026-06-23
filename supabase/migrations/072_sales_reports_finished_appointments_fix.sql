-- COMPANYMANAGER — 072 SALES REPORTS AFTER FINISHED APPOINTMENTS FIX
-- Widok Sprzedaż musi widzieć sprzedaż utworzoną z zakończonych wizyt.
-- Ten SQL tylko hartuje sale_items pod stare/nowe ścieżki zapisu i nie zmienia statusów wizyt.

alter table public.sale_items
add column if not exists name_snapshot text,
add column if not exists total_price numeric(12,2);

alter table public.sale_items
alter column name set default 'Pozycja sprzedaży';

alter table public.sale_items
alter column name_snapshot set default 'Pozycja sprzedaży';

create or replace function public.sale_items_fill_sales_report_fields()
returns trigger
language plpgsql
as $$
begin
  new.name := coalesce(nullif(new.name, ''), nullif(new.name_snapshot, ''), 'Pozycja sprzedaży');
  new.name_snapshot := coalesce(nullif(new.name_snapshot, ''), nullif(new.name, ''), 'Pozycja sprzedaży');
  new.quantity := coalesce(new.quantity, 1);
  new.unit_price := coalesce(new.unit_price, 0);
  new.total := coalesce(new.total, new.total_price, new.quantity * new.unit_price, 0);
  new.total_price := coalesce(new.total_price, new.total, new.quantity * new.unit_price, 0);
  return new;
end;
$$;

drop trigger if exists trg_sale_items_fill_sales_report_fields on public.sale_items;

create trigger trg_sale_items_fill_sales_report_fields
before insert or update on public.sale_items
for each row
execute function public.sale_items_fill_sales_report_fields();

update public.sale_items
set
  name = coalesce(nullif(name, ''), nullif(name_snapshot, ''), 'Pozycja sprzedaży'),
  name_snapshot = coalesce(nullif(name_snapshot, ''), nullif(name, ''), 'Pozycja sprzedaży'),
  quantity = coalesce(quantity, 1),
  unit_price = coalesce(unit_price, 0),
  total = coalesce(total, total_price, quantity * unit_price, 0),
  total_price = coalesce(total_price, total, quantity * unit_price, 0)
where name is null
   or name_snapshot is null
   or total is null
   or total_price is null;

notify pgrst, 'reload schema';
