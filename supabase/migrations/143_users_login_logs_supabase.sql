-- COMPANYMANAGER 051A — Users login logs Supabase
-- Dziennik logowania: data, IP, login, status, przeglądarka.

create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null,
  user_id uuid null,
  login text,
  email text,
  status text not null default 'unknown',
  ip_address text,
  browser text,
  user_agent text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.login_logs
add column if not exists company_id uuid,
add column if not exists user_id uuid,
add column if not exists login text,
add column if not exists email text,
add column if not exists status text default 'unknown',
add column if not exists ip_address text,
add column if not exists browser text,
add column if not exists user_agent text,
add column if not exists error_message text,
add column if not exists created_at timestamptz default now();

create index if not exists login_logs_company_created_idx on public.login_logs(company_id, created_at desc);
create index if not exists login_logs_login_created_idx on public.login_logs(login, created_at desc);
create index if not exists login_logs_user_created_idx on public.login_logs(user_id, created_at desc);

alter table public.login_logs enable row level security;

drop policy if exists "login_logs_select_company" on public.login_logs;
drop policy if exists "login_logs_insert_none" on public.login_logs;

create policy "login_logs_select_company"
on public.login_logs
for select
to authenticated
using (
  company_id in (
    select p.company_id
    from public.profiles p
    where p.id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role::text, '')) = 'OWNER'
  )
);

-- Wpisy dodaje tylko funkcja SECURITY DEFINER.
create policy "login_logs_insert_none"
on public.login_logs
for insert
to authenticated
with check (false);

grant select on public.login_logs to authenticated;

create or replace function public.cm_record_login_log(
  p_login text,
  p_status text,
  p_user_agent text default null,
  p_browser text default null,
  p_user_id uuid default null,
  p_company_id uuid default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_headers jsonb := '{}'::jsonb;
  v_ip text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := coalesce(
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    nullif(v_headers ->> 'x-client-ip', '')
  );

  insert into public.login_logs (
    company_id,
    user_id,
    login,
    email,
    status,
    ip_address,
    browser,
    user_agent,
    error_message,
    created_at
  ) values (
    p_company_id,
    p_user_id,
    nullif(lower(trim(coalesce(p_login, ''))), ''),
    nullif(lower(trim(coalesce(p_login, ''))), ''),
    coalesce(nullif(lower(trim(coalesce(p_status, ''))), ''), 'unknown'),
    v_ip,
    nullif(trim(coalesce(p_browser, '')), ''),
    nullif(p_user_agent, ''),
    nullif(p_error_message, ''),
    now()
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.cm_record_login_log(text, text, text, text, uuid, uuid, text) to anon, authenticated;

create or replace function public.cm_list_company_login_logs(
  p_company_id uuid,
  p_limit integer default 200
)
returns table (
  id uuid,
  company_id uuid,
  user_id uuid,
  login text,
  email text,
  status text,
  ip_address text,
  browser text,
  user_agent text,
  error_message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.company_id,
    l.user_id,
    l.login,
    l.email,
    l.status,
    l.ip_address,
    l.browser,
    l.user_agent,
    l.error_message,
    l.created_at
  from public.login_logs l
  where l.company_id = p_company_id
    and (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.company_id = p_company_id
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and upper(coalesce(p.role::text, '')) = 'OWNER'
      )
    )
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

grant execute on function public.cm_list_company_login_logs(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
