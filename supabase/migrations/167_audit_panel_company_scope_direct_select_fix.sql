-- COMPANYMANAGER — 082 AUDIT PANEL COMPANY SCOPE DIRECT SELECT FIX
-- Panel Historii aktywności czyta logi per firma. ADMIN widzi tylko swoją firmę, OWNER kontekst firmy. EMPLOYEE bez dostępu.

alter table public.company_audit_logs enable row level security;

drop policy if exists company_audit_logs_select on public.company_audit_logs;
create policy company_audit_logs_select
on public.company_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.login_allowed, true) is true
      and (
        upper(coalesce(p.role::text,'')) = 'OWNER'
        or (
          upper(coalesce(p.role::text,'')) = 'ADMIN'
          and p.company_id = company_audit_logs.company_id
        )
      )
  )
);

grant select on public.company_audit_logs to authenticated;

create index if not exists idx_company_audit_logs_company_created_id
on public.company_audit_logs(company_id, created_at desc, id desc);

notify pgrst, 'reload schema';
