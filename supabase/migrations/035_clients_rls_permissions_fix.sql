-- CompanyManager — 035_clients_rls_permissions_fix
-- Cel: finalny dostęp modułu Klienci do Supabase po błędach:
-- permission denied for table clients / profiles.

-- Podstawowe prawa dla zalogowanych użytkowników.
grant usage on schema public to anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;

-- Bezpieczny helper dla RLS: pobiera company_id aktualnie zalogowanego użytkownika.
create or replace function public.my_company_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.my_company_id() to authenticated;

-- Helper roli użytkownika, gdyby nie istniał w danym środowisku.
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.my_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;

-- Użytkownik może czytać swój profil; OWNER może czytać profile globalnie.
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_owner_read" on public.profiles;

create policy "profiles_self_read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_owner_read"
on public.profiles
for select
to authenticated
using (public.my_role() = 'OWNER');

-- Klienci: OWNER widzi wszystko, firma widzi tylko swoje company_id.
drop policy if exists "clients_owner_all" on public.clients;
drop policy if exists "clients_company_access" on public.clients;

create policy "clients_owner_all"
on public.clients
for all
to authenticated
using (public.my_role() = 'OWNER')
with check (public.my_role() = 'OWNER');

create policy "clients_company_access"
on public.clients
for all
to authenticated
using (company_id = public.my_company_id())
with check (company_id = public.my_company_id());
