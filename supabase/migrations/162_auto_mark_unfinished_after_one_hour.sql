-- COMPANYMANAGER — AUTO MARK UNFINISHED AFTER 1 HOUR
-- Planned appointments remain planned until one hour after their scheduled end.
-- After that grace period they become unfinished and remain editable.

create or replace function public.auto_mark_unfinished_appointments(
  p_company_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  effective_company_id uuid;
  updated_count integer := 0;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if coalesce(me.login_allowed, false) is false then raise exception 'Login not allowed'; end if;

  if me.role = 'OWNER' then
    effective_company_id := p_company_id;
  else
    effective_company_id := me.company_id;
  end if;
  if effective_company_id is null then raise exception 'Missing company context'; end if;

  update public.appointments
  set status = 'niezakończone'::public.appointment_status,
      updated_at = now()
  where company_id = effective_company_id
    and lower(status::text) in ('zaplanowane', 'planned', 'scheduled')
    and coalesce(deleted, false) = false
    and coalesce(
      ends_at,
      case
        when date is not null and end_time is not null
          then ((date::text || ' ' || end_time::text)::timestamp at time zone 'Europe/Warsaw')
        when date is not null and time is not null
          then ((date::text || ' ' || time::text)::timestamp at time zone 'Europe/Warsaw')
        else null
      end
    ) < (now() - interval '1 hour');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.auto_mark_unfinished_appointments(uuid) to authenticated;
notify pgrst, 'reload schema';
