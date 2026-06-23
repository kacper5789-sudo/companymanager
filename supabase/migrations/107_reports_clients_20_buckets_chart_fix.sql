-- COMPANYMANAGER 107
-- Wykres/Statystyka: stałe 20 słupków dla wybranego grupowania.
-- Główny wykres: Zapisało się klientów / Liczba klientów.

create or replace function public.cm_reports_stats(
  p_company_id uuid,
  p_from date default null,
  p_to date default null,
  p_group text default 'days'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, date_trunc('month', now())::date);
  v_to date := coalesce(p_to, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_group text := lower(coalesce(nullif(p_group, ''), 'days'));
  v_start date;
  v_end date;
  v_step interval;
  v_result jsonb;
begin
  if p_company_id is null then
    raise exception 'Missing company_id';
  end if;

  if public.can_access_company_data(p_company_id, 'reports_access') is false
     and public.can_access_company_data(p_company_id, 'open_stats') is false then
    raise exception 'Permission denied';
  end if;

  if v_to < v_from then
    raise exception 'Invalid date range';
  end if;

  if v_group not in ('days', 'weeks', 'months', 'quarters', 'years') then
    v_group := 'days';
  end if;

  v_start := case
    when v_group = 'weeks' then date_trunc('week', v_from)::date
    when v_group = 'months' then date_trunc('month', v_from)::date
    when v_group = 'quarters' then date_trunc('quarter', v_from)::date
    when v_group = 'years' then date_trunc('year', v_from)::date
    else v_from
  end;

  v_end := case
    when v_group = 'weeks' then date_trunc('week', v_to)::date
    when v_group = 'months' then date_trunc('month', v_to)::date
    when v_group = 'quarters' then date_trunc('quarter', v_to)::date
    when v_group = 'years' then date_trunc('year', v_to)::date
    else v_to
  end;

  v_step := case
    when v_group = 'weeks' then interval '1 week'
    when v_group = 'months' then interval '1 month'
    when v_group = 'quarters' then interval '3 months'
    when v_group = 'years' then interval '1 year'
    else interval '1 day'
  end;

  with periods as (
    select gs::date as period_start
    from generate_series(v_start::timestamp, v_end::timestamp, v_step) gs
  ), sales_base as (
    select
      s.id,
      s.created_at,
      s.total_gross,
      s.total_net,
      s.payment_status,
      case
        when v_group = 'weeks' then date_trunc('week', s.created_at)::date
        when v_group = 'months' then date_trunc('month', s.created_at)::date
        when v_group = 'quarters' then date_trunc('quarter', s.created_at)::date
        when v_group = 'years' then date_trunc('year', s.created_at)::date
        else s.created_at::date
      end as period_start
    from public.sales s
    where s.company_id = p_company_id
      and s.created_at::date between v_from and v_to
      and coalesce(lower(s.payment_status::text), '') not in ('void', 'unpaid', 'pending', 'nieopłacone', 'nieoplacone')
  ), item_stats as (
    select
      sb.period_start,
      count(distinct sb.id) as sales_count,
      coalesce(sum(coalesce(si.total, si.total_price, si.unit_price * coalesce(si.quantity, 1), sb.total_gross, sb.total_net, 0)), 0)::numeric(12,2) as revenue,
      count(*) filter (where lower(coalesce(si.item_type::text, '')) = 'service') as service_items,
      coalesce(sum(coalesce(si.total, si.total_price, si.unit_price * coalesce(si.quantity, 1), 0)) filter (where lower(coalesce(si.item_type::text, '')) = 'service'), 0)::numeric(12,2) as service_revenue,
      count(*) filter (where lower(coalesce(si.item_type::text, '')) = 'product') as product_items,
      coalesce(sum(coalesce(si.total, si.total_price, si.unit_price * coalesce(si.quantity, 1), 0)) filter (where lower(coalesce(si.item_type::text, '')) = 'product'), 0)::numeric(12,2) as product_revenue,
      count(*) filter (where lower(coalesce(si.item_type::text, '')) in ('pass', 'passes', 'karnet') or si.pass_id is not null) as pass_items,
      coalesce(sum(coalesce(si.total, si.total_price, si.unit_price * coalesce(si.quantity, 1), 0)) filter (where lower(coalesce(si.item_type::text, '')) in ('pass', 'passes', 'karnet') or si.pass_id is not null), 0)::numeric(12,2) as pass_revenue
    from sales_base sb
    left join public.sale_items si on si.sale_id = sb.id
    group by sb.period_start
  ), appointment_base as (
    select
      a.status,
      case
        when v_group = 'weeks' then date_trunc('week', coalesce(a.appointment_datetime, a.starts_at, a.created_at))::date
        when v_group = 'months' then date_trunc('month', coalesce(a.appointment_datetime, a.starts_at, a.created_at))::date
        when v_group = 'quarters' then date_trunc('quarter', coalesce(a.appointment_datetime, a.starts_at, a.created_at))::date
        when v_group = 'years' then date_trunc('year', coalesce(a.appointment_datetime, a.starts_at, a.created_at))::date
        else coalesce(a.appointment_datetime, a.starts_at, a.created_at)::date
      end as period_start
    from public.appointments a
    where a.company_id = p_company_id
      and coalesce(a.appointment_datetime, a.starts_at, a.created_at)::date between v_from and v_to
      and coalesce(lower(a.status::text), '') <> 'usunięte'
  ), appointment_stats as (
    select
      period_start,
      count(*) filter (where lower(coalesce(status::text, '')) = 'zakończone') as finished_visits,
      count(*) filter (where lower(coalesce(status::text, '')) = 'zaplanowane') as planned_visits,
      count(*) filter (where lower(coalesce(status::text, '')) = 'niezakończone') as unfinished_visits,
      count(*) filter (where lower(coalesce(status::text, '')) = 'odwołane') as cancelled_visits,
      count(*) as all_visits
    from appointment_base
    group by period_start
  ), client_base as (
    select
      case
        when v_group = 'weeks' then date_trunc('week', c.created_at)::date
        when v_group = 'months' then date_trunc('month', c.created_at)::date
        when v_group = 'quarters' then date_trunc('quarter', c.created_at)::date
        when v_group = 'years' then date_trunc('year', c.created_at)::date
        else c.created_at::date
      end as period_start
    from public.clients c
    where c.company_id = p_company_id
      and c.created_at::date between v_from and v_to
  ), client_stats as (
    select period_start, count(*) as new_clients
    from client_base
    group by period_start
  ), client_total_stats as (
    select
      p.period_start,
      count(c.id)::int as total_clients
    from periods p
    left join public.clients c
      on c.company_id = p_company_id
     and c.created_at::date <= ((p.period_start::timestamp + v_step - interval '1 day')::date)
    group by p.period_start
  ), joined as (
    select
      p.period_start,
      coalesce(i.revenue, 0)::numeric(12,2) as revenue,
      coalesce(i.sales_count, 0)::int as sales_count,
      coalesce(i.service_items, 0)::int as service_items,
      coalesce(i.service_revenue, 0)::numeric(12,2) as service_revenue,
      coalesce(i.product_items, 0)::int as product_items,
      coalesce(i.product_revenue, 0)::numeric(12,2) as product_revenue,
      coalesce(i.pass_items, 0)::int as pass_items,
      coalesce(i.pass_revenue, 0)::numeric(12,2) as pass_revenue,
      coalesce(a.finished_visits, 0)::int as finished_visits,
      coalesce(a.planned_visits, 0)::int as planned_visits,
      coalesce(a.unfinished_visits, 0)::int as unfinished_visits,
      coalesce(a.cancelled_visits, 0)::int as cancelled_visits,
      coalesce(a.all_visits, 0)::int as all_visits,
      coalesce(c.new_clients, 0)::int as new_clients,
      coalesce(ct.total_clients, 0)::int as total_clients
    from periods p
    left join item_stats i on i.period_start = p.period_start
    left join appointment_stats a on a.period_start = p.period_start
    left join client_stats c on c.period_start = p.period_start
    left join client_total_stats ct on ct.period_start = p.period_start
    order by p.period_start
  )
  select jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'group', v_group,
    'summary', jsonb_build_object(
      'revenue', coalesce(sum(revenue), 0),
      'sales_count', coalesce(sum(sales_count), 0),
      'service_items', coalesce(sum(service_items), 0),
      'service_revenue', coalesce(sum(service_revenue), 0),
      'product_items', coalesce(sum(product_items), 0),
      'product_revenue', coalesce(sum(product_revenue), 0),
      'pass_items', coalesce(sum(pass_items), 0),
      'pass_revenue', coalesce(sum(pass_revenue), 0),
      'finished_visits', coalesce(sum(finished_visits), 0),
      'planned_visits', coalesce(sum(planned_visits), 0),
      'unfinished_visits', coalesce(sum(unfinished_visits), 0),
      'cancelled_visits', coalesce(sum(cancelled_visits), 0),
      'all_visits', coalesce(sum(all_visits), 0),
      'new_clients', coalesce(sum(new_clients), 0),
      'total_clients', coalesce(max(total_clients), 0)
    ),
    'series', coalesce(jsonb_agg(to_jsonb(joined) order by period_start), '[]'::jsonb)
  )
  into v_result
  from joined;

  return v_result;
end;
$$;

grant execute on function public.cm_reports_stats(uuid, date, date, text) to authenticated;

notify pgrst, 'reload schema';
