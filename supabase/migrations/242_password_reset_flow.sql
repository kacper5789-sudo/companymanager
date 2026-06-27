-- 242_password_reset_flow
-- Frontend-only patch: dodano resetowanie hasła przez Supabase Auth.
-- W Supabase Auth należy ustawić:
-- Site URL: https://companymanager.com.pl
-- Redirect URL: https://companymanager.com.pl/reset-password.html
select '242_password_reset_flow: frontend only; configure Supabase Auth redirect URL' as info;
