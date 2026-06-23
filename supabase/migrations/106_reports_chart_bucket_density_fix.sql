-- COMPANYMANAGER 106
-- reports_chart_bucket_density_fix
-- UI/JS only patch: wykres auto dobiera dni/tygodnie/miesiące/kwartały/lata i uzupełnia puste okresy.

notify pgrst, 'reload schema';
