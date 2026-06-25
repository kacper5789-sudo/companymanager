// CompanyManager — Supabase Panel Bridge
// 109: Supabase-first runtime guard. Local/demo renderers are fallback only.

(function () {
  const LEGACY_SESSION_KEY = "companymanager_session_v1";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function setMode(mode, reason) {
    const normalized = mode === "local_fallback" ? "local_fallback" : "supabase";
    window.CM_DATA_MODE = normalized;
    window.cmDataMode = normalized;
    window.CM_DATA_MODE_REASON = reason || "";
    try {
      document.documentElement.dataset.cmDataMode = normalized;
      document.body && (document.body.dataset.cmDataMode = normalized);
    } catch (_) {}
  }

  const access = readJson("cm_access");
  const hasSupabaseClient = Boolean(window.cmSupabase);

  if (hasSupabaseClient && access && access.allowed === true) {
    setMode("supabase", "access_snapshot_ok");
  } else if (hasSupabaseClient) {
    // Supabase exists, but there is no confirmed access snapshot yet. Login/public pages can still use it.
    setMode("supabase", "supabase_client_loaded");
  } else {
    setMode("local_fallback", "supabase_client_missing");
  }

  window.cmIsSupabaseMode = function () {
    return String(window.CM_DATA_MODE || "").toLowerCase() === "supabase";
  };

  window.cmIsLocalFallbackMode = function () {
    return String(window.CM_DATA_MODE || "").toLowerCase() === "local_fallback";
  };

  window.cmMarkSupabaseUnavailable = function (reason) {
    setMode("local_fallback", reason || "supabase_unavailable");
  };

  window.cmMarkSupabaseAvailable = function (reason) {
    setMode("supabase", reason || "supabase_available");
  };

  if (!access || access.allowed !== true) return;

  const role = String(access.role || "").toUpperCase();
  const legacyRole = role === "OWNER" ? "owner" : role === "ADMIN" ? "admin" : "employee";
  const existing = readJson(LEGACY_SESSION_KEY);
  if (existing && existing.source === "supabase") {
    window.CM_APP_CONTEXT = {
      access,
      mode: window.CM_DATA_MODE,
      company_id: access.company_id || existing.activeCompanyId || existing.companyId || "",
      role,
      loadedAt: Date.now()
    };
    return;
  }

  const session = {
    userId: role === "OWNER" ? "owner_kacper" : (access.user_id || access.email || "supabase_user"),
    companyId: role === "OWNER" ? "company_main" : (access.company_id || ""),
    activeCompanyId: role === "OWNER" ? "company_main" : (access.company_id || ""),
    role: legacyRole,
    loginAt: new Date().toISOString(),
    source: "supabase"
  };

  writeJson(LEGACY_SESSION_KEY, session);
  window.CM_APP_CONTEXT = {
    access,
    mode: window.CM_DATA_MODE,
    company_id: access.company_id || session.activeCompanyId || session.companyId || "",
    role,
    loadedAt: Date.now()
  };
})();
