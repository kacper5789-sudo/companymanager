-- CompanyManager 219 — option fields verification + marketing filter support note
-- Ten plik dopina/utrwala kolumny używane przez formularze Usługi/Produkty oraz filtry Marketingu.

alter table if exists public.products
  add column if not exists sale_only boolean default false,
  add column if not exists include_commission boolean default false,
  add column if not exists include_discount boolean default false;

alter table if exists public.services
  add column if not exists show_online boolean default false,
  add column if not exists prevent_overlap boolean default false,
  add column if not exists include_commission boolean default false,
  add column if not exists include_discount boolean default false;

comment on column public.products.sale_only is 'Produkt dostępny do sprzedaży w formularzach sprzedaży/wizyt.';
comment on column public.products.include_commission is 'Produkt wliczany do prowizji pracownika, gdy moduł prowizji jest używany.';
comment on column public.products.include_discount is 'Produkt uwzględniany przy naliczaniu rabatów.';
comment on column public.services.show_online is 'Usługa widoczna przy rezerwacji online.';
comment on column public.services.prevent_overlap is 'Usługa nie powinna być rezerwowana równolegle w tym samym czasie.';
comment on column public.services.include_commission is 'Usługa wliczana do prowizji pracownika.';
comment on column public.services.include_discount is 'Usługa uwzględniana przy naliczaniu rabatów.';

notify pgrst, 'reload schema';
