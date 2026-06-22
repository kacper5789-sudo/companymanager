-- COMPANYMANAGER — 047 PRODUCTS SUPABASE COMPLETE

alter table public.products
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists name text,
add column if not exists category text,
add column if not exists package_stock integer default 0,
add column if not exists low_package_stock integer default 0,
add column if not exists unit_stock integer default 0,
add column if not exists units_per_package integer default 0,
add column if not exists company_name text,
add column if not exists sale_only boolean not null default false,
add column if not exists price numeric(12,2) default 0,
add column if not exists last_purchase_price numeric(12,2) default 0,
add column if not exists supplier text,
add column if not exists description text,
add column if not exists code text,
add column if not exists include_commission boolean not null default false,
add column if not exists include_discount boolean not null default false,
add column if not exists active boolean not null default true,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists products_company_id_idx on public.products(company_id);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_company_name_idx on public.products(company_name);
create index if not exists products_code_idx on public.products(code);
create index if not exists products_sale_only_idx on public.products(sale_only);
create index if not exists products_active_idx on public.products(active);

grant select, insert, update, delete on public.products to authenticated;

alter table public.products enable row level security;

drop policy if exists "products select by permission" on public.products;
drop policy if exists "products insert by permission" on public.products;
drop policy if exists "products update by permission" on public.products;
drop policy if exists "products delete by permission" on public.products;

create policy "products select by permission"
on public.products
for select
to authenticated
using (
  public.can_access_company_data(company_id, 'open_products')
);

create policy "products insert by permission"
on public.products
for insert
to authenticated
with check (
  public.can_access_company_data(company_id, 'products_add')
);

create policy "products update by permission"
on public.products
for update
to authenticated
using (
  public.can_access_company_data(company_id, 'products_edit')
  or public.can_access_company_data(company_id, 'warehouse_manage')
)
with check (
  public.can_access_company_data(company_id, 'products_edit')
  or public.can_access_company_data(company_id, 'warehouse_manage')
);

create policy "products delete by permission"
on public.products
for delete
to authenticated
using (
  public.can_access_company_data(company_id, 'products_delete')
);
