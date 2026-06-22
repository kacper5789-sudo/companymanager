// CompanyManager — Supabase Panel Bridge
// Tymczasowy most, żeby obecny app.js nie wyrzucał użytkownika Supabase do loginu.

(function () {
  const LEGACY_SESSION_KEY = "companymanager_session_v1";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  const access = readJson("cm_access");
  if (!access || access.allowed !== true) return;

  const role = String(access.role || "").toUpperCase();
  const legacyRole = role === "OWNER" ? "owner" : role === "ADMIN" ? "admin" : "employee";

  const existing = readJson(LEGACY_SESSION_KEY);
  if (existing && existing.source === "supabase") return;

  const session = {
    userId: role === "OWNER" ? "owner_kacper" : (access.user_id || access.email || "supabase_user"),
    companyId: role === "OWNER" ? "company_main" : (access.company_id || ""),
    activeCompanyId: role === "OWNER" ? "company_main" : (access.company_id || ""),
    role: legacyRole,
    loginAt: new Date().toISOString(),
    source: "supabase"
  };

  localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(session));
})();
