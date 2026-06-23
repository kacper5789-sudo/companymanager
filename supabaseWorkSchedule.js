// CompanyManager — 050B Grafik pracy Supabase UI polish
// work-schedule.html: flexible work hours, edit/delete, download schedule.
(function () {
  function isPage() {
    return document.body?.dataset?.panelPage === "workSchedule" || location.pathname.includes("work-schedule.html");
  }
  if (!isPage()) return;

  const DAYS = [
    { idx: 1, key: "monday", short: "Pon", label: "Poniedziałek" },
    { idx: 2, key: "tuesday", short: "Wt", label: "Wtorek" },
    { idx: 3, key: "wednesday", short: "Śr", label: "Środa" },
    { idx: 4, key: "thursday", short: "Czw", label: "Czwartek" },
    { idx: 5, key: "friday", short: "Pt", label: "Piątek" },
    { idx: 6, key: "saturday", short: "Sob", label: "Sobota" },
    { idx: 0, key: "sunday", short: "Nd", label: "Niedziela" }
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
  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
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
    return (data || [])
      .filter((row) => normalizeRole(row.role) !== "OWNER")
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "pl"));
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
      <td><strong>${escapeHtml(day.label)}</strong><span>${escapeHtml(day.short)}</span></td>
      <td><label class="cm-check-line cm-work-toggle"><input type="checkbox" data-working ${working ? "checked" : ""}> <span>Pracuje</span></label></td>
      <td><input type="time" data-start value="${escapeHtml(time(row.start_time, "08:00"))}"></td>
      <td><input type="time" data-end value="${escapeHtml(time(row.end_time, "16:00"))}"></td>
      <td><input type="time" data-break-start value="${escapeHtml(time(row.break_start, ""))}"></td>
      <td><input type="time" data-break-end value="${escapeHtml(time(row.break_end, ""))}"></td>
      <td data-day-duration>${working ? escapeHtml(formatDuration(row.start_time || "08:00", row.end_time || "16:00")) : "wolne"}</td>
    </tr>`;
  }

  function summaryRows() {
    if (!state.employees.length) return `<tr><td colspan="9">Brak pracowników.</td></tr>`;
    const byEmployee = new Map();
    state.employees.forEach((employee) => byEmployee.set(String(employee.id), { employee, days: [] }));
    state.schedules.forEach((row) => {
      const target = byEmployee.get(String(row.employee_id));
      if (target) target.days.push(row);
    });
    return Array.from(byEmployee.values()).map(({ employee, days }) => {
      const cells = DAYS.map((day) => {
        const row = days.find((item) => Number(item.day_of_week) === Number(day.idx));
        if (!row) return "—";
        if (row.is_working === false) return "wolne";
        return `${time(row.start_time, "08:00")} - ${time(row.end_time, "16:00")}`;
      });
      return `<tr data-employee-id="${escapeHtml(employee.id)}">
        <td><strong>${escapeHtml(employeeName(employee))}</strong></td>
        ${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        <td class="cm-work-actions">
          <button type="button" class="bm-light-btn" data-edit-employee="${escapeHtml(employee.id)}">Edytuj</button>
          <button type="button" class="bm-danger-btn" data-delete-employee="${escapeHtml(employee.id)}">Usuń</button>
        </td>
      </tr>`;
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
      <div class="bm-page-head customers-head cm-work-schedule-head">
        <div>
          <h2>Grafik pracy</h2>
          <p class="bm-muted">Ustaw dowolne godziny pracy pracowników. Dashboard korzysta z tych godzin przy tworzeniu slotów wizyt.</p>
        </div>
      </div>

      <div class="cm-work-schedule-grid">
        <section class="cm-work-panel cm-work-panel-main">
          <div class="cm-work-panel-title">Edycja grafiku</div>
          <div class="cm-work-schedule-controls">
            <label>Pracownik<select id="workScheduleEmployee">${employeeOptions()}</select></label>
            <label>Szybko od<input type="time" id="quickStartTime" value="08:00"></label>
            <label>Szybko do<input type="time" id="quickEndTime" value="16:00"></label>
            <label>Przerwa od<input type="time" id="quickBreakStart" value=""></label>
            <label>Przerwa do<input type="time" id="quickBreakEnd" value=""></label>
          </div>
          <div class="cm-work-actions-bar">
            <button type="button" id="copyCompanyHoursBtn" class="bm-light-btn">Zastosuj pn-pt</button>
            <button type="button" id="applyAllDaysBtn" class="bm-light-btn">Zastosuj cały tydzień</button>
            <button type="button" id="clearScheduleBtn" class="bm-danger-btn">Ustaw wolne</button>
            <button type="button" id="saveWorkScheduleBtn" class="bm-primary-btn cm-save-schedule-btn">Zapisz grafik</button>
          </div>
          <p id="workScheduleMessage" class="panel-message"></p>
        </section>
      </div>

      <div class="bm-table-wrap cm-work-schedule-editor-wrap">
        <table class="bm-table cm-work-schedule-editor">
          <thead><tr><th>Dzień</th><th>Status</th><th>Od</th><th>Do</th><th>Przerwa od</th><th>Przerwa do</th><th>Czas</th></tr></thead>
          <tbody>${DAYS.map((day) => dayRow(employee, day)).join("")}</tbody>
        </table>
      </div>

      <div class="cm-work-bottom-actions">
        <button type="button" id="saveWorkScheduleBottomBtn" class="bm-primary-btn cm-save-schedule-btn">Zapisz grafik</button>
      </div>

      <div class="cm-section-title-row">
        <h3 class="cm-section-title">Podsumowanie grafików</h3>
        <button type="button" id="downloadWorkScheduleBtn" class="bm-light-btn">Pobierz grafik</button>
      </div>
      <div class="bm-table-wrap cm-work-summary-wrap">
        <table class="bm-table cm-work-schedule-summary">
          <thead><tr><th>Pracownik</th>${DAYS.map((day) => `<th>${escapeHtml(day.short)}</th>`).join("")}<th>Akcje</th></tr></thead>
          <tbody>${summaryRows()}</tbody>
        </table>
      </div>
    </section>`;
    bindEvents();
    refreshDurations();
    try { window.cmReinitNativePickers?.(target); } catch (_) {}
  }

  function message(text, ok = true) {
    const node = $("#workScheduleMessage");
    if (!node) return;
    node.textContent = text;
    node.style.color = ok ? "#86efac" : "#fca5a5";
  }

  function validateRows(rows) {
    for (const row of rows) {
      if (!row.is_working) continue;
      const start = minutes(row.start_time);
      const end = minutes(row.end_time);
      if (start == null || end == null || end <= start) {
        throw new Error("Godzina 'Do' musi być późniejsza niż 'Od'. Nie ma limitu 8h — ustaw dowolny poprawny zakres.");
      }
      const bs = minutes(row.break_start);
      const be = minutes(row.break_end);
      if ((bs != null || be != null) && (bs == null || be == null || be <= bs || bs < start || be > end)) {
        throw new Error("Przerwa musi mieścić się w godzinach pracy i mieć poprawny zakres od/do.");
      }
    }
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
      validateRows(rows);
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

  function quickValues() {
    return {
      start: $("#quickStartTime")?.value || "08:00",
      end: $("#quickEndTime")?.value || "16:00",
      breakStart: $("#quickBreakStart")?.value || "",
      breakEnd: $("#quickBreakEnd")?.value || ""
    };
  }

  function applyToRows(mode) {
    const q = quickValues();
    $$(".cm-work-schedule-editor tbody tr").forEach((tr) => {
      const day = Number(tr.dataset.day);
      const weekend = day === 0 || day === 6;
      if (mode === "week" && weekend) return;
      const working = $("[data-working]", tr);
      if (working) working.checked = true;
      const start = $("[data-start]", tr); if (start) start.value = q.start;
      const end = $("[data-end]", tr); if (end) end.value = q.end;
      const bs = $("[data-break-start]", tr); if (bs) bs.value = q.breakStart;
      const be = $("[data-break-end]", tr); if (be) be.value = q.breakEnd;
    });
    refreshDurations();
  }

  function setFree() {
    $$(".cm-work-schedule-editor tbody tr").forEach((tr) => {
      const working = $("[data-working]", tr);
      if (working) working.checked = false;
    });
    refreshDurations();
  }

  function refreshDurations() {
    $$(".cm-work-schedule-editor tbody tr").forEach((tr) => {
      const working = $("[data-working]", tr)?.checked;
      const target = $("[data-day-duration]", tr);
      if (!target) return;
      target.textContent = working ? formatDuration($("[data-start]", tr)?.value, $("[data-end]", tr)?.value) : "wolne";
    });
  }

  async function deleteSchedule(employeeId) {
    const employee = state.employees.find((row) => String(row.id) === String(employeeId));
    if (!employee) return;
    if (!confirm(`Usunąć grafik pracownika: ${employeeName(employee)}?`)) return;
    try {
      const { error } = await window.cmSupabase
        .from("employee_work_schedules")
        .delete()
        .eq("company_id", state.ctx.companyId)
        .eq("employee_id", employee.id);
      if (error) throw error;
      state.schedules = await fetchSchedules(state.ctx);
      if (String(state.selectedEmployeeId) === String(employee.id)) state.selectedEmployeeId = employee.id;
      render();
    } catch (error) {
      alert(`Błąd usuwania grafiku: ${error.message || error}`);
    }
  }

  function downloadCsv() {
    const header = ["Pracownik", ...DAYS.map((day) => day.label)];
    const rows = [header];
    state.employees.forEach((employee) => {
      const row = [employeeName(employee)];
      DAYS.forEach((day) => {
        const schedule = scheduleByEmployeeAndDay(employee.id, day);
        if (!schedule) row.push("—");
        else if (schedule.is_working === false) row.push("wolne");
        else row.push(`${time(schedule.start_time)}-${time(schedule.end_time)}${schedule.break_start && schedule.break_end ? `; przerwa ${time(schedule.break_start, "")}-${time(schedule.break_end, "")}` : ""}`);
      });
      rows.push(row);
    });
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `grafik-pracy-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    $("#workScheduleEmployee")?.addEventListener("change", (event) => {
      state.selectedEmployeeId = event.currentTarget.value;
      render();
    });
    $("#saveWorkScheduleBtn")?.addEventListener("click", save);
    $("#saveWorkScheduleBottomBtn")?.addEventListener("click", save);
    $("#copyCompanyHoursBtn")?.addEventListener("click", () => applyToRows("week"));
    $("#applyAllDaysBtn")?.addEventListener("click", () => applyToRows("all"));
    $("#clearScheduleBtn")?.addEventListener("click", setFree);
    $("#downloadWorkScheduleBtn")?.addEventListener("click", downloadCsv);
    $$(".cm-work-schedule-editor input").forEach((input) => input.addEventListener("change", refreshDurations));
    $$('[data-edit-employee]').forEach((button) => button.addEventListener("click", () => {
      state.selectedEmployeeId = button.dataset.editEmployee;
      render();
      document.querySelector(".cm-work-schedule-editor-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$('[data-delete-employee]').forEach((button) => button.addEventListener("click", () => deleteSchedule(button.dataset.deleteEmployee)));
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
