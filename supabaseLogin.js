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

  function getSelectedPublicLanguage() {
    try {
      const raw = localStorage.getItem("cmLanguage") || localStorage.getItem("cm_public_language") || "pl";
      const lang = window.cmNormalizePublicLanguage ? window.cmNormalizePublicLanguage(raw) : (String(raw).toLowerCase().startsWith("en") ? "en-gb" : "pl");
      return lang === "en-gb" ? "en-gb" : "pl";
    } catch (_) { return "pl"; }
  }


  function parseTimeMinutes(value, fallback) {
    const raw = String(value || fallback || "").trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const h = Math.max(0, Math.min(23, Number(match[1])));
    const m = Math.max(0, Math.min(59, Number(match[2])));
    return h * 60 + m;
  }

  function currentMinutesInTimezone(timezone) {
    const tz = String(timezone || "Europe/Warsaw");
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(new Date());
      const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
      const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
      return hour * 60 + minute;
    } catch (_) {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
  }

  function isNowInsideLoginWindow(fromValue, toValue, timezone) {
    const from = parseTimeMinutes(fromValue, "04:00");
    const to = parseTimeMinutes(toValue, "22:00");
    if (from === null || to === null) return true;
    const now = currentMinutesInTimezone(timezone || "Europe/Warsaw");
    if (from === to) return true;
    if (from < to) return now >= from && now <= to;
    // Zakres przez północ, np. 22:00-06:00.
    return now >= from || now <= to;
  }

  function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
  }

  function asBool(value, fallback = false) {
    if (value === true || value === false) return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "t", "1", "yes", "tak"].includes(normalized)) return true;
      if (["false", "f", "0", "no", "nie"].includes(normalized)) return false;
    }
    if (typeof value === "number") return value !== 0;
    return fallback;
  }

  function normalizeGuardPayload(payload) {
    const data = payload || {};
    return {
      login_allowed: asBool(firstDefined(data.login_allowed, data.loginAllowed, true), true),
      login_hours_enabled: asBool(firstDefined(data.login_hours_enabled, data.loginHoursEnabled, false), false),
      login_hour_from: firstDefined(data.login_hour_from, data.loginHourFrom, data.login_from, data.from, null),
      login_hour_to: firstDefined(data.login_hour_to, data.loginHourTo, data.login_to, data.to, null),
      timezone: firstDefined(data.timezone, data.company_timezone, data.settings?.timezone, "Europe/Warsaw"),
      server_allowed: firstDefined(data.allowed, data.server_allowed, null),
      reason: firstDefined(data.reason, data.message, null)
    };
  }

  async function getLoginGuard(accessData, signedUser) {
    let guard = normalizeGuardPayload(accessData);

    // 117: twarda walidacja po stronie Supabase. Front nie zgaduje godzin — RPC liczy je po stronie bazy
    // z timezone firmy i zwraca gotowy wynik. To naprawia sytuację, gdy get_my_access nie zwraca pól godzinowych.
    if (window.cmSupabase) {
      try {
        const { data, error } = await window.cmSupabase.rpc("cm_validate_login_window");
        if (!error && data) {
          const serverGuard = normalizeGuardPayload(data);
          guard = { ...guard, ...serverGuard };
          if (serverGuard.server_allowed === false || serverGuard.login_allowed === false) {
            guard.login_allowed = false;
            guard.reason = serverGuard.reason || "Logowanie do tego konta jest zablokowane.";
          }
          if (serverGuard.server_allowed === false && serverGuard.login_hours_enabled) {
            guard.reason = serverGuard.reason || loginGuardErrorMessage(serverGuard);
          }
          return guard;
        }
      } catch (rpcError) {
        console.warn("CompanyManager login guard RPC warning", rpcError);
      }
    }

    // Fallback: dociągamy profil zalogowanego użytkownika po auth.uid / user.id, nie tylko po accessData.user_id.
    const authUserId = firstDefined(accessData?.user_id, accessData?.profile_id, accessData?.id, signedUser?.id, null);
    if (window.cmSupabase && authUserId) {
      try {
        const { data, error } = await window.cmSupabase
          .from("profiles")
          .select("login_allowed,login_hours_enabled,login_hour_from,login_hour_to,company_id,companies(timezone)")
          .eq("id", authUserId)
          .maybeSingle();
        if (!error && data) {
          const profileGuard = normalizeGuardPayload({
            ...data,
            timezone: data?.companies?.timezone || guard.timezone
          });
          guard = { ...guard, ...profileGuard };
        }
      } catch (profileError) {
        console.warn("CompanyManager login guard profile warning", profileError);
      }
    }

    return guard;
  }

  function loginGuardErrorMessage(guard) {
    if (guard?.reason && (guard.server_allowed === false || guard.login_allowed === false)) return String(guard.reason);
    if (guard.login_allowed === false) return "Logowanie do tego konta jest zablokowane.";
    if (guard.login_hours_enabled && !isNowInsideLoginWindow(guard.login_hour_from || "04:00", guard.login_hour_to || "22:00", guard.timezone)) {
      const from = String(guard.login_hour_from || "04:00").slice(0, 5);
      const to = String(guard.login_hour_to || "22:00").slice(0, 5);
      return `Logowanie dozwolone tylko w godzinach od ${from} do ${to}.`;
    }
    return "";
  }

  function setLegacyPanelSession(accessData) {
    const selectedLanguage = getSelectedPublicLanguage();
    accessData = { ...(accessData || {}), language: selectedLanguage, profile_language: selectedLanguage, company_language: selectedLanguage };
    try {
      const settings = JSON.parse(localStorage.getItem("cm_company_settings") || "{}");
      settings.language = selectedLanguage;
      localStorage.setItem("cm_company_settings", JSON.stringify(settings));
      localStorage.setItem("cmLanguage", selectedLanguage);
      localStorage.setItem("cm_language_source", "login");
    } catch (_) {}
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

      const { data: signInData, error } = await window.cmSupabase.auth.signInWithPassword({ email, password });

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

      const loginGuard = await getLoginGuard(accessData, signInData?.user || null);
      const loginGuardMessage = loginGuardErrorMessage(loginGuard);
      if (loginGuardMessage) {
        await window.cmSupabase.auth.signOut().catch(() => {});
        await recordLoginLog({
          email,
          status: loginGuard.login_allowed === false ? "blocked" : "outside_hours",
          userId: accessData?.user_id || null,
          companyId: accessData?.company_id || null,
          errorMessage: loginGuardMessage
        });
        loginSuccess.textContent = loginGuardMessage;
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
