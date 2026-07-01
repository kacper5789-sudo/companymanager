// CompanyManager — 121 Grafik: bezpieczny kreator zakresów, masowa edycja, podgląd zapisu
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

  function toIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function parseIsoDate(value) {
    const [y, m, d] = String(value || "").slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function addDays(date, amount) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(amount || 0));
    return d;
  }
  function monthStartIso(date) { return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)); }
  function monthEndIso(date) { return toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)); }
  function yearStartIso(date) { return toIsoDate(new Date(date.getFullYear(), 0, 1)); }
  function yearEndIso(date) { return toIsoDate(new Date(date.getFullYear(), 11, 31)); }
  function todayIso() { return toIsoDate(new Date()); }
  function minEditableIso() { return toIsoDate(addDays(new Date(), -7)); }
  function shiftedMonthIso(date, offset, end = false) {
    const d = new Date(date.getFullYear(), date.getMonth() + Number(offset || 0), 1);
    return end ? monthEndIso(d) : monthStartIso(d);
  }
  function startOfWeekIso(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return toIsoDate(d);
  }
  function endOfWeekIso(date) { return toIsoDate(addDays(parseIsoDate(startOfWeekIso(date)), 6)); }
  function dateRange(fromIso, toIso, maxDays = 370) {
    const start = parseIsoDate(fromIso);
    const end = parseIsoDate(toIso);
    if (!start || !end || start > end) return [];
    const rows = [];
    let d = new Date(start);
    while (d <= end && rows.length < maxDays) {
      rows.push(new Date(d));
      d = addDays(d, 1);
    }
    return rows;
  }
  function dayLabel(date) {
    const day = DAYS.find((item) => item.idx === date.getDay());
    return day?.short || "";
  }
  function formatDatePL(value) {
    const iso = typeof value === "string" ? value.slice(0, 10) : toIsoDate(value);
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}.${m}.${y}` : iso;
  }
  function dayOffStart(row) { return String(row?.start_date || row?.date_from || row?.date || "").slice(0, 10); }
  function dayOffEnd(row) { return String(row?.end_date || row?.date_to || row?.start_date || row?.date_from || row?.date || "").slice(0, 10); }
  function normalizeText(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function dayOffMatchesEmployee(row, employee) {
    if (!row || !employee) return false;
    const offEmployeeId = String(row.employee_id || "");
    if (offEmployeeId && offEmployeeId === String(employee.id || "")) return true;
    if (offEmployeeId && offEmployeeId === String(scheduleEmployeeId(employee) || "")) return true;
    if (offEmployeeId && offEmployeeId === String(employee.profile_id || "")) return true;
    const a = normalizeText(row.employee_name || row.full_name || "");
    const b = normalizeText(employeeName(employee));
    return !!a && !!b && a === b;
  }
  function dayOffFor(employee, iso) {
    return state.daysOff.find((row) => {
      const start = dayOffStart(row);
      const end = dayOffEnd(row) || start;
      return dayOffMatchesEmployee(row, employee) && start && iso >= start && iso <= end;
    }) || null;
  }
  function dayOffCell(row) {
    const source = `${row?.type || ""} ${row?.reason || ""} ${row?.description || ""}`;
    const raw = source.toLowerCase();
    if (raw.includes("zwol") || raw.includes("chorob") || raw.includes("lekars") || raw.includes("l4") || raw.includes("sick")) return "ZWOLNIENIE";
    if (raw.includes("urlop") || raw.includes("vacation") || raw.includes("holiday") || raw.includes("leave")) return "URLOP";
    const custom = String(row?.reason || row?.type || row?.description || "").trim();
    if (custom) return custom.toUpperCase().slice(0, 32);
    return "WOLNE";
  }


  function selectedEmployees() {
    const selected = Array.isArray(state.selectedEmployeeIds) ? state.selectedEmployeeIds.map(String) : [];
    const list = state.employees.filter((employee) => selected.includes(String(employee.id)));
    if (list.length) return list;
    const one = state.employees.find((employee) => String(employee.id) === String(state.selectedEmployeeId));
    return one ? [one] : [];
  }

  function collectWeeklyRowsFor(employee) {
    return $$(".cm-work-schedule-editor tbody tr").map((tr) => ({
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
  }

  function calculatePreviewForEmployee(employee, weeklyRows, dates) {
    let workingDays = 0;
    let workingMinutes = 0;
    let daysOff = 0;
    dates.forEach((date) => {
      const iso = toIsoDate(date);
      const template = weeklyRows.find((row) => Number(row.day_of_week) === Number(date.getDay()));
      if (!template || !template.is_working) return;
      if (dayOffFor(employee, iso)) { daysOff += 1; return; }
      const start = minutes(template.start_time);
      const end = minutes(template.end_time);
      if (start != null && end != null && end > start) {
        workingDays += 1;
        workingMinutes += end - start;
      }
    });
    return { workingDays, workingMinutes, daysOff };
  }

  function previewText(employees, weeklyRowsByEmployee, dates, existingCount, mode) {
    const from = formatDatePL(toIsoDate(dates[0]));
    const to = formatDatePL(toIsoDate(dates[dates.length - 1]));
    const summary = employees.map((employee) => {
      const rows = weeklyRowsByEmployee.get(String(employee.id)) || [];
      const p = calculatePreviewForEmployee(employee, rows, dates);
      const hours = Math.round((p.workingMinutes / 60) * 100) / 100;
      return `${employeeName(employee)}: ${p.workingDays} dni pracy, ${hours}h, dni wolne w zakresie: ${p.daysOff}`;
    }).join("\n");
    const modeLabel = mode === "overwrite" ? "NADPISZ cały zakres" : mode === "fill" ? "UZUPEŁNIJ tylko puste dni" : "USUŃ grafik w zakresie";
    return `Zakres: ${from} – ${to}\nTryb: ${modeLabel}\nPracownicy: ${employees.length}\n\n${summary}\n\nIstniejące wpisy grafiku w tym zakresie: ${existingCount}.\n\nKontynuować?`;
  }

  async function countExistingConcreteSchedules(employees, dates) {
    if (!employees.length || !dates.length) return 0;
    try {
      const ids = employees.map((e) => scheduleEmployeeId(e)).filter(Boolean);
      if (!ids.length) return 0;
      const { data, error } = await window.cmSupabase
        .from("work_schedule")
        .select("id, employee_id, date")
        .eq("company_id", state.ctx.companyId)
        .in("employee_id", ids)
        .gte("date", toIsoDate(dates[0]))
        .lte("date", toIsoDate(dates[dates.length - 1]));
      if (error) throw error;
      return (data || []).length;
    } catch (error) {
      console.warn("work_schedule existing count skipped", error?.message || error);
      return 0;
    }
  }


  let state = {
    ctx: null,
    employees: [],
    schedules: [],
    concreteSchedules: [],
    daysOff: [],
    selectedEmployeeId: "",
    selectedEmployeeIds: [],
    saveMode: "fill",
    finalFrom: monthStartIso(new Date()),
    finalTo: monthEndIso(new Date()),
    applyFrom: startOfWeekIso(new Date()),
    applyTo: endOfWeekIso(new Date()),
    finalPage: 1,
    finalPageSize: 50
  };

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

  function hasAnyPermission(ctx, keys) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return keys.some((key) => permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1");
  }

  function hasAccess(ctx) { return hasAnyPermission(ctx, ["open_work_schedule", "work_schedule"]); }
  function canAdd(ctx) { return hasAnyPermission(ctx, ["work_schedule_edit", "work_schedule_delete", "open_work_schedule", "work_schedule"]); }
  function canEdit(ctx) { return hasAnyPermission(ctx, ["work_schedule_edit"]); }
  function canDelete(ctx) { return hasAnyPermission(ctx, ["work_schedule_delete"]); }

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

    // company_team_members zwraca użytkowników/profiles. Tabela work_schedule ma FK do public.employees(id),
    // dlatego do zapisu grafiku potrzebujemy technicznego id z employees, a nie id profilu.
    // UI nadal używa employee.id jako id użytkownika, żeby nie ruszać widoku ani wyboru pracowników.
    let employeeRows = [];
    try {
      const employeesResponse = await window.cmSupabase
        .from("employees")
        .select("id, profile_id, full_name, role, active, company_id")
        .eq("company_id", ctx.companyId);
      if (!employeesResponse.error) employeeRows = employeesResponse.data || [];
      else console.warn("Grafik pracy employees mapping skipped", employeesResponse.error?.message || employeesResponse.error);
    } catch (mappingError) {
      console.warn("Grafik pracy employees mapping skipped", mappingError?.message || mappingError);
    }

    const byProfileId = new Map(employeeRows.filter((row) => row.profile_id).map((row) => [String(row.profile_id), row]));
    const byName = new Map(employeeRows.map((row) => [normalizeText(row.full_name || ""), row]).filter(([key]) => !!key));

    return (data || [])
      .filter((row) => normalizeRole(row.role) !== "OWNER")
      .map((row) => {
        const mapped = byProfileId.get(String(row.id)) || byName.get(normalizeText(employeeName(row))) || null;
        return {
          ...row,
          profile_id: row.id,
          work_schedule_employee_id: mapped?.id || row.employee_id || row.id,
          employee_record_id: mapped?.id || row.employee_id || null
        };
      })
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

  async function fetchConcreteSchedules(ctx) {
    try {
      const { data, error } = await window.cmSupabase
        .from("work_schedule")
        .select("id, company_id, employee_id, date, start_time, end_time, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Grafik pracy work_schedule skipped", error?.message || error);
      return [];
    }
  }



  async function fetchDaysOff(ctx) {
    const { data, error } = await window.cmSupabase
      .from("days_off")
      .select("id, company_id, employee_id, employee_name, type, start_date, end_date, date_from, date_to, reason, description, status, deleted_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null);
    if (error) {
      console.warn("Grafik pracy days_off skipped", error.message || error);
      return [];
    }
    return data || [];
  }

  function scheduleByEmployeeAndDay(employeeId, day) {
    return state.schedules.find((row) => String(row.employee_id) === String(employeeId) && Number(row.day_of_week) === Number(day.idx));
  }

  function concreteScheduleFor(employeeId, iso) {
    return state.concreteSchedules.find((row) => String(row.employee_id) === String(employeeId) && String(row.date || "").slice(0, 10) === String(iso).slice(0, 10));
  }

  function scheduleEmployeeId(employee) {
    return employee?.work_schedule_employee_id || employee?.employee_record_id || employee?.employee_id || employee?.id;
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
          ${canEdit(state.ctx) ? `<button type="button" class="bm-light-btn" data-edit-employee="${escapeHtml(employee.id)}">Edytuj</button>` : ""}
          ${canDelete(state.ctx) ? `<button type="button" class="bm-danger-btn" data-delete-employee="${escapeHtml(employee.id)}">Usuń</button>` : ""}
        </td>
      </tr>`;
    }).join("");
  }


  function finalCell(employee, date) {
    const iso = toIsoDate(date);
    const off = dayOffFor(employee, iso);
    if (off) return dayOffCell(off);
    const schedule = concreteScheduleFor(scheduleEmployeeId(employee), iso);
    if (!schedule) return "—";
    const start = time(schedule.start_time, "");
    const end = time(schedule.end_time, "");
    if (!start || !end) return "WOLNE";
    return `${start}-${end}`;
  }

  function finalScheduleRowsHtml() {
    const dates = dateRange(state.finalFrom, state.finalTo, 370);
    if (!dates.length) return `<tr><td colspan="${state.employees.length + 1}">Wybierz poprawny zakres dat.</td></tr>`;
    const pageSize = Number(state.finalPageSize || 50);
    const totalPages = Math.max(1, Math.ceil(dates.length / pageSize));
    state.finalPage = Math.min(Math.max(1, Number(state.finalPage || 1)), totalPages);
    const startIndex = (state.finalPage - 1) * pageSize;
    const visibleDates = dates.slice(startIndex, startIndex + pageSize);
    return visibleDates.map((date) => {
      const iso = toIsoDate(date);
      return `<tr>
        <td class="cm-work-date-day"><strong>${escapeHtml(formatDatePL(iso))}</strong><span>${escapeHtml(dayLabel(date))}</span></td>
        ${state.employees.map((employee) => {
          const off = dayOffFor(employee, iso);
          const cell = off ? dayOffCell(off) : finalCell(employee, date);
          const cls = off || /URLOP|ZWOLNIENIE|WOLNE/.test(cell) ? " cm-work-final-off" : "";
          const title = off ? `Dni wolne: ${dayOffCell(off)}` : "";
          return `<td class="${cls}" title="${escapeHtml(title)}">${escapeHtml(cell)}</td>`;
        }).join("")}
      </tr>`;
    }).join("");
  }

  function finalSchedulePagerHtml() {
    const dates = dateRange(state.finalFrom, state.finalTo, 370);
    const total = dates.length;
    const pageSize = Number(state.finalPageSize || 50);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.finalPage = Math.min(Math.max(1, Number(state.finalPage || 1)), totalPages);
    const from = total ? ((state.finalPage - 1) * pageSize + 1) : 0;
    const to = Math.min(total, state.finalPage * pageSize);
    return `<div class="cm-work-final-pager">
      <div class="cm-work-page-size">
        <label>Na stronę
          <select id="finalSchedulePageSize">
            ${[50, 100, 200].map((size) => `<option value="${size}" ${Number(state.finalPageSize) === size ? "selected" : ""}>${size}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="cm-work-page-status">Pozycje od ${from} do ${to} z ${total}</div>
      <div class="cm-work-page-buttons">
        <button type="button" id="finalSchedulePrevPage" class="bm-light-btn cm-work-btn" ${state.finalPage <= 1 ? "disabled" : ""}>‹</button>
        <span>${state.finalPage} z ${totalPages}</span>
        <button type="button" id="finalScheduleNextPage" class="bm-light-btn cm-work-btn" ${state.finalPage >= totalPages ? "disabled" : ""}>›</button>
      </div>
    </div>`;
  }

  function finalScheduleTableHtml() {
    return `<section class="cm-work-final-section">
      <div class="cm-section-title-row">
        <h3 class="cm-section-title">Grafik wynikowy</h3>
      </div>
      <p class="bm-muted">Finalny grafik po połączeniu szablonu tygodniowego z dniami wolnymi. Każdy wpis w Dni wolne nadpisuje plan pracy: urlop, zwolnienie, szkolenie, inne lub własny powód.</p>
      <div class="cm-work-schedule-controls cm-work-final-controls">
        <label>Od<input type="date" class="cm-modern-date" id="finalScheduleFrom" value="${escapeHtml(state.finalFrom)}"></label>
        <label>Do<input type="date" class="cm-modern-date" id="finalScheduleTo" value="${escapeHtml(state.finalTo)}"></label>
        <button type="button" id="finalSchedulePrevMonthBtn" class="bm-light-btn cm-work-btn">Poprzedni miesiąc</button>
        <button type="button" id="finalScheduleCurrentMonthBtn" class="bm-light-btn cm-work-btn">Obecny miesiąc</button>
        <button type="button" id="finalScheduleNextMonthBtn" class="bm-light-btn cm-work-btn">Kolejny miesiąc</button>
        <button type="button" id="finalScheduleYearBtn" class="bm-light-btn cm-work-btn">Ten rok</button>
        <button type="button" id="downloadFinalScheduleBtn" class="bm-light-btn cm-work-btn cm-work-btn-download">Pobierz grafik wynikowy</button>
      </div>
      ${finalSchedulePagerHtml()}
      <div class="bm-table-wrap cm-work-final-wrap">
        <table class="bm-table cm-work-final-table">
          <thead><tr><th class="cm-work-date-day-head">Data / dzień</th>${state.employees.map((e) => `<th>${escapeHtml(employeeName(e))}</th>`).join("")}</tr></thead>
          <tbody>${finalScheduleRowsHtml()}</tbody>
        </table>
      </div>
    </section>`;
  }

  function render() {
    const target = area();
    if (!target) return;
    if (!state.employees.length) {
      target.innerHTML = `<section class="bm-page-card"><h2>Grafik pracy</h2><p class="bm-muted">Brak pracowników w firmie.</p></section>`;
      return;
    }
    if (!state.selectedEmployeeId) state.selectedEmployeeId = state.employees[0].id;
    if (!Array.isArray(state.selectedEmployeeIds) || !state.selectedEmployeeIds.length) state.selectedEmployeeIds = [state.selectedEmployeeId];
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
          <div class="cm-work-panel-title">Kreator ustawiania grafiku</div>
          <div class="cm-work-apply-range-card cm-work-solid-card">
            <div class="cm-work-apply-range-title">Pracownicy do aktualizacji</div>
            <div class="cm-work-employee-multi" id="workScheduleEmployeeMulti">
              ${state.employees.map((emp) => `<label class="cm-work-employee-pill"><input type="checkbox" data-employee-multi value="${escapeHtml(emp.id)}" ${(state.selectedEmployeeIds || []).map(String).includes(String(emp.id)) ? "checked" : ""}> <span>${escapeHtml(employeeName(emp))}</span></label>`).join("")}
            </div>
            <p class="bm-muted cm-work-range-hint">Możesz zastosować ten sam grafik dla jednego lub wielu pracowników naraz.</p>
          </div>
          <div class="cm-work-apply-range-card cm-work-solid-card">
            <div class="cm-work-apply-range-title">Zakres ustawiania grafiku</div>
            <div class="cm-work-schedule-controls cm-work-range-controls">
              <label>Od<input type="date" class="cm-modern-date" id="workScheduleApplyFrom" min="${escapeHtml(minEditableIso())}" value="${escapeHtml(state.applyFrom)}"></label>
              <label>Do<input type="date" class="cm-modern-date" id="workScheduleApplyTo" min="${escapeHtml(minEditableIso())}" value="${escapeHtml(state.applyTo)}"></label>
              <button type="button" id="applyRangeWeekBtn" class="bm-light-btn cm-work-btn cm-work-btn-neutral">Ustaw na ten tydzień</button>
              <button type="button" id="applyRangeMonthBtn" class="bm-light-btn cm-work-btn cm-work-btn-neutral">Ustaw na ten miesiąc</button>
              <button type="button" id="applyRangeYearBtn" class="bm-light-btn cm-work-btn cm-work-btn-neutral">Ustaw na ten rok</button>
            </div>
            <p class="bm-muted cm-work-range-hint">Edycja jest bezpieczna: można ustawiać grafik od maksymalnie 7 dni wstecz względem dzisiejszej daty. Starszy grafik jest chroniony, bo wpływa na raporty.</p>
          </div>
          <div class="cm-work-apply-range-card cm-work-solid-card">
            <div class="cm-work-apply-range-title">Tryb zapisu</div>
            <div class="cm-work-save-modes">
              <label><input type="radio" name="workScheduleSaveMode" value="fill" ${state.saveMode === "fill" ? "checked" : ""}> Uzupełnij tylko puste dni</label>
              <label><input type="radio" name="workScheduleSaveMode" value="overwrite" ${state.saveMode === "overwrite" ? "checked" : ""}> Nadpisz cały zakres</label>
              <label><input type="radio" name="workScheduleSaveMode" value="delete" ${state.saveMode === "delete" ? "checked" : ""}> Usuń grafik w zakresie</label>
            </div>
          </div>
          <div class="cm-work-schedule-controls cm-work-solid-controls">
            <label>Pracuje od<input type="time" id="quickStartTime" value="08:00"></label>
            <label>Pracuje do<input type="time" id="quickEndTime" value="16:00"></label>
            <label>Przerwa od<input type="time" id="quickBreakStart" value=""></label>
            <label>Przerwa do<input type="time" id="quickBreakEnd" value=""></label>
          </div>
          <div class="cm-work-actions-bar">
            ${canEdit(state.ctx) ? `<button type="button" id="copyCompanyHoursBtn" class="bm-light-btn cm-work-btn cm-work-btn-neutral">Zastosuj pn-pt</button>` : ""}
            ${canEdit(state.ctx) ? `<button type="button" id="applyAllDaysBtn" class="bm-light-btn cm-work-btn cm-work-btn-neutral">Zastosuj cały tydzień</button>` : ""}
            ${canDelete(state.ctx) ? `<button type="button" id="clearScheduleBtn" class="bm-danger-btn cm-work-btn cm-work-btn-danger">Ustaw wolne</button>` : ""}
          </div>
          <div id="workSchedulePreview" class="cm-work-preview-box">Przed zapisem zobaczysz podsumowanie: dni pracy, godziny, dni wolne oraz istniejące wpisy w wybranym zakresie.</div><p id="workScheduleMessage" class="panel-message"></p>
        </section>
      </div>

      <div class="bm-table-wrap cm-work-schedule-editor-wrap">
        <table class="bm-table cm-work-schedule-editor">
          <thead><tr><th>Dzień</th><th>Status</th><th>Pracuje od</th><th>Pracuje do</th><th>Przerwa od</th><th>Przerwa do</th><th>Czas</th></tr></thead>
          <tbody>${DAYS.map((day) => dayRow(employee, day)).join("")}</tbody>
        </table>
      </div>

      <div class="cm-work-bottom-actions">
        ${canEdit(state.ctx) ? `<button type="button" id="saveWorkScheduleBottomBtn" class="bm-primary-btn cm-save-schedule-btn cm-work-btn cm-work-btn-save">Zapisz grafik w zakresie</button>` : ""}
      </div>

      ${finalScheduleTableHtml()}
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
    if (!canEdit(state.ctx)) return message("Brak uprawnienia: grafik pracy — edycja", false);
    const employees = selectedEmployees();
    if (!employees.length) return message("Wybierz przynajmniej jednego pracownika.", false);
    const mode = document.querySelector('input[name="workScheduleSaveMode"]:checked')?.value || state.saveMode || "fill";
    state.saveMode = mode;
    try {
      const range = selectedApplyDates();
      state.applyFrom = range.from;
      state.applyTo = range.to;
      const weeklyRowsByEmployee = new Map();
      employees.forEach((employee) => {
        const rows = collectWeeklyRowsFor(employee);
        validateRows(rows);
        weeklyRowsByEmployee.set(String(employee.id), rows);
      });
      const existingCount = await countExistingConcreteSchedules(employees, range.dates);
      if (!confirm(previewText(employees, weeklyRowsByEmployee, range.dates, existingCount, mode))) {
        message("Zapis grafiku anulowany.", false);
        return;
      }

      let totalInserted = 0;
      let totalSkippedDaysOff = 0;
      let totalOverwritten = 0;
      let totalDeleted = 0;

      for (const employee of employees) {
        const rows = weeklyRowsByEmployee.get(String(employee.id));
        if (mode !== "delete") {
          const { error } = await window.cmSupabase
            .from("employee_work_schedules")
            .upsert(rows, { onConflict: "company_id,employee_id,day_of_week" });
          if (error) throw error;
        }
        const result = await saveConcreteSchedule(employee, rows, range.dates, mode);
        totalInserted += result.inserted || 0;
        totalSkippedDaysOff += result.daysOff || 0;
        totalOverwritten += result.overwritten || 0;
        totalDeleted += result.deleted || 0;
      }

      state.schedules = await fetchSchedules(state.ctx);
      state.concreteSchedules = await fetchConcreteSchedules(state.ctx);
      state.daysOff = await fetchDaysOff(state.ctx);
      state.finalFrom = range.from;
      state.finalTo = range.to;
      message(`Gotowe. Zapisano ${totalInserted} dni pracy. Pominięto/nadpisano wolnym ${totalSkippedDaysOff} dni wolnych. Nadpisano ${totalOverwritten} wpisów. Usunięto ${totalDeleted} wpisów.`);
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


  function setApplyRange(from, to) {
    if (from) state.applyFrom = from;
    if (to) state.applyTo = to;
    render();
    document.querySelector("#workScheduleApplyFrom")?.focus?.();
  }

  function applyRangePreset(kind) {
    const now = new Date();
    const min = minEditableIso();
    if (kind === "week") return setApplyRange(maxIso(startOfWeekIso(now), min), endOfWeekIso(now));
    if (kind === "month") return setApplyRange(maxIso(monthStartIso(now), min), monthEndIso(now));
    if (kind === "year") return setApplyRange(maxIso(yearStartIso(now), min), yearEndIso(now));
  }
  function maxIso(a, b) { return a > b ? a : b; }

  function selectedApplyDates() {
    const from = $("#workScheduleApplyFrom")?.value || state.applyFrom;
    const to = $("#workScheduleApplyTo")?.value || state.applyTo;
    const min = minEditableIso();
    if (from < min) {
      throw new Error(`Nie można edytować grafiku starszego niż ${formatDatePL(min)}. Starsze wpisy są zablokowane, bo wpływają na raporty.`);
    }
    if (to < from) throw new Error("Data 'Do' nie może być wcześniejsza niż data 'Od'.");
    const dates = dateRange(from, to, 370);
    if (!dates.length) throw new Error("Wybierz poprawny zakres dat dla ustawianego grafiku.");
    return { from, to, dates };
  }

  async function saveConcreteSchedule(employee, weeklyRows, dates, mode = "fill") {
    const fromIso = toIsoDate(dates[0]);
    const toIso = toIsoDate(dates[dates.length - 1]);
    const employeeId = scheduleEmployeeId(employee);
    const result = { inserted: 0, daysOff: 0, overwritten: 0, deleted: 0 };

    if (!employeeId) throw new Error(`Nie można ustalić technicznego ID pracownika dla grafiku: ${employeeName(employee)}`);

    const existingResponse = await window.cmSupabase
      .from("work_schedule")
      .select("id, date")
      .eq("company_id", state.ctx.companyId)
      .eq("employee_id", employeeId)
      .gte("date", fromIso)
      .lte("date", toIso);
    if (existingResponse.error) throw existingResponse.error;

    const existing = existingResponse.data || [];
    const existingByDate = new Map(existing.map((row) => [String(row.date || "").slice(0, 10), row]));
    result.overwritten = existing.length;

    if (mode === "delete") {
      const { error } = await window.cmSupabase
        .from("work_schedule")
        .delete()
        .eq("company_id", state.ctx.companyId)
        .eq("employee_id", employeeId)
        .gte("date", fromIso)
        .lte("date", toIso);
      if (error) throw error;
      result.deleted = existing.length;
      return result;
    }

    const rowsByDate = new Map();
    dates.forEach((date) => {
      const iso = toIsoDate(date);
      if (mode === "fill" && existingByDate.has(iso)) return;
      const template = weeklyRows.find((row) => Number(row.day_of_week) === Number(date.getDay()));
      if (!template || !template.is_working) return;
      const off = dayOffFor(employee, iso);
      if (off) { result.daysOff += 1; return; }
      rowsByDate.set(iso, {
        company_id: state.ctx.companyId,
        employee_id: employeeId,
        date: iso,
        start_time: template.start_time,
        end_time: template.end_time,
        updated_at: new Date().toISOString()
      });
    });

    for (const row of rowsByDate.values()) {
      const existingRow = existingByDate.get(row.date);

      if (existingRow) {
        const { error } = await window.cmSupabase
          .from("work_schedule")
          .update({
            start_time: row.start_time,
            end_time: row.end_time,
            updated_at: row.updated_at
          })
          .eq("id", existingRow.id);
        if (error) throw error;
        result.inserted += 1;
        continue;
      }

      const insertPayload = {
        company_id: row.company_id,
        employee_id: row.employee_id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        created_at: new Date().toISOString(),
        updated_at: row.updated_at
      };

      const { error: insertError } = await window.cmSupabase
        .from("work_schedule")
        .insert(insertPayload);

      if (!insertError) {
        result.inserted += 1;
        continue;
      }

      // 409/23505 może się pojawić, gdy rekord powstał między SELECT a INSERT.
      // Wtedy nie przerywamy — odszukujemy rekord i robimy UPDATE.
      const conflictText = `${insertError.code || ""} ${insertError.message || ""} ${insertError.details || ""}`.toLowerCase();
      if (String(insertError.code || "") === "23505" || conflictText.includes("duplicate") || conflictText.includes("conflict")) {
        const retry = await window.cmSupabase
          .from("work_schedule")
          .select("id")
          .eq("company_id", row.company_id)
          .eq("employee_id", row.employee_id)
          .eq("date", row.date)
          .maybeSingle();
        if (retry.error) throw retry.error;
        if (retry.data?.id) {
          const { error: updateError } = await window.cmSupabase
            .from("work_schedule")
            .update({
              start_time: row.start_time,
              end_time: row.end_time,
              updated_at: row.updated_at
            })
            .eq("id", retry.data.id);
          if (updateError) throw updateError;
          result.inserted += 1;
          continue;
        }
      }

      throw insertError;
    }

    return result;
  }

  function applyToRows(mode) {
    if (!canEdit(state.ctx)) return message("Brak uprawnienia: grafik pracy — edycja", false);
    const q = quickValues();
    $$(".cm-work-schedule-editor tbody tr").forEach((tr) => {
      const day = Number(tr.dataset.day);
      const weekend = day === 0 || day === 6;
      const working = $("[data-working]", tr);
      if (mode === "week" && weekend) {
        if (working) working.checked = false;
        return;
      }
      if (working) working.checked = true;
      const start = $("[data-start]", tr); if (start) start.value = q.start;
      const end = $("[data-end]", tr); if (end) end.value = q.end;
      const bs = $("[data-break-start]", tr); if (bs) bs.value = q.breakStart;
      const be = $("[data-break-end]", tr); if (be) be.value = q.breakEnd;
    });
    refreshDurations();
  }

  function setFree() {
    if (!canDelete(state.ctx)) return message("Brak uprawnienia: grafik pracy — usuwanie", false);
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
    if (!canDelete(state.ctx)) return message("Brak uprawnienia: grafik pracy — usuwanie", false);
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
      state.concreteSchedules = await fetchConcreteSchedules(state.ctx);
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



  function downloadFinalCsv() {
    const dates = dateRange(state.finalFrom, state.finalTo, 370);
    const header = ["Data / dzień", ...state.employees.map(employeeName)];
    const rows = [header];
    dates.forEach((date) => {
      rows.push([`${formatDatePL(date)} ${dayLabel(date)}`, ...state.employees.map((employee) => finalCell(employee, date))]);
    });
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `grafik-wynikowy-${state.finalFrom}-${state.finalTo}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function updateFinalRange(from, to) {
    if (from) state.finalFrom = from;
    if (to) state.finalTo = to;
    state.finalPage = 1;
    render();
    document.querySelector(".cm-work-final-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindEvents() {
    $$('[data-employee-multi]').forEach((input) => input.addEventListener("change", () => {
      state.selectedEmployeeIds = $$('[data-employee-multi]:checked').map((el) => el.value);
    }));
    $$('input[name="workScheduleSaveMode"]').forEach((input) => input.addEventListener("change", (event) => { state.saveMode = event.currentTarget.value; }));
    $("#saveWorkScheduleBottomBtn")?.addEventListener("click", save);
    $("#workScheduleApplyFrom")?.addEventListener("change", (event) => { state.applyFrom = event.currentTarget.value; });
    $("#workScheduleApplyTo")?.addEventListener("change", (event) => { state.applyTo = event.currentTarget.value; });
    $("#applyRangeWeekBtn")?.addEventListener("click", () => applyRangePreset("week"));
    $("#applyRangeMonthBtn")?.addEventListener("click", () => applyRangePreset("month"));
    $("#applyRangeYearBtn")?.addEventListener("click", () => applyRangePreset("year"));
    $("#copyCompanyHoursBtn")?.addEventListener("click", () => applyToRows("week"));
    $("#applyAllDaysBtn")?.addEventListener("click", () => applyToRows("all"));
    $("#clearScheduleBtn")?.addEventListener("click", setFree);
    $("#downloadWorkScheduleBtn")?.addEventListener("click", downloadCsv);
    $("#finalScheduleFrom")?.addEventListener("change", (event) => { state.finalFrom = event.currentTarget.value; state.finalPage = 1; render(); });
    $("#finalScheduleTo")?.addEventListener("change", (event) => { state.finalTo = event.currentTarget.value; state.finalPage = 1; render(); });
    $("#finalSchedulePrevMonthBtn")?.addEventListener("click", () => { const now = new Date(); updateFinalRange(shiftedMonthIso(now, -1), shiftedMonthIso(now, -1, true)); });
    $("#finalScheduleCurrentMonthBtn")?.addEventListener("click", () => { const now = new Date(); updateFinalRange(monthStartIso(now), monthEndIso(now)); });
    $("#finalScheduleNextMonthBtn")?.addEventListener("click", () => { const now = new Date(); updateFinalRange(shiftedMonthIso(now, 1), shiftedMonthIso(now, 1, true)); });
    $("#finalScheduleYearBtn")?.addEventListener("click", () => { const now = new Date(); updateFinalRange(yearStartIso(now), yearEndIso(now)); });
    $("#finalSchedulePageSize")?.addEventListener("change", (event) => { state.finalPageSize = Number(event.currentTarget.value || 50); state.finalPage = 1; render(); document.querySelector(".cm-work-final-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#finalSchedulePrevPage")?.addEventListener("click", () => { state.finalPage = Math.max(1, Number(state.finalPage || 1) - 1); render(); document.querySelector(".cm-work-final-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#finalScheduleNextPage")?.addEventListener("click", () => { state.finalPage = Number(state.finalPage || 1) + 1; render(); document.querySelector(".cm-work-final-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#downloadFinalScheduleBtn")?.addEventListener("click", downloadFinalCsv);
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
        const [employees, schedules, concreteSchedules, daysOff] = await Promise.all([fetchEmployees(state.ctx), fetchSchedules(state.ctx), fetchConcreteSchedules(state.ctx), fetchDaysOff(state.ctx)]);
        state.employees = employees;
        state.schedules = schedules;
        state.concreteSchedules = concreteSchedules;
        state.daysOff = daysOff;
        state.selectedEmployeeId = employees[0]?.id || "";
        state.selectedEmployeeIds = state.selectedEmployeeId ? [state.selectedEmployeeId] : [];
        render();
      } catch (error) {
        showError(error.message || String(error));
      }
    }, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
