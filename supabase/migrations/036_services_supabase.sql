-- COMPANYMANAGER — 036 SERVICES MODULE SUPABASE
-- Usługi + kategorie usług pod Supabase/RLS/company_id.

alter table public.service_categories
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists name text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.services
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists category_id uuid references public.service_categories(id) on delete set null,
add column if not exists name text,
add column if not exists duration_hours integer not null default 0,
add column if not exists duration_minutes integer not null default 0,
add column if not exists price_from numeric(12,2),
add column if not exists price_to numeric(12,2),
add column if not exists show_online boolean not null default false,
add column if not exists prevent_overlap boolean not null default false,
add column if not exists deposit numeric(12,2),
add column if not exists position_id uuid references public.positions(id) on delete set null,
add column if not exists description text,
add column if not exists code text,
add column if not exists include_commission boolean not null default false,
add column if not exists include_discount boolean not null default false,
add column if not exists active boolean not null default true,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create index if not exists service_categories_company_id_idx on public.service_categories(company_id);
create index if not exists service_categories_name_idx on public.service_categories(name);
create index if not exists services_company_id_idx on public.services(company_id);
create index if not exists services_category_id_idx on public.services(category_id);
create index if not exists services_position_id_idx on public.services(position_id);
create index if not exists services_name_idx on public.services(name);

grant select, insert, update, delete on table public.service_categories to authenticated;
grant select, insert, update, delete on table public.services to authenticated;
grant select on table public.positions to authenticated;

alter table public.service_categories enable row level security;
alter table public.services enable row level security;

-- Kategorie usług: osobne RLS, bo moduł Usługi ich używa tak samo jak same usługi.
drop policy if exists "service_categories select by permission" on public.service_categories;
drop policy if exists "service_categories insert by permission" on public.service_categories;
drop policy if exists "service_categories update by permission" on public.service_categories;
drop policy if exists "service_categories delete by permission" on public.service_categories;

create policy "service_categories select by permission"
on public.service_categories for select to authenticated
using (public.can_access_company_data(company_id, 'open_services'));

create policy "service_categories insert by permission"
on public.service_categories for insert to authenticated
with check (public.can_access_company_data(company_id, 'services_add'));

create policy "service_categories update by permission"
on public.service_categories for update to authenticated
using (public.can_access_company_data(company_id, 'services_edit'))
with check (public.can_access_company_data(company_id, 'services_edit'));

create policy "service_categories delete by permission"
on public.service_categories for delete to authenticated
using (public.can_access_company_data(company_id, 'services_delete'));

-- Usługi: odświeżenie polityk zgodne z permission based RLS.
drop policy if exists "services select by permission" on public.services;
drop policy if exists "services insert by permission" on public.services;
drop policy if exists "services update by permission" on public.services;
drop policy if exists "services delete by permission" on public.services;

drop policy if exists "company scoped manage services" on public.services;
drop policy if exists "company scoped select services" on public.services;

create policy "services select by permission"
on public.services for select to authenticated
using (public.can_access_company_data(company_id, 'open_services'));

create policy "services insert by permission"
on public.services for insert to authenticated
with check (public.can_access_company_data(company_id, 'services_add'));

create policy "services update by permission"
on public.services for update to authenticated
using (public.can_access_company_data(company_id, 'services_edit'))
with check (public.can_access_company_data(company_id, 'services_edit'));

create policy "services delete by permission"
on public.services for delete to authenticated
using (public.can_access_company_data(company_id, 'services_delete'));
