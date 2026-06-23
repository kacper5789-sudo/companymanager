-- 155_finish_appointment_sale_items_fk_safe_fix.sql
-- CompanyManager: naprawa błędu FK sale_items_service_id_fkey przy kończeniu wizyty.
-- Przyczyna: appointments.service_id może wskazywać rekord, którego nie ma już w services
-- albo pochodzić ze starszego zapisu/localStorage. Przy tworzeniu sale_items FK wtedy blokuje insert.
-- Fix: funkcja kończenia wizyty sprawdza, czy service_id/product_id istnieje w bazie danej firmy.
-- Jeśli nie istnieje, tworzy pozycję sprzedaży jako snapshot bez service_id/product_id.

create or replace function public.finish_appointment_with_sale(
  p_appointment_id uuid,
  p_company_id uuid default null,
  p_paid_amount numeric default null,
  p_payment_method text default 'gotówka',
  p_note text default null,
  p_pass_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  a public.appointments;
  v_pass public.passes;
  final_company_id uuid;
  final_total numeric(12,2) := 0;
  final_paid numeric(12,2) := 0;
  v_sale_id uuid;
  service_unit_price numeric(12,2) := 0;
  product_unit_price numeric(12,2) := 0;
  product_qty numeric(12,2) := 1;
  product_total numeric(12,2) := 0;
  service_item_name text;
  product_item_name text;
  service_charge numeric(12,2) := 0;
  v_pass_used_value numeric(12,2) := 0;
  v_pass_used_units numeric(12,2) := 0;
  effective_pass_id uuid;
  v_safe_service_id uuid := null;
  v_safe_product_id uuid := null;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;

  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;

  final_company_id := a.company_id;
  if p_company_id is not null and p_company_id <> final_company_id then raise exception 'Wrong company context'; end if;
  if me.role <> 'OWNER' and me.company_id <> final_company_id then raise exception 'Cannot finish appointment from another company'; end if;
  if not public.can_access_company_data(final_company_id, 'appointments_finish') then raise exception 'Missing appointments_finish permission'; end if;

  effective_pass_id := coalesce(p_pass_id, a.pass_id);

  if a.service_id is not null then
    select s.id,
           public.cm_first_money(s.price_from, s.price, s.price_to, 0),
           coalesce(nullif(s.name,''), nullif(a.service_name,''), 'Usługa')
    into v_safe_service_id, service_unit_price, service_item_name
    from public.services s
    where s.id = a.service_id
      and s.company_id = final_company_id
    limit 1;
  end if;

  if service_item_name is null then
    service_item_name := coalesce(nullif(a.service_name,''), 'Usługa');
  end if;
  if service_unit_price is null or service_unit_price = 0 then
    service_unit_price := public.cm_first_money(a.price, a.total, 0);
  end if;

  if a.product_id is not null then
    select p.id,
           public.cm_first_money(a.product_price, p.price, p.sale_price, p.gross_price, p.net_price, p.retail_price, p.selling_price, p.sale_gross_price, p.unit_price, p.last_purchase_price, 0),
           coalesce(nullif(a.product_name,''), nullif(p.name,''), 'Produkt')
    into v_safe_product_id, product_unit_price, product_item_name
    from public.products p
    where p.id = a.product_id
      and p.company_id = final_company_id
    limit 1;
  end if;

  if product_item_name is null then
    product_item_name := coalesce(nullif(a.product_name,''), 'Produkt');
  end if;
  if product_unit_price is null then
    product_unit_price := coalesce(a.product_price, 0);
  end if;

  product_qty := greatest(coalesce(a.product_quantity, 1), 1);
  product_total := coalesce(product_unit_price, 0) * product_qty;
  service_charge := coalesce(service_unit_price, 0);

  if effective_pass_id is not null then
    select * into v_pass from public.passes
    where id = effective_pass_id and company_id = final_company_id and active = true
    for update;

    if not found then raise exception 'Karnet nie istnieje albo jest nieaktywny'; end if;
    if coalesce(v_pass.beneficiary_client_id, v_pass.customer_id) <> coalesce(a.client_id, a.customer_id) then
      raise exception 'Karnet jest przypisany do innego klienta';
    end if;
    if v_pass.valid_until is not null and v_pass.valid_until < current_date then
      raise exception 'Karnet jest po terminie';
    end if;
    if v_pass.service_id is not null and v_safe_service_id is not null and v_pass.service_id <> v_safe_service_id then
      raise exception 'Karnet dotyczy innej usługi';
    end if;

    if v_pass.pass_type in ('service','units') then
      if coalesce(v_pass.remaining_units,0) <= 0 then raise exception 'Brak wejść na karnecie'; end if;
      v_pass_used_units := 1;
      v_pass_used_value := least(service_charge, coalesce(v_pass.remaining, service_charge));
      service_charge := 0;
    else
      if coalesce(v_pass.remaining,0) <= 0 then raise exception 'Brak środków na karnecie'; end if;
      v_pass_used_value := least(service_charge, coalesce(v_pass.remaining,0));
      service_charge := greatest(service_charge - v_pass_used_value, 0);
    end if;
  end if;

  final_total := service_charge + product_total;
  if final_total = 0 and effective_pass_id is null then
    final_total := public.cm_first_money(a.total, a.price, 0);
  end if;
  final_paid := coalesce(p_paid_amount, final_total, 0);

  select id into v_sale_id from public.sales
  where appointment_id = p_appointment_id and company_id = final_company_id
  order by created_at desc limit 1;

  if v_sale_id is null then
    insert into public.sales(company_id, appointment_id, client_id, employee_id, sale_number, total_net, total_tax, total_gross, discount_value, payment_status, note, created_at, updated_at)
    values (final_company_id, p_appointment_id, coalesce(a.client_id, a.customer_id), a.employee_id, 'WIZ-' || to_char(now(), 'YYYYMMDDHH24MISS'), final_total, 0, final_total, 0, case when final_paid >= final_total then 'paid' else 'partial' end, nullif(p_note,''), now(), now())
    returning id into v_sale_id;
  else
    update public.sales set client_id = coalesce(a.client_id, a.customer_id), employee_id = a.employee_id, total_net = final_total, total_tax = 0, total_gross = final_total, payment_status = case when final_paid >= final_total then 'paid' else 'partial' end, note = nullif(p_note,''), updated_at = now()
    where id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.payments where sale_id = v_sale_id;
  end if;

  if v_safe_service_id is not null or coalesce(a.service_name, service_item_name, '') <> '' then
    insert into public.sale_items(company_id, sale_id, item_type, service_id, pass_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'service', v_safe_service_id, effective_pass_id, coalesce(service_item_name, a.service_name, 'Usługa'), coalesce(service_item_name, a.service_name, 'Usługa'), 1, service_unit_price, v_pass_used_value, service_charge, service_charge, now());
  end if;

  if v_safe_product_id is not null or a.product_id is not null or coalesce(a.product_name, '') <> '' then
    insert into public.sale_items(company_id, sale_id, item_type, product_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at)
    values (final_company_id, v_sale_id, 'product', v_safe_product_id, coalesce(product_item_name, a.product_name, 'Produkt'), coalesce(product_item_name, a.product_name, 'Produkt'), product_qty, product_unit_price, 0, product_total, product_total, now());
  end if;

  if final_paid > 0 then
    insert into public.payments(company_id, sale_id, amount, method, paid_at, created_at)
    values (final_company_id, v_sale_id, final_paid, coalesce(nullif(p_payment_method,''), 'gotówka'), now(), now());
  end if;

  if effective_pass_id is not null then
    update public.passes
    set remaining = greatest(coalesce(remaining,0) - v_pass_used_value, 0),
        remaining_units = greatest(coalesce(remaining_units,0) - v_pass_used_units, 0),
        used_value = coalesce(used_value,0) + v_pass_used_value,
        used_units = coalesce(used_units,0) + v_pass_used_units,
        last_used_at = now(),
        status = case
          when v_pass.pass_type in ('service','units') and greatest(coalesce(remaining_units,0) - v_pass_used_units, 0) <= 0 then 'zrealizowane'
          when v_pass.pass_type not in ('service','units') and greatest(coalesce(remaining,0) - v_pass_used_value, 0) <= 0 then 'zrealizowane'
          else status
        end,
        updated_at = now()
    where id = effective_pass_id;
  end if;

  update public.appointments
  set status = 'zakończone'::public.appointment_status,
      finished = true,
      finished_at = now(),
      paid_amount = final_paid,
      payment_method = coalesce(nullif(p_payment_method,''), case when effective_pass_id is not null then 'karnet' else 'gotówka' end),
      payment_status = case when final_paid >= final_total then 'paid' else 'partial' end,
      pass_id = effective_pass_id,
      pass_name = case when effective_pass_id is not null then v_pass.name else pass_name end,
      pass_used_value = v_pass_used_value,
      pass_used_units = v_pass_used_units,
      product_price = case when v_safe_product_id is not null then coalesce(a.product_price, product_unit_price, 0) else a.product_price end,
      product_name = case when v_safe_product_id is not null then coalesce(a.product_name, product_item_name, 'Produkt') else a.product_name end,
      product_quantity = case when v_safe_product_id is not null then product_qty else a.product_quantity end,
      total = final_total,
      price = final_total,
      updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object('appointment_id', p_appointment_id, 'sale_id', v_sale_id, 'pass_id', effective_pass_id, 'total', final_total, 'paid_amount', final_paid, 'pass_used_value', v_pass_used_value, 'pass_used_units', v_pass_used_units, 'status', 'zakończone');
end;
$$;

grant execute on function public.finish_appointment_with_sale(uuid, uuid, numeric, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
