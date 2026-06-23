-- COMPANYMANAGER 052C
-- Globalny Cofnij Czas: jeden ostatni ruch w całej firmie.
-- Logowanie zmian odbywa się triggerami w Supabase.

create table if not exists public.undo_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  actor_id uuid,
  txid bigint,
  module text,
  action_type text not null check (action_type in ('insert','update','delete')),
  target_table text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid
);

alter table public.undo_actions enable row level security;

grant select, insert, update on public.undo_actions to authenticated;

create index if not exists undo_actions_company_active_idx
on public.undo_actions(company_id, undone_at, created_at desc);

create index if not exists undo_actions_txid_idx
on public.undo_actions(company_id, txid, created_at desc);

drop policy if exists "undo_actions_select_own_company" on public.undo_actions;
create policy "undo_actions_select_own_company"
on public.undo_actions
for select
to authenticated
using (
  company_id in (
    select company_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "undo_actions_insert_own_company" on public.undo_actions;
create policy "undo_actions_insert_own_company"
on public.undo_actions
for insert
to authenticated
with check (
  company_id in (
    select company_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "undo_actions_update_own_company" on public.undo_actions;
create policy "undo_actions_update_own_company"
on public.undo_actions
for update
to authenticated
using (
  company_id in (
    select company_id from public.profiles where id = auth.uid()
  )
)
with check (
  company_id in (
    select company_id from public.profiles where id = auth.uid()
  )
);

create or replace function public.cm_undo_company_id(p_table text, p_row jsonb)
returns uuid
language plpgsql
stable
as $$
declare
  v_company_id uuid;
begin
  if p_row ? 'company_id' and nullif(p_row->>'company_id', '') is not null then
    return (p_row->>'company_id')::uuid;
  end if;

  if p_table = 'companies' and p_row ? 'id' and nullif(p_row->>'id', '') is not null then
    return (p_row->>'id')::uuid;
  end if;

  if p_table = 'profiles' and p_row ? 'company_id' and nullif(p_row->>'company_id', '') is not null then
    return (p_row->>'company_id')::uuid;
  end if;

  select company_id into v_company_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  return v_company_id;
exception when others then
  return null;
end;
$$;

create or replace function public.cm_undo_capture_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_company_id uuid;
  v_target_id text;
  v_action text;
begin
  if current_setting('app.cm_undo_disabled', true) = '1' then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if TG_TABLE_NAME in ('undo_actions', 'login_logs') then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if TG_OP = 'INSERT' then
    v_action := 'insert';
    v_before := null;
    v_after := to_jsonb(new);
    v_company_id := public.cm_undo_company_id(TG_TABLE_NAME, v_after);
    v_target_id := v_after->>'id';
  elsif TG_OP = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_company_id := public.cm_undo_company_id(TG_TABLE_NAME, coalesce(v_after, v_before));
    v_target_id := coalesce(v_after->>'id', v_before->>'id');
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_after := null;
    v_company_id := public.cm_undo_company_id(TG_TABLE_NAME, v_before);
    v_target_id := v_before->>'id';
  end if;

  if v_company_id is not null and v_target_id is not null then
    insert into public.undo_actions (
      company_id,
      actor_id,
      txid,
      module,
      action_type,
      target_table,
      target_id,
      before_data,
      after_data
    ) values (
      v_company_id,
      auth.uid(),
      txid_current(),
      TG_TABLE_NAME,
      v_action,
      TG_TABLE_NAME,
      v_target_id,
      v_before,
      v_after
    );
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.cm_install_undo_trigger(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_has_id boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = p_table
  ) into v_exists;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'id'
  ) into v_has_id;

  if not v_exists or not v_has_id then
    return;
  end if;

  execute format('drop trigger if exists cm_undo_capture_%I on public.%I', p_table, p_table);
  execute format(
    'create trigger cm_undo_capture_%I after insert or update or delete on public.%I for each row execute function public.cm_undo_capture_trigger()',
    p_table,
    p_table
  );
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments',
    'clients',
    'companies',
    'days_off',
    'employee_work_schedules',
    'passes',
    'pass_templates',
    'pass_usages',
    'payments',
    'positions',
    'products',
    'profiles',
    'sales',
    'sale_items',
    'service_categories',
    'services',
    'user_permissions',
    'work_schedules'
  ] loop
    perform public.cm_install_undo_trigger(t);
  end loop;
end $$;

create or replace function public.undo_last_action()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_txid bigint;
  r record;
  v_cols text;
  v_vals text;
  v_sql text;
  v_count integer := 0;
begin
  select company_id into v_company_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_company_id is null then
    return jsonb_build_object('success', false, 'message', 'Brak firmy użytkownika');
  end if;

  select txid into v_txid
  from public.undo_actions
  where company_id = v_company_id
    and undone_at is null
  order by created_at desc, id desc
  limit 1;

  if v_txid is null then
    return jsonb_build_object('success', false, 'message', 'Nie ma czego cofnąć');
  end if;

  perform set_config('app.cm_undo_disabled', '1', true);

  for r in
    select *
    from public.undo_actions
    where company_id = v_company_id
      and undone_at is null
      and txid = v_txid
    order by created_at desc, id desc
  loop
    select
      string_agg(format('%I', column_name), ', ' order by ordinal_position),
      string_agg(format('x.%I', column_name), ', ' order by ordinal_position)
    into v_cols, v_vals
    from information_schema.columns
    where table_schema = 'public'
      and table_name = r.target_table
      and coalesce(is_generated, 'NEVER') = 'NEVER'
      and coalesce(is_identity, 'NO') = 'NO';

    if v_cols is null then
      update public.undo_actions set undone_at = now(), undone_by = auth.uid() where id = r.id;
      continue;
    end if;

    if r.action_type = 'insert' then
      execute format('delete from public.%I where id::text = $1', r.target_table)
      using r.target_id;

    elsif r.action_type = 'delete' then
      if r.before_data is not null then
        v_sql := format(
          'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as x on conflict (id) do nothing',
          r.target_table, v_cols, v_vals, r.target_table
        );
        execute v_sql using r.before_data;
      end if;

    elsif r.action_type = 'update' then
      if r.before_data is not null then
        execute format('delete from public.%I where id::text = $1', r.target_table)
        using r.target_id;

        v_sql := format(
          'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as x on conflict (id) do update set updated_at = excluded.updated_at',
          r.target_table, v_cols, v_vals, r.target_table
        );
        begin
          execute v_sql using r.before_data;
        exception when others then
          v_sql := format(
            'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as x on conflict (id) do nothing',
            r.target_table, v_cols, v_vals, r.target_table
          );
          execute v_sql using r.before_data;
        end;
      end if;
    end if;

    update public.undo_actions
    set undone_at = now(), undone_by = auth.uid()
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Cofnięto ostatni ruch',
    'txid', v_txid,
    'items', v_count
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.undo_last_action() to authenticated;
grant execute on function public.cm_install_undo_trigger(text) to authenticated;

notify pgrst, 'reload schema';
