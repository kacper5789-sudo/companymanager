// CompanyManager — 050A Grafik pracy Supabase
// work-schedule.html: employee_work_schedules + Dashboard/Raporty support.
(function () {
  function isPage() {
    return document.body?.dataset?.panelPage === "workSchedule" || location.pathname.includes("work-schedule.html");
  }
  if (!isPage()) return;

  const DAYS = [
    { idx: 1, key: "monday", label: "Poniedziałek" },
    { idx: 2, key: "tuesday", label: "Wtorek" },
    { idx: 3, key: "wednesday", label: "Środa" },
    { idx: 4, key: "thursday", label: "Czwartek" },
    { idx: 5, key: "friday", label: "Piątek" },
    { idx: 6, key: "saturday", label: "Sobota" },
    { idx: 0, key: "sunday", label: "Niedziela" }
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function normalizeRole(role) { return String(role || "").trim().toUpperCase(); }
  function employeeName(employee) { return employee?.full_name || employee?.employee_name || employee?.email || "Pracownik"; }
  function time(value, fallback = "08:00") {
    const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }
  function minutes(value) {
    const normalized = time(value, "");
    if (!normalized) return null;
    const [h, m] = normalized.split(":").map(Number);
    return h * 60 + m;
  }
  function formatDuration(start, end) {
    const a = minutes(start); const b = minutes(end);
    if (a == null || b == null || b <= a) return "0min";
    const diff = b - a;
    const h = Math.floor(diff / 60); const m = diff % 60;
    if (!h) return `${m}min`;
    return `${h}h${m ? " " + m + "min" : ""}`;
  }

  let state = { ctx: null, employees: [], schedules: [], selectedEmployeeId: "" };

  function area() { return $(".bm-panel-area") || $("#dashboardRoot"); }
  function showError(msg) {
    const target = area();
    if (target) target.innerHTML = `<section class="bm-page-card"><h2>Grafik pracy</h2><p class="panel-message" style="color:#fca5a5">${escapeHtml(msg)}</p></section>`;
  }

  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, key) => ({ ...acc, [String(key)]: true }), {});
    if (typeof raw === "object") return raw;
    try { return normalizePermissions(JSON.parse(raw)); } catch (_) { return {}; }
  }

  function hasAccess(ctx) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    return permissions.all === true || permissions.admin === true || permissions.open_work_schedule === true || permissions.work_schedule === true;
  }

  async function getContext() {
    if (!window.cmSupabase) throw new Error("Nie załadowano połączenia z Supabase.");
    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);
    if (accessError) throw accessError;
    if (contextError) throw contextError;
    if (!access?.allowed) throw new Error(access?.reason || "Brak dostępu.");
    if (!context?.allowed || !context.company_id) throw new Error(context?.reason || "Brak kontekstu firmy.");
    const ctx = { access, context, companyId: context.company_id };
    if (!hasAccess(ctx)) throw new Error("Brak uprawnienia do grafiku pracy.");
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
  }

  async function fetchEmployees(ctx) {
    const { data, error } = await window.cmSupabase.rpc("company_team_members", { p_company_id: ctx.companyId });
    if (error) throw error;
    return (data || []).filter((row) => normalizeRole(row.role) !== "OWNER").sort((a, b) => employeeName(a).localeCompare(employeeName(b), "pl"));
  }

  async function fetchSchedules(ctx) {
    const { data, error } = await window.cmSupabase
      .from("employee_work_schedules")
      .select("id, company_id, employee_id, employee_name, day_of_week, is_working, start_time, end_time, break_start, break_end, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .order("employee_name", { ascending: true })
      .order("day_of_week", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function scheduleByEmployeeAndDay(employeeId, day) {
    return state.schedules.find((row) => String(row.employee_id) === String(employeeId) && Number(row.day_of_week) === Number(day.idx));
  }

  function employeeOptions() {
    return state.employees.map((employee) => `<option value="${escapeHtml(employee.id)}" ${String(employee.id) === String(state.selectedEmployeeId) ? "selected" : ""}>${escapeHtml(employeeName(employee))}</option>`).join("");
  }

  function dayRow(employee, day) {
    const row = scheduleByEmployeeAndDay(employee.id, day) || {};
    const working = row.is_working !== false;
    return `<tr data-day="${day.idx}">
      <td><strong>${escapeHtml(day.label)}</strong></td>
      <td><label class="cm-check-line"><input type="checkbox" data-working ${working ? "checked" : ""}> Pracuje</label></td>
      <td><input type="time" data-start value="${escapeHtml(time(row.start_time, "08:00"))}"></td>
      <td><input type="time" data-end value="${escapeHtml(time(row.end_time, "16:00"))}"></td>
      <td><input type="time" data-break-start value="${escapeHtml(time(row.break_start, ""))}"></td>
      <td><input type="time" data-break-end value="${escapeHtml(time(row.break_end, ""))}"></td>
      <td>${working ? escapeHtml(formatDuration(row.start_time || "08:00", row.end_time || "16:00")) : "wolne"}</td>
    </tr>`;
  }

  function summaryRows() {
    const byEmployee = new Map();
    state.employees.forEach((employee) => byEmployee.set(employee.id, { employee, days: [] }));
    state.schedules.forEach((row) => {
      const target = byEmployee.get(row.employee_id);
      if (target) target.days.push(row);
    });
    return Array.from(byEmployee.values()).map(({ employee, days }) => {
      const cells = DAYS.map((day) => {
        const row = days.find((item) => Number(item.day_of_week) === Number(day.idx));
        if (!row) return "—";
        if (row.is_working === false) return "wolne";
        return `${time(row.start_time, "08:00")} - ${time(row.end_time, "16:00")}`;
      });
      return `<tr><td><strong>${escapeHtml(employeeName(employee))}</strong></td>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
    }).join("");
  }

  function render() {
    const target = area();
    if (!target) return;
    if (!state.employees.length) {
      target.innerHTML = `<section class="bm-page-card"><h2>Grafik pracy</h2><p class="bm-muted">Brak pracowników w firmie.</p></section>`;
      return;
    }
    if (!state.selectedEmployeeId) state.selectedEmployeeId = state.employees[0].id;
    const employee = state.employees.find((row) => String(row.id) === String(state.selectedEmployeeId)) || state.employees[0];
    target.innerHTML = `<section class="bm-page-card cm-work-schedule-page cm-supabase-work-schedule">
      <div class="bm-page-head customers-head">
        <div><h2>Grafik pracy</h2><p class="bm-muted">Ustaw tygodniowe godziny pracy pracowników. Dashboard korzysta z tych godzin przy tworzeniu slotów wizyt.</p></div>
      </div>

      <div class="cm-report-filter-row cm-work-schedule-controls">
        <label>Pracownik<select id="workScheduleEmployee">${employeeOptions()}</select></label>
        <button type="button" id="copyCompanyHoursBtn" class="bm-light-btn">Ustaw 08:00-16:00 pn-pt</button>
        <button type="button" id="saveWorkScheduleBtn" class="bm-primary-btn">Zapisz grafik</button>
      </div>
      <p id="workScheduleMessage" class="panel-message"></p>

      <div class="bm-table-wrap cm-work-schedule-editor-wrap">
        <table class="bm-table cm-work-schedule-editor">
          <thead><tr><th>Dzień</th><th>Status</th><th>Od</th><th>Do</th><th>Przerwa od</th><th>Przerwa do</th><th>Czas</th></tr></thead>
          <tbody>${DAYS.map((day) => dayRow(employee, day)).join("")}</tbody>
        </table>
      </div>

      <h3 class="cm-section-title">Podsumowanie grafików</h3>
      <div class="bm-table-wrap">
        <table class="bm-table cm-work-schedule-summary">
          <thead><tr><th>Pracownik</th>${DAYS.map((day) => `<th>${escapeHtml(day.label)}</th>`).join("")}</tr></thead>
          <tbody>${summaryRows()}</tbody>
        </table>
      </div>
    </section>`;
    bindEvents();
    try { window.cmReinitNativePickers?.(target); } catch (_) {}
  }

  function message(text, ok = true) {
    const node = $("#workScheduleMessage");
    if (!node) return;
    node.textContent = text;
    node.style.color = ok ? "#86efac" : "#fca5a5";
  }

  async function save() {
    const employee = state.employees.find((row) => String(row.id) === String(state.selectedEmployeeId));
    if (!employee) return message("Wybierz pracownika.", false);
    const rows = $$(".cm-work-schedule-editor tbody tr").map((tr) => ({
      company_id: state.ctx.companyId,
      employee_id: employee.id,
      employee_name: employeeName(employee),
      day_of_week: Number(tr.dataset.day),
      is_working: !!$("[data-working]", tr)?.checked,
      start_time: $("[data-start]", tr)?.value || "08:00",
      end_time: $("[data-end]", tr)?.value || "16:00",
      break_start: $("[data-break-start]", tr)?.value || null,
      break_end: $("[data-break-end]", tr)?.value || null,
      updated_at: new Date().toISOString()
    }));
    try {
      const { error } = await window.cmSupabase
        .from("employee_work_schedules")
        .upsert(rows, { onConflict: "company_id,employee_id,day_of_week" });
      if (error) throw error;
      state.schedules = await fetchSchedules(state.ctx);
      message("Grafik pracy zapisany.");
      render();
    } catch (error) {
      message(`Błąd zapisu grafiku: ${error.message || error}`, false);
    }
  }

  function applyDefaultWeek() {
    $$(".cm-work-schedule-editor tbody tr").forEach((tr) => {
      const day = Number(tr.dataset.day);
      const isWeekend = day === 0 || day === 6;
      const working = $("[data-working]", tr);
      if (working) working.checked = !isWeekend;
      const start = $("[data-start]", tr); if (start) start.value = "08:00";
      const end = $("[data-end]", tr); if (end) end.value = isWeekend ? "08:00" : "16:00";
      const bs = $("[data-break-start]", tr); if (bs) bs.value = "";
      const be = $("[data-break-end]", tr); if (be) be.value = "";
    });
  }

  function bindEvents() {
    $("#workScheduleEmployee")?.addEventListener("change", (event) => {
      state.selectedEmployeeId = event.currentTarget.value;
      render();
    });
    $("#saveWorkScheduleBtn")?.addEventListener("click", save);
    $("#copyCompanyHoursBtn")?.addEventListener("click", applyDefaultWeek);
  }

  async function boot() {
    setTimeout(async () => {
      try {
        state.ctx = await getContext();
        const [employees, schedules] = await Promise.all([fetchEmployees(state.ctx), fetchSchedules(state.ctx)]);
        state.employees = employees;
        state.schedules = schedules;
        state.selectedEmployeeId = employees[0]?.id || "";
        render();
      } catch (error) {
        showError(error.message || String(error));
      }
    }, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
