-- CompanyManager v98 — Employee color system

alter table public.profiles
add column if not exists employee_color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_employee_color_hex_chk'
  ) then
    alter table public.profiles
    add constraint profiles_employee_color_hex_chk
    check (employee_color is null or employee_color ~ '^#[0-9A-Fa-f]{6}$')
    not valid;
  end if;
end $$;

create index if not exists profiles_employee_color_idx
on public.profiles(company_id, employee_color);

grant select on table public.profiles to authenticated;
grant update(employee_color) on table public.profiles to authenticated;
