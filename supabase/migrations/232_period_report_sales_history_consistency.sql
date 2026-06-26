-- CompanyManager 163
-- Raport z okresu: ujednolicenie wartości z modułem Sprzedaż / Historia sprzedaży.
-- Zmiana frontendowa: raport z okresu liczy przychód z tych samych typów pozycji co Historia sprzedaży:
-- usługi + produkty + karnety, z pominięciem technicznych statusów i mapowaniem paid -> gotówka.
select '232_period_report_sales_history_consistency: frontend-only reporting logic update' as info;
