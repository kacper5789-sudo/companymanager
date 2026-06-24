-- COMPANYMANAGER — 093 MARKETING EMAIL UI FILTERS + COUNTER
-- Dopina licznik odbiorców i domyślne filtrowanie wszystkich klientów ze zgodą.

create or replace function public.cm_marketing_recipients(p_channel text, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  v_channel text := lower(coalesce(p_channel, 'email'));
  result jsonb;
  v_has_filter boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if me.company_id is null then raise exception 'Missing company_id'; end if;

  if v_channel not in ('email','sms') then raise exception 'Invalid channel'; end if;

  v_has_filter := coalesce((p_filters->>'allCustomers')::boolean, false)
    or coalesce((p_filters->>'allWomen')::boolean, false)
    or coalesce((p_filters->>'allMen')::boolean, false)
    or coalesce((p_filters->>'updatedRange')::boolean, false)
    or coalesce((p_filters->>'addedRange')::boolean, false)
    or (jsonb_typeof(p_filters->'clientIds') = 'array' and jsonb_array_length(p_filters->'clientIds') > 0);

  with base as (
    select
      c.id,
      c.company_id,
      c.email,
      c.phone,
      trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) as client_name,
      c.gender,
      c.created_at,
      c.updated_at,
      c.marketing_email,
      c.marketing_sms
    from public.clients c
    where c.company_id = me.company_id
      and coalesce(c.active, true) is true
      and (
        case when v_channel = 'email'
          then coalesce(c.marketing_email, false) is true and nullif(trim(c.email),'') is not null
          else coalesce(c.marketing_sms, false) is true and nullif(trim(c.phone),'') is not null
        end
      )
      and (
        v_has_filter is false
        or coalesce((p_filters->>'allCustomers')::boolean, false) is true
        or (coalesce((p_filters->>'allWomen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('kobieta','female','woman'))
        or (coalesce((p_filters->>'allMen')::boolean, false) is true and lower(coalesce(c.gender,'')) in ('mężczyzna','mezczyzna','male','man'))
        or (jsonb_typeof(p_filters->'clientIds') = 'array' and c.id::text in (select jsonb_array_elements_text(p_filters->'clientIds')))
        or (coalesce((p_filters->>'updatedRange')::boolean, false) is true and c.updated_at::date between coalesce(nullif(p_filters->>'updatedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'updatedTo','')::date, current_date))
        or (coalesce((p_filters->>'addedRange')::boolean, false) is true and c.created_at::date between coalesce(nullif(p_filters->>'addedFrom','')::date, current_date) and coalesce(nullif(p_filters->>'addedTo','')::date, current_date))
      )
  )
  select jsonb_build_object(
    'count', count(*),
    'recipients', coalesce(jsonb_agg(jsonb_build_object('client_id', id, 'name', nullif(client_name,''), 'email', email, 'phone', phone) order by client_name), '[]'::jsonb)
  ) into result
  from base;

  return coalesce(result, jsonb_build_object('count',0,'recipients','[]'::jsonb));
end;
$$;

grant execute on function public.cm_marketing_recipients(text, jsonb) to authenticated;
notify pgrst, 'reload schema';
