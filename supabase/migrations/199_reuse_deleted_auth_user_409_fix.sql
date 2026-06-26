-- COMPANYMANAGER — 199 REUSE DELETED AUTH USER 409 FIX
-- Naprawia konflikt 409 przy ponownym dodawaniu użytkownika z emailem istniejącym jeszcze w auth.users.
-- Kolejność po patchu 124: frontend najpierw próbuje odzyskać stare konto Auth przez tę funkcję,
-- a dopiero jeśli go nie ma, wykonuje zwykłe auth.signUp().

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists anonymized_at timestamptz,
add column if not exists original_email_hash text,
add column if not exists active boolean default true;

create or replace function public.admin_reuse_deleted_auth_user(
  p_email text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  me public.profiles;
  normalized_email text;
  existing_auth_id uuid;
  active_profile_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if me.role not in ('OWNER','ADMIN') then
    raise exception 'Permission denied';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  if normalized_email = '' then
    raise exception 'Missing email';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Missing password';
  end if;

  -- Jeżeli email należy do aktywnego profilu, to nie wolno go przejąć.
  select p.id into active_profile_id
  from public.profiles p
  where lower(trim(coalesce(p.email, ''))) = normalized_email
    and p.deleted_at is null
    and p.anonymized_at is null
    and coalesce(p.active, true) = true
  limit 1;

  if active_profile_id is not null then
    raise exception 'Email is used by active profile' using errcode = '23505';
  end if;

  select u.id into existing_auth_id
  from auth.users u
  where lower(trim(coalesce(u.email, ''))) = normalized_email
  limit 1;

  if existing_auth_id is null then
    raise exception 'No reusable auth user';
  end if;

  -- Odblokowanie / ustawienie nowego hasła dla istniejącego Auth usera.
  -- To pozwala użyć tego samego emaila po usunięciu profilu z listy aktywnych użytkowników.
  update auth.users u
  set
    encrypted_password = crypt(p_password, gen_salt('bf')),
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('full_name', coalesce(nullif(p_full_name, ''), normalized_email)),
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '',
    banned_until = null,
    deleted_at = null,
    updated_at = now()
  where u.id = existing_auth_id;

  -- Zwolnij stare usunięte/anonymizowane profile trzymające ten email.
  update public.profiles p
  set
    email = 'deleted+' || replace(p.id::text, '-', '') || '@companymanager.local',
    original_email_hash = coalesce(p.original_email_hash, encode(extensions.digest(coalesce(p.email, '')::bytea, 'sha256'), 'hex')),
    updated_at = now()
  where lower(trim(coalesce(p.email, ''))) = normalized_email
    and (
      p.deleted_at is not null
      or p.anonymized_at is not null
      or coalesce(p.active, true) = false
      or coalesce(p.login_allowed, true) = false
    );

  return existing_auth_id;
end;
$$;

grant execute on function public.admin_reuse_deleted_auth_user(text, text, text) to authenticated;

-- Utrzymujemy też poprzedni bezpieczny create RPC, ale bez zmiany sygnatury.
-- Jeżeli profil o tym id już istnieje jako deleted/anonymized, zostanie reaktywowany.

notify pgrst, 'reload schema';
