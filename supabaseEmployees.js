// CompanyManager — Employees / Team Module powered by Supabase
// v99: compact employee color picker popover
// 040A: Zespół jako podgląd pracowników z profiles + positions. Tworzenie/edycja kont zostaje w Użytkownicy.

(function () {
  function isEmployeesPage() {
    return document.body?.dataset?.panelPage === "employees" || window.location.pathname.includes("employees.html");
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
          renderCurrentPage();
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll("[data-employee-color-menu]").forEach((menu) => { menu.hidden = true; });
  });

  let state = {
    ctx: null,
    employees: [],
    filtered: [],
    search: ""
  };


  const CM_EMPLOYEE_COLORS_KEY = "companyManagerEmployeeColorsV1";
  const CM_EMPLOYEE_COLOR_PALETTE = ["#2563EB", "#16A34A", "#9333EA", "#EA580C", "#DC2626", "#CA8A04", "#0891B2", "#DB2777", "#4F46E5", "#059669", "#7C3AED", "#F97316", "#BE123C", "#65A30D", "#0D9488", "#C026D3", "#1D4ED8", "#15803D", "#A16207", "#E11D48", "#0284C7", "#7E22CE", "#D97706", "#047857", "#B91C1C", "#0F766E", "#6D28D9", "#C2410C", "#0369A1", "#4D7C0F", "#A21CAF", "#B45309", "#1E40AF", "#166534", "#991B1B", "#155E75", "#581C87", "#9A3412", "#0E7490", "#3F6212", "#F43F5E", "#22C55E", "#38BDF8", "#A78BFA", "#FACC15", "#FB7185", "#34D399", "#60A5FA", "#F59E0B", "#94A3B8"];

  function normalizeEmployeeColor(color) {
    const value = String(color || "").trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "";
  }

  function readEmployeeColorStore() {
    try { return JSON.parse(localStorage.getItem(CM_EMPLOYEE_COLORS_KEY) || "{}") || {}; } catch (_) { return {}; }
  }

  function writeEmployeeColorStore(store) {
    try { localStorage.setItem(CM_EMPLOYEE_COLORS_KEY, JSON.stringify(store || {})); } catch (_) {}
  }

  function defaultEmployeeColor(employee, index = 0) {
    const seed = String(employee?.id || employee?.email || employee?.full_name || index || "");
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return CM_EMPLOYEE_COLOR_PALETTE[Math.abs(hash) % CM_EMPLOYEE_COLOR_PALETTE.length];
  }

  function getEmployeeColor(employee, index = 0) {
    const stored = readEmployeeColorStore();
    const id = String(employee?.id || "");
    return normalizeEmployeeColor(employee?.color || employee?.employee_color)
      || normalizeEmployeeColor(id ? stored[id] : "")
      || defaultEmployeeColor(employee, index);
  }

  function setEmployeeColorLocal(employeeId, color) {
    const id = String(employeeId || "");
    const normalized = normalizeEmployeeColor(color);
    if (!id || !normalized) return;
    const stored = readEmployeeColorStore();
    stored[id] = normalized;
    writeEmployeeColorStore(stored);
  }

  async function fetchEmployeeColors(ctx) {
    if (!window.cmSupabase || !ctx?.companyId) return {};
    try {
      const { data, error } = await window.cmSupabase
        .from("profiles")
        .select("id, color")
        .eq("company_id", ctx.companyId);
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [String(row.id), normalizeEmployeeColor(row.color)]).filter((row) => row[0] && row[1]));
    } catch (error) {
      console.warn("CompanyManager employee colors read skipped", error?.message || error);
      return {};
    }
  }

  function mergeEmployeeColors(employees, colors) {
    return (employees || []).map((employee, index) => {
      const id = String(employee?.id || "");
      const color = normalizeEmployeeColor(colors?.[id]) || getEmployeeColor(employee, index);
      return { ...employee, employee_color: color };
    });
  }

  function employeeColorInlineStyle(color) {
    const safe = escapeHtml(normalizeEmployeeColor(color) || "#64748B");
    return `--cm-employee-color:${safe};background:${safe}!important;background-color:${safe}!important;background-image:none!important;`;
  }

  function colorPickerHtml(employee, index = 0) {
    const selected = getEmployeeColor(employee, index);
    return `<div class="cm-employee-color-picker" data-employee-color-picker="${escapeHtml(employee.id || "")}" aria-label="Kolor pracownika">
      <button type="button" class="cm-employee-color-current" data-employee-color-toggle aria-label="Zmień kolor pracownika" title="Zmień kolor pracownika" style="${employeeColorInlineStyle(selected)}"></button>
      <div class="cm-employee-color-popover" data-employee-color-menu hidden>
        <div class="cm-employee-color-popover-title">Wybierz kolor</div>
        <div class="cm-employee-color-grid">
          ${CM_EMPLOYEE_COLOR_PALETTE.map((color) => `<button type="button" class="cm-employee-color-dot${String(color).toUpperCase() === String(selected).toUpperCase() ? " is-active" : ""}" data-employee-color="${escapeHtml(color)}" title="${escapeHtml(color)}" style="${employeeColorInlineStyle(color)}"></button>`).join("")}
        </div>
      </div>
    </div>`;
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, key) => ({ ...acc, [String(key)]: true }), {});
    if (typeof raw === "object") return raw;
    try { return normalizePermissions(JSON.parse(raw)); } catch (_) { return {}; }
  }

  function hasAnyPermission(ctx, keys) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return keys.some((key) => permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1");
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
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
    if (!hasAnyPermission(ctx, ["open_team", "open_employees"])) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Zespół." };

    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}

    return ctx;
  }

  async function fetchEmployees(ctx) {
    const { data, error } = await window.cmSupabase.rpc("company_team_members", {
      p_company_id: ctx.companyId
    });
    if (error) throw error;
    return data || [];
  }

  function roleLabel(role) {
    const normalized = normalizeRole(role);
    if (normalized === "ADMIN") return "ADMIN";
    if (normalized === "EMPLOYEE") return "EMPLOYEE";
    return normalized || "—";
  }

  function loginLabel(employee) {
    if (employee.login_allowed === false) return `<span class="bm-status inactive">Zablokowane</span>`;
    if (employee.login_hours_enabled) {
      const from = employee.login_hour_from ? String(employee.login_hour_from).slice(0, 5) : "—";
      const to = employee.login_hour_to ? String(employee.login_hour_to).slice(0, 5) : "—";
      return `<span class="bm-status active">Godzinowe ${escapeHtml(from)}–${escapeHtml(to)}</span>`;
    }
    return `<span class="bm-status active">Dozwolone</span>`;
  }

  function filterEmployees() {
    const query = String(state.search || "").trim().toLowerCase();
    const list = Array.isArray(state.employees) ? state.employees : [];
    if (!query) return list;
    return list.filter((employee) => [
      employee.full_name,
      employee.email,
      employee.phone,
      employee.position_name,
      employee.position_description,
      employee.role
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }

  function employeeRows(employees) {
    return employees.map((employee, index) => `
      <tr>
        <td>${escapeHtml(employee.full_name || employee.email || "—")}</td>
        <td>${escapeHtml(employee.phone || "—")}</td>
        <td>${escapeHtml(employee.position_name || "—")}</td>
        <td>${escapeHtml(employee.position_description || "—")}</td>
        <td>${escapeHtml(roleLabel(employee.role))}</td>
        <td>${loginLabel(employee)}</td>
        <td>${colorPickerHtml(employee, index)}</td>
      </tr>
    `).join("");
  }

  function renderCurrentPage() {
    const tbody = document.querySelector("#employeesSupabaseTableBody");
    const count = document.querySelector("#employeesCount");
    const pagination = document.querySelector("#employeesPagination");
    if (!tbody) return;

    const filtered = filterEmployees();
    state.filtered = filtered;
    const limit = Number(getModulePageLimit("50")) || 50;
    const visible = filtered;
    tbody.innerHTML = visible.length
      ? employeeRows(visible)
      : `<tr><td colspan="7" class="bm-muted">Brak pracowników w zespole.</td></tr>`;

    if (count) count.textContent = `Liczba pracowników: ${filtered.length}`;
    if (pagination) {
      pagination.textContent = filtered.length
        ? `Pozycje od 1 do ${filtered.length} z ${filtered.length} łącznie`
        : "Pozycji 0 z 0 dostępnych";
    }
    setupEmployeeColorPickers();
  }

  function positionEmployeeColorMenu(toggle, menu) {
    if (!toggle || !menu) return;
    const rect = toggle.getBoundingClientRect();
    const menuWidth = Math.min(256, Math.max(220, menu.offsetWidth || 256));
    const menuHeight = menu.offsetHeight || 170;
    let left = rect.left + (rect.width / 2) - (menuWidth / 2);
    left = Math.max(10, Math.min(left, window.innerWidth - menuWidth - 10));
    let top = rect.bottom + 10;
    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 10);
    }
    menu.style.position = 'fixed';
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.transform = 'none';
    menu.style.width = `${menuWidth}px`;
  }

  function applyEmployeeColorToButton(button, color) {
    if (!button || !color) return;
    button.style.setProperty('--cm-employee-color', color);
    button.style.setProperty('background', color, 'important');
    button.style.setProperty('background-color', color, 'important');
    button.style.setProperty('background-image', 'none', 'important');
  }

  function setupEmployeeColorPickers() {
    document.querySelectorAll('[data-employee-color-picker]').forEach((picker) => {
      if (picker.dataset.cmEmployeeColorReady === '1') return;
      picker.dataset.cmEmployeeColorReady = '1';
      const employeeId = picker.getAttribute('data-employee-color-picker') || '';
      const toggle = picker.querySelector('[data-employee-color-toggle]');
      const menu = picker.querySelector('[data-employee-color-menu]');

      toggle?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll('[data-employee-color-menu]').forEach((item) => {
          if (item !== menu) item.hidden = true;
        });
        if (menu) {
          const willOpen = menu.hidden;
          menu.hidden = !willOpen;
          if (willOpen) {
            positionEmployeeColorMenu(toggle, menu);
            requestAnimationFrame(() => positionEmployeeColorMenu(toggle, menu));
          }
        }
      });

      picker.querySelectorAll('[data-employee-color]').forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const color = normalizeEmployeeColor(button.getAttribute('data-employee-color'));
          if (!employeeId || !color) return;
          setEmployeeColorLocal(employeeId, color);
          state.employees = state.employees.map((employee) => String(employee.id) === String(employeeId) ? { ...employee, employee_color: color } : employee);
          picker.querySelectorAll('.cm-employee-color-dot').forEach((dot) => dot.classList.toggle('is-active', dot === button));
          applyEmployeeColorToButton(toggle, color);
          if (menu) menu.hidden = true;
          try {
            const { error } = await window.cmSupabase.from('profiles').update({ color: color }).eq('id', employeeId).eq('company_id', state.ctx?.companyId);
            if (error) throw error;
          } catch (error) {
            console.warn('CompanyManager employee color saved locally only', error?.message || error);
          }
        });
      });
    });
  }

  function renderContent(ctx, employees) {
    const area = getPanelArea();
    if (!area) return;

    const canManageUsers = hasAnyPermission(ctx, ["users_add", "users_edit", "users_delete"]);
    state.ctx = ctx;
    state.employees = employees;
    state.filtered = employees;

    area.innerHTML = `
      <section class="bm-page-card cm-employees-page cm-employees-supabase-page">
        <div class="bm-page-head cm-users-head">
          <div>
            <h2>Zespół</h2>
            <p class="bm-muted">Podgląd pracowników firmy z Supabase. Tworzenie i edycja kont jest w zakładce Użytkownicy.</p>
          </div>
          <div class="bm-action-row">
            ${canManageUsers ? `<a class="bm-light-btn" href="users.html">Zarządzaj użytkownikami</a>` : ""}
          </div>
        </div>

        <div class="bm-table-toolbar cm-limit-toolbar">
          ${moduleLimitDropdownHtml("employeesLimit")}
          <label class="bm-search-box">Szukaj: <input type="search" id="employeesSearch" placeholder="Szukaj"></label>
        </div>

        <div class="cm-summary-grid" style="margin-bottom: 14px;">
          <div><span>Pracownicy</span><strong>${employees.length}</strong></div>
          <div><span>Aktywne logowanie</span><strong>${employees.filter((e) => e.login_allowed !== false).length}</strong></div>
          <div><span>Zablokowane logowanie</span><strong>${employees.filter((e) => e.login_allowed === false).length}</strong></div>
        </div>

        <p id="employeesCount" class="bm-muted">Liczba pracowników: ${employees.length}</p>

        <div class="bm-table-wrap">
          <table class="bm-table">
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>Numer telefonu</th>
                <th>Stanowisko</th>
                <th>Opis stanowiska</th>
                <th>Rola</th>
                <th>Logowanie</th>
                <th>Kolor grafiku</th>
              </tr>
            </thead>
            <tbody id="employeesSupabaseTableBody"></tbody>
          </table>
        </div>
        <div id="employeesPagination" class="cm-pagination-row"></div>
      </section>
    `;

    setupModuleLimitDropdowns(area);
    const searchInput = document.querySelector("#employeesSearch");
    searchInput?.addEventListener("input", () => {
      state.search = searchInput.value || "";
      renderCurrentPage();
    });
    renderCurrentPage();
  }

  function renderError(message) {
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `
      <section class="bm-page-card">
        <h2>Zespół</h2>
        <p class="bm-error">${escapeHtml(message || "Błąd ładowania zespołu.")}</p>
      </section>
    `;
  }

  async function init() {
    if (!isEmployeesPage()) return;
    const area = getPanelArea();
    if (area) {
      area.innerHTML = `<section class="bm-page-card"><h2>Zespół</h2><p class="bm-muted">Ładowanie zespołu z Supabase...</p></section>`;
    }

    try {
      const ctx = await getContext();
      if (!ctx.ok) {
        renderError(ctx.message);
        return;
      }
      const employeesRaw = await fetchEmployees(ctx);
      const colorMap = await fetchEmployeeColors(ctx);
      const employees = mergeEmployeeColors(employeesRaw, colorMap);
      renderContent(ctx, employees);
    } catch (error) {
      console.error("Employees Supabase error", error);
      renderError(error?.message || "Błąd ładowania zespołu.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
