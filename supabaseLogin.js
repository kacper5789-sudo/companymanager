// CompanyManager — Supabase Login

(function () {
  const LEGACY_SESSION_KEY = "companymanager_session_v1";


  function detectBrowser(userAgent) {
    const ua = String(userAgent || navigator.userAgent || '');
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return ua ? ua.slice(0, 120) : 'Nieznana';
  }

  async function recordLoginLog({ email, status, userId = null, companyId = null, errorMessage = null }) {
    if (!window.cmSupabase) return;
    try {
      await window.cmSupabase.rpc('cm_record_login_log', {
        p_login: String(email || '').trim().toLowerCase(),
        p_status: String(status || ''),
        p_user_agent: navigator.userAgent || detectBrowser(),
        p_browser: detectBrowser(),
        p_user_id: userId || null,
        p_company_id: companyId || null,
        p_error_message: errorMessage ? String(errorMessage).slice(0, 500) : null
      });
    } catch (logError) {
      console.warn('CompanyManager login log warning', logError);
    }
  }

  function setLegacyPanelSession(accessData) {
    const role = String(accessData?.role || "").toUpperCase();
    const legacyRole = role === "OWNER" ? "owner" : role === "ADMIN" ? "admin" : "employee";

    const session = {
      userId: role === "OWNER" ? "owner_kacper" : (accessData?.user_id || accessData?.email || "supabase_user"),
      companyId: role === "OWNER" ? "company_main" : (accessData?.company_id || ""),
      activeCompanyId: role === "OWNER" ? "company_main" : (accessData?.company_id || ""),
      role: legacyRole,
      loginAt: new Date().toISOString(),
      source: "supabase"
    };

    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem("cm_access", JSON.stringify(accessData));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginInput = document.getElementById("login");
    const passwordInput = document.getElementById("password");
    const loginSuccess = document.getElementById("loginSuccess");

    if (!loginForm || !loginInput || !passwordInput) return;

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = loginInput.value.trim();
      const password = passwordInput.value;

      loginSuccess.textContent = "Logowanie...";
      loginSuccess.style.display = "block";

      if (!window.cmSupabase) {
        loginSuccess.textContent = "Brak połączenia z Supabase. Sprawdź supabaseClient.js.";
        return;
      }

      const { error } = await window.cmSupabase.auth.signInWithPassword({ email, password });

      if (error) {
        await recordLoginLog({ email, status: "error", errorMessage: error.message });
        loginSuccess.textContent = "Błąd logowania: " + error.message;
        return;
      }

      const { data: accessData, error: accessError } = await window.cmSupabase.rpc("get_my_access");

      if (accessError) {
        await recordLoginLog({ email, status: "error", errorMessage: accessError.message });
        loginSuccess.textContent = "Błąd dostępu: " + accessError.message;
        return;
      }

      if (!accessData || accessData.allowed !== true) {
        await recordLoginLog({
          email,
          status: "blocked",
          userId: accessData?.user_id || null,
          companyId: accessData?.company_id || null,
          errorMessage: accessData?.reason || "brak dostępu"
        });
        loginSuccess.textContent = "Dostęp zablokowany: " + (accessData?.reason || "brak dostępu");
        return;
      }

      await recordLoginLog({
        email,
        status: "success",
        userId: accessData?.user_id || null,
        companyId: accessData?.company_id || null
      });

      setLegacyPanelSession(accessData);

      if (String(accessData.role).toUpperCase() === "OWNER") {
        window.location.href = "panel/companies.html";
      } else {
        window.location.href = "panel/dashboard.html";
      }
    }, true);
  });
})();
