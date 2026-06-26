// CompanyManager — 045A Klienci - raporty Supabase
// customersraports.html: realne dane z clients / appointments / services / profiles.
(function () {
  if (document.body?.dataset?.panelPage !== "customersReports") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => window.cmFormatMoney ? window.cmFormatMoney(value) : `${Number(value || 0).toFixed(2)} PLN`;
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
    if (!d) return false;
    return d.getTime() >= parseDate(from).getTime() && d.getTime() <= parseDate(to).getTime();
  }

  function dateLabel(value) {
    const d = parseDate(value);
    if (!d) return "Wybierz datę";
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  function clientName(client, fallback = "") {
    const full = [client?.first_name || client?.firstName, client?.last_name || client?.lastName].filter(Boolean).join(" ").trim();
    return full || client?.full_name || client?.fullName || client?.name || fallback || client?.email || client?.phone || "(brak)";
  }

  function employeeName(employee, fallback = "") {
    return employee?.full_name || employee?.fullName || employee?.name || employee?.email || fallback || "(brak)";
  }

  function serviceName(service, fallback = "") {
    return service?.name || service?.service_name || fallback || "(brak usługi)";
  }

  function appointmentDate(row) {
    return row?.starts_at || row?.appointment_datetime || row?.date || row?.created_at || row?.sale_date;
  }

  function appointmentClientId(row) {
    return row?.client_id || row?.customer_id || row?.clientId || row?.customerId || "";
  }

  function appointmentEmployeeId(row) {
    return row?.employee_id || row?.employeeId || "";
  }

  function appointmentServiceId(row) {
    return row?.service_id || row?.serviceId || "";
  }

  function appointmentValue(row, service) {
    // W raportach klientów wartość wizyty rozbijamy na usługę + produkty.
    // Dlatego najpierw bierzemy cenę samej usługi, a dopiero awaryjnie total z wizyty.
    return Number(row?.price || service?.price || service?.price_from || service?.priceFrom || service?.price_to || service?.priceTo || row?.total || row?.total_gross || row?.paid_amount || 0);
  }

  function saleValue(row) {
    return Number(row?.total_gross || row?.total || row?.amount || row?.paid_amount || 0);
  }

  function saleClientId(row) {
    return row?.client_id || row?.customer_id || row?.buyer_client_id || row?.beneficiary_client_id || "";
  }

  function isDeletedOrInactive(row) {
    return row?.deleted_at || row?.deleted === true || row?.active === false || String(row?.status || "").toLowerCase() === "deleted";
  }

  function isCancelled(row) {
    const status = String(row?.status || "").toLowerCase();
    return row?.cancelled === true || row?.is_cancelled === true || ["odwołane", "odwołana", "odwołany", "usunięte", "usunięta", "deleted", "cancelled"].includes(status);
  }

  function isFinished(row) {
    const status = String(row?.status || "").toLowerCase();
    return row?.finished === true || ["zakończone", "zakończona", "zakończony", "completed"].includes(status);
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
    return permissions.all === true || permissions.admin === true || permissions.open_customer_reports === true || permissions.reports_access === true;
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
    if (!hasAccess(access, context)) throw new Error("Brak uprawnienia do Klienci - raporty.");
    return { access, context, companyId: context.company_id };
  }

  async function safeSelect(table, query) {
    const { data, error } = await query;
    if (error) {
      console.warn(`[Klienci - raporty] ${table}:`, error.message || error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  async function loadData(companyId) {
    const [clients, appointments, services, categories, profiles, sales, saleItems, passes] = await Promise.all([
      safeSelect("clients", window.cmSupabase.from("clients").select("*").eq("company_id", companyId).limit(5000)),
      safeSelect("appointments", window.cmSupabase.from("appointments").select("*").eq("company_id", companyId).limit(5000)),
      safeSelect("services", window.cmSupabase.from("services").select("*").eq("company_id", companyId).limit(3000)),
      safeSelect("service_categories", window.cmSupabase.from("service_categories").select("*").eq("company_id", companyId).limit(1000)),
      safeSelect("profiles", window.cmSupabase.from("profiles").select("*").eq("company_id", companyId).limit(1000)),
      safeSelect("sales", window.cmSupabase.from("sales").select("*").eq("company_id", companyId).limit(5000)),
      safeSelect("sale_items", window.cmSupabase.from("sale_items").select("*").eq("company_id", companyId).limit(8000)),
      safeSelect("passes", window.cmSupabase.from("passes").select("*").eq("company_id", companyId).limit(3000))
    ]);
    return {
      clients: clients.filter((c) => !isDeletedOrInactive(c)),
      appointments: appointments.filter((a) => !isDeletedOrInactive(a)),
      services: services.filter((s) => !isDeletedOrInactive(s)),
      categories: categories.filter((c) => !isDeletedOrInactive(c)),
      profiles: profiles.filter((p) => !isDeletedOrInactive(p)),
      sales: sales.filter((sale) => !isDeletedOrInactive(sale)),
      saleItems,
      passes: passes.filter((pass) => !isDeletedOrInactive(pass))
    };
  }

  function optionList(items, selected) {
    return items.map((item) => `<label class="cm-cr-dropdown-option"><input type="checkbox" class="${esc(item.group)}-item" value="${esc(item.id)}" ${selected.includes(String(item.id)) ? "checked" : ""}> ${esc(item.label)}</label>`).join("") || `<p class="cm-cr-dropdown-empty">Brak danych</p>`;
  }

  function dropdown(id, title, items, selected, allLabel) {
    const allSelected = !selected.length || selected.length >= items.length;
    const checkedCount = allSelected ? items.length : selected.length;
    const prepared = items.map((item) => ({ ...item, group: id }));
    return `<div class="cm-cr-dropdown" data-filter="${esc(id)}">
      <span class="cm-cr-dropdown-label">${esc(title)}</span>
      <button type="button" class="cm-cr-dropdown-button" id="${esc(id)}Toggle">${checkedCount ? `Wybrano: ${checkedCount}` : "Wybierz"} ▼</button>
      <div class="cm-cr-dropdown-menu" id="${esc(id)}Menu" hidden>
        <label class="cm-cr-dropdown-option cm-cr-dropdown-all"><input type="checkbox" id="${esc(id)}All" ${allSelected ? "checked" : ""}> ${esc(allLabel)}</label>
        ${optionList(prepared, allSelected ? items.map((i) => String(i.id)) : selected)}
      </div>
    </div>`;
  }

  function table(headers, rows) {
    const body = rows.length ? rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Nie znaleziono żadnych danych</td></tr>`;
    return `<div class="bm-table-wrap"><table class="bm-table cm-customers-report-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function exportCsv(filename, headers, rows) {
    const csv = [headers, ...rows.map((row) => row.map((cell) => String(cell).replace(/<[^>]*>/g, "")))].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderLayout(raw, filters) {
    const root = getRoot();
    const clientsById = Object.fromEntries(raw.clients.map((c) => [String(c.id), c]));
    const servicesById = Object.fromEntries(raw.services.map((s) => [String(s.id), s]));
    const categoriesById = Object.fromEntries(raw.categories.map((c) => [String(c.id), c]));
    const profilesById = Object.fromEntries(raw.profiles.map((p) => [String(p.id), p]));

    const employeeItems = raw.profiles
      .filter((p) => normalizeRole(p.role) !== "OWNER")
      .map((p) => ({ id: String(p.id), label: employeeName(p) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));
    const categoryItems = raw.categories
      .map((c) => ({ id: String(c.id), label: c.name || "Kategoria" }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));

    const selectedEmployees = filters.employees;
    const selectedCategories = filters.categories;

    let visits = raw.appointments.filter((a) => inRange(appointmentDate(a), filters.from, filters.to));
    if (filters.mode === "finishedVisits") visits = visits.filter((a) => isFinished(a) && !isCancelled(a));
    else visits = visits.filter((a) => !isFinished(a) && !isCancelled(a));
    if (selectedEmployees.length) visits = visits.filter((a) => selectedEmployees.includes(String(appointmentEmployeeId(a))));
    if (selectedCategories.length) visits = visits.filter((a) => {
      const svc = servicesById[String(appointmentServiceId(a))];
      return selectedCategories.includes(String(svc?.category_id || svc?.categoryId || ""));
    });

    const salesInRange = (raw.sales || []).filter((sale) => inRange(sale.created_at || sale.sale_date || sale.paid_at, filters.from, filters.to));
    const salesById = Object.fromEntries((raw.sales || []).map((sale) => [String(sale.id), sale]));
    const saleItemsBySale = new Map();
    (raw.saleItems || []).forEach((item) => {
      if (!item.sale_id) return;
      const key = String(item.sale_id);
      const list = saleItemsBySale.get(key) || [];
      list.push(item);
      saleItemsBySale.set(key, list);
    });

    const productMetaForAppointment = (appointment) => {
      const appointmentId = String(appointment?.id || "");
      const linkedSales = (raw.sales || []).filter((sale) => String(sale.appointment_id || sale.visit_id || "") === appointmentId);
      let qty = 0;
      let value = 0;
      linkedSales.forEach((sale) => {
        (saleItemsBySale.get(String(sale.id)) || []).forEach((item) => {
          const type = String(item.item_type || item.type || "").toLowerCase();
          if (!type.includes("product")) return;
          const itemQty = Number(item.quantity || 1);
          const itemValue = Number(item.total ?? item.total_price ?? 0) || (Number(item.unit_price || 0) * itemQty);
          qty += itemQty;
          value += itemValue;
        });
      });
      if (qty > 0 || value > 0) return { qty, value };

      // Starszy model Dashboardu zapisywał produkt bezpośrednio na wizycie.
      const hasAppointmentProduct = !!(appointment?.product_id || appointment?.product_name);
      if (!hasAppointmentProduct) return { qty: 0, value: 0 };
      const appointmentQty = Number(appointment?.product_quantity || 1);
      const appointmentValue = Number(appointment?.product_price || appointment?.product_total || 0) * appointmentQty;
      return { qty: appointmentQty, value: appointmentValue };
    };

    const salesByClient = new Map();
    salesInRange.forEach((sale) => {
      const cid = String(saleClientId(sale) || "");
      if (!cid) return;
      const items = saleItemsBySale.get(String(sale.id)) || [];
      const prev = salesByClient.get(cid) || { count: 0, value: 0, products: 0, passes: 0, services: 0 };
      prev.count += 1;
      prev.value += saleValue(sale);
      items.forEach((item) => {
        const type = String(item.item_type || "").toLowerCase();
        if (type.includes("product")) prev.products += Number(item.quantity || 1);
        else if (type.includes("pass")) prev.passes += Number(item.quantity || 1);
        else if (type.includes("service")) prev.services += Number(item.quantity || 1);
      });
      salesByClient.set(cid, prev);
    });

    const byCustomer = () => {
      const map = new Map();
      visits.forEach((a) => {
        const cid = String(appointmentClientId(a) || a.client_name || "brak");
        const client = clientsById[cid];
        const svc = servicesById[String(appointmentServiceId(a))];
        const label = clientName(client, a.client_name || a.clientName || "(brak)");
        const prev = map.get(cid) || {
          label,
          phone: client?.phone || a.client_phone || "",
          email: client?.email || "",
          visits: 0,
          services: 0,
          products: 0,
          value: 0,
          avgVisit: 0,
          firstDate: "",
          lastDate: ""
        };
        const productMeta = productMetaForAppointment(a);
        prev.visits += 1;
        if (appointmentServiceId(a)) prev.services += 1;
        prev.products += Number(productMeta.qty || 0);
        prev.value += appointmentValue(a, svc) + Number(productMeta.value || 0);
        const d = String(appointmentDate(a) || "").slice(0, 10);
        if (d && (!prev.firstDate || d < prev.firstDate)) prev.firstDate = d;
        if (d > prev.lastDate) prev.lastDate = d;
        map.set(cid, prev);
      });
      return [...map.values()].map((row) => ({
        ...row,
        avgVisit: row.visits ? row.value / row.visits : 0
      })).sort((a, b) => b.value - a.value || b.visits - a.visits || String(a.label).localeCompare(String(b.label), "pl"));
    };

    const byCategory = () => {
      const map = new Map();
      visits.forEach((a) => {
        const svc = servicesById[String(appointmentServiceId(a))];
        const catId = String(svc?.category_id || svc?.categoryId || "");
        const label = categoriesById[catId]?.name || svc?.category || "(bez kategorii)";
        const prev = map.get(label) || { label, visits: 0, clients: new Set(), services: 0, products: 0, value: 0 };
        const productMeta = productMetaForAppointment(a);
        prev.visits += 1;
        const cid = String(appointmentClientId(a) || "");
        if (cid) prev.clients.add(cid);
        if (appointmentServiceId(a)) prev.services += 1;
        prev.products += Number(productMeta.qty || 0);
        prev.value += appointmentValue(a, svc) + Number(productMeta.value || 0);
        map.set(label, prev);
      });
      return [...map.values()].map((row) => ({
        label: row.label,
        visits: row.visits,
        clients: row.clients.size,
        services: row.services,
        products: row.products,
        value: row.value
      })).sort((a, b) => b.visits - a.visits || b.value - a.value);
    };

    const byVisit = () => visits.map((a) => {
      const client = clientsById[String(appointmentClientId(a))];
      const employee = profilesById[String(appointmentEmployeeId(a))];
      const svc = servicesById[String(appointmentServiceId(a))];
      const cat = categoriesById[String(svc?.category_id || svc?.categoryId || "")];
      const productMeta = productMetaForAppointment(a);
      return {
        date: String(appointmentDate(a) || "").slice(0, 10),
        client: clientName(client, a.client_name || a.clientName || "(brak)"),
        employee: employeeName(employee, a.employee_name || a.employeeName || "(brak)"),
        category: cat?.name || svc?.category || "(bez kategorii)",
        service: serviceName(svc, a.service_name || a.serviceName),
        products: Number(productMeta.qty || 0),
        value: appointmentValue(a, svc) + Number(productMeta.value || 0),
        status: a.status || ""
      };
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.value - a.value);

    let headers;
    let rowsData;
    let reportRowsForStats;
    if (filters.mode === "plannedCategories") {
      headers = ["Kategoria usług", "Planowane wizyty", "Klienci", "Usługi", "Produkty", "Wartość"];
      reportRowsForStats = byCategory();
      rowsData = reportRowsForStats.map((r) => [esc(r.label), String(r.visits), String(r.clients), String(r.services), String(r.products || 0), money(r.value)]);
    } else if (filters.mode === "finishedVisits") {
      headers = ["Klient", "Zakończone wizyty", "Usługi", "Produkty", "Ostatnia zakończona wizyta", "Wartość"];
      reportRowsForStats = byCustomer();
      rowsData = reportRowsForStats.map((r) => [
        esc(r.label),
        String(r.visits),
        String(r.services),
        String(r.products || 0),
        esc(r.lastDate ? dateLabel(r.lastDate) : "-"),
        money(r.value)
      ]);
    } else {
      headers = ["Klient", "Planowane wizyty", "Usługi", "Produkty", "Najbliższa wizyta", "Ostatnia planowana", "Wartość"];
      reportRowsForStats = byCustomer();
      rowsData = reportRowsForStats.map((r) => [
        esc(r.label),
        String(r.visits),
        String(r.services),
        String(r.products || 0),
        esc(r.firstDate ? dateLabel(r.firstDate) : "-"),
        esc(r.lastDate ? dateLabel(r.lastDate) : "-"),
        money(r.value)
      ]);
    }

    const needle = normalize(filters.search);
    if (needle) rowsData = rowsData.filter((row) => normalize(row.join(" ")).includes(needle));
    const limit = Number(filters.limit) || 50;
    const shownRows = rowsData.slice(0, limit);
    const totals = visits.reduce((acc, a) => {
      const svc = servicesById[String(appointmentServiceId(a))];
      const productMeta = productMetaForAppointment(a);
      acc.visits += 1;
      if (appointmentServiceId(a)) acc.services += 1;
      acc.products += Number(productMeta.qty || 0);
      acc.value += appointmentValue(a, svc) + Number(productMeta.value || 0);
      return acc;
    }, { visits: 0, services: 0, products: 0, value: 0 });
    const customerRows = byCustomer();
    const categoryRows = byCategory();
    const clientsInTable = filters.mode === "plannedCategories"
      ? categoryRows.reduce((sum, row) => sum + Number(row.clients || 0), 0)
      : customerRows.length;

    const titles = {
      plannedClients: "Planowane wizyty według klientów",
      plannedCategories: "Planowane wizyty według kategorii usług",
      finishedVisits: "Zakończone wizyty klientów"
    };
    const modes = ["plannedClients", "plannedCategories", "finishedVisits"];
    const title = titles[filters.mode] || titles.plannedClients;
    const presets = [["currentMonth", "bieżący miesiąc"], ["currentWeek", "bieżący tydzień"], ["today", "dziś"], ["yesterday", "wczoraj"], ["last7", "ostatnie 7 dni"], ["last30", "ostatnie 30 dni"], ["previousMonth", "poprzedni miesiąc"], ["last3Months", "ostatnie 3 miesiące"], ["last12Months", "ostatnie 12 miesięcy"]];

    root.innerHTML = `<section class="bm-page-card cm-customers-reports-page cm-supa-customers-reports">
      <div class="bm-page-head customers-head"><h2>Klienci - raporty</h2><div class="bm-actions-row"><button type="button" id="crExportBtn" class="bm-excel-btn">Export - Excel</button></div></div>
      <div class="cm-customer-report-switcher" aria-label="Widok raportu klientów">
        <button type="button" id="customersReportPrev" class="bm-light-btn" aria-label="Poprzedni widok">‹</button>
        <strong>${esc(title)}</strong>
        <button type="button" id="customersReportNext" class="bm-light-btn" aria-label="Następny widok">›</button>
      </div>
      <form class="cm-period-controls cm-customers-report-controls cm-reports-polished-controls" id="crFilters">
        <label class="cm-report-date-field"><span>Od</span><div class="cm-report-date-pill"><strong data-date-label="from">${esc(dateLabel(filters.from))}</strong><input id="crFrom" name="from" type="date" value="${esc(filters.from)}"></div></label>
        <label class="cm-report-date-field"><span>Do</span><div class="cm-report-date-pill"><strong data-date-label="to">${esc(dateLabel(filters.to))}</strong><input id="crTo" name="to" type="date" value="${esc(filters.to)}"></div></label>
        <label class="cm-report-group-field"><span>Zakres</span><div class="cm-report-select-pill"><select id="crPreset" name="preset">${presets.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div></label>
        ${dropdown("crEmployees", "Pracownicy", employeeItems, selectedEmployees, "Wszyscy pracownicy")}
        ${dropdown("crCategories", "Kategorie usług", categoryItems, selectedCategories, "Wszystkie kategorie")}
        <button type="submit" id="crShow" class="btn btn-primary cm-report-show-btn">Pokaż</button>
      </form>
      <div class="cm-period-kpis cm-customers-report-kpis">
        <div><span>Liczba wizyt</span><b>${esc(totals.visits)}</b></div>
        <div><span>Liczba usług</span><b>${esc(totals.services)}</b></div>
        <div><span>Liczba produktów</span><b>${esc(totals.products || 0)}</b></div>
        <div><span>Wartość wizyt</span><b>${esc(money(totals.value))}</b></div>
        <div><span>Pozycje w tabeli</span><b>${esc(rowsData.length)}</b></div>
      </div>
      <div class="bm-table-toolbar"><label>${limitSelect(filters.limit)}</label><label>Szukaj: <input id="crSearch" type="search" value="${esc(filters.search)}" placeholder="Szukaj"></label></div>
      <div id="crTableWrap">${table(headers, shownRows)}<p class="cm-table-footer">Pozycje od ${shownRows.length ? 1 : 0} do ${shownRows.length} z ${rowsData.length}</p></div>
    </section>`;

    function apply(overrides = {}) {
      const collect = (id) => {
        const items = $$(`.${id}-item`);
        const selected = items.filter((input) => input.checked).map((input) => input.value);
        return selected.length && selected.length < items.length ? selected : [];
      };
      loadAndRender({
        mode: overrides.mode || filters.mode,
        from: $("#crFrom")?.value || filters.from,
        to: $("#crTo")?.value || filters.to,
        employees: collect("crEmployees"),
        categories: collect("crCategories"),
        limit: $("#crLimit")?.value || filters.limit,
        search: $("#crSearch")?.value || ""
      });
    }

    function move(step) {
      const index = Math.max(0, modes.indexOf(filters.mode));
      apply({ mode: modes[(index + step + modes.length) % modes.length] });
    }

    $("#customersReportPrev")?.addEventListener("click", () => move(-1));
    $("#customersReportNext")?.addEventListener("click", () => move(1));
    $("#crFilters")?.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
    $("#crSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });
    $("#crLimit")?.addEventListener("change", () => apply());
    $("#crExportBtn")?.addEventListener("click", () => exportCsv(`klienci-raporty-${filters.from}-${filters.to}.xls`, headers, rowsData));

    $$("#crFilters input[type='date']").forEach((input) => {
      input.addEventListener("change", () => {
        const label = document.querySelector(`[data-date-label="${input.name}"]`);
        if (label) label.textContent = dateLabel(input.value);
      });
    });

    $("#crPreset")?.addEventListener("change", (event) => {
      const now = new Date();
      let start = new Date(now.getFullYear(), now.getMonth(), 1);
      let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const day = now.getDay() || 7;
      const val = event.target.value;
      if (val === "today") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = new Date(start); }
      if (val === "yesterday") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); end = new Date(start); }
      if (val === "currentWeek") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1); end = new Date(start); end.setDate(start.getDate() + 6); }
      if (val === "last7") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
      if (val === "last30") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
      if (val === "previousMonth") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
      if (val === "last3Months") { start = new Date(now.getFullYear(), now.getMonth() - 2, 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
      if (val === "last12Months") { start = new Date(now.getFullYear(), now.getMonth() - 11, 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
      const fromInput = $("#crFrom");
      const toInput = $("#crTo");
      if (fromInput) fromInput.value = iso(start);
      if (toInput) toInput.value = iso(end);
      $$("#crFilters input[type='date']").forEach((input) => input.dispatchEvent(new Event("change")));
    });

    setupDropdown("crEmployees");
    setupDropdown("crCategories");
    window.cmReinitDatePickers?.();
    window.cmReinitCalendarInputs?.();
  }

  function limitSelect(value) {
    return `<select id="crLimit">${[50,100,150,200].map((n) => `<option value="${n}" ${String(value) === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  }

  function setupDropdown(id) {
    const toggle = $(`#${id}Toggle`);
    const menu = $(`#${id}Menu`);
    const all = $(`#${id}All`);
    const items = $$(`.${id}-item`);
    if (!toggle || !menu) return;
    const refresh = () => {
      const selected = items.filter((i) => i.checked).length;
      if (all) all.checked = selected === 0 || selected === items.length;
      toggle.textContent = selected ? `Wybrano: ${selected} ▼` : "Wybierz ▼";
    };
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      $$(".cm-cr-dropdown-menu").forEach((m) => { if (m !== menu) m.hidden = true; });
      menu.hidden = !menu.hidden;
    });
    all?.addEventListener("change", () => { items.forEach((i) => { i.checked = all.checked; }); refresh(); });
    items.forEach((i) => i.addEventListener("change", refresh));
    refresh();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".cm-cr-dropdown")) $$(".cm-cr-dropdown-menu").forEach((m) => { m.hidden = true; });
  });

  function renderError(message) {
    getRoot().innerHTML = `<section class="bm-page-card"><div class="bm-page-head"><h2>Klienci - raporty</h2></div><div class="bm-empty-state">Błąd raportów klientów: ${esc(message)}</div></section>`;
  }

  async function loadAndRender(overrides = {}) {
    const defaults = defaultDates();
    const filters = {
      mode: overrides.mode || "plannedClients",
      from: overrides.from || defaults.from,
      to: overrides.to || defaults.to,
      employees: Array.isArray(overrides.employees) ? overrides.employees.map(String) : [],
      categories: Array.isArray(overrides.categories) ? overrides.categories.map(String) : [],
      limit: String(overrides.limit || "50"),
      search: String(overrides.search || "")
    };
    try {
      getRoot().innerHTML = `<section class="bm-page-card"><div class="bm-page-head"><h2>Klienci - raporty</h2></div><div class="bm-empty-state">Ładowanie raportów klientów z Supabase...</div></section>`;
      const ctx = await getContext();
      const raw = await loadData(ctx.companyId);
      renderLayout(raw, filters);
    } catch (error) {
      renderError(error?.message || String(error));
    }
  }

  function boot() { setTimeout(() => loadAndRender(), 180); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
