// CompanyManager — Supabase Login

(function () {
  const LEGACY_SESSION_KEY = "companymanager_session_v1";

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
    if (typeof window.cmEnsureLegacySupabaseContext === "function") {
      window.cmEnsureLegacySupabaseContext(accessData);
    }
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
        loginSuccess.textContent = "Błąd logowania: " + error.message;
        return;
      }

      const { data: accessData, error: accessError } = await window.cmSupabase.rpc("get_my_access");

      if (accessError) {
        loginSuccess.textContent = "Błąd dostępu: " + accessError.message;
        return;
      }

      if (!accessData || accessData.allowed !== true) {
        loginSuccess.textContent = "Dostęp zablokowany: " + (accessData?.reason || "brak dostępu");
        return;
      }

      setLegacyPanelSession(accessData);

      if (String(accessData.role).toUpperCase() === "OWNER") {
        window.location.href = "panel/companies.html";
      } else {
        window.location.href = "panel/dashboard.html";
      }
    }, true);
  });
})();
