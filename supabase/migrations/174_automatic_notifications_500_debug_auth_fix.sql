-- COMPANYMANAGER — 097 FIX AUTOMATIC NOTIFICATIONS 500 DEBUG/AUTH
-- Kompatybilność tabel dla Edge Function send-automatic-notifications.

alter table public.companies
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists visit_email_24 boolean default false,
  add column if not exists visit_email_sender text,
  add column if not exists visit_email_subject text,
  add column if not exists visit_email_template text,
  add column if not exists birthday_email boolean default false,
  add column if not exists birthday_email_sender text,
  add column if not exists birthday_email_subject text,
  add column if not exists birthday_email_template text,
  add column if not exists after_add_email boolean default false,
  add column if not exists after_add_email_sender text,
  add column if not exists after_add_email_subject text,
  add column if not exists after_add_email_template text,
  add column if not exists after_visit_email boolean default false,
  add column if not exists after_visit_email_sender text,
  add column if not exists after_visit_email_subject text,
  add column if not exists after_visit_email_template text;

alter table public.appointments
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists notification_created_email_sent_at timestamptz,
  add column if not exists notification_after_visit_email_sent_at timestamptz,
  add column if not exists notification_reminder_email_sent_at timestamptz;

alter table public.clients
  add column if not exists date_of_birth date,
  add column if not exists birth_date date,
  add column if not exists birthday date,
  add column if not exists marketing_email boolean default false,
  add column if not exists active boolean default true,
  add column if not exists deleted_at timestamptz;

notify pgrst, 'reload schema';
