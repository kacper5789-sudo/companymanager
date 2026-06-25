-- 191_login_hours_company_panel_permission_fix
-- Frontend patch:
-- 1) supabaseLogin.js enforces profiles.login_allowed and profiles.login_hours_enabled/login_hour_from/login_hour_to after Supabase Auth login.
-- 2) A new tab permission key open_company_panel controls access to company-panel.html for EMPLOYEE.
-- 3) open_company_manager no longer grants Company Panel access implicitly.
--
-- Optional safety: ensure the profiles columns exist in older databases.
alter table if exists public.profiles
  add column if not exists login_allowed boolean not null default true,
  add column if not exists login_hours_enabled boolean not null default false,
  add column if not exists login_hour_from time,
  add column if not exists login_hour_to time;

notify pgrst, 'reload schema';
