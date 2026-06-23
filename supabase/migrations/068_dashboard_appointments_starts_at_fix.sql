-- COMPANYMANAGER — 068 DASHBOARD APPOINTMENTS STARTS_AT FIX

alter table public.appointments
add column if not exists starts_at timestamptz,
add column if not exists ends_at timestamptz,
add column if not exists appointment_datetime timestamptz;

-- Uzupełnij stare rekordy, jeśli mają date/start_time/end_time, ale brakuje starts_at/ends_at.
update public.appointments
set
  starts_at = coalesce(
    starts_at,
    appointment_datetime,
    case
      when date is not null and coalesce(start_time::text, time::text) is not null
      then (date::text || ' ' || coalesce(start_time::text, time::text))::timestamptz
      else null
    end
  ),
  ends_at = coalesce(
    ends_at,
    case
      when date is not null and end_time::text is not null
      then (date::text || ' ' || end_time::text)::timestamptz
      else null
    end
  ),
  appointment_datetime = coalesce(
    appointment_datetime,
    starts_at,
    case
      when date is not null and coalesce(start_time::text, time::text) is not null
      then (date::text || ' ' || coalesce(start_time::text, time::text))::timestamptz
      else null
    end
  )
where starts_at is null or ends_at is null or appointment_datetime is null;

create index if not exists appointments_starts_at_idx on public.appointments(starts_at);
create index if not exists appointments_ends_at_idx on public.appointments(ends_at);

notify pgrst, 'reload schema';
