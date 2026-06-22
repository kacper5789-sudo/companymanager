-- COMPANYMANAGER — 042 POSITIONS MODULE SUPABASE

alter table public.positions
add column if not exists company_id uuid references public.companies(id) on delete cascade,
add column if not exists name text,
add column if not exists description text,
add column if not exists active boolean not null default true,
add column if not exists capacity integer default 1,
add column if not exists color text,
add column if not exists order_index integer default 0,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists positions_company_id_idx on public.positions(company_id);
create index if not exists positions_order_index_idx on public.positions(order_index);

grant select, insert, update, delete on public.positions to authenticated;

alter table public.positions enable row level security;

drop policy if exists "positions select by permission" on public.positions;
drop policy if exists "positions insert by permission" on public.positions;
drop policy if exists "positions update by permission" on public.positions;
drop policy if exists "positions delete by permission" on public.positions;

create policy "positions select by permission"
on public.positions
for select
to authenticated
using (
  public.can_access_company_data(company_id, 'open_positions')
  or public.can_access_company_data(company_id, 'open_services')
);

create policy "positions insert by permission"
on public.positions
for insert
to authenticated
with check (
  public.can_access_company_data(company_id, 'positions_add')
);

create policy "positions update by permission"
on public.positions
for update
to authenticated
using (
  public.can_access_company_data(company_id, 'positions_edit')
)
with check (
  public.can_access_company_data(company_id, 'positions_edit')
);

create policy "positions delete by permission"
on public.positions
for delete
to authenticated
using (
  public.can_access_company_data(company_id, 'positions_delete')
);
