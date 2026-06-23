-- COMPANYMANAGER 058 — language button Supabase preference

alter table public.profiles
add column if not exists language text default 'pl';

alter table public.companies
add column if not exists language text default 'pl';

alter table public.profiles
add constraint profiles_language_check
check (language in ('pl', 'en-gb')) not valid;

alter table public.companies
add constraint companies_language_check
check (language in ('pl', 'en-gb')) not valid;

create or replace function public.cm_get_language()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  c public.companies;
  profile_lang text;
  company_lang text;
begin
  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    return jsonb_build_object('language', 'pl', 'profile_language', 'pl', 'company_language', 'pl');
  end if;

  if me.company_id is not null then
    select * into c
    from public.companies
    where id = me.company_id
    limit 1;
  end if;

  profile_lang := case when me.language in ('pl', 'en-gb') then me.language else null end;
  company_lang := case when c.language in ('pl', 'en-gb') then c.language else null end;

  return jsonb_build_object(
    'language', coalesce(profile_lang, company_lang, 'pl'),
    'profile_language', coalesce(profile_lang, 'pl'),
    'company_language', coalesce(company_lang, 'pl')
  );
end;
$$;

create or replace function public.cm_set_language(p_language text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  normalized text;
begin
  normalized := lower(coalesce(nullif(p_language, ''), 'pl'));

  if normalized in ('eng', 'en', 'en_gb', 'gb') then
    normalized := 'en-gb';
  end if;

  if normalized not in ('pl', 'en-gb') then
    normalized := 'pl';
  end if;

  select * into me
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  update public.profiles
  set language = normalized
  where id = auth.uid();

  if me.company_id is not null then
    update public.companies
    set language = normalized
    where id = me.company_id
      and (
        me.role in ('OWNER', 'ADMIN')
        or public.can_access_company_data(me.company_id, 'open_company_manager')
      );
  end if;

  return jsonb_build_object(
    'language', normalized,
    'profile_language', normalized,
    'company_language', normalized
  );
end;
$$;

grant execute on function public.cm_get_language() to authenticated;
grant execute on function public.cm_set_language(text) to authenticated;

notify pgrst, 'reload schema';
