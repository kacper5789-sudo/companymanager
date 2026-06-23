// CompanyManager — 046A Raport dzienny Supabase
// daily-report.html: realne dane z sales / sale_items / payments / appointments / clients.
(function () {
  if (document.body?.dataset?.panelPage !== "dailyReport") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const int = (value) => String(Number(value || 0));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dayNames = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const paymentLabels = ["gotówka", "karta", "przelew", "karnet", "pakiet", "gratis"];

  function parseLocalDate(value) {
    const raw = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dateRange(day) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), dayIso: isoDate(start) };
  }

  function displayDate(day) {
    return `${dayNames[day.getDay()]}, ${pad(day.getDate())}.${pad(day.getMonth() + 1)}.${day.getFullYear()}`;
  }

  function normalizeRole(role) { return String(role || "").trim().toUpperCase(); }
  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, item) => { acc[String(item)] = true; return acc; }, {});
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

  async function getContext() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano połączenia z Supabase." };
    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);
    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true || !context.company_id) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!hasAnyPermission(ctx, ["open_daily_report", "reports_access", "daily_report_today", "daily_report_other_days", "open_stats"])) {
      return { ok: false, message: "Brak uprawnienia do raportu dziennego." };
    }
    return ctx;
  }

  function panelArea() {
    return $(".bm-panel-area") || $("#dashboardRoot") || document.body;
  }

  function renderError(message) {
    panelArea().innerHTML = `<section class="bm-page-card cm-daily-report-card"><div class="bm-page-head"><h2>Raport dzienny</h2></div><p class="panel-message error">Błąd raportu dziennego: ${esc(message)}</p></section>`;
  }

  function table(headers, rows, cls = "") {
    return `<div class="bm-table-wrap cm-daily-table-wrap ${esc(cls)}"><table class="bm-table cm-daily-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Brak danych</td></tr>`}</tbody></table></div>`;
  }

  function groupBy(items, keyFn, initFn, updateFn) {
    const map = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, initFn(item, key));
      updateFn(map.get(key), item);
    });
    return Array.from(map.values());
  }

  function saleValue(sale) {
    return Number(sale.total_gross ?? sale.total_net ?? sale.paid_amount ?? 0) || 0;
  }

  function itemValue(item, saleMap) {
    const sale = saleMap.get(item.sale_id) || {};
    return Number(item.total ?? item.total_price ?? item.unit_price ?? saleValue(sale) ?? 0) || 0;
  }

  async function fetchDailyData(ctx, day) {
    const range = dateRange(day);
    const sb = window.cmSupabase;

    const [salesRes, paymentsRes, appointmentsRes, employeesRes, clientsRes] = await Promise.all([
      sb.from("sales").select("id,company_id,client_id,employee_id,employee_name,appointment_id,total_gross,total_net,payment_status,payment_method,created_at,updated_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("payments").select("id,company_id,sale_id,appointment_id,amount,method,status,paid_at,created_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("appointments").select("id,company_id,client_id,client_name,employee_id,employee_name,service_id,service_name,product_id,product_name,total,price,paid_amount,payment_status,payment_method,status,date,starts_at,appointment_datetime,created_at").eq("company_id", ctx.companyId).eq("date", range.dayIso),
      sb.from("profiles").select("id,full_name,email,role,company_id").eq("company_id", ctx.companyId),
      sb.from("clients").select("id,first_name,last_name,full_name,created_at,company_id").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso)
    ]);

    const errors = [salesRes.error, paymentsRes.error, appointmentsRes.error, employeesRes.error, clientsRes.error].filter(Boolean);
    if (errors.length) throw new Error(errors.map(e => e.message).join(" | "));

    const sales = (salesRes.data || []).filter(s => String(s.payment_status || "").toLowerCase() !== "void");
    const saleIds = sales.map(s => s.id).filter(Boolean);
    let saleItems = [];
    if (saleIds.length) {
      const itemsRes = await sb.from("sale_items").select("id,company_id,sale_id,item_type,service_id,product_id,pass_id,name,name_snapshot,quantity,unit_price,total,total_price,created_at").in("sale_id", saleIds);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      saleItems = itemsRes.data || [];
    }

    return { sales, payments: paymentsRes.data || [], appointments: appointmentsRes.data || [], employees: employeesRes.data || [], clients: clientsRes.data || [], saleItems };
  }

  function buildReport(data) {
    const sales = data.sales || [];
    const payments = data.payments || [];
    const appointments = data.appointments || [];
    const employees = data.employees || [];
    const saleItems = data.saleItems || [];
    const clients = data.clients || [];
    const saleMap = new Map(sales.map(s => [s.id, s]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const statusOf = (item) => String(item.status || "").toLowerCase();
    const isCancelled = (a) => ["odwołane", "odwolane", "usunięte", "usuniete"].includes(statusOf(a)) || a.is_cancelled === true;
    const isFinished = (a) => ["zakończone", "zakonczone", "completed"].includes(statusOf(a)) || a.finished === true;
    const isPlanned = (a) => !isCancelled(a) && !isFinished(a);

    const serviceItems = saleItems.filter(i => String(i.item_type || "").toLowerCase() === "service");
    const productItems = saleItems.filter(i => String(i.item_type || "").toLowerCase() === "product");
    const passItems = saleItems.filter(i => ["pass", "karnet"].includes(String(i.item_type || "").toLowerCase()));

    const revenue = sales.reduce((sum, sale) => sum + saleValue(sale), 0);
    const paymentSum = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cash = payments.filter(p => String(p.method || "").toLowerCase().includes("gotówka")).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const paymentsByMethod = groupBy(payments, p => String(p.method || "gotówka").trim() || "gotówka", (_, key) => ({ method: key, count: 0, value: 0 }), (row, p) => { row.count += 1; row.value += Number(p.amount || 0); });

    const serviceRows = groupBy(serviceItems, i => i.name_snapshot || i.name || "Usługa", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });
    const productRows = groupBy(productItems, i => i.name_snapshot || i.name || "Produkt", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });
    const passRows = groupBy(passItems, i => i.name_snapshot || i.name || "Karnet", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });

    const employeeRows = employees.map(emp => {
      const empSales = sales.filter(s => s.employee_id === emp.id || (!s.employee_id && String(s.employee_name || "").trim() && String(s.employee_name).trim() === String(emp.full_name || emp.email || "").trim()));
      const empAppointments = appointments.filter(a => a.employee_id === emp.id || (!a.employee_id && String(a.employee_name || "").trim() === String(emp.full_name || emp.email || "").trim()));
      const empSaleIds = new Set(empSales.map(s => s.id));
      const empItems = saleItems.filter(i => empSaleIds.has(i.sale_id));
      const empServices = empItems.filter(i => String(i.item_type || "").toLowerCase() === "service");
      const empProducts = empItems.filter(i => String(i.item_type || "").toLowerCase() === "product");
      const empPasses = empItems.filter(i => ["pass", "karnet"].includes(String(i.item_type || "").toLowerCase()));
      return {
        id: emp.id,
        name: emp.full_name || emp.email || "Pracownik",
        visits: empAppointments.length,
        serviceCount: empServices.reduce((s, i) => s + Number(i.quantity || 1), 0),
        serviceValue: empServices.reduce((s, i) => s + itemValue(i, saleMap), 0),
        productCount: empProducts.reduce((s, i) => s + Number(i.quantity || 1), 0),
        productValue: empProducts.reduce((s, i) => s + itemValue(i, saleMap), 0),
        passCount: empPasses.reduce((s, i) => s + Number(i.quantity || 1), 0),
        passValue: empPasses.reduce((s, i) => s + itemValue(i, saleMap), 0)
      };
    }).filter(row => row.visits || row.serviceCount || row.productCount || row.passCount);

    return {
      plannedVisits: appointments.filter(isPlanned).length,
      finishedVisits: appointments.filter(isFinished).length,
      cancelledVisits: appointments.filter(isCancelled).length,
      newClients: clients.length,
      salesCount: sales.length,
      revenue,
      paymentSum,
      cash,
      paymentsByMethod,
      serviceRows,
      productRows,
      passRows,
      employeeRows,
      serviceItems,
      productItems,
      passItems
    };
  }

  function render(ctx, day, report) {
    const canBrowse = hasAnyPermission(ctx, ["daily_report_other_days", "reports_access", "open_stats"]);
    const today = isoDate(new Date());
    const currentIso = isoDate(day);
    const headerDate = displayDate(day);

    const paymentRows = report.paymentsByMethod.length
      ? report.paymentsByMethod.map(row => `<div><span>${esc(row.method)}</span><b>${money(row.value)}</b><small>${int(row.count)} płatności</small></div>`).join("")
      : paymentLabels.map(method => `<div><span>${esc(method)}</span><b>${money(0)}</b></div>`).join("");

    const servicesTable = table(["L.szt.", "Wartość PLN", "Nazwa usługi"], report.serviceRows.map(r => [int(r.count), money(r.value), esc(r.name)]));
    const productsTable = table(["L.szt.", "Wartość PLN", "Nazwa produktu"], report.productRows.map(r => [int(r.count), money(r.value), esc(r.name)]));
    const passesTable = table(["L.szt.", "Wartość PLN", "Nazwa karnetu"], report.passRows.map(r => [int(r.count), money(r.value), esc(r.name)]));
    const employeeTable = table(["Pracownik", "Wizyty", "Usługi", "Wartość usług", "Produkty", "Wartość produktów", "Karnety", "Wartość karnetów"], report.employeeRows.map(r => [esc(r.name), int(r.visits), int(r.serviceCount), money(r.serviceValue), int(r.productCount), money(r.productValue), int(r.passCount), money(r.passValue)]), "cm-daily-employees-table");

    panelArea().innerHTML = `
      <section class="bm-page-card cm-period-report-card cm-daily-report-card cm-supabase-daily-report">
        <div class="bm-page-head cm-period-head">
          <h2>Raport dzienny</h2>
          <button type="button" class="bm-light-btn" id="dailyExportExcel">Export - Excel</button>
        </div>

        <div class="cm-daily-date-row">
          <button type="button" id="dailyPrevDay" class="bm-light-btn cm-daily-arrow" aria-label="Poprzedni dzień">‹</button>
          <label class="cm-daily-date-field" id="dailyDateField" title="Wybierz datę">
            <span>${esc(headerDate)}</span>
            <input id="dailyReportDate" type="date" value="${esc(currentIso)}" aria-label="Wybierz datę raportu dziennego">
          </label>
          <button type="button" id="dailyNextDay" class="bm-light-btn cm-daily-arrow" aria-label="Następny dzień">›</button>
        </div>

        <div class="cm-period-kpis cm-daily-main-kpis">
          <div><span>Przychód</span><b>${money(report.revenue)}</b><small>zakończone/opłacone sprzedaże</small></div>
          <div><span>Sprzedaże</span><b>${int(report.salesCount)}</b><small>liczba paragonów/sprzedaży</small></div>
          <div><span>Nowi klienci</span><b>${int(report.newClients)}</b><small>zapisani dzisiaj</small></div>
        </div>

        <div class="cm-period-kpis">
          <div><span>Liczba zaplanowanych wizyt</span><b>${int(report.plannedVisits)}</b></div>
          <div><span>Liczba zakończonych wizyt</span><b>${int(report.finishedVisits)}</b></div>
          <div><span>Liczba odwołanych wizyt</span><b>${int(report.cancelledVisits)}</b></div>
        </div>

        <section class="cm-period-section"><h3>Finanse</h3><div class="cm-finance-grid"><div><span>Płatności</span><b>${money(report.paymentSum)}</b>${paymentRows}</div><div><span>Stan kasy</span><b>${money(report.cash)}</b><small>gotówka w wybranym dniu</small></div><div><span>Obrót</span><b>${money(report.revenue)}</b><small>łączny obrót w wybranym dniu</small></div></div></section>
        <section class="cm-period-section"><h3>Usługi</h3><p>Sprzedane usługi w tym dniu: <b>${int(report.serviceItems.length)}</b></p>${servicesTable}</section>
        <section class="cm-period-section"><h3>Produkty</h3><p>Sprzedane produkty w tym dniu: <b>${int(report.productItems.length)}</b></p>${productsTable}</section>
        <section class="cm-period-section"><h3>Karnety</h3><p>Sprzedane karnety w tym dniu: <b>${int(report.passItems.length)}</b></p>${passesTable}</section>
        <section class="cm-period-section"><h3>Pracownicy</h3>${employeeTable}</section>
        <section class="cm-period-section cm-comm-grid"><div><h3>SMS</h3><p>Wysłane SMS</p><b>0</b></div><div><h3>Email</h3><p>Wysłane EMAIL</p><b>0</b></div></section>
      </section>`;

    const move = (delta) => {
      const next = new Date(day);
      next.setDate(next.getDate() + delta);
      const url = new URL(window.location.href);
      url.searchParams.set("date", isoDate(next));
      window.location.href = url.toString();
    };
    $("#dailyPrevDay")?.addEventListener("click", () => move(-1));
    $("#dailyNextDay")?.addEventListener("click", () => move(1));
    const dateInput = $("#dailyReportDate");
    if (dateInput && !canBrowse) dateInput.min = today;
    $("#dailyDateField")?.addEventListener("click", (event) => {
      if (!dateInput) return;
      if (event.target !== dateInput) event.preventDefault();
      if (typeof dateInput.showPicker === "function") dateInput.showPicker(); else dateInput.focus();
    });
    dateInput?.addEventListener("change", (event) => {
      const selected = event.target.value || currentIso;
      if (!canBrowse && selected !== today) {
        alert("Brak uprawnienia do raportu dziennego z innych dni.");
        event.target.value = today;
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("date", selected);
      window.location.href = url.toString();
    });
    $("#dailyExportExcel")?.addEventListener("click", () => exportExcel(day, report));
    window.setupNativePickers?.();
  }

  function exportExcel(day, report) {
    const rows = [];
    rows.push(["Raport dzienny", isoDate(day)]);
    rows.push([]);
    rows.push(["Przychód", report.revenue.toFixed(2)]);
    rows.push(["Sprzedaże", report.salesCount]);
    rows.push(["Nowi klienci", report.newClients]);
    rows.push(["Wizyty zaplanowane", report.plannedVisits]);
    rows.push(["Wizyty zakończone", report.finishedVisits]);
    rows.push(["Wizyty odwołane", report.cancelledVisits]);
    rows.push([]);
    rows.push(["Usługi", "L.szt.", "Wartość"]);
    report.serviceRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    rows.push([]);
    rows.push(["Produkty", "L.szt.", "Wartość"]);
    report.productRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    rows.push([]);
    rows.push(["Karnety", "L.szt.", "Wartość"]);
    report.passRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-dzienny-${isoDate(day)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function init() {
    try {
      const ctx = await getContext();
      if (!ctx.ok) return renderError(ctx.message);
      const params = new URLSearchParams(window.location.search || "");
      const picked = parseLocalDate(params.get("date")) || new Date();
      const day = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
      const data = await fetchDailyData(ctx, day);
      render(ctx, day, buildReport(data));
    } catch (error) {
      console.error("Daily report Supabase error", error);
      renderError(error.message || String(error));
    }
  }

  function bootDailyReport() {
    const root = panelArea();
    if (root && !root.querySelector(".cm-supabase-daily-report")) {
      root.innerHTML = `<section class="bm-page-card cm-daily-report-card"><div class="bm-page-head"><h2>Raport dzienny</h2></div><p class="panel-message">Ładuję dane z Supabase...</p></section>`;
    }
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(bootDailyReport, 150));
  } else {
    setTimeout(bootDailyReport, 150);
  }
})();
