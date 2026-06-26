-- 220_cleanup_dead_service_product_fields.sql
-- CompanyManager v150 cleanup: usuwa martwe pola sprzedaż/online/konflikt czasu z produktów i usług.
-- UWAGA: kolumny są usuwane tylko jeśli istnieją. Dane historyczne sprzedaży pozostają bez zmian.

alter table if exists public.products
  drop column if exists sale_only;

drop index if exists public.products_sale_only_idx;

alter table if exists public.services
  drop column if exists show_online,
  drop column if exists prevent_overlap,
  drop column if exists deposit;

notify pgrst, 'reload schema';
