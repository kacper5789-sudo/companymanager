// CompanyManager — Users Module powered by Supabase
// 036C: Użytkownicy Supabase — lista / dodaj / edytuj / blokada logowania + permissions JSONB 1:1.

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
    ["appointments_unfinished_manage", "wizyty niezakończone — zarządzanie"],
    ["appointments_history", "wizyty — historia"],
    ["sales_without_visit_add", "sprzedaż bez wizyty — dodawanie"],
    ["sales_without_visit_edit", "sprzedaż bez wizyty — edycja"],
    ["sales_without_visit_delete", "sprzedaż bez wizyty — usuwanie"],
    ["sales_without_visit_history", "sprzedaż bez wizyty — historia"],
    ["marketing_sms", "marketing — SMS"],
    ["marketing_email", "marketing — Email"],
    ["marketing_delete", "marketing — usuwanie"],
    ["passes_add", "karnety — dodawanie"],
    ["passes_edit", "karnety — edycja"],
    ["passes_delete", "karnety — usuwanie"],
    ["daily_report_today", "raport dzienny — dziś"],
    ["daily_report_other_days", "raport dzienny — inne dni"],
    ["work_schedule_add", "grafik pracy — dodawanie"],
    ["work_schedule_edit", "grafik pracy — edycja"],
    ["work_schedule_delete", "grafik pracy — usuwanie"],
    ["reports_access", "dostęp do raportów"],
    ["export_data", "export danych"],
    ["import_data", "import danych"]
  ];

  const allPermissionKeys = [...tabPermissions, ...actionPermissions].map(([key]) => key);

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

  function positionOptionsHtml(positions, selectedId = "") {
    if (!positions.length) return `<option value="">Brak aktywnych stanowisk pracy</option>`;
    return `<option value="">Wybierz stanowisko pracy</option>${positions.map((position) => `
      <option value="${escapeHtml(position.id)}" ${String(position.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(position.name || "Stanowisko pracy")}</option>`).join("")}`;
  }

  async function fetchData(ctx) {
    const [usersRes, positionsRes] = await Promise.all([
      window.cmSupabase.rpc("admin_list_company_users", { p_company_id: ctx.companyId }),
      window.cmSupabase.from("positions").select("id,name,description,active,company_id").eq("active", true).order("name", { ascending: true })
    ]);
    if (usersRes.error) throw usersRes.error;
    if (positionsRes.error) throw positionsRes.error;
    return { users: usersRes.data || [], positions: positionsRes.data || [] };
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
      <label>Rola<select name="role"><option value="EMPLOYEE" ${role === "EMPLOYEE" ? "selected" : ""}>EMPLOYEE</option><option value="ADMIN" ${role === "ADMIN" ? "selected" : ""}>ADMIN</option></select></label>

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
        ${permissionChecksHtml(selectedPermissions)}
      </fieldset>`;
  }

  function renderContent(ctx, data) {
    const area = getPanelArea();
    if (!area) return;
    const users = data.users || [];
    const positions = data.positions || [];
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

    area.innerHTML = `<section class="bm-page-card cm-users-admin-page">
      <div class="bm-page-head cm-users-head"><h2>Użytkownicy</h2><div class="bm-actions-row"><button id="showAddAdminUserBtn" type="button">Dodaj użytkownika</button><button id="showEditAdminUserBtn" type="button">Edytuj</button><button id="showDeleteAdminUserBtn" type="button" class="bm-danger-btn">Usuń pracownika</button></div></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("usersLimit", "50")}</div>
      <div class="bm-table-wrap cm-users-table-wrap"><table class="bm-table cm-users-table"><thead><tr><th>Login</th><th>Imię i nazwisko</th><th>Numer telefonu</th><th>Stanowisko</th><th>Opis stanowiska</th><th>Rola</th><th>Logowanie dozwolone</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="bm-muted cm-table-count">Pozycje od 1 do ${users.length} z ${users.length} łącznie</p>
    </section>

    <section class="bm-page-card cm-login-journal-card">
      <div class="bm-page-head"><h2>Dziennik logowania</h2></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("loginJournalLimit", "50")}</div>
      <div class="bm-table-wrap"><table class="bm-table"><thead><tr><th>Data</th><th>IP</th><th>Login</th><th>Status</th><th>Przeglądarka internetowa</th></tr></thead><tbody></tbody></table></div>
    </section>

    <section id="addAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Dodaj użytkownika</h2>
      <form id="addAdminUserForm" class="bm-form-grid cm-admin-user-form">
        ${userFormHtml("add", null, positions)}
        <button type="submit">Dodaj użytkownika</button>
      </form>
      <p id="addAdminUserMessage" class="panel-message"></p>
    </section>

    <section id="editAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Edytuj użytkownika</h2>
      ${users.length ? `<form id="editAdminUserForm" class="bm-form-grid cm-admin-user-form">
        <label class="cm-full-field">Wybierz użytkownika<select name="userId" id="editAdminUserSelect" required>${userOptions}</select></label>
        <div id="editAdminUserFields" class="cm-admin-user-fields cm-form-subgrid"></div>
        <button type="submit">Zatwierdź</button>
      </form><p id="editAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak użytkowników do edycji.</p>`}
    </section>

    <section id="deleteAdminUserPanel" class="bm-page-card bm-collapsible-panel" hidden>
      <h2>Usuń pracownika</h2>
      ${users.length ? `<form id="deleteAdminUserForm" class="bm-form-grid"><label class="full">Wybierz pracownika<select name="employeeId" required>${userOptions}</select></label><button type="submit" class="bm-danger-btn">Usuń pracownika</button></form><p id="deleteAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak pracowników do usunięcia.</p>`}
    </section>`;

    setupModuleLimitDropdowns(area);
    bindEvents(ctx, users, positions);
  }

  function validatePhone(phone) {
    return /^\+?\d{7,15}$/.test(String(phone || "").replace(/\s/g, ""));
  }

  async function createAuthUser(email, password, fullName) {
    const { data: currentSessionData } = await window.cmSupabase.auth.getSession();
    const currentSession = currentSessionData?.session || null;
    const { data, error } = await window.cmSupabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (currentSession?.access_token && currentSession?.refresh_token) {
      const { data: afterData } = await window.cmSupabase.auth.getSession();
      if (afterData?.session?.user?.email && String(afterData.session.user.email).toLowerCase() !== String(currentSession.user.email).toLowerCase()) {
        await window.cmSupabase.auth.setSession({ access_token: currentSession.access_token, refresh_token: currentSession.refresh_token });
      }
    }
    if (error) throw error;
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

  function bindEvents(ctx, users, positions) {
    const addPanel = document.querySelector("#addAdminUserPanel");
    const editPanel = document.querySelector("#editAdminUserPanel");
    const deletePanel = document.querySelector("#deleteAdminUserPanel");
    const panels = [addPanel, editPanel, deletePanel].filter(Boolean);
    document.querySelector("#showAddAdminUserBtn")?.addEventListener("click", () => showOnlyPanel(addPanel, panels));
    document.querySelector("#showEditAdminUserBtn")?.addEventListener("click", () => showOnlyPanel(editPanel, panels));
    document.querySelector("#showDeleteAdminUserBtn")?.addEventListener("click", () => showOnlyPanel(deletePanel, panels));

    const editFields = document.querySelector("#editAdminUserFields");
    const editSelect = document.querySelector("#editAdminUserSelect");
    const renderEditFields = () => {
      if (!editFields || !editSelect) return;
      const selected = users.find((u) => String(u.id) === String(editSelect.value)) || users[0];
      editFields.innerHTML = selected ? userFormHtml("edit", selected, positions) : "";
    };
    editSelect?.addEventListener("change", renderEditFields);
    renderEditFields();

    document.querySelector("#addAdminUserForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const msg = "#addAdminUserMessage";
      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const passwordConfirm = String(formData.get("passwordConfirm") || "");
      const base = formBasePayload(form);
      if (!email) return setMessage(msg, "Podaj adres email.", false);
      if (!validatePhone(base.phone)) return setMessage(msg, "Podaj numer telefonu w formacie np. +48321321321.", false);
      if (!password || password !== passwordConfirm) return setMessage(msg, "Hasła nie są takie same.", false);
      if (users.some((u) => String(u.email || "").toLowerCase() === email)) return setMessage(msg, "Konto z takim e-mailem już istnieje.", false);
      try {
        setMessage(msg, "Tworzę konto użytkownika...", true);
        const userId = await createAuthUser(email, password, base.fullName);
        const { error } = await window.cmSupabase.rpc("admin_create_company_user", {
          p_user_id: userId,
          p_company_id: ctx.companyId,
          p_email: email,
          ...base.rpcBase
        });
        if (error) throw error;
        setMessage(msg, "Użytkownik dodany do Supabase. Po potwierdzeniu emaila będzie mógł się zalogować.", true);
        setTimeout(renderUsers, 700);
      } catch (error) {
        setMessage(msg, "Błąd dodawania użytkownika: " + (error.message || error), false);
      }
    });

    document.querySelector("#editAdminUserForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const msg = "#editAdminUserMessage";
      const userId = String(new FormData(form).get("userId") || "");
      const base = formBasePayload(form);
      if (!userId) return setMessage(msg, "Wybierz użytkownika do edycji.", false);
      if (!validatePhone(base.phone)) return setMessage(msg, "Podaj numer telefonu w formacie np. +48321321321.", false);
      try {
        const { error } = await window.cmSupabase.rpc("admin_update_company_user", {
          p_user_id: userId,
          ...base.rpcBase
        });
        if (error) throw error;
        setMessage(msg, "Użytkownik zaktualizowany w Supabase.", true);
        setTimeout(renderUsers, 600);
      } catch (error) {
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
        const { error } = await window.cmSupabase.rpc("admin_disable_company_user", { p_user_id: userId });
        if (error) throw error;
        setMessage(msg, "Pracownik zablokowany — logowanie wyłączone.", true);
        setTimeout(renderUsers, 600);
      } catch (error) {
        setMessage(msg, "Błąd usuwania/blokady pracownika: " + (error.message || error), false);
      }
    });
  }

  async function renderUsers() {
    if (!isUsersPage()) return;
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
