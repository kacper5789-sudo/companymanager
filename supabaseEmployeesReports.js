// CompanyManager — 047A Pracownicy - raporty Supabase
// employeesraports.html: realne dane z profiles / appointments / sales / sale_items / days_off.
(function () {
  if (document.body?.dataset?.panelPage !== "employeesReports") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function injectStyles() {
    if (document.getElementById("cmEmployeesReportsStyle")) return;
    const style = document.createElement("style");
    style.id = "cmEmployeesReportsStyle";
    style.textContent = `
      .cm-employees-report-page .cm-er-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0 18px;}
      .cm-employees-report-page .cm-er-card{padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.055);box-shadow:0 18px 55px rgba(0,0,0,.18);backdrop-filter:blur(18px);}
      .cm-employees-report-page .cm-er-card span{display:block;color:rgba(255,255,255,.64);font-size:12px;margin-bottom:6px;}
      .cm-employees-report-page .cm-er-card strong{font-size:24px;line-height:1.2;color:#fff;}
      .cm-employees-report-page .cm-er-filters{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:10px 0 16px;}
      .cm-employees-report-page .cm-er-filters label{display:grid;gap:6px;color:rgba(255,255,255,.72);font-size:12px;}
      .cm-employees-report-page .cm-er-filters input{min-width:150px;}
      .cm-er-section{margin-top:18px;}
      .cm-er-section .bm-page-head h3{margin:0;}
      .cm-er-table-card{border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.035);padding:12px;overflow:hidden;}
      .cm-er-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;}
      .cm-er-toolbar-left,.cm-er-toolbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .cm-er-toolbar label{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.72);font-size:13px;}
      .cm-er-limit{min-width:76px;}
      .cm-er-search{min-width:210px;}
      .cm-er-table-wrap{overflow-x:auto;border-radius:14px;}
      .cm-er-table{width:100%;border-collapse:collapse;table-layout:fixed;}
      .cm-er-table th,.cm-er-table td{padding:10px 9px;text-align:center;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.08);white-space:normal;word-break:normal;}
      .cm-er-table th{font-size:12px;line-height:1.15;color:rgba(255,255,255,.76);font-weight:700;background:rgba(255,255,255,.045);}
      .cm-er-table td{font-size:13px;color:rgba(255,255,255,.9);}
      .cm-er-table td:first-child,.cm-er-table th:first-child{text-align:left;width:18%;}
      .cm-er-table tfoot td{font-weight:800;background:rgba(255,255,255,.055);color:#fff;}
      .cm-er-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px;color:rgba(255,255,255,.65);font-size:12px;}
      .cm-er-pager{display:flex;align-items:center;gap:8px;}
      .cm-er-pager button{min-width:34px;padding:7px 10px;}
      .cm-er-error{padding:16px;border:1px solid rgba(255,90,90,.35);background:rgba(255,70,70,.08);border-radius:16px;color:#fff;}
      @media(max-width:900px){.cm-employees-report-page .cm-er-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.cm-er-table{min-width:880px;}}
    `;
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
    const [profiles, positions, appointments, sales, saleItems, daysOff] = await Promise.all([
      safeSelect("profiles", sb.from("profiles").select("*").eq("company_id", companyId)),
      safeSelect("positions", sb.from("positions").select("*").eq("company_id", companyId)),
      safeSelect("appointments", sb.from("appointments").select("*").eq("company_id", companyId)),
      safeSelect("sales", sb.from("sales").select("*").eq("company_id", companyId)),
      safeSelect("sale_items", sb.from("sale_items").select("*").eq("company_id", companyId)),
      safeSelect("days_off", sb.from("days_off").select("*").eq("company_id", companyId))
    ]);

    const filteredAppointments = appointments.filter((row) => inRange(appointmentDate(row), from, to));
    const filteredSales = sales.filter((row) => inRange(saleDate(row), from, to) && String(row.payment_status || "").toLowerCase() !== "void");
    const saleIds = new Set(filteredSales.map((row) => row.id));
    const filteredItems = saleItems.filter((item) => saleIds.has(item.sale_id));
    const filteredDaysOff = daysOff.filter((row) => inRange(row.date || row.start_date || row.date_from || row.from_date || row.created_at, from, to));

    return { profiles, positions, appointments: filteredAppointments, sales: filteredSales, saleItems: filteredItems, daysOff: filteredDaysOff };
  }

  function calcStats(data) {
    const positionsById = new Map(data.positions.map((p) => [p.id, p]));
    const employees = data.profiles
      .filter((p) => normalizeRole(p.role) !== "OWNER")
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "pl"));
    const employeeById = new Map(employees.map((e) => [e.id, e]));
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
        free: 0
      });
    });

    const ensure = (id, fallback) => {
      const key = id || `unknown:${fallback || "brak"}`;
      if (!base.has(key)) {
        base.set(key, { id: key, name: fallback || "(brak)", email: "", position: "-", visits: 0, finishedVisits: 0, cancelledVisits: 0, services: 0, serviceValue: 0, products: 0, productValue: 0, passes: 0, passValue: 0, revenue: 0, daysOff: 0, vacation: 0, sick: 0, free: 0 });
      }
      return base.get(key);
    };

    data.appointments.forEach((a) => {
      const emp = ensure(a.employee_id || a.employeeId, rowEmployeeName(a, employeeById));
      emp.visits += 1;
      if (isFinishedAppointment(a)) emp.finishedVisits += 1;
      if (isCancelledAppointment(a)) emp.cancelledVisits += 1;
    });

    data.saleItems.forEach((item) => {
      const sale = saleById.get(item.sale_id) || {};
      const appointment = appointmentById.get(sale.appointment_id) || {};
      const employeeId = sale.employee_id || appointment.employee_id || "";
      const empName = employeeName(employeeById.get(employeeId), sale.employee_name || appointment.employee_name || "(brak)");
      const emp = ensure(employeeId, empName);
      const type = String(item.item_type || "service").toLowerCase();
      const qty = itemQty(item);
      const value = itemValue(item, sale);
      emp.revenue += value;
      if (type.includes("product")) { emp.products += qty; emp.productValue += value; }
      else if (type.includes("pass") || type.includes("karnet")) { emp.passes += qty; emp.passValue += value; }
      else { emp.services += qty; emp.serviceValue += value; }
    });

    data.daysOff.forEach((d) => {
      const emp = ensure(d.employee_id || d.employeeId, d.employee_name || "(brak)");
      const type = normalize(d.type || d.reason || d.status || "");
      emp.daysOff += 1;
      if (type.includes("urlop")) emp.vacation += 1;
      else if (type.includes("zwol") || type.includes("chorob")) emp.sick += 1;
      else emp.free += 1;
    });

    return Array.from(base.values()).sort((a, b) => a.name.localeCompare(b.name, "pl"));
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
    const stats = calcStats(data);
    const totals = stats.reduce((acc, r) => {
      Object.keys(acc).forEach((key) => { acc[key] += Number(r[key] || 0); });
      return acc;
    }, { visits:0, finishedVisits:0, cancelledVisits:0, services:0, serviceValue:0, products:0, productValue:0, passes:0, passValue:0, revenue:0, daysOff:0, vacation:0, sick:0, free:0 });

    const summaryRows = stats.map((r) => [esc(r.name), esc(r.position), String(r.visits), String(r.finishedVisits), String(r.cancelledVisits), money(r.revenue)]);
    const salesRows = stats.map((r) => [esc(r.name), String(r.services), money(r.serviceValue), String(r.products), money(r.productValue), String(r.passes), money(r.passValue), money(r.revenue)]);
    const absenceRows = stats.map((r) => [esc(r.name), String(r.daysOff), String(r.vacation), String(r.sick), String(r.free)]);

    const root = getRoot();
    root.innerHTML = `<section class="bm-page-card cm-employees-report-page">
      <div class="bm-page-head customers-head"><h2>Pracownicy - raporty</h2></div>
      <div class="cm-er-filters">
        <label>Od<input type="date" id="erDateFrom" value="${esc(filters.from)}"></label>
        <label>Do<input type="date" id="erDateTo" value="${esc(filters.to)}"></label>
        <button type="button" id="erShowBtn">Pokaż</button>
      </div>
      <div class="cm-er-grid">
        <div class="cm-er-card"><span>Pracownicy</span><strong>${stats.length}</strong></div>
        <div class="cm-er-card"><span>Wizyty zakończone</span><strong>${totals.finishedVisits}</strong></div>
        <div class="cm-er-card"><span>Pozycje sprzedaży</span><strong>${totals.services + totals.products + totals.passes}</strong></div>
        <div class="cm-er-card"><span>Przychód</span><strong>${money(totals.revenue)}</strong></div>
      </div>
      ${tableModule('summary', 'Podsumowanie pracowników', ['Pracownik','Stanowisko','Wizyty','Zakończone','Odwołane','Przychód'], summaryRows, ['SUMA','', totals.visits, totals.finishedVisits, totals.cancelledVisits, money(totals.revenue)])}
      ${tableModule('sales', 'Sprzedaż według pracowników', ['Pracownik','Usługi','Wartość usług','Produkty','Wartość produktów','Karnety','Wartość karnetów','Razem'], salesRows, ['SUMA', totals.services, money(totals.serviceValue), totals.products, money(totals.productValue), totals.passes, money(totals.passValue), money(totals.revenue)])}
      ${tableModule('absences', 'Dni wolne według pracowników', ['Pracownik','Dni wolne','Urlop','Zwolnienie','Inne'], absenceRows, ['SUMA', totals.daysOff, totals.vacation, totals.sick, totals.free])}
    </section>`;

    $('#erShowBtn')?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('from', $('#erDateFrom')?.value || filters.from);
      url.searchParams.set('to', $('#erDateTo')?.value || filters.to);
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
      const filters = { from: params.get('from') || defaults.from, to: params.get('to') || defaults.to };
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
