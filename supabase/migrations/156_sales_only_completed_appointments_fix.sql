-- COMPANYMANAGER — 156 SALES ONLY COMPLETED APPOINTMENTS FIX
-- Zasada biznesowa:
-- 1) Wizyta zakończona -> tworzy/aktualizuje sprzedaż i płatność.
-- 2) Wizyta odwołana/usunięta -> NIE liczy się jako sprzedaż/kasa.
-- 3) Jeśli do odwołanej wizyty istniała już sprzedaż, zostaje oznaczona jako void.

alter table public.sales
add column if not exists payment_status text default 'paid',
add column if not exists note text,
add column if not exists updated_at timestamptz default now();

alter table public.payments
add column if not exists status text default 'paid';

create or replace function public.cm_is_cancelled_appointment_status(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_status, '')) in (
    'odwołane', 'odwolane', 'odwołana', 'odwolana',
    'anulowane', 'anulowana', 'cancelled', 'canceled',
    'usunięte', 'usuniete', 'usunięta', 'usunieta', 'deleted'
  );
$$;

create or replace function public.cm_void_sales_for_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments p
  set status = 'void'
  where p.sale_id in (
    select s.id
    from public.sales s
    where s.appointment_id = p_appointment_id
  )
  or p.appointment_id = p_appointment_id;

  update public.sales s
  set
    payment_status = 'void',
    note = trim(coalesce(s.note, '') || case when coalesce(s.note, '') = '' then '' else E'\n' end || 'Sprzedaż anulowana automatycznie: wizyta odwołana/usunięta.'),
    updated_at = now()
  where s.appointment_id = p_appointment_id;
end;
$$;

create or replace function public.cm_void_sales_when_appointment_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.cm_is_cancelled_appointment_status(new.status::text) then
    perform public.cm_void_sales_for_appointment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cm_void_sales_when_appointment_cancelled on public.appointments;

create trigger trg_cm_void_sales_when_appointment_cancelled
after insert or update of status, deleted, cancelled_at on public.appointments
for each row
when (
  public.cm_is_cancelled_appointment_status(new.status::text)
  or new.deleted is true
)
execute function public.cm_void_sales_when_appointment_cancelled();

-- Sprzątnięcie danych historycznych: odwołane/usunięte wizyty nie mogą wisieć jako aktywna sprzedaż.
update public.payments p
set status = 'void'
where p.sale_id in (
  select s.id
  from public.sales s
  join public.appointments a on a.id = s.appointment_id
  where public.cm_is_cancelled_appointment_status(a.status::text)
     or a.deleted is true
);

update public.sales s
set
  payment_status = 'void',
  note = trim(coalesce(s.note, '') || case when coalesce(s.note, '') = '' then '' else E'\n' end || 'Sprzedaż anulowana automatycznie: wizyta odwołana/usunięta.'),
  updated_at = now()
from public.appointments a
where a.id = s.appointment_id
  and (
    public.cm_is_cancelled_appointment_status(a.status::text)
    or a.deleted is true
  );

notify pgrst, 'reload schema';
