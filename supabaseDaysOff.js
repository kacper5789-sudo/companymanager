// CompanyManager — Days Off Module powered by Supabase
// 042A: Dni wolne pracowników -> public.days_off + profiles/team members.

(function () {
  function isDaysOffPage() {
    return document.body?.dataset?.panelPage === "daysOff" || window.location.pathname.includes("days-off.html");
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

  function todayIso() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toIsoDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDatePL(value) {
    if (!value) return "—";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    if (!y || !m || !d) return escapeHtml(value);
    return `${d}.${m}.${y}`;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isInRange(iso, start, end) {
    const s = String(start || "").slice(0, 10);
    const e = String(end || start || "").slice(0, 10);
    return iso >= s && iso <= e;
  }

  const monthNamesPL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  const typeOptions = ["zwolnienie lekarskie", "szkolenie", "urlop", "dzień wolny"];

  let state = {
    ctx: null,
    employees: [],
    daysOff: [],
    calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  };

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

  function canOpen(ctx) { return hasAnyPermission(ctx, ["open_days_off"]); }
  function canAdd(ctx) { return hasAnyPermission(ctx, ["days_off_add"]); }
  function canEdit(ctx) { return hasAnyPermission(ctx, ["days_off_edit", "days_off_delete"]); }
  function canDelete(ctx) { return hasAnyPermission(ctx, ["days_off_delete", "days_off_edit"]); }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  function showError(message) {
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `<section class="bm-page-card"><h2>Dni wolne pracowników</h2><p class="panel-message" style="color:#fca5a5">${escapeHtml(message)}</p></section>`;
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
    if (!canOpen(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Dni wolne pracowników." };

    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}

    return ctx;
  }

  async function fetchEmployees(ctx) {
    const { data, error } = await window.cmSupabase.rpc("company_team_members", { p_company_id: ctx.companyId });
    if (error) throw error;
    return (data || []).filter((employee) => normalizeRole(employee.role) !== "OWNER");
  }

  async function fetchDaysOff(ctx) {
    const { data, error } = await window.cmSupabase
      .from("days_off")
      .select("id, company_id, employee_id, employee_name, type, start_date, end_date, date_from, date_to, description, reason, status, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null)
      .order("date_from", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeDayOffRow);
  }

  function normalizeDayOffRow(item) {
    return {
      ...item,
      start_date: item.start_date || item.date_from,
      end_date: item.end_date || item.date_to || item.start_date || item.date_from,
      description: item.description || item.reason || "",
      employee_name: item.employee_name || employeeNameById(item.employee_id)
    };
  }

  function employeeNameById(id) {
    const employee = state.employees.find((item) => item.id === id);
    return employee?.full_name || employee?.email || employee?.employee_name || "Pracownik";
  }

  function employeeOptionsHtml(selectedId = "") {
    if (!state.employees.length) return `<option value="">Brak pracowników</option>`;
    return state.employees.map((employee) => {
      const label = employee.full_name || employee.email || "Pracownik";
      const selected = String(employee.id) === String(selectedId) ? " selected" : "";
      return `<option value="${escapeHtml(employee.id)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function typeOptionsHtml(selectedType = "dzień wolny") {
    return typeOptions.map((type) => `<option value="${escapeHtml(type)}"${type === selectedType ? " selected" : ""}>${escapeHtml(type)}</option>`).join("");
  }

  function dayOffLabel(item) {
    const name = item.employee_name || employeeNameById(item.employee_id);
    const dates = `${formatDatePL(item.start_date)}${item.end_date && item.end_date !== item.start_date ? " do " + formatDatePL(item.end_date) : ""}`;
    return `${name} — ${item.type || "dzień wolny"} — ${dates}${item.description ? " — " + item.description : ""}`;
  }

  function entryOptionsHtml(selectedId = "") {
    if (!state.daysOff.length) return `<option value="">Brak wpisów</option>`;
    return state.daysOff.map((item) => `<option value="${escapeHtml(item.id)}"${String(item.id) === String(selectedId) ? " selected" : ""}>${escapeHtml(dayOffLabel(item))}</option>`).join("");
  }

  function buildCalendar() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const now = new Date();
    let day = 1 - offset;
    let cells = "";

    for (let i = 0; i < 42; i += 1, day += 1) {
      const cellDate = new Date(year, month, day);
      const iso = toIsoDate(cellDate);
      const outside = cellDate.getMonth() !== month;
      const entries = state.daysOff
        .filter((item) => isInRange(iso, item.start_date, item.end_date))
        .map((item) => `<span class="day-off-entry">${escapeHtml((item.employee_name || employeeNameById(item.employee_id)) + " - " + (item.type || "dzień wolny"))}</span>`)
        .join("");

      cells += `<button type="button" class="day-off-cell ${outside ? "outside" : ""} ${sameDay(cellDate, now) ? "today" : ""}" data-date="${iso}"><b>${cellDate.getDate()}</b>${entries}</button>`;
    }

    return `
      <div class="days-off-head">
        <button id="daysOffPrev" type="button">‹</button>
        <strong>${escapeHtml(monthNamesPL[month])} ${year}</strong>
        <button id="daysOffNext" type="button">›</button>
      </div>
      <div class="days-off-weekdays"><span>Po</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pi</span><span>So</span><span>Ni</span></div>
      <div class="days-off-grid">${cells}</div>`;
  }

  function recordsTable() {
    if (!state.daysOff.length) return `<p class="bm-muted">Brak dodanych dni wolnych.</p>`;
    return `
      <div class="bm-table-wrap">
        <table class="bm-table">
          <thead><tr><th>Pracownik</th><th>Rodzaj</th><th>Od</th><th>Do</th><th>Opis</th></tr></thead>
          <tbody>
            ${state.daysOff.map((item) => `
              <tr>
                <td>${escapeHtml(item.employee_name || employeeNameById(item.employee_id))}</td>
                <td>${escapeHtml(item.type || "dzień wolny")}</td>
                <td>${formatDatePL(item.start_date)}</td>
                <td>${formatDatePL(item.end_date)}</td>
                <td>${escapeHtml(item.description || "—")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }


  function ensureDaysOffBackdrop() {
    let backdrop = document.getElementById("cmDaysOffLocalBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "cmDaysOffLocalBackdrop";
      backdrop.className = "cm-days-off-backdrop";
      backdrop.hidden = true;
      backdrop.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); });
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  function setDaysOffModalOpen(isOpen) {
    const backdrop = ensureDaysOffBackdrop();
    backdrop.hidden = !isOpen;
    document.body.classList.toggle("cm-days-off-modal-open", !!isOpen);
  }

  function hasOpenDaysOffPanel() {
    return ["daysOffFormCard", "daysOffEditPanel", "daysOffDeletePanel"]
      .map((id) => document.getElementById(id))
      .some((panel) => panel && !panel.hidden);
  }

  function hidePanels() {
    ["daysOffFormCard", "daysOffEditPanel", "daysOffDeletePanel"].forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove("cm-days-off-dialog");
      panel.classList.remove("cm-modal-active", "cm-as-modal", "cm-days-off-centered");
      panel.removeAttribute("data-cm-modal-depth");
      panel.style.removeProperty("z-index");
    });
    setDaysOffModalOpen(false);
    // CompanyManager 127 — pełne sprzątanie modala dni wolnych, żeby tło nie zostawało przyciemnione/rozmyte.
    document.body.classList.remove("cm-modal-open", "cm-centered-panel-open", "cm-days-off-modal-open");
    document.documentElement.classList.remove("cm-modal-open", "cm-centered-panel-open", "cm-days-off-modal-open");
    const globalOverlay = document.getElementById("cmGlobalFormOverlay");
    if (globalOverlay) {
      globalOverlay.hidden = true;
      globalOverlay.style.display = "none";
      globalOverlay.style.opacity = "0";
      globalOverlay.style.pointerEvents = "none";
      globalOverlay.style.backdropFilter = "none";
      globalOverlay.style.webkitBackdropFilter = "none";
    }
    try { window.cmGlobalModalCleanup?.(); } catch (_) {}
    try { window.cmRefreshGlobalModalState?.(); } catch (_) {}
  }

  function render() {
    const area = getPanelArea();
    if (!area) return;
    const ctx = state.ctx;
    const allowAdd = canAdd(ctx);
    const allowEdit = canEdit(ctx);
    const allowDelete = canDelete(ctx);
    const today = todayIso();

    area.innerHTML = `
      <section class="bm-page-card cm-days-off-page">
        <div class="bm-page-head">
          <div>
            <h2>Dni wolne pracowników</h2>
          </div>
        </div>
        <div id="daysOffCalendar">${buildCalendar()}</div>
      </section>

      <section class="bm-page-card days-off-actions-card">
        <div class="days-off-action-grid">
          <button type="button" id="showAddDaysOff" class="bm-primary-btn"${allowAdd ? "" : " disabled"}>Dodaj</button>
          <button type="button" id="showEditDaysOff" class="bm-inline-action"${allowEdit ? "" : " disabled"}>Edytuj</button>
          <button type="button" id="showDeleteDaysOff" class="bm-danger-btn"${allowDelete ? "" : " disabled"}>Usuń</button>
        </div>
      </section>

      <section class="bm-page-card cm-centered-form-card cm-no-modal" id="daysOffFormCard" data-cm-no-modal="true" hidden>
        <h2>Dodaj dni wolne pracownika</h2>
        <form id="daysOffForm" class="bm-form-grid">
          <label>Pracownik<select name="employee_id" required>${employeeOptionsHtml()}</select></label>
          <label>Rodzaj<select name="type" required>${typeOptionsHtml("dzień wolny")}</select></label>
          <label>Od dnia<input name="start_date" id="daysOffStart" type="date" value="${today}" required></label>
          <label>Do dnia<input name="end_date" id="daysOffEnd" type="date" value="${today}" required></label>
          <label class="full">Opis<textarea name="description" placeholder="Przyczyna / powód"></textarea></label>
          <button type="submit">Zapisz dni wolne</button>
        </form>
        <p id="daysOffMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card cm-centered-form-card cm-no-modal" id="daysOffEditPanel" data-cm-no-modal="true" hidden>
        <h2>Edytuj dni wolne</h2>
        ${state.daysOff.length ? `<form id="daysOffEditForm" class="bm-form-grid">
          <label class="full">Wybierz wpis<select id="daysOffEditSelect" name="day_off_id" required>${entryOptionsHtml()}</select></label>
          <label>Pracownik<select name="employee_id" id="editDaysOffEmployee" required>${employeeOptionsHtml()}</select></label>
          <label>Rodzaj<select name="type" id="editDaysOffType" required>${typeOptionsHtml()}</select></label>
          <label>Od dnia<input name="start_date" id="editDaysOffStart" type="date" required></label>
          <label>Do dnia<input name="end_date" id="editDaysOffEnd" type="date" required></label>
          <label class="full">Opis<textarea name="description" id="editDaysOffDescription" placeholder="Przyczyna / powód"></textarea></label>
          <button type="submit">Zapisz zmiany</button>
        </form><p id="daysOffEditMessage" class="panel-message"></p>` : `<p class="muted-note">Brak dodanych dni wolnych do edycji.</p>`}
      </section>

      <section class="bm-page-card cm-centered-form-card cm-no-modal" id="daysOffDeletePanel" data-cm-no-modal="true" hidden>
        <h2>Usuń dni wolne</h2>
        ${state.daysOff.length ? `<form id="daysOffDeleteForm" class="bm-form-grid">
          <label class="full">Wybierz wpis<select id="daysOffDeleteSelect" name="day_off_id" required>${entryOptionsHtml()}</select></label>
          <label>Pracownik<input id="deleteDaysOffEmployee" type="text" readonly></label>
          <label>Rodzaj<input id="deleteDaysOffType" type="text" readonly></label>
          <label>Od dnia<input id="deleteDaysOffStart" type="date" readonly></label>
          <label>Do dnia<input id="deleteDaysOffEnd" type="date" readonly></label>
          <label class="full">Opis<textarea id="deleteDaysOffDescription" readonly></textarea></label>
          <button type="button" id="deleteDaysOffBtn" class="bm-danger-btn">Usuń dni wolne</button>
        </form><p id="daysOffDeleteMessage" class="panel-message"></p>` : `<p class="muted-note">Brak dodanych dni wolnych do usunięcia.</p>`}
      </section>

      <section class="bm-page-card">
        <h2>Lista dni wolnych</h2>
        ${recordsTable()}
      </section>`;

    bindEvents();
    try { window.cmReinitNativePickers?.(); } catch (_) {}
    try { window.cmGlobalModalCleanup?.(); } catch (_) {}
  }

  function ensureDaysOffCancel(panel) {
    if (!panel || panel.querySelector('[data-days-off-cancel="true"]')) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bm-inline-action cm-days-off-cancel";
    btn.dataset.daysOffCancel = "true";
    btn.textContent = "Anuluj";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hidePanels();
    });
    panel.appendChild(btn);
  }

  function showPanel(targetId) {
    const panels = ["daysOffFormCard", "daysOffEditPanel", "daysOffDeletePanel"].map((id) => document.getElementById(id)).filter(Boolean);
    const target = document.getElementById(targetId);
    panels.forEach((panel) => {
      panel.hidden = panel !== target;
      panel.classList.remove("cm-modal-active", "cm-as-modal", "cm-days-off-centered");
      panel.classList.toggle("cm-days-off-dialog", panel === target);
      panel.classList.add("cm-no-modal");
      panel.dataset.cmNoModal = "true";
      panel.removeAttribute("data-cm-modal-depth");
      panel.style.removeProperty("z-index");
    });
    if (target) {
      target.hidden = false;
      target.classList.add("cm-days-off-dialog", "cm-no-modal");
      target.dataset.cmNoModal = "true";
      target.addEventListener("click", (event) => event.stopPropagation(), { once: false });
      target.addEventListener("mousedown", (event) => event.stopPropagation(), { once: false });
      ensureDaysOffCancel(target);
      setDaysOffModalOpen(true);
      try { window.cmReinitNativePickers?.(target); } catch (_) {}
      try { window.cmReinitNativeDatePickers?.(target); } catch (_) {}
      try { window.cmRefreshGlobalModalState?.(); } catch (_) {}
      const first = target.querySelector("input:not([readonly]), select:not([disabled]), textarea:not([readonly])");
      window.setTimeout(() => { try { first?.focus?.({ preventScroll: true }); } catch (_) {} }, 40);
    } else {
      setDaysOffModalOpen(hasOpenDaysOffPanel());
    }
  }

  function message(selector, text, ok = true) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#86efac" : "#fca5a5";
  }

  function normalizeDateValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : raw.slice(0, 10);
  }

  function formDateValue(form, fieldName, inputId, fallback) {
    const dataValue = normalizeDateValue(new FormData(form).get(fieldName));
    if (dataValue) return dataValue;
    const inputValue = normalizeDateValue(document.getElementById(inputId)?.value);
    if (inputValue) return inputValue;
    return normalizeDateValue(fallback || todayIso());
  }

  function validateDates(start, end, selector) {
    if (!start || !end) {
      message(selector, "Uzupełnij daty.", false);
      return false;
    }
    if (end < start) {
      message(selector, "Data końcowa nie może być wcześniejsza niż data początkowa.", false);
      return false;
    }
    return true;
  }

  async function reloadAndRender() {
    state.daysOff = await fetchDaysOff(state.ctx);
    render();
  }

  function selectedItem(selectId) {
    const id = document.getElementById(selectId)?.value;
    return state.daysOff.find((item) => String(item.id) === String(id));
  }

  function fillEditForm() {
    const item = selectedItem("daysOffEditSelect");
    if (!item) return;
    const employee = document.getElementById("editDaysOffEmployee");
    const type = document.getElementById("editDaysOffType");
    const start = document.getElementById("editDaysOffStart");
    const end = document.getElementById("editDaysOffEnd");
    const description = document.getElementById("editDaysOffDescription");
    if (employee) employee.value = item.employee_id || "";
    if (type) type.value = item.type || "dzień wolny";
    if (start) start.value = String(item.start_date || "").slice(0, 10);
    if (end) end.value = String(item.end_date || item.start_date || "").slice(0, 10);
    if (description) description.value = item.description || "";
  }

  function fillDeleteForm() {
    const item = selectedItem("daysOffDeleteSelect");
    const employee = document.getElementById("deleteDaysOffEmployee");
    const type = document.getElementById("deleteDaysOffType");
    const start = document.getElementById("deleteDaysOffStart");
    const end = document.getElementById("deleteDaysOffEnd");
    const description = document.getElementById("deleteDaysOffDescription");
    if (employee) employee.value = item ? (item.employee_name || employeeNameById(item.employee_id)) : "";
    if (type) type.value = item?.type || "";
    if (start) start.value = String(item?.start_date || "").slice(0, 10);
    if (end) end.value = String(item?.end_date || item?.start_date || "").slice(0, 10);
    if (description) description.value = item?.description || "";
  }

  function bindEvents() {
    ["daysOffFormCard", "daysOffEditPanel", "daysOffDeletePanel"].forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel || panel.dataset.daysOffClickGuard === "1") return;
      panel.dataset.daysOffClickGuard = "1";
      ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"].forEach((eventName) => {
        panel.addEventListener(eventName, (event) => event.stopPropagation());
      });
    });
    document.getElementById("showAddDaysOff")?.addEventListener("click", () => showPanel("daysOffFormCard"));
    document.getElementById("showEditDaysOff")?.addEventListener("click", () => { showPanel("daysOffEditPanel"); fillEditForm(); });
    document.getElementById("showDeleteDaysOff")?.addEventListener("click", () => { showPanel("daysOffDeletePanel"); fillDeleteForm(); });

    document.getElementById("daysOffCalendar")?.addEventListener("click", (event) => {
      const prev = event.target.closest("#daysOffPrev");
      const next = event.target.closest("#daysOffNext");
      const cell = event.target.closest(".day-off-cell");
      if (prev) {
        state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
        render();
        return;
      }
      if (next) {
        state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
        render();
        return;
      }
      if (cell && canAdd(state.ctx)) {
        showPanel("daysOffFormCard");
        const selected = cell.dataset.date;
        const start = document.getElementById("daysOffStart");
        const end = document.getElementById("daysOffEnd");
        if (start) start.value = selected;
        if (end) end.value = selected;
      }
    });

    document.getElementById("daysOffForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const selectedCalendarDate = normalizeDateValue(document.querySelector(".day-off-cell.is-selected")?.dataset?.date);
      const startDate = formDateValue(form, "start_date", "daysOffStart", selectedCalendarDate || todayIso());
      const endDate = formDateValue(form, "end_date", "daysOffEnd", startDate);
      data.start_date = startDate;
      data.end_date = endDate;
      if (!validateDates(data.start_date, data.end_date, "#daysOffMessage")) return;
      if (!data.employee_id) return message("#daysOffMessage", "Wybierz pracownika.", false);
      try {
        const employee = state.employees.find((item) => String(item.id) === String(data.employee_id) || String(item.profile_id) === String(data.employee_id));
        const payload = {
          company_id: state.ctx.companyId,
          employee_id: data.employee_id || null,
          employee_name: employee?.full_name || employee?.email || "Pracownik",
          type: data.type || "dzień wolny",
          start_date: startDate,
          end_date: endDate,
          description: String(data.description || "").trim(),
          status: "active"
        };

        const rpcResult = await window.cmSupabase.rpc("add_day_off", {
          p_company_id: payload.company_id,
          p_employee_id: payload.employee_id,
          p_type: payload.type,
          p_start_date: payload.start_date || startDate || todayIso(),
          p_end_date: payload.end_date || endDate || payload.start_date || startDate || todayIso(),
          p_description: payload.description
        });

        if (rpcResult.error) {
          console.warn("add_day_off RPC failed:", rpcResult.error);
          const details = [rpcResult.error.message, rpcResult.error.details, rpcResult.error.hint].filter(Boolean).join(" | ");
          throw new Error(details || "Nie udało się zapisać dni wolnych.");
        }
        message("#daysOffMessage", "Dni wolne zapisane.");
        hidePanels();
        form.reset();
        const startInput = document.getElementById("daysOffStart");
        const endInput = document.getElementById("daysOffEnd");
        if (startInput) startInput.value = todayIso();
        if (endInput) endInput.value = todayIso();
        await reloadAndRender();
      } catch (error) {
        message("#daysOffMessage", `Błąd zapisu dni wolnych: ${error.message || error}`, false);
      }
    });

    document.getElementById("daysOffEditSelect")?.addEventListener("change", fillEditForm);
    fillEditForm();

    document.getElementById("daysOffDeleteSelect")?.addEventListener("change", fillDeleteForm);
    fillDeleteForm();

    document.getElementById("daysOffEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      data.start_date = formDateValue(form, "start_date", "editDaysOffStart", todayIso());
      data.end_date = formDateValue(form, "end_date", "editDaysOffEnd", data.start_date);
      if (!data.day_off_id) return message("#daysOffEditMessage", "Wybierz wpis do edycji.", false);
      if (!validateDates(data.start_date, data.end_date, "#daysOffEditMessage")) return;
      try {
        const employee = state.employees.find((item) => item.id === data.employee_id);
        const { error } = await window.cmSupabase.rpc("update_day_off", {
          p_day_off_id: data.day_off_id,
          p_company_id: state.ctx.companyId,
          p_employee_id: data.employee_id || null,
          p_type: data.type || "dzień wolny",
          p_start_date: data.start_date,
          p_end_date: data.end_date,
          p_description: String(data.description || "").trim()
        });
        if (error) throw error;
        message("#daysOffEditMessage", "Dni wolne zaktualizowane.");
        hidePanels();
        await reloadAndRender();
      } catch (error) {
        message("#daysOffEditMessage", `Błąd edycji dni wolnych: ${error.message || error}`, false);
      }
    });

    document.getElementById("deleteDaysOffBtn")?.addEventListener("click", async () => {
      const id = document.getElementById("daysOffDeleteSelect")?.value;
      if (!id) return message("#daysOffDeleteMessage", "Wybierz wpis do usunięcia.", false);
      try {
        const { error } = await window.cmSupabase.rpc("delete_day_off", {
          p_day_off_id: id,
          p_company_id: state.ctx.companyId
        });
        if (error) throw error;
        message("#daysOffDeleteMessage", "Dni wolne usunięte.");
        hidePanels();
        await reloadAndRender();
      } catch (error) {
        message("#daysOffDeleteMessage", `Błąd usuwania dni wolnych: ${error.message || error}`, false);
      }
    });
  }

  async function boot() {
    if (!isDaysOffPage()) return;
    setTimeout(async () => {
      try {
        const ctx = await getContext();
        if (!ctx.ok) return showError(ctx.message || "Brak dostępu.");
        state.ctx = ctx;
        const [employees, daysOff] = await Promise.all([
          fetchEmployees(ctx),
          fetchDaysOff(ctx)
        ]);
        state.employees = employees;
        state.daysOff = daysOff;
        render();
      } catch (error) {
        showError(error.message || String(error));
      }
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
