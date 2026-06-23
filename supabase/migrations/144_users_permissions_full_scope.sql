-- COMPANYMANAGER 051B — USERS PERMISSIONS FULL SCOPE
-- Pełny zakres uprawnień dla panelu Użytkownicy.

alter table public.profiles
add column if not exists permissions jsonb not null default '{}'::jsonb,
add column if not exists login_allowed boolean not null default true,
add column if not exists login_hours_enabled boolean not null default false,
add column if not exists login_hour_from time,
add column if not exists login_hour_to time,
add column if not exists phone text,
add column if not exists position_id uuid references public.positions(id) on delete set null,
add column if not exists updated_at timestamptz default now();

create or replace function public.default_employee_permissions()
returns jsonb
language sql
stable
as $$
  select jsonb_object_agg(key, false)
  from unnest(array[
    -- Możliwość otwierania zakładek
    'open_company_manager',
    'open_positions',
    'open_team',
    'open_days_off',
    'open_clients',
    'open_services',
    'open_products',
    'open_appointments',
    'open_sales_without_visit',
    'open_marketing',
    'open_passes',
    'open_owner_page',
    'open_sales',
    'open_stats',
    'open_customer_reports',
    'open_daily_report',
    'open_period_report',
    'open_employees',
    'open_work_schedule',
    'open_sms',
    'open_email',

    -- Funkcje w systemie
    'positions_add',
    'positions_edit',
    'positions_delete',
    'users_add',
    'users_edit',
    'users_delete',
    'days_off_add',
    'days_off_edit',
    'days_off_delete',
    'clients_add',
    'clients_edit',
    'clients_delete',
    'clients_history',
    'services_add',
    'services_edit',
    'services_delete',
    'products_add',
    'products_edit',
    'products_delete',
    'warehouse_manage',
    'appointments_add',
    'appointments_edit',
    'appointments_finish',
    'appointments_delete',
    'appointments_unfinished_history',
    'appointments_unfinished_manage',
    'appointments_history',
    'sales_without_visit_add',
    'sales_without_visit_edit',
    'sales_without_visit_delete',
    'sales_without_visit_history',
    'marketing_sms',
    'marketing_email',
    'marketing_delete',
    'passes_add',
    'passes_edit',
    'passes_delete',
    'daily_report_today',
    'daily_report_other_days',
    'work_schedule_add',
    'work_schedule_edit',
    'work_schedule_delete',
    'reports_access',
    'export_data',
    'import_data'
  ]) as key;
$$;

create or replace function public.admin_permissions()
returns jsonb
language sql
stable
as $$
  select '{"admin": true}'::jsonb;
$$;

-- Uzupełnij brakujące klucze bez nadpisywania istniejących wyborów.
update public.profiles
set permissions = coalesce(permissions, '{}'::jsonb) || public.default_employee_permissions() || coalesce(permissions, '{}'::jsonb),
    updated_at = now()
where role = 'EMPLOYEE';

update public.profiles
set permissions = public.admin_permissions(),
    updated_at = now()
where role in ('OWNER', 'ADMIN');

grant select, update on public.profiles to authenticated;
grant execute on function public.default_employee_permissions() to authenticated;
grant execute on function public.admin_permissions() to authenticated;

notify pgrst, 'reload schema';
