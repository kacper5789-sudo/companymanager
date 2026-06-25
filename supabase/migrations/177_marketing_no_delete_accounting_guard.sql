-- 177_marketing_no_delete_accounting_guard.sql
-- CompanyManager: Marketing campaigns must stay in history for SMS/Email statistics and billing.
-- Companies cannot remove campaigns after creation; corrections should be handled by status/logs, not deletion.

create or replace function public.prevent_marketing_campaign_delete_for_accounting()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Marketing campaigns cannot be deleted because they are used for statistics and billing.';
  end if;

  if tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is distinct from new.deleted_at then
      raise exception 'Marketing campaigns cannot be marked as deleted because they are used for statistics and billing.';
    end if;

    if lower(coalesce(new.status, '')) = 'deleted' and lower(coalesce(old.status, '')) is distinct from 'deleted' then
      raise exception 'Marketing campaigns cannot be marked as deleted because they are used for statistics and billing.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_marketing_campaign_delete_for_accounting on public.marketing_campaigns;
create trigger trg_prevent_marketing_campaign_delete_for_accounting
before update or delete on public.marketing_campaigns
for each row
execute function public.prevent_marketing_campaign_delete_for_accounting();

notify pgrst, 'reload schema';
