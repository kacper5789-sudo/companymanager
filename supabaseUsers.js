// CompanyManager — Users Module powered by Supabase
// 051B: Użytkownicy Supabase — dodawanie/edycja + pełne uprawnienia.

(function () {
  function isUsersPage() {
    return document.body?.dataset?.panelPage === "users" || window.location.pathname.includes("users.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  const CM_MODULE_PAGE_LIMIT_KEY = "companyManagerGlobalPageLimit";

  function getModulePageLimit(fallback = "50") {
    try {
      const saved = localStorage.getItem(CM_MODULE_PAGE_LIMIT_KEY);
      if (["50", "100", "200"].includes(String(saved))) return String(saved);
    } catch (_) {}
    const normalized = String(fallback || "50");
    return ["50", "100", "200"].includes(normalized) ? normalized : "50";
  }

  function setModulePageLimit(value) {
    const normalized = String(value || "50");
    if (!["50", "100", "200"].includes(normalized)) return;
    try { localStorage.setItem(CM_MODULE_PAGE_LIMIT_KEY, normalized); } catch (_) {}
    document.querySelectorAll("[data-limit-dropdown]").forEach((root) => {
      const input = root.querySelector('input[type="hidden"]');
      const toggle = root.querySelector("[data-limit-toggle]");
      if (input) input.value = normalized;
      if (toggle) toggle.textContent = `${normalized} ▾`;
    });
  }

  function moduleLimitDropdownHtml(id, selected = "50") {
    const value = getModulePageLimit(selected);
    return `
      <div class="cm-limit-dropdown" data-limit-dropdown>
        <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(value)}">
        <button type="button" class="cm-limit-toggle" data-limit-toggle>${escapeHtml(value)} ▾</button>
        <div class="cm-limit-menu" hidden>
          <button type="button" data-limit-value="50">50 pozycji na stronę</button>
          <button type="button" data-limit-value="100">100 pozycji na stronę</button>
          <button type="button" data-limit-value="200">200 pozycji na stronę</button>
        </div>
      </div>`;
  }

  function setupModuleLimitDropdowns(root = document) {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll("[data-limit-dropdown]").forEach((dropdown) => {
      if (dropdown.dataset.cmLimitReady === "1") return;
      dropdown.dataset.cmLimitReady = "1";
      const toggle = dropdown.querySelector("[data-limit-toggle]");
      const menu = dropdown.querySelector(".cm-limit-menu");
      toggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll(".cm-limit-menu").forEach((item) => {
          if (item !== menu) item.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
      });
      dropdown.querySelectorAll("[data-limit-value]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setModulePageLimit(button.getAttribute("data-limit-value") || "50");
          if (menu) menu.hidden = true;
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
  });

  const tabPermissions = [
    ["open_company_manager", "CompanyManager"],
    ["open_company_panel", "Panel firmy"],
    ["open_positions", "Stanowiska pracy"],
    ["open_team", "Zespół"],
    ["open_days_off", "Dni wolne pracowników"],
    ["open_clients", "Klienci"],
    ["open_services", "Usługi"],
    ["open_products", "Produkty"],
    ["open_appointments", "Wizyty"],
    ["open_sales_without_visit", "Sprzedaż bez wizyty"],
    ["open_marketing", "Marketing"],
    ["open_passes", "Karnety"],
    ["open_owner_page", "Właściciel strony"],
    ["open_sales", "Sprzedaż"],
    ["open_stats", "Wykres/Statystyka"],
    ["open_customer_reports", "Klienci(customersraports)"],
    ["open_daily_report", "Raport dzienny"],
    ["open_period_report", "Raport z okresu"],
    ["open_employees", "Pracownicy"],
    ["open_work_schedule", "Grafik pracy"],
    ["open_sms", "SMS"],
    ["open_email", "Email"]
  ];

  const actionPermissions = [
    ["positions_add", "stanowiska pracy — dodawanie"],
    ["positions_edit", "stanowiska pracy — edycja"],
    ["positions_delete", "stanowiska pracy — usuwanie"],
    ["users_add", "użytkownicy — dodawanie"],
    ["users_edit", "użytkownicy — edycja"],
    ["users_delete", "użytkownicy — usuwanie/blokada"],
    ["days_off_add", "dni wolne — dodawanie"],
    ["days_off_edit", "dni wolne — edycja"],
    ["days_off_delete", "dni wolne — usuwanie"],
    ["clients_add", "klienci — dodawanie"],
    ["clients_edit", "klienci — edycja"],
    ["clients_delete", "klienci — usuwanie"],
    ["clients_history", "klienci — historia"],
    ["services_add", "usługi — dodawanie"],
    ["services_edit", "usługi — edycja"],
    ["services_delete", "usługi — usuwanie"],
    ["products_add", "produkty — dodawanie"],
    ["products_edit", "produkty — edycja"],
    ["products_delete", "produkty — usuwanie"],
    ["warehouse_manage", "produkty — magazyn"],
    ["appointments_add", "wizyty — dodawanie"],
    ["appointments_edit", "wizyty — edycja"],
    ["appointments_finish", "wizyty — zakończenie"],
    ["appointments_delete", "wizyty — usuwanie"],
    ["appointments_unfinished_history", "wizyty niezakończone — historia"],
    ["appointments_history", "wizyty — historia"],
    ["sales_without_visit_add", "sprzedaż bez wizyty — dodawanie"],
    ["sales_without_visit_delete", "sprzedaż bez wizyty — usuwanie"],
    ["marketing_sms", "marketing — SMS"],
    ["marketing_email", "marketing — Email"],
    ["passes_add", "karnety — dodawanie"],
    ["passes_edit", "karnety — edycja"],
    ["passes_delete", "karnety — usuwanie"],
    ["daily_report_today", "raport dzienny — dziś"],
    ["daily_report_other_days", "raport dzienny — inne dni"],
    ["work_schedule_view_all", "grafik wszystkich pracowników"],
    ["work_schedule_edit", "grafik pracy — edycja"],
    ["work_schedule_delete", "grafik pracy — usuwanie"],
    ["export_data", "export danych"],
    ["import_data", "import danych"]
  ];

  const allPermissionKeys = [...tabPermissions, ...actionPermissions].map(([key]) => key);

  const basicEmployeePermissionKeys = [
    // Zakładki widoczne po kliknięciu „Podstawowe pracownika”
    "open_company_manager",
    "open_positions",
    "open_team",
    "open_days_off",
    "open_clients",
    "open_services",
    "open_products",
    "open_appointments",
    "open_sales_without_visit",
    "open_marketing",
    "open_passes",
    "open_owner_page",
    "open_daily_report",
    "open_work_schedule",
    "open_sms",
    "open_email",

    // Funkcje systemowe podstawowego pracownika
    "days_off_add",
    "clients_add",
    "clients_history",
    "services_add",
    "products_add",
    "warehouse_manage",
    "appointments_add",
    "appointments_edit",
    "appointments_finish",
    "appointments_history",
    "sales_without_visit_add",
    "marketing_sms",
    "marketing_email",
    "passes_add",
    "daily_report_today"
  ];

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, key) => ({ ...acc, [String(key)]: true }), {});
    if (typeof raw === "object") return raw;
    try { return normalizePermissions(JSON.parse(raw)); } catch (_) { return {}; }
  }

  function permissionPayload(form) {
    const permissions = Object.fromEntries(allPermissionKeys.map((key) => [key, false]));
    form.querySelectorAll('input[name="permissions"]:checked').forEach((input) => {
      if (input.value) permissions[input.value] = true;
    });
    return permissions;
  }

  function permissionChecksHtml(selected = {}) {
    const perms = normalizePermissions(selected);
    const group = (items) => items.map(([key, label]) => `
      <label class="cm-permission-check">
        <input type="checkbox" name="permissions" value="${escapeHtml(key)}" ${perms[key] === true ? "checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>`).join("");

    return `
      <div class="cm-permission-section-title">Możliwość Otwierania zakładek:</div>
      <div class="cm-permissions-grid cm-tab-permissions-grid">${group(tabPermissions)}</div>
      <div class="cm-permission-section-title">Funkcje w systemie:</div>
      <div class="cm-permissions-grid">${group(actionPermissions)}</div>`;
  }

  function hasAnyPermission(ctx, keys) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return keys.some((key) => permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1");
  }

  function canManageUsers(ctx) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    return hasAnyPermission(ctx, ["users_add", "users_edit", "users_delete", "open_team"]);
  }

  async function getContext() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano połączenia z Supabase." };

    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);

    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    if (!context.company_id) return { ok: false, message: "Brak wybranej firmy. OWNER musi najpierw wejść w firmę z zakładki Firmy." };

    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!canManageUsers(ctx)) return { ok: false, message: "Brak uprawnień do modułu Użytkownicy." };

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  function showOnlyPanel(panel, panels) {
    if (window.cmOpenModalPanel) return window.cmOpenModalPanel(panel, panels || []);
    panels.forEach((item) => { if (item) item.hidden = item !== panel; });
  }

  function setMessage(selector, text, ok) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.textContent = text;
    node.style.color = ok ? "#86efac" : "#fca5a5";
  }

  function closeUsersModals() {
    if (window.cmHardCloseAllModalPanels) {
      window.cmHardCloseAllModalPanels();
      return;
    }
    if (window.cmCloseAllModalPanels) {
      window.cmCloseAllModalPanels();
      return;
    }
    document.querySelectorAll(".cm-modal-active, .cm-as-modal").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("cm-modal-active", "cm-as-modal");
    });
    document.body?.classList?.remove("cm-modal-open");
  }

  function rerenderUsersAfterSuccess(delay = 450) {
    closeUsersModals();
    setTimeout(() => {
      closeUsersModals();
      renderUsers();
    }, delay);
  }

  function roleToDb(value) {
    const role = normalizeRole(value);
    return role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  }

  function roleToForm(value) {
    return normalizeRole(value) === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  }

  function loginAllowedText(user) {
    if (user.login_allowed === false) return "zablokowane";
    if (user.login_hours_enabled) return `tylko w godz. od ${String(user.login_hour_from || "04:00").slice(0,5)} do ${String(user.login_hour_to || "22:00").slice(0,5)}`;
    return "tak";
  }

  function personName(user) {
    return user?.full_name || user?.email || "Użytkownik";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    try {
      return new Intl.DateTimeFormat("pl-PL", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(value));
    } catch (_) {
      return String(value);
    }
  }

  function normalizeLoginStatus(status) {
    const s = String(status || "").toLowerCase();
    if (s === "success" || s === "ok") return "sukces";
    if (s === "blocked") return "zablokowane";
    if (s === "error" || s === "failed") return "błąd";
    return status || "-";
  }

  function browserName(log) {
    if (log?.browser) return log.browser;
    const ua = String(log?.user_agent || "");
    if (/Edg\//.test(ua)) return "Microsoft Edge";
    if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    return ua ? ua.slice(0, 120) : "-";
  }

  function positionOptionsHtml(positions, selectedId = "") {
    if (!positions.length) return `<option value="">Brak aktywnych stanowisk pracy</option>`;
    return `<option value="">Wybierz stanowisko pracy</option>${positions.map((position) => `
      <option value="${escapeHtml(position.id)}" ${String(position.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(position.name || "Stanowisko pracy")}</option>`).join("")}`;
  }

  async function fetchData(ctx) {
    const [usersRes, positionsRes, logsRes] = await Promise.all([
      window.cmSupabase.rpc("admin_list_company_users", { p_company_id: ctx.companyId }),
      window.cmSupabase.from("positions").select("id,name,description,active,company_id").eq("active", true).order("name", { ascending: true }),
      window.cmSupabase.rpc("cm_list_company_login_logs", { p_company_id: ctx.companyId, p_limit: 200 })
    ]);
    if (usersRes.error) throw usersRes.error;
    if (positionsRes.error) throw positionsRes.error;
    if (logsRes.error) console.warn("CompanyManager login logs warning", logsRes.error);
    return { users: usersRes.data || [], positions: positionsRes.data || [], loginLogs: logsRes.data || [] };
  }

  function userFormHtml(mode, user, positions) {
    const isEdit = mode === "edit";
    const selectedPermissions = normalizePermissions(user?.permissions);
    const role = roleToForm(user?.role);
    const emailReadonly = isEdit ? "readonly" : "required";
    const passwordRequired = isEdit ? "" : "required";
    return `
      <label>Adres email<input name="email" type="email" placeholder="Adres email" value="${escapeHtml(user?.email || "")}" ${emailReadonly}></label>
      <label>Imię i nazwisko<input name="fullName" placeholder="Imię i nazwisko" value="${escapeHtml(user?.full_name || "")}" required></label>
      <label>Nr telefonu<input name="phone" type="tel" placeholder="Nr telefonu" value="${escapeHtml(user?.phone || "")}" required></label>
      <p class="bm-muted cm-phone-hint">Np. +48321321321</p>
      <label>Hasło<input name="password" type="password" placeholder="Hasło" ${passwordRequired}></label>
      <label>Potwierdzenie hasła<input name="passwordConfirm" type="password" placeholder="Potwierdzenie hasła" ${passwordRequired}></label>
      <label>Stanowisko pracy<select name="positionId">${positionOptionsHtml(positions, user?.position_id || "")}</select></label>
      <label>Rola<select name="role"><option value="EMPLOYEE" ${role === "EMPLOYEE" ? "selected" : ""}>Pracownik / Recepcja</option><option value="ADMIN" ${role === "ADMIN" ? "selected" : ""}>Manager / Admin</option></select></label>

      <fieldset class="cm-login-rules">
        <legend>Funkcje logowania</legend>
        <label class="cm-check-line"><input type="checkbox" name="blockedLogin" ${user?.login_allowed === false ? "checked" : ""}> zablokuj logowanie</label>
        <label class="cm-check-line"><input type="checkbox" name="hoursOnly" ${user?.login_hours_enabled ? "checked" : ""}> Logowanie tylko w godzinach</label>
        <div class="cm-hours-row">
          <label>od<input name="loginFrom" type="time" value="${escapeHtml(String(user?.login_hour_from || "04:00").slice(0,5))}"></label>
          <label>do<input name="loginTo" type="time" value="${escapeHtml(String(user?.login_hour_to || "22:00").slice(0,5))}"></label>
        </div>
      </fieldset>

      <fieldset class="cm-permissions-box">
        <legend>Uprawnienia</legend>
        <div class="cm-permissions-tools">
          <button type="button" data-permissions-action="all">Zaznacz wszystkie</button>
          <button type="button" data-permissions-action="none">Odznacz wszystkie</button>
          <button type="button" data-permissions-action="basic">Podstawowe pracownika</button>
        </div>
        ${permissionChecksHtml(selectedPermissions)}
      </fieldset>`;
  }

  function renderContent(ctx, data) {
    const area = getPanelArea();
    if (!area) return;
    const users = data.users || [];
    const positions = data.positions || [];
    const loginLogs = data.loginLogs || [];
    const positionById = Object.fromEntries(positions.map((p) => [p.id, p]));
    const rows = users.map((u) => {
      const position = positionById[u.position_id] || { name: u.position_name };
      return [
        escapeHtml(u.email || "-"),
        escapeHtml(u.full_name || "-"),
        escapeHtml(String(u.phone || "").replace(/\D/g, "") || "-"),
        escapeHtml(position.name || u.position_name || "-"),
        escapeHtml(position.description || "-"),
        escapeHtml(normalizeRole(u.role) || "-"),
        escapeHtml(loginAllowedText(u))
      ];
    });
    const userOptions = users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(personName(u))}</option>`).join("");
    const visibleLoginLogs = loginLogs.slice(0, Number(getModulePageLimit("50")));
    const logRows = visibleLoginLogs.map((log) => `
      <tr>
        <td>${escapeHtml(formatDateTime(log.created_at))}</td>
        <td>${escapeHtml(log.ip_address || "-")}</td>
        <td>${escapeHtml(log.login || log.email || "-")}</td>
        <td>${escapeHtml(normalizeLoginStatus(log.status))}</td>
        <td>${escapeHtml(browserName(log))}</td>
      </tr>`).join("");

    area.innerHTML = `<section class="bm-page-card cm-users-admin-page">
      <div class="bm-page-head cm-users-head"><h2>Użytkownicy</h2><div class="bm-actions-row"><button id="showAddAdminUserBtn" type="button">Dodaj użytkownika</button><button id="showEditAdminUserBtn" type="button">Edytuj</button><button id="showDeleteAdminUserBtn" type="button" class="bm-danger-btn">Usuń pracownika (przenieś do archiwum)</button></div></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("usersLimit", "50")}</div>
      <div class="bm-table-wrap cm-users-table-wrap"><table class="bm-table cm-users-table"><thead><tr><th>Login</th><th>Imię i nazwisko</th><th>Numer telefonu</th><th>Stanowisko</th><th>Opis stanowiska</th><th>Rola</th><th>Logowanie dozwolone</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="bm-muted cm-table-count">Pozycje od 1 do ${users.length} z ${users.length} łącznie</p>
    </section>

    <section class="bm-page-card cm-login-journal-card">
      <div class="bm-page-head"><h2>Dziennik logowania</h2></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("loginJournalLimit", "50")}</div>
      <div class="bm-table-wrap"><table class="bm-table"><thead><tr><th>Data</th><th>IP</th><th>Login</th><th>Status</th><th>Przeglądarka internetowa</th></tr></thead><tbody>${logRows || `<tr><td colspan="5" class="bm-muted">Brak wpisów w dzienniku logowania.</td></tr>`}</tbody></table></div>
      <p class="bm-muted cm-table-count">Pozycje od ${loginLogs.length ? 1 : 0} do ${Math.min(visibleLoginLogs.length, loginLogs.length)} z ${loginLogs.length} łącznie</p>
    </section>

    <section id="addAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Dodaj użytkownika</h2>
      <form id="addAdminUserForm" class="bm-form-grid cm-admin-user-form">
        ${userFormHtml("add", null, positions)}
        <div class="cm-admin-user-actions">
          <button id="submitAddAdminUserBtn" type="submit">Dodaj użytkownika</button>
          <button type="button" class="cm-secondary-action" data-modal-cancel="true">Anuluj</button>
        </div>
      </form>
      <p id="addAdminUserMessage" class="panel-message"></p>
    </section>

    <section id="editAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Edytuj użytkownika</h2>
      ${users.length ? `<form id="editAdminUserForm" class="bm-form-grid cm-admin-user-form">
        <label class="cm-full-field">Wybierz użytkownika<select name="userId" id="editAdminUserSelect" required>${userOptions}</select></label>
        <div id="editAdminUserFields" class="cm-admin-user-fields cm-form-subgrid"></div>
        <div class="cm-admin-user-actions">
          <button type="submit">Zatwierdź</button>
          <button type="button" class="cm-secondary-action" data-modal-cancel="true">Anuluj</button>
        </div>
      </form><p id="editAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak użytkowników do edycji.</p>`}
    </section>

    <section id="deleteAdminUserPanel" class="bm-page-card bm-collapsible-panel" hidden>
      <h2>Usuń pracownika (przenieś do archiwum)</h2>
      ${users.length ? `<form id="deleteAdminUserForm" class="bm-form-grid"><label class="full">Wybierz pracownika<select name="employeeId" required>${userOptions}</select></label><p class="bm-muted full"><strong>Pracownik zostanie przeniesiony do archiwum.</strong><br>Nie będzie mógł się zalogować, zniknie z listy aktywnych użytkowników i nie będzie można przypisywać mu nowych wizyt. Historia wizyt, sprzedaży, raportów i audytu zostanie zachowana.</p><div class="cm-admin-user-actions"><button type="submit" class="bm-danger-btn">Przenieś do archiwum</button><button type="button" class="cm-secondary-action" data-modal-cancel="true">Anuluj</button></div></form><p id="deleteAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak pracowników do przeniesienia do archiwum.</p>`}
    </section>`;

    setupModuleLimitDropdowns(area);
    bindEvents(ctx, users, positions);
    if (window.cmUpdateGlobalModalState) window.cmUpdateGlobalModalState();
  }

  function validatePhone(phone) {
    return /^\+?\d{7,15}$/.test(String(phone || "").replace(/\s/g, ""));
  }

  async function restoreAdminSession(currentSession) {
    if (currentSession?.access_token && currentSession?.refresh_token) {
      try {
        await window.cmSupabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        });
      } catch (restoreError) {
        console.warn("CompanyManager: nie udało się automatycznie przywrócić sesji po operacji Auth", restoreError);
      }
    }
  }

  async function createAuthUser(email, password, fullName) {
    const { data: currentSessionData } = await window.cmSupabase.auth.getSession();
    const currentSession = currentSessionData?.session || null;

    // 124: Supabase Auth zwraca 409, jeśli email istnieje nawet po usunięciu profilu.
    // Najpierw próbujemy bezpiecznie odzyskać/reaktywować stare konto Auth przez RPC.
    

    const { data, error } = await window.cmSupabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    // Supabase signUp wykonany z panelu ADMIN może chwilowo przełączyć sesję
    // na nowo tworzonego użytkownika. Zanim odpalimy RPC admin_create_company_user,
    // zawsze przywracamy sesję aktualnego ADMINA/OWNERA.
    await restoreAdminSession(currentSession);

    if (error) {
      if (Number(error.status) === 409 || String(error.message || "").toLowerCase().includes("already")) {
        throw new Error("Ten email nadal istnieje w Supabase Auth. Odpal SQL 200 i spróbuj ponownie.");
      }
      throw error;
    }
    if (!data?.user?.id) throw new Error("Nie udało się utworzyć użytkownika Auth.");
    return data.user.id;
  }

  function formBasePayload(form) {
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const role = roleToDb(formData.get("role"));
    const blockedLogin = Boolean(form.querySelector('[name="blockedLogin"]')?.checked);
    const hoursOnly = Boolean(form.querySelector('[name="hoursOnly"]')?.checked);
    const permissions = permissionPayload(form);
    return {
      formData,
      fullName,
      phone,
      role,
      blockedLogin,
      hoursOnly,
      permissions,
      rpcBase: {
        p_full_name: fullName,
        p_phone: phone,
        p_position_id: String(formData.get("positionId") || "") || null,
        p_role: role,
        p_login_allowed: !blockedLogin,
        p_login_hours_enabled: hoursOnly,
        p_login_hour_from: hoursOnly ? String(formData.get("loginFrom") || "04:00") : null,
        p_login_hour_to: hoursOnly ? String(formData.get("loginTo") || "22:00") : null,
        p_permissions: role === "ADMIN" ? null : permissions
      }
    };
  }

  async function rpcCreateCompanyUserCompat(ctx, payload) {
    const cleanPayload = cleanUsersRpcPayload({ ...payload, p_company_id: ctx?.companyId || null });

    // 036M: dodawanie użytkownika ma iść WYŁĄCZNIE przez JSON-safe RPC.
    // Nie wracamy do admin_create_company_user, bo stara funkcja ma inne sygnatury
    // i powodowała 400/404 oraz wielokrotne próby po stronie frontendu.
    return window.cmSupabase.rpc("admin_create_company_user_safe", {
      p_payload: cleanPayload
    });
  }

  function cleanUsersRpcPayload(payload) {
    const out = { ...(payload || {}) };
    Object.keys(out).forEach((key) => {
      if (out[key] === "") out[key] = null;
    });
    if (!out.p_login_hours_enabled) {
      out.p_login_hour_from = null;
      out.p_login_hour_to = null;
    }
    if (out.p_role) out.p_role = String(out.p_role).toUpperCase();
    return out;
  }

  async function rpcUpdateCompanyUserSafe(ctx, payload) {
    const cleanPayload = cleanUsersRpcPayload({ ...payload, p_company_id: ctx?.companyId || null });

    // 036M: edycja również tylko przez JSON-safe RPC. Bez fallbacku na starą funkcję.
    return window.cmSupabase.rpc("admin_update_company_user_safe", {
      p_payload: cleanPayload
    });
  }

  function bindEvents(ctx, users, positions) {
    const addPanel = document.querySelector("#addAdminUserPanel");
    const editPanel = document.querySelector("#editAdminUserPanel");
    const deletePanel = document.querySelector("#deleteAdminUserPanel");
    const panels = [addPanel, editPanel, deletePanel].filter(Boolean);
    let activeUsersFormMode = null;
    document.querySelector("#showAddAdminUserBtn")?.addEventListener("click", () => {
      activeUsersFormMode = "add";
      showOnlyPanel(addPanel, panels);
    });
    document.querySelector("#showEditAdminUserBtn")?.addEventListener("click", () => {
      activeUsersFormMode = "edit";
      showOnlyPanel(editPanel, panels);
    });
    document.querySelector("#showDeleteAdminUserBtn")?.addEventListener("click", () => {
      activeUsersFormMode = "delete";
      showOnlyPanel(deletePanel, panels);
    });

    const editFields = document.querySelector("#editAdminUserFields");
    const editSelect = document.querySelector("#editAdminUserSelect");
    const renderEditFields = () => {
      if (!editFields || !editSelect) return;
      const selected = users.find((u) => String(u.id) === String(editSelect.value)) || users[0];
      editFields.innerHTML = selected ? userFormHtml("edit", selected, positions) : "";
    };
    editSelect?.addEventListener("change", renderEditFields);
    renderEditFields();

    document.querySelectorAll(".cm-permissions-tools [data-permissions-action]").forEach((button) => {
      if (button.dataset.cmPermissionsToolReady === "1") return;
      button.dataset.cmPermissionsToolReady = "1";
      button.addEventListener("click", () => {
        const box = button.closest(".cm-permissions-box");
        if (!box) return;
        const action = button.getAttribute("data-permissions-action");
        box.querySelectorAll('input[name="permissions"]').forEach((input) => {
          if (action === "all") input.checked = true;
          else if (action === "none") input.checked = false;
          else if (action === "basic") input.checked = basicEmployeePermissionKeys.includes(input.value);
        });
      });
    });

    const addForm = document.querySelector("#addAdminUserForm");
    const addButton = document.querySelector("#submitAddAdminUserBtn");
    let addUserSubmitting = false;

    // 036G: modal overlay safety. The final button is a real submit button,
    // but we also bind a direct handler to prevent any global modal/click bridge
    // from swallowing the action.
    if (addButton && !addButton.dataset.cmUsersSubmitReady) {
      addButton.dataset.cmUsersSubmitReady = "1";
      addButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        activeUsersFormMode = "add";
        if (addUserSubmitting) return;
        try {
          if (addForm && typeof addForm.reportValidity === "function" && !addForm.reportValidity()) return;
          await handleAddUserSubmit(addForm);
        } catch (error) {
          setMessage("#addAdminUserMessage", "Błąd dodawania użytkownika: " + (error.message || error), false);
          console.error("CompanyManager users add button error", error);
        }
      }, true);
    }

    async function handleAddUserSubmit(form) {
      if (!form || addUserSubmitting) return;
      const msg = "#addAdminUserMessage";
      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const passwordConfirm = String(formData.get("passwordConfirm") || "");
      const base = formBasePayload(form);

      if (!email) return setMessage(msg, "Podaj adres email.", false);
      if (!base.fullName) return setMessage(msg, "Podaj imię i nazwisko.", false);
      if (!validatePhone(base.phone)) return setMessage(msg, "Podaj numer telefonu w formacie np. +48321321321.", false);
      if (!password || password !== passwordConfirm) return setMessage(msg, "Hasła nie są takie same.", false);
      if (password.length < 6) return setMessage(msg, "Hasło musi mieć minimum 6 znaków.", false);
      if (users.some((u) => String(u.email || "").toLowerCase() === email)) return setMessage(msg, "Konto z takim e-mailem już istnieje.", false);

      addUserSubmitting = true;
      if (addButton) addButton.disabled = true;
      try {
        setMessage(msg, "Dodawanie użytkownika: tworzę konto Auth...", true);
        const userId = await createAuthUser(email, password, base.fullName);
        setMessage(msg, "Dodawanie użytkownika: zapisuję profil w firmie...", true);
        const { error } = await rpcCreateCompanyUserCompat(ctx, {
          p_user_id: userId,
          p_email: email,
          p_full_name: base.fullName,
          p_phone: base.phone,
          p_position_id: base.rpcBase.p_position_id,
          p_role: base.role,
          p_login_allowed: base.rpcBase.p_login_allowed,
          p_login_hours_enabled: base.rpcBase.p_login_hours_enabled,
          p_login_hour_from: base.rpcBase.p_login_hour_from,
          p_login_hour_to: base.rpcBase.p_login_hour_to,
          p_permissions: base.role === "ADMIN" ? null : base.permissions
        });
        if (error) throw error;
        setMessage(msg, "Użytkownik dodany do Supabase. Po potwierdzeniu emaila będzie mógł się zalogować.", true);
        rerenderUsersAfterSuccess(700);
      } catch (error) {
        const rawMessage = String(error.message || error || "");
        const lowerMessage = rawMessage.toLowerCase();
        const friendlyMessage = rawMessage.includes("429") || lowerMessage.includes("rate")
          ? "Supabase Auth chwilowo zablokował tworzenie kont po zbyt wielu próbach. Odczekaj kilka minut i kliknij tylko raz."
          : (rawMessage.includes("409") || lowerMessage.includes("duplicate") || lowerMessage.includes("conflict") || lowerMessage.includes("already exists"))
            ? "Ten e-mail był już użyty przez konto w systemie. Jeśli konto było usunięte, odpal migrację 198 i spróbuj ponownie."
            : rawMessage;
        setMessage(msg, "Błąd dodawania użytkownika: " + friendlyMessage, false);
        addUserSubmitting = false;
        if (addButton) addButton.disabled = false;
      }
    }

    addForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      activeUsersFormMode = "add";
      await handleAddUserSubmit(event.currentTarget);
    }, true);


    document.querySelector("#editAdminUserForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const form = event.currentTarget;
      if (activeUsersFormMode !== "edit" || !editPanel || editPanel.hidden) {
        return;
      }
      const msg = "#editAdminUserMessage";
      const editFormData = new FormData(form);
      const userId = String(editFormData.get("userId") || "");
      const password = String(editFormData.get("password") || "");
      const passwordConfirm = String(editFormData.get("passwordConfirm") || "");
      const base = formBasePayload(form);
      if (!userId) return setMessage(msg, "Wybierz użytkownika do edycji.", false);
      if (!validatePhone(base.phone)) return setMessage(msg, "Podaj numer telefonu w formacie np. +48321321321.", false);
      if (password || passwordConfirm) {
        if (password !== passwordConfirm) return setMessage(msg, "Hasła nie są takie same.", false);
        if (password.length < 8) return setMessage(msg, "Nowe hasło musi mieć minimum 8 znaków.", false);
      }
      try {
        const { error } = await rpcUpdateCompanyUserSafe(ctx, {
          p_user_id: userId,
          p_password: password || null,
          ...base.rpcBase
        });
        if (error) throw error;
        setMessage(msg, password ? "Użytkownik i hasło zostały zaktualizowane." : "Użytkownik zaktualizowany w Supabase.", true);
        rerenderUsersAfterSuccess(600);
      } catch (error) {
        console.error("CompanyManager users edit error", error);
        setMessage(msg, "Błąd edycji użytkownika: " + (error.message || error), false);
      }
    });

    document.querySelector("#deleteAdminUserForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const userId = String(formData.get("employeeId") || "");
      const msg = "#deleteAdminUserMessage";
      if (!userId) return setMessage(msg, "Wybierz pracownika.", false);
      try {
        const { data, error } = await window.cmSupabase.rpc("admin_delete_company_user", { p_user_id: userId });
        if (error) throw error;
        const mode = String(data || "removed");
        const info = mode === "hard_deleted"
          ? "Pracownik usunięty całkowicie z bazy."
          : "Pracownik przeniesiony do archiwum. Dane historyczne zostały zachowane anonimowo.";
        setMessage(msg, info, true);
        rerenderUsersAfterSuccess(600);
      } catch (error) {
        setMessage(msg, "Błąd przenoszenia pracownika do archiwum: " + (error.message || error), false);
      }
    });
  }

  async function renderUsers() {
    if (!isUsersPage()) return;
    closeUsersModals();
    const area = getPanelArea();
    if (area) area.innerHTML = `<section class="bm-page-card"><h2>Użytkownicy</h2><p>Ładowanie użytkowników z Supabase...</p></section>`;
    try {
      const ctx = await getContext();
      if (!ctx.ok) throw new Error(ctx.message);
      const data = await fetchData(ctx);
      renderContent(ctx, data);
    } catch (error) {
      if (area) area.innerHTML = `<section class="bm-page-card"><h2>Błąd użytkowników</h2><p>${escapeHtml(error.message || error)}</p></section>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderUsers);
  } else {
    renderUsers();
  }
})();
