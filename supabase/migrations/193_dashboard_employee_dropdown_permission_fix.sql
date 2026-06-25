-- 193_dashboard_employee_dropdown_permission_fix
-- Dashboard can be the only enabled page for EMPLOYEE. In that case the page still needs a safe
-- employee/user dropdown for schedule columns and filters, but it must not expose company panel/admin data.
-- This replaces the old RPC guard that required appointment add/edit permissions and crashed Dashboard.

create or replace function public.company_users_for_dropdown(target_company_id uuid)
returns table (
  id uuid,
  email text,
  full_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.can_access_company_data(target_company_id, 'open_company_manager')
    or public.can_access_company_data(target_company_id, 'dashboard')
    or public.can_access_company_data(target_company_id, 'open_dashboard')
    or public.can_access_company_data(target_company_id, 'CompanyManager')
    or public.can_access_company_data(target_company_id, 'open_appointments')
    or public.can_access_company_data(target_company_id, 'appointments_add')
    or public.can_access_company_data(target_company_id, 'appointments_edit')
  ) then
    -- Do not raise for Dashboard. Return an empty safe dropdown instead of breaking the whole page.
    return;
  end if;

  return query
  select
    p.id,
    p.email,
    coalesce(p.full_name, p.email, '') as full_name,
    p.role::text as role
  from public.profiles p
  where p.company_id = target_company_id
    and coalesce(p.login_allowed, true) = true
    and coalesce(p.role::text, '') <> 'OWNER'
  order by coalesce(p.full_name, p.email, '');
end;
$$;

grant execute on function public.company_users_for_dropdown(uuid) to authenticated;
notify pgrst, 'reload schema';
