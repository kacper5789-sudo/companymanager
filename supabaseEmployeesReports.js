// CompanyManager — 048G Employees reports remove unassigned duplicates fix
// employeesraports.html: realne dane z profiles / clients / appointments / sales / sale_items / days_off.
(function () {
  if (document.body?.dataset?.panelPage !== "employeesReports") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function employeeKeyByName(value) {
    return normalize(value || "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "brak";
  }

  function injectStyles() {
    if (document.getElementById("cmEmployeesReportsStyle")) return;
    const style = document.createElement("style");
    style.id = "cmEmployeesReportsStyle";
    style.textContent = `
      .cm-employees-report-page{--cm-er-line:rgba(148,163,184,.16);--cm-er-soft:rgba(15,23,42,.72);--cm-er-glass:rgba(255,255,255,.055);}
      .cm-employees-report-page .customers-head{align-items:flex-start;margin-bottom:18px;}
      .cm-employees-report-page .customers-head h2{font-size:22px;letter-spacing:-.035em;margin:0;color:#f8fafc;}
      .cm-employees-report-page .cm-er-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0 18px;}
      .cm-employees-report-page .cm-er-card{padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.035));box-shadow:0 18px 55px rgba(0,0,0,.18);backdrop-filter:blur(18px);}
      .cm-employees-report-page .cm-er-card span{display:block;color:rgba(255,255,255,.64);font-size:12px;margin-bottom:6px;font-weight:800;letter-spacing:.02em;}
      .cm-employees-report-page .cm-er-card strong{font-size:24px;line-height:1.2;color:#fff;}
      .cm-employees-report-page .cm-er-filters{display:grid;grid-template-columns:minmax(150px,190px) minmax(150px,190px) minmax(190px,240px) auto;align-items:end;gap:12px;margin:12px 0 18px;padding:14px;border:1px solid var(--cm-er-line);border-radius:18px;background:linear-gradient(180deg,rgba(15,23,42,.74),rgba(2,6,23,.44));box-shadow:0 16px 45px rgba(0,0,0,.16);}
      .cm-employees-report-page .cm-er-filters label{display:grid;gap:7px;color:rgba(255,255,255,.72);font-size:12px;font-weight:800;letter-spacing:.02em;}
      .cm-employees-report-page .cm-er-filters input[type="date"],.cm-employees-report-page .cm-er-filters select{height:43px;min-width:0;width:100%;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:rgba(2,6,23,.58);color:#e5eefb;padding:0 42px 0 13px;outline:none;font:inherit;font-weight:700;color-scheme:dark;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);} .cm-employees-report-page .cm-er-filters select{appearance:auto;padding-right:12px;cursor:pointer;}
      .cm-employees-report-page .cm-er-filters input[type="date"]:focus,.cm-employees-report-page .cm-er-filters select:focus{border-color:rgba(56,189,248,.72);box-shadow:0 0 0 3px rgba(56,189,248,.12);}
      .cm-employees-report-page .cm-er-filters input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1) brightness(1.65);opacity:.9;cursor:pointer;}
      .cm-er-employee-filter{grid-column:1/-1;display:grid;gap:9px;padding:12px;border:1px solid rgba(148,163,184,.16);border-radius:16px;background:rgba(2,6,23,.32);}
      .cm-er-employee-filter .cm-er-employee-title{color:rgba(255,255,255,.72);font-size:12px;font-weight:900;letter-spacing:.02em;}
      .cm-er-employee-options{display:flex;flex-wrap:wrap;gap:8px;}
      .cm-er-employee-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(148,163,184,.18);border-radius:999px;background:rgba(255,255,255,.055);color:#e5eefb;font-size:12px;font-weight:850;cursor:pointer;user-select:none;}
      .cm-er-employee-chip input{accent-color:#60a5fa;}
      .cm-er-employee-chip:has(input:checked){border-color:rgba(96,165,250,.55);background:rgba(37,99,235,.22);}
      .cm-employees-report-page #erShowBtn{height:43px;min-width:92px;max-width:120px;border:1px solid rgba(59,130,246,.36);border-radius:14px;background:linear-gradient(180deg,rgba(59,130,246,.34),rgba(37,99,235,.18));color:#eff6ff;font-weight:900;padding:0 18px;cursor:pointer;box-shadow:0 16px 42px rgba(37,99,235,.18);backdrop-filter:blur(12px);}
      .cm-employees-report-page #erShowBtn:hover{border-color:rgba(125,211,252,.55);background:linear-gradient(180deg,rgba(59,130,246,.44),rgba(37,99,235,.26));}
      .cm-er-section{margin-top:18px;}
      .cm-er-section .bm-page-head{margin:0 0 10px;}
      .cm-er-section .bm-page-head h3{margin:0;font-size:16px;color:#eaf2ff;letter-spacing:-.02em;}
      .cm-er-table-card{border:1px solid var(--cm-er-line);border-radius:18px;background:linear-gradient(180deg,rgba(15,23,42,.68),rgba(2,6,23,.38));padding:12px;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.16);}
      .cm-er-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
      .cm-er-toolbar-left,.cm-er-toolbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .cm-er-toolbar label{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.72);font-size:13px;font-weight:800;}
      .cm-er-limit,.cm-er-search{height:40px;border:1px solid rgba(148,163,184,.22);border-radius:13px;background:rgba(2,6,23,.6);color:#e5eefb;font:inherit;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.035);}
      .cm-er-limit{min-width:86px;padding:0 34px 0 12px;font-weight:900;color-scheme:dark;}
      .cm-er-search{min-width:220px;padding:0 13px;}
      .cm-er-limit:focus,.cm-er-search:focus{border-color:rgba(56,189,248,.72);box-shadow:0 0 0 3px rgba(56,189,248,.12);}
      .cm-er-table-wrap{overflow-x:auto;border:1px solid rgba(148,163,184,.12);border-radius:15px;background:rgba(2,6,23,.24);}
      .cm-er-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;min-width:880px;}
      .cm-er-table th,.cm-er-table td{padding:10px 10px;text-align:center;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.075);white-space:normal;word-break:normal;line-height:1.25;}
      .cm-er-table th{font-size:11px;line-height:1.15;color:rgba(219,234,254,.82);font-weight:900;background:rgba(37,99,235,.12);text-transform:uppercase;letter-spacing:.045em;}
      .cm-er-table td{font-size:13px;color:rgba(255,255,255,.88);}
      .cm-er-table tbody tr:hover td{background:rgba(56,189,248,.055);}
      .cm-er-table td:first-child,.cm-er-table th:first-child{text-align:left;width:20%;}
      .cm-er-table tfoot td{font-weight:900;background:rgba(255,255,255,.055);color:#fff;border-bottom:0;}
      .cm-er-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:11px;color:rgba(255,255,255,.62);font-size:12px;}
      .cm-er-pager{display:flex;align-items:center;gap:8px;}
      .cm-er-pager button{min-width:34px;height:32px;padding:0 10px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(255,255,255,.055);color:#e5eefb;font-weight:900;cursor:pointer;}
      .cm-er-pager button:hover:not(:disabled){border-color:rgba(56,189,248,.45);background:rgba(37,99,235,.18);}
      .cm-er-pager button:disabled{opacity:.42;cursor:not-allowed;}
      .cm-er-pager strong{min-width:54px;text-align:center;color:#dbeafe;}
      .cm-er-error{padding:16px;border:1px solid rgba(255,90,90,.35);background:rgba(255,70,70,.08);border-radius:16px;color:#fff;}
      @media(max-width:900px){.cm-employees-report-page .cm-er-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.cm-employees-report-page .cm-er-filters{grid-template-columns:1fr;}.cm-er-toolbar{align-items:stretch;}.cm-er-toolbar-left,.cm-er-toolbar-right,.cm-er-toolbar label{width:100%;}.cm-er-search{width:100%;min-width:0;}.cm-er-footer{justify-content:center;text-align:center;}.cm-er-footer [data-er-info]{width:100%;}}    `;
    document.head.appendChild(style);
  }

  function getRoot() {
    return $(".bm-panel-area") || $("#dashboardRoot") || $("#panelAppRoot") || document.body;
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function defaultDates() {
    const now = new Date();
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }


  function addMonths(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }

  function rangePreset(value) {
    const today = new Date();
    const to = iso(today);
    const start = new Date(today);
    switch (String(value || "custom")) {
      case "week": start.setDate(today.getDate() - 6); break;
      case "2weeks": start.setDate(today.getDate() - 13); break;
      case "month": start.setMonth(today.getMonth() - 1); start.setDate(start.getDate() + 1); break;
      case "2months": return { from: iso(addMonths(today, -2)), to };
      case "quarter": return { from: iso(addMonths(today, -3)), to };
      case "6months": return { from: iso(addMonths(today, -6)), to };
      case "12months": return { from: iso(addMonths(today, -12)), to };
      case "18months": return { from: iso(addMonths(today, -18)), to };
      case "24months": return { from: iso(addMonths(today, -24)), to };
      case "36months": return { from: iso(addMonths(today, -36)), to };
      default: return null;
    }
    return { from: iso(start), to };
  }

  function rangeOptions(selected) {
    const opts = [
      ["custom", "Własny zakres"],
      ["week", "Tydzień"],
      ["2weeks", "2 tygodnie"],
      ["month", "Miesiąc"],
      ["2months", "2 miesiące"],
      ["quarter", "Kwartał"],
      ["6months", "6 miesięcy"],
      ["12months", "12 miesięcy"],
      ["18months", "18 miesięcy"],
      ["24months", "24 miesiące"],
      ["36months", "36 miesięcy"]
    ];
    return opts.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = String(value).slice(0, 10);
    const parts = raw.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function inRange(value, from, to) {
    const d = parseDate(value);
    const f = parseDate(from);
    const t = parseDate(to);
    if (!d || !f || !t) return false;
    return d.getTime() >= f.getTime() && d.getTime() <= t.getTime();
  }

  function employeeName(employee, fallback = "") {
    return employee?.full_name || employee?.fullName || employee?.name || employee?.email || fallback || "(brak)";
  }

  function rowEmployeeName(row, employeeById) {
    const id = row?.employee_id || row?.employeeId || "";
    return employeeName(employeeById.get(id), row?.employee_name || row?.employeeName || "(brak)");
  }

  function saleDate(row) {
    return row?.created_at || row?.sale_date || row?.paid_at || row?.updated_at || row?.date;
  }

  function appointmentDate(row) {
    return row?.starts_at || row?.appointment_datetime || row?.date || row?.created_at;
  }

  function isFinishedAppointment(row) {
    const status = String(row?.status || "").toLowerCase();
    return row?.finished === true || ["zakończone", "zakończona", "completed"].includes(status);
  }

  function isCancelledAppointment(row) {
    const status = String(row?.status || "").toLowerCase();
    return row?.is_cancelled === true || row?.cancelled === true || ["odwołane", "odwołana", "cancelled", "usunięte", "deleted"].includes(status);
  }

  function itemValue(item, sale) {
    return Number(item?.total_price ?? item?.total ?? 0) || (Number(item?.quantity || 1) * Number(item?.unit_price || 0)) || Number(sale?.total_gross || sale?.total_net || 0) || 0;
  }

  function itemQty(item) {
    return Number(item?.quantity || 1) || 1;
  }

  function appointmentMinutes(row) {
    const direct = Number(row?.duration_minutes || row?.duration || 0);
    if (direct > 0) return direct;
    const startRaw = row?.starts_at || row?.appointment_datetime;
    const endRaw = row?.ends_at;
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return Math.round((end - start) / 60000);
    }
    return 0;
  }


  function timeToMinutes(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function rangeMinutes(startValue, endValue) {
    const start = timeToMinutes(startValue);
    const end = timeToMinutes(endValue);
    if (start === null || end === null) return 0;
    return Math.max(0, end - start);
  }

  function scheduleMinutes(row) {
    const directHours = Number(row?.hours || row?.work_hours || row?.planned_hours || row?.scheduled_hours || 0);
    if (directHours > 0) return Math.round(directHours * 60);
    const directMinutes = Number(row?.minutes || row?.work_minutes || row?.planned_minutes || row?.scheduled_minutes || 0);
    if (directMinutes > 0) return Math.round(directMinutes);
    return rangeMinutes(
      row?.start_time || row?.time_from || row?.hour_from || row?.from_time || row?.starts_at,
      row?.end_time || row?.time_to || row?.hour_to || row?.to_time || row?.ends_at
    );
  }

  function countWeekdayInRange(from, to, jsDay) {
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end) return 0;
    let count = 0;
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (d <= last) {
      if (d.getDay() === Number(jsDay)) count += 1;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  function employeeSchedulePeriodMinutes(row, from, to) {
    if (row?.is_working === false) return 0;
    const oneDay = scheduleMinutes(row);
    if (!oneDay) return 0;
    return oneDay * countWeekdayInRange(from, to, Number(row.day_of_week));
  }

  function formatMinutes(totalMinutes) {
    const minutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}min`;
    if (h) return `${h}h`;
    return `${m}min`;
  }

  function percent(part, total) {
    const value = Number(total || 0) ? (Number(part || 0) / Number(total || 0)) * 100 : 0;
    return `${value.toFixed(1)}%`;
  }

  function clientCreatedDate(row) {
    return row?.created_at || row?.createdAt || row?.created || row?.date_added || row?.registered_at;
  }

  function normalizeRole(role) { return String(role || "").trim().toUpperCase(); }
  function normalizePermissions(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  function hasAccess(access, context) {
    const role = normalizeRole(access?.role || context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(access?.permissions || context?.permissions);
    return permissions.all === true || permissions.admin === true || permissions.reports_access === true || permissions.open_employees === true || permissions.open_employee_reports === true;
  }

  async function getContext() {
    if (!window.cmSupabase) throw new Error("Nie załadowano Supabase.");
    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);
    if (accessError) throw accessError;
    if (contextError) throw contextError;
    if (!access || access.allowed !== true) throw new Error(access?.reason || "Brak dostępu.");
    if (!context || context.allowed !== true || !context.company_id) throw new Error(context?.reason || "Brak kontekstu firmy.");
    if (!hasAccess(access, context)) throw new Error("Brak uprawnienia do raportów pracowników.");
    return { access, context, companyId: context.company_id };
  }

  async function safeSelect(table, query) {
    const { data, error } = await query;
    if (error) {
      console.warn(`[Pracownicy - raporty] ${table}:`, error.message || error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  async function fetchData(companyId, from, to) {
    const sb = window.cmSupabase;
    const [profiles, positions, clients, appointments, sales, saleItems, daysOff, workSchedules, workScheduleTemplates, employeeWorkSchedules] = await Promise.all([
      safeSelect("profiles", sb.from("profiles").select("*").eq("company_id", companyId)),
      safeSelect("positions", sb.from("positions").select("*").eq("company_id", companyId)),
      safeSelect("clients", sb.from("clients").select("*").eq("company_id", companyId)),
      safeSelect("appointments", sb.from("appointments").select("*").eq("company_id", companyId)),
      safeSelect("sales", sb.from("sales").select("*").eq("company_id", companyId)),
      safeSelect("sale_items", sb.from("sale_items").select("*").eq("company_id", companyId)),
      safeSelect("days_off", sb.from("days_off").select("*").eq("company_id", companyId)),
      safeSelect("work_schedule", sb.from("work_schedule").select("*").eq("company_id", companyId)),
      safeSelect("work_schedule_templates", sb.from("work_schedule_templates").select("*").eq("company_id", companyId)),
      safeSelect("employee_work_schedules", sb.from("employee_work_schedules").select("*").eq("company_id", companyId))
    ]);

    const filteredAppointments = appointments.filter((row) => inRange(appointmentDate(row), from, to));
    const inactiveSaleStatuses = ["void", "deleted", "usunięte", "usuniete", "cancelled", "canceled", "anulowane", "anulowana"];
    const filteredSales = sales.filter((row) => {
      const ps = String(row.payment_status || "").toLowerCase();
      const st = String(row.status || "").toLowerCase();
      return inRange(saleDate(row), from, to) && !inactiveSaleStatuses.includes(ps) && !inactiveSaleStatuses.includes(st);
    });
    const saleIds = new Set(filteredSales.map((row) => row.id));
    const filteredItems = saleItems.filter((item) => saleIds.has(item.sale_id));
    const filteredDaysOff = daysOff.filter((row) => inRange(row.date || row.start_date || row.date_from || row.from_date || row.created_at, from, to));
    const filteredWorkSchedules = workSchedules.filter((row) => inRange(row.date || row.work_date || row.day || row.created_at, from, to));

    return { profiles, positions, clients, appointments: filteredAppointments, sales: filteredSales, saleItems: filteredItems, daysOff: filteredDaysOff, workSchedules: filteredWorkSchedules, workScheduleTemplates, employeeWorkSchedules, from, to };
  }

  function calcStats(data) {
    const positionsById = new Map(data.positions.map((p) => [p.id, p]));
    const employees = data.profiles
      .filter((p) => normalizeRole(p.role) !== "OWNER")
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "pl"));
    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const employeeAliasToId = new Map();
    const addEmployeeAlias = (value, id) => {
      const key = employeeKeyByName(value);
      if (key && key !== "brak" && id && !employeeAliasToId.has(key)) employeeAliasToId.set(key, id);
    };
    employees.forEach((e) => {
      addEmployeeAlias(e.full_name || e.fullName || e.name, e.id);
      addEmployeeAlias(e.email, e.id);
    });
    const resolveEmployeeId = (id, fallback) => {
      if (id && employeeById.has(id)) return id;
      const key = employeeKeyByName(fallback);
      return employeeAliasToId.get(key) || "";
    };
    const resolveEmployeeName = (id, fallback) => {
      const resolvedId = resolveEmployeeId(id, fallback);
      if (resolvedId && employeeById.has(resolvedId)) return employeeName(employeeById.get(resolvedId), fallback);
      const cleaned = String(fallback || "").trim();
      return cleaned && cleaned !== "(brak)" ? cleaned : "";
    };
    const clientById = new Map((data.clients || []).map((c) => [c.id, c]));
    const saleById = new Map(data.sales.map((s) => [s.id, s]));
    const appointmentById = new Map(data.appointments.map((a) => [a.id, a]));

    const base = new Map();
    employees.forEach((e) => {
      const position = positionsById.get(e.position_id) || {};
      base.set(e.id, {
        id: e.id,
        name: employeeName(e),
        email: e.email || "",
        position: position.name || e.position_name || "-",
        visits: 0,
        finishedVisits: 0,
        cancelledVisits: 0,
        services: 0,
        serviceValue: 0,
        products: 0,
        productValue: 0,
        passes: 0,
        passValue: 0,
        revenue: 0,
        daysOff: 0,
        vacation: 0,
        sick: 0,
        free: 0,
        visitMinutes: 0,
        clientIds: new Set(),
        newClientIds: new Set(),
        returningClientIds: new Set(),
        workMinutes: 0,
        scheduledMinutes: 0
      });
    });

    const ensure = (id, fallback) => {
      const resolvedId = resolveEmployeeId(id, fallback);
      const resolvedName = resolveEmployeeName(resolvedId || id, fallback);
      if (!resolvedId && !resolvedName) return null;
      const key = resolvedId || `unknown:${employeeKeyByName(resolvedName)}`;
      if (!base.has(key)) {
        base.set(key, {
          id: key,
          name: resolvedName || "(brak)",
          email: "",
          position: "-",
          visits: 0,
          finishedVisits: 0,
          cancelledVisits: 0,
          services: 0,
          serviceValue: 0,
          products: 0,
          productValue: 0,
          passes: 0,
          passValue: 0,
          revenue: 0,
          daysOff: 0,
          vacation: 0,
          sick: 0,
          free: 0,
          visitMinutes: 0,
          clientIds: new Set(),
          newClientIds: new Set(),
          returningClientIds: new Set(),
          workMinutes: 0,
          scheduledMinutes: 0
        });
      }
      return base.get(key);
    };

    const touchClient = (emp, clientId) => {
      if (!clientId) return;
      emp.clientIds.add(clientId);
      const client = clientById.get(clientId);
      const created = clientCreatedDate(client);
      if (created && inRange(created, window.__cmErCurrentFrom, window.__cmErCurrentTo)) emp.newClientIds.add(clientId);
    };

    data.appointments.forEach((a) => {
      const emp = ensure(a.employee_id || a.employeeId, rowEmployeeName(a, employeeById));
      if (!emp) return;
      emp.visits += 1;
      if (isFinishedAppointment(a)) emp.finishedVisits += 1;
      if (isCancelledAppointment(a)) emp.cancelledVisits += 1;
      if (!isCancelledAppointment(a)) {
        const mins = appointmentMinutes(a);
        emp.visitMinutes += mins;
        emp.workMinutes += mins;
      }
      touchClient(emp, a.client_id || a.customer_id || a.clientId || a.customerId || "");
    });

    data.saleItems.forEach((item) => {
      const sale = saleById.get(item.sale_id) || {};
      const appointment = appointmentById.get(sale.appointment_id) || {};
      const employeeId = sale.employee_id || appointment.employee_id || item.employee_id || item.employeeId || "";
      const empName = sale.employee_name || appointment.employee_name || item.employee_name || item.employeeName || "";
      const emp = ensure(employeeId, empName);
      if (!emp) return;
      const type = String(item.item_type || "service").toLowerCase();
      const qty = itemQty(item);
      const value = itemValue(item, sale);
      emp.revenue += value;
      touchClient(emp, sale.client_id || appointment.client_id || appointment.customer_id || "");
      if (type.includes("product")) { emp.products += qty; emp.productValue += value; }
      else if (type.includes("pass") || type.includes("karnet")) { emp.passes += qty; emp.passValue += value; }
      else { emp.services += qty; emp.serviceValue += value; }
    });

    data.daysOff.forEach((d) => {
      const emp = ensure(d.employee_id || d.employeeId, d.employee_name || "");
      if (!emp) return;
      const type = normalize(d.type || d.reason || d.status || "");
      emp.daysOff += 1;
      if (type.includes("urlop")) emp.vacation += 1;
      else if (type.includes("zwol") || type.includes("chorob")) emp.sick += 1;
      else emp.free += 1;
    });

    (data.workSchedules || []).forEach((row) => {
      const emp = ensure(row.employee_id || row.employeeId || row.profile_id || row.user_id || "", row.employee_name || row.employeeName || row.name || "");
      if (!emp) return;
      emp.scheduledMinutes += scheduleMinutes(row);
    });

    (data.employeeWorkSchedules || []).forEach((row) => {
      const emp = ensure(row.employee_id || row.employeeId || row.profile_id || row.user_id || "", row.employee_name || row.employeeName || row.name || "");
      if (!emp) return;
      emp.scheduledMinutes += employeeSchedulePeriodMinutes(row, data.from, data.to);
    });

    const realNameToKey = new Map();
    Array.from(base.values()).forEach((r) => {
      if (r.id && !String(r.id).startsWith("unknown:")) {
        realNameToKey.set(employeeKeyByName(r.name), `id:${r.id}`);
      }
    });

    const merged = new Map();
    Array.from(base.values()).forEach((r) => {
      const nameKey = `name:${employeeKeyByName(r.name)}`;
      const realKeyForName = realNameToKey.get(employeeKeyByName(r.name));
      const key = r.id && !String(r.id).startsWith("unknown:") ? `id:${r.id}` : (realKeyForName || nameKey);
      const existingKey = merged.has(key) ? key : (merged.has(nameKey) ? nameKey : key);
      if (!merged.has(existingKey)) {
        merged.set(existingKey, {
          ...r,
          clientIds: new Set(r.clientIds),
          newClientIds: new Set(r.newClientIds),
          returningClientIds: new Set(r.returningClientIds)
        });
      } else {
        const m = merged.get(existingKey);
        ["visits","finishedVisits","cancelledVisits","services","serviceValue","products","productValue","passes","passValue","revenue","daysOff","vacation","sick","free","visitMinutes","workMinutes","scheduledMinutes"].forEach((field) => {
          m[field] += Number(r[field] || 0);
        });
        r.clientIds.forEach((id) => m.clientIds.add(id));
        r.newClientIds.forEach((id) => m.newClientIds.add(id));
        r.returningClientIds.forEach((id) => m.returningClientIds.add(id));
        if ((!m.id || String(m.id).startsWith("unknown:")) && r.id && !String(r.id).startsWith("unknown:")) m.id = r.id;
      }
    });

    const collapsed = new Map();
    Array.from(merged.values()).forEach((r) => {
      const normalizedName = employeeKeyByName(r.name);
      const key = normalizedName && normalizedName !== "(brak)" ? normalizedName : String(r.id || "missing");
      if (!collapsed.has(key)) {
        collapsed.set(key, {
          ...r,
          clientIds: new Set(r.clientIds),
          newClientIds: new Set(r.newClientIds),
          returningClientIds: new Set(r.returningClientIds)
        });
      } else {
        const m = collapsed.get(key);
        ["visits","finishedVisits","cancelledVisits","services","serviceValue","products","productValue","passes","passValue","revenue","daysOff","vacation","sick","free","visitMinutes","workMinutes","scheduledMinutes"].forEach((field) => {
          m[field] += Number(r[field] || 0);
        });
        r.clientIds.forEach((id) => m.clientIds.add(id));
        r.newClientIds.forEach((id) => m.newClientIds.add(id));
        r.returningClientIds.forEach((id) => m.returningClientIds.add(id));
        if (m.name === "(brak)" && r.name !== "(brak)") m.name = r.name;
      }
    });
    return Array.from(collapsed.values()).map((r) => {
      r.clients = r.clientIds.size;
      r.newClients = r.newClientIds.size;
      r.returningClients = Math.max(0, r.clients - r.newClients);
      r.newClientsPct = percent(r.newClients, r.clients);
      r.returningClientsPct = percent(r.returningClients, r.clients);
      r.workPct = percent(r.workMinutes, r.scheduledMinutes);
      return r;
    }).filter((r) => r.name !== "(brak)")
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  function parseSelectedEmployees(value) {
    return new Set(String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean));
  }

  function employeeFilterHtml(employees, selectedSet) {
    const allChecked = selectedSet.size === 0;
    const chips = employees.map((emp) => {
      const checked = allChecked || selectedSet.has(emp.id);
      return `<label class="cm-er-employee-chip"><input type="checkbox" data-er-employee value="${esc(emp.id)}" ${checked ? "checked" : ""}>${esc(employeeName(emp))}</label>`;
    }).join("");
    return `<div class="cm-er-employee-filter">
      <div class="cm-er-employee-title">Pracownicy</div>
      <div class="cm-er-employee-options">
        <label class="cm-er-employee-chip"><input type="checkbox" id="erEmployeesAll" ${allChecked ? "checked" : ""}>Wszyscy</label>
        ${chips || '<span style="color:rgba(255,255,255,.55);font-size:12px;">Brak pracowników</span>'}
      </div>
    </div>`;
  }

  function tableModule(id, title, headers, rows, footer) {
    const bodyRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${headers.length}">Brak danych</td></tr>`;
    const footerHtml = footer ? `<tfoot><tr>${footer.map((cell) => `<td>${cell}</td>`).join("")}</tr></tfoot>` : "";
    return `<section class="cm-er-section" data-er-table="${esc(id)}">
      <div class="bm-page-head"><h3>${esc(title)}</h3></div>
      <div class="cm-er-table-card">
        <div class="cm-er-toolbar">
          <div class="cm-er-toolbar-left"><select class="cm-er-limit" data-er-limit><option>50</option><option>100</option><option>200</option></select></div>
          <div class="cm-er-toolbar-right"><label>Szukaj:<input class="cm-er-search" data-er-search type="search" placeholder="Szukaj"></label></div>
        </div>
        <div class="cm-er-table-wrap"><table class="cm-er-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody>${footerHtml}</table></div>
        <div class="cm-er-footer"><span data-er-info>Pozycje od 0 do 0 z 0 łącznie</span><span class="cm-er-pager"><button type="button" data-er-prev>‹</button><strong data-er-page>1 z 1</strong><button type="button" data-er-next>›</button></span></div>
      </div>
    </section>`;
  }

  function setupTables(root) {
    $$('[data-er-table]', root).forEach((section) => {
      const table = $('table', section);
      const tbody = $('tbody', table);
      const allRows = $$('tr', tbody).filter((row) => !row.textContent.includes('Brak danych'));
      const limitEl = $('[data-er-limit]', section);
      const searchEl = $('[data-er-search]', section);
      const infoEl = $('[data-er-info]', section);
      const pageEl = $('[data-er-page]', section);
      const prevEl = $('[data-er-prev]', section);
      const nextEl = $('[data-er-next]', section);
      let page = 1;
      const render = () => {
        const limit = Number(limitEl?.value || 50);
        const needle = normalize(searchEl?.value || "");
        const filtered = allRows.filter((row) => !needle || normalize(row.textContent).includes(needle));
        const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
        page = Math.min(Math.max(1, page), totalPages);
        const start = filtered.length ? (page - 1) * limit : 0;
        const end = Math.min(start + limit, filtered.length);
        allRows.forEach((row) => { row.style.display = "none"; });
        filtered.slice(start, end).forEach((row) => { row.style.display = ""; });
        if (infoEl) infoEl.textContent = `Pozycje od ${filtered.length ? start + 1 : 0} do ${end} z ${filtered.length} łącznie`;
        if (pageEl) pageEl.textContent = `${page} z ${totalPages}`;
        if (prevEl) prevEl.disabled = page <= 1;
        if (nextEl) nextEl.disabled = page >= totalPages;
      };
      limitEl?.addEventListener('change', () => { page = 1; render(); });
      searchEl?.addEventListener('input', () => { page = 1; render(); });
      prevEl?.addEventListener('click', () => { page -= 1; render(); });
      nextEl?.addEventListener('click', () => { page += 1; render(); });
      render();
    });
  }

  function renderPage(context, data, filters) {
    window.__cmErCurrentFrom = filters.from;
    window.__cmErCurrentTo = filters.to;
    const selectedEmployees = parseSelectedEmployees(filters.employees || "");
    const allStats = calcStats(data);
    const stats = (selectedEmployees.size ? allStats.filter((r) => selectedEmployees.has(r.id)) : allStats)
      .filter((r) => String(r.name || "").trim() && String(r.name || "").trim() !== "(brak)");
    const employeeOptions = data.profiles
      .filter((p) => normalizeRole(p.role) !== "OWNER")
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "pl"));
    const totals = stats.reduce((acc, r) => {
      Object.keys(acc).forEach((key) => { acc[key] += Number(r[key] || 0); });
      return acc;
    }, { visits:0, finishedVisits:0, cancelledVisits:0, services:0, serviceValue:0, products:0, productValue:0, passes:0, passValue:0, revenue:0, daysOff:0, vacation:0, sick:0, free:0, visitMinutes:0, clients:0, newClients:0, returningClients:0, workMinutes:0, scheduledMinutes:0 });

    const customerServiceRows = stats.map((r) => [esc(r.name), String(r.services), String(r.clients), formatMinutes(r.visitMinutes), String(r.newClients), r.newClientsPct, String(r.returningClients), r.returningClientsPct]);
    const salesRows = stats.map((r) => [esc(r.name), String(r.services), money(r.serviceValue), String(r.products), money(r.productValue), String(r.passes), money(r.passValue), money(r.revenue)]);
    const absenceRows = stats.map((r) => [esc(r.name), String(r.daysOff), String(r.vacation), String(r.sick), String(r.free)]);
    const workHoursRows = stats.map((r) => [esc(r.name), String(r.visits), formatMinutes(r.workMinutes || r.visitMinutes), formatMinutes(r.scheduledMinutes), r.workPct || percent(r.workMinutes || r.visitMinutes, r.scheduledMinutes)]);

    const root = getRoot();
    root.innerHTML = `<section class="bm-page-card cm-employees-report-page">
      <div class="bm-page-head customers-head"><h2>Pracownicy - raporty</h2></div>
      <div class="cm-er-filters">
        <label>Od<input type="date" id="erDateFrom" value="${esc(filters.from)}"></label>
        <label>Do<input type="date" id="erDateTo" value="${esc(filters.to)}"></label>
        <label>Zakres<select id="erRangePreset">${rangeOptions(filters.range || "custom")}</select></label>
        <button type="button" id="erShowBtn">Pokaż</button>
        ${employeeFilterHtml(employeeOptions, selectedEmployees)}
      </div>
      <div class="cm-er-grid">
        <div class="cm-er-card"><span>Pracownicy</span><strong>${stats.length}</strong></div>
        <div class="cm-er-card"><span>Wizyty zakończone</span><strong>${totals.finishedVisits}</strong></div>
        <div class="cm-er-card"><span>Pozycje sprzedaży</span><strong>${totals.services + totals.products + totals.passes}</strong></div>
        <div class="cm-er-card"><span>Przychód</span><strong>${money(totals.revenue)}</strong></div>
      </div>
      ${tableModule('customer-service', 'Obsługa klientów', ['Pracownik','L. usług','L. klientów','Czas wizyt','Nowi k.','Nowi k. %','K. powracający','K. powracający %'], customerServiceRows, ['SUMA', totals.services, totals.clients, formatMinutes(totals.visitMinutes), totals.newClients, percent(totals.newClients, totals.clients), totals.returningClients, percent(totals.returningClients, totals.clients)])}
      ${tableModule('sales', 'Sprzedaż według pracowników', ['Pracownik','Usługi','Wartość usług','Produkty','Wartość produktów','Karnety','Wartość karnetów','Razem'], salesRows, ['SUMA', totals.services, money(totals.serviceValue), totals.products, money(totals.productValue), totals.passes, money(totals.passValue), money(totals.revenue)])}
      ${tableModule('absences', 'Dni wolne według pracowników', ['Pracownik','Dni wolne','Urlop','Zwolnienie','Inne'], absenceRows, ['SUMA', totals.daysOff, totals.vacation, totals.sick, totals.free])}
      ${tableModule('work-hours', 'Godziny pracy', ['Pracownik','Liczba wizyt','Czas pracy','Czas wyznaczony','Grafik %'], workHoursRows, ['SUMA', totals.visits, formatMinutes(totals.workMinutes || totals.visitMinutes), formatMinutes(totals.scheduledMinutes), percent(totals.workMinutes || totals.visitMinutes, totals.scheduledMinutes)])}
    </section>`;

    const syncEmployeesAll = () => {
      const all = $('#erEmployeesAll');
      const boxes = $$('[data-er-employee]');
      if (!all) return;
      all.checked = boxes.length > 0 && boxes.every((box) => box.checked);
    };
    $('#erEmployeesAll')?.addEventListener('change', (event) => {
      $$('[data-er-employee]').forEach((box) => { box.checked = event.currentTarget.checked; });
    });
    $$('[data-er-employee]').forEach((box) => box.addEventListener('change', syncEmployeesAll));
    syncEmployeesAll();

    $('#erRangePreset')?.addEventListener('change', (event) => {
      const preset = rangePreset(event.currentTarget.value);
      if (preset) {
        const fromEl = $('#erDateFrom');
        const toEl = $('#erDateTo');
        if (fromEl) fromEl.value = preset.from;
        if (toEl) toEl.value = preset.to;
      }
    });

    $('#erShowBtn')?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      const range = $('#erRangePreset')?.value || 'custom';
      const preset = rangePreset(range);
      const fromValue = preset?.from || $('#erDateFrom')?.value || filters.from;
      const toValue = preset?.to || $('#erDateTo')?.value || filters.to;
      url.searchParams.set('from', fromValue);
      url.searchParams.set('to', toValue);
      url.searchParams.set('range', range);
      const boxes = $$('[data-er-employee]');
      const checked = boxes.filter((box) => box.checked).map((box) => box.value);
      if (checked.length && checked.length !== boxes.length) url.searchParams.set('employees', checked.join(','));
      else url.searchParams.delete('employees');
      window.location.href = url.toString();
    });
    window.initCalendars?.();
    window.cmReinitDatepickers?.();
    setupTables(root);
  }

  function renderError(error) {
    getRoot().innerHTML = `<section class="bm-page-card cm-employees-report-page"><h2>Pracownicy - raporty</h2><div class="cm-er-error">Błąd raportów pracowników: ${esc(error?.message || error)}</div></section>`;
  }

  async function init() {
    injectStyles();
    try {
      const defaults = defaultDates();
      const params = new URLSearchParams(window.location.search);
      const filters = { from: params.get('from') || defaults.from, to: params.get('to') || defaults.to, range: params.get('range') || 'custom', employees: params.get('employees') || '' };
      const context = await getContext();
      const data = await fetchData(context.companyId, filters.from, filters.to);
      renderPage(context, data, filters);
    } catch (error) {
      console.error('Employees reports Supabase error', error);
      renderError(error);
    }
  }

  window.addEventListener('load', () => setTimeout(init, 250));
})();
