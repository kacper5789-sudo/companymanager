// CompanyManager — Supabase Client

const SUPABASE_URL = "https://oyireskoxiyfqiezwtya.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95aXJlc2tveGl5ZnFpZXp3dHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjc0NTYsImV4cCI6MjA5NzY0MzQ1Nn0.smHfccmTEY5d_dSB4vtOw8E6MZDJdFrfaLjqiZGgXWA";

window.cmSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);