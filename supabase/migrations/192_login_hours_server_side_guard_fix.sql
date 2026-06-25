-- 192_login_hours_server_side_guard_fix
-- Twarda walidacja godzin logowania po stronie Supabase.
-- Front po zalogowaniu wywołuje cm_validate_login_window(); jeżeli konto jest poza oknem godzinowym,
-- użytkownik jest natychmiast wylogowywany i nie wejdzie do panelu.

alter table if exists public.profiles
  add column if not exists login_allowed boolean not null default true,
  add column if not exists login_hours_enabled boolean not null default false,
  add column if not exists login_hour_from time,
  add column if not exists login_hour_to time;

create or replace function public.cm_validate_login_window()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  company_tz text := 'Europe/Warsaw';
  from_t time;
  to_t time;
  now_t time;
  inside_window boolean := true;
  reason_text text := null;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'login_allowed', false,
      'login_hours_enabled', false,
      'reason', 'Profil użytkownika nie istnieje.'
    );
  end if;

  if me.role = 'OWNER'::public.user_role then
    return jsonb_build_object(
      'allowed', true,
      'login_allowed', true,
      'login_hours_enabled', false,
      'role', me.role::text,
      'timezone', company_tz
    );
  end if;

  if coalesce(me.login_allowed, true) is false then
    return jsonb_build_object(
      'allowed', false,
      'login_allowed', false,
      'login_hours_enabled', coalesce(me.login_hours_enabled, false),
      'login_hour_from', case when me.login_hour_from is null then null else to_char(me.login_hour_from, 'HH24:MI') end,
      'login_hour_to', case when me.login_hour_to is null then null else to_char(me.login_hour_to, 'HH24:MI') end,
      'reason', 'Logowanie do tego konta jest zablokowane.'
    );
  end if;

  if me.company_id is not null then
    select coalesce(nullif(c.timezone, ''), 'Europe/Warsaw')
    into company_tz
    from public.companies c
    where c.id = me.company_id;
    company_tz := coalesce(nullif(company_tz, ''), 'Europe/Warsaw');
  end if;

  if coalesce(me.login_hours_enabled, false) is true then
    from_t := coalesce(me.login_hour_from, '04:00'::time);
    to_t := coalesce(me.login_hour_to, '22:00'::time);
    now_t := (now() at time zone company_tz)::time;

    if from_t = to_t then
      inside_window := true;
    elsif from_t < to_t then
      inside_window := now_t >= from_t and now_t <= to_t;
    else
      -- Zakres przez północ, np. 22:00-06:00.
      inside_window := now_t >= from_t or now_t <= to_t;
    end if;

    if inside_window is false then
      reason_text := 'Logowanie dozwolone tylko w godzinach od '
        || to_char(from_t, 'HH24:MI') || ' do ' || to_char(to_t, 'HH24:MI') || '.';
      return jsonb_build_object(
        'allowed', false,
        'login_allowed', true,
        'login_hours_enabled', true,
        'login_hour_from', to_char(from_t, 'HH24:MI'),
        'login_hour_to', to_char(to_t, 'HH24:MI'),
        'timezone', company_tz,
        'current_time', to_char(now_t, 'HH24:MI'),
        'reason', reason_text
      );
    end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'login_allowed', true,
    'login_hours_enabled', coalesce(me.login_hours_enabled, false),
    'login_hour_from', case when me.login_hour_from is null then null else to_char(me.login_hour_from, 'HH24:MI') end,
    'login_hour_to', case when me.login_hour_to is null then null else to_char(me.login_hour_to, 'HH24:MI') end,
    'timezone', company_tz,
    'role', me.role::text
  );
end;
$$;

grant execute on function public.cm_validate_login_window() to authenticated;

notify pgrst, 'reload schema';
