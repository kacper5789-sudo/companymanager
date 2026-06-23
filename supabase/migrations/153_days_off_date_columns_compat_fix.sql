-- 153_days_off_date_columns_compat_fix.sql
-- CompanyManager: Dni wolne pracowników — kompatybilność start_date/end_date z date_from/date_to.

-- Twardy bezpiecznik: tabela ma stare kolumny date_from/date_to NOT NULL,
-- a frontend wcześniej wysyłał start_date/end_date. Trigger synchronizuje oba modele.

create or replace function public.normalize_days_off_date_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.date_from := coalesce(new.date_from, new.start_date);
  new.date_to := coalesce(new.date_to, new.end_date, new.date_from, new.start_date);
  new.start_date := coalesce(new.start_date, new.date_from);
  new.end_date := coalesce(new.end_date, new.date_to, new.start_date, new.date_from);
  new.reason := coalesce(nullif(new.reason, ''), nullif(new.description, ''));
  new.description := coalesce(nullif(new.description, ''), nullif(new.reason, ''));
  new.status := coalesce(nullif(new.status, ''), 'active');

  if new.date_from is null then
    raise exception 'Missing date_from/start_date';
  end if;

  if new.date_to is null then
    new.date_to := new.date_from;
  end if;

  if new.end_date is null then
    new.end_date := new.date_to;
  end if;

  if new.date_to < new.date_from then
    raise exception 'Data końcowa nie może być wcześniejsza niż data początkowa';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_days_off_date_columns on public.days_off;
create trigger trg_normalize_days_off_date_columns
before insert or update on public.days_off
for each row
execute function public.normalize_days_off_date_columns();

-- Jedna wersja RPC zgodna z realną tabelą i frontendem.
drop function if exists public.add_day_off(uuid, uuid, text, date, date, text);

create or replace function public.add_day_off(
  p_company_id uuid,
  p_employee_id uuid,
  p_type text,
  p_start_date date,
  p_end_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  employee_label text;
begin
  if p_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if p_start_date is null then
    raise exception 'Missing start_date';
  end if;

  if public.can_access_company_data(p_company_id, 'days_off_add') is false
     and public.can_access_company_data(p_company_id, 'open_days_off') is false then
    raise exception 'Permission denied';
  end if;

  select coalesce(nullif(full_name, ''), nullif(email, ''), 'Pracownik')
  into employee_label
  from public.profiles
  where id = p_employee_id
    and company_id = p_company_id;

  insert into public.days_off (
    company_id,
    employee_id,
    employee_name,
    type,
    start_date,
    end_date,
    date_from,
    date_to,
    description,
    reason,
    status,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_company_id,
    p_employee_id,
    coalesce(employee_label, 'Pracownik'),
    coalesce(nullif(p_type, ''), 'dzień wolny'),
    p_start_date,
    coalesce(p_end_date, p_start_date),
    p_start_date,
    coalesce(p_end_date, p_start_date),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    'active',
    auth.uid(),
    now(),
    now()
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.add_day_off(uuid, uuid, text, date, date, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'days_off') then
    grant select, insert, update, delete on public.days_off to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
