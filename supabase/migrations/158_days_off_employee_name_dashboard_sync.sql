-- 158_days_off_employee_name_dashboard_sync.sql
-- Days off: show real employee names and make Dashboard respect days off automatically.

create or replace function public.add_day_off(
  p_company_id uuid,
  p_employee_id uuid,
  p_type text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_employee_name text;
  v_start_date date := coalesce(p_start_date, p_end_date, current_date);
  v_end_date date := coalesce(p_end_date, p_start_date, current_date);
  v_type text := coalesce(nullif(p_type, ''), 'dzień wolny');
  v_note text;
  new_id uuid;
begin
  select
    e.id,
    coalesce(nullif(e.full_name, ''), 'Pracownik')
  into
    v_employee_id,
    v_employee_name
  from public.employees e
  where e.company_id = p_company_id
    and (e.id = p_employee_id or e.profile_id = p_employee_id)
  limit 1;

  if v_employee_id is null then
    raise exception 'Employee not found';
  end if;

  v_note := nullif(trim(coalesce(p_description, '')), '');
  if v_note is null then
    v_note := v_employee_name || ' — ' || v_type;
  end if;

  insert into public.days_off (
    company_id,
    employee_id,
    employee_name,
    type,
    date_from,
    date_to,
    start_date,
    end_date,
    reason,
    description,
    created_by
  )
  values (
    p_company_id,
    v_employee_id,
    v_employee_name,
    v_type,
    v_start_date,
    v_end_date,
    v_start_date,
    v_end_date,
    v_note,
    v_note,
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.add_day_off(uuid, uuid, text, date, date, text) to authenticated;

update public.days_off d
set employee_name = coalesce(nullif(e.full_name, ''), d.employee_name, 'Pracownik')
from public.employees e
where d.employee_id = e.id
  and (d.employee_name is null or d.employee_name = '' or d.employee_name = 'Pracownik');

notify pgrst, 'reload schema';
