// CompanyManager — Sales Reports powered by Supabase
// 155: Historia sprzedaży jako pełny widok usług, produktów i karnetów.

(function () {
  function isSalesPage() {
    return document.body?.dataset?.panelPage === "sales" || window.location.pathname.includes("sales.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function displayDateTime(rawDate, rawTime = "") {
    if (!rawDate) return "";
    const value = String(rawDate);
    const date = value.slice(0, 10);
    const [y, m, d] = date.split("-");
    let time = rawTime ? String(rawTime).slice(0, 5) : "";
    if (!time && value.includes("T")) time = value.split("T")[1]?.slice(0, 5) || "";
    if (!time && value.includes(" ")) time = value.split(" ")[1]?.slice(0, 5) || "";
    return `${d || ""}.${m || ""}.${y || ""}${time ? " " + time : ""}`;
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
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

  function canOpenSales(ctx) { return hasAnyPermission(ctx, ["open_sales", "sales_open", "sprzedaż", "Sprzedaż", "raporty"]); }

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
    if (!canOpenSales(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Sprzedaż." };
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
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
        document.querySelectorAll(".cm-limit-menu").forEach((item) => { if (item !== menu) item.hidden = true; });
        if (menu) menu.hidden = !menu.hidden;
      });
      dropdown.querySelectorAll("[data-limit-value]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setModulePageLimit(button.getAttribute("data-limit-value") || "50");
          if (menu) menu.hidden = true;
          applySalesFilters();
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
  });

  function table(headers, rows) {
    if (!rows.length) {
      return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody><tr>${headers.map((_, i) => `<td>${i === 0 ? "Nie znaleziono żadnych danych" : ""}</td>`).join("")}</tr></tbody></table></div>`;
    }
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function pager(from, to, total, page, pages) {
    return `<div class="cm-sales-pager cm-pagination-row"><span>${total ? `Pozycje od ${from} do ${to} z ${total} łącznie` : "Pozycje od 0 do 0 z 0 łącznie"}</span><span class="cm-pagination-controls">&lt; <strong>${page} z ${Math.max(pages || 1, 1)}</strong> &gt;</span></div>`;
  }

  function getParams() {
    const params = new URLSearchParams(window.location.search || "");
    const now = new Date();
    const fromDefault = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const toDefault = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return {
      params,
      currentView: params.get("view") || "all",
      fromDate: params.get("from") || fromDefault,
      toDate: params.get("to") || toDefault,
      limitValue: getModulePageLimit(params.get("limit") || "50"),
      searchValue: String(params.get("search") || "")
    };
  }

  function getSelected(params, name, allValues) {
    const selected = params.getAll(name).filter(Boolean).map(String);
    return selected.length ? selected : allValues.map(String);
  }

  function uniq(items) {
    return [...new Set(items.map((item) => String(item || "")).filter(Boolean))];
  }

  function dropdown(name, title, options, selectedValues) {
    const normalized = options.map((option) => ({ value: String(option.value || ""), label: String(option.label || option.value || "-") })).filter((option) => option.value);
    const allValues = normalized.map((option) => option.value);
    const selected = (selectedValues?.length ? selectedValues : allValues).map(String);
    const selectedSet = new Set(selected);
    const count = normalized.filter((option) => selectedSet.has(option.value)).length;
    const items = normalized.length ? normalized.map((option) => `<label class="cm-cr-dropdown-option"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${selectedSet.has(option.value) ? "checked" : ""}> ${escapeHtml(option.label)}</label>`).join("") : "<span class='cm-cr-dropdown-empty'>Brak opcji</span>";
    return `<div class="cm-cr-dropdown cm-sales-dropdown" data-filter="${escapeHtml(name)}" data-total="${normalized.length}">
      <span class="cm-cr-dropdown-label">${escapeHtml(title)}</span>
      <button class="cm-cr-dropdown-button" type="button">Wybrano: ${count} ▼</button>
      <div class="cm-cr-dropdown-menu" hidden>${items}</div>
    </div>`;
  }

  function setupSalesDropdowns() {
    document.querySelectorAll(".cm-sales-dropdown .cm-cr-dropdown-button").forEach((button) => {
      if (button.dataset.cmSalesReady === "1") return;
      button.dataset.cmSalesReady = "1";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const dropdown = button.closest(".cm-sales-dropdown");
        const menu = dropdown?.querySelector(".cm-cr-dropdown-menu");
        if (!menu) return;
        const wasHidden = menu.hasAttribute("hidden");
        document.querySelectorAll(".cm-sales-dropdown .cm-cr-dropdown-menu").forEach((item) => item.setAttribute("hidden", ""));
        if (wasHidden) menu.removeAttribute("hidden");
      });
    });
    document.querySelectorAll(".cm-sales-dropdown input[type='checkbox']").forEach((input) => {
      if (input.dataset.cmSalesReady === "1") return;
      input.dataset.cmSalesReady = "1";
      input.addEventListener("change", () => {
        const dropdown = input.closest(".cm-sales-dropdown");
        const button = dropdown?.querySelector(".cm-cr-dropdown-button");
        const count = dropdown?.querySelectorAll("input[type='checkbox']:checked").length || 0;
        if (button) button.textContent = `Wybrano: ${count} ▼`;
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".cm-sales-dropdown")) return;
    document.querySelectorAll(".cm-sales-dropdown .cm-cr-dropdown-menu").forEach((item) => item.setAttribute("hidden", ""));
  });

  async function fetchData(ctx, fromDate, toDate) {
    const [salesRes, itemsRes, paymentsRes, clientsRes, servicesRes, productsRes, categoriesRes, usersRes, appointmentsRes, passesRes] = await Promise.all([
      window.cmSupabase.from("sales").select("id, company_id, client_id, appointment_id, employee_id, employee_name, sale_number, status, total_net, total_tax, total_gross, discount_value, payment_status, note, created_at, updated_at").eq("company_id", ctx.companyId).gte("created_at", `${fromDate}T00:00:00`).lte("created_at", `${toDate}T23:59:59`).order("created_at", { ascending: false }),
      window.cmSupabase.from("sale_items").select("id, company_id, sale_id, item_type, service_id, product_id, name, name_snapshot, quantity, unit_price, discount, total, total_price, created_at").eq("company_id", ctx.companyId),
      window.cmSupabase.from("payments").select("id, company_id, sale_id, appointment_id, amount, method, status, paid_at, created_at").eq("company_id", ctx.companyId).gte("paid_at", `${fromDate}T00:00:00`).lte("paid_at", `${toDate}T23:59:59`).order("paid_at", { ascending: false }),
      window.cmSupabase.from("clients").select("id, first_name, last_name, email, phone, status, active").eq("company_id", ctx.companyId).eq("active", true),
      window.cmSupabase.from("services").select("id, name, category_id, category, price, price_from, active").eq("company_id", ctx.companyId).eq("active", true),
      window.cmSupabase.from("products").select("id, name, category, price").eq("company_id", ctx.companyId),
      window.cmSupabase.from("service_categories").select("id, name, active").eq("company_id", ctx.companyId).eq("active", true),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId }),
      window.cmSupabase.from("appointments").select("id, client_id, client_name, service_id, service_name, product_id, product_name, employee_id, employee_name, payment_method, payment_status, status, finished, total, price, starts_at, appointment_datetime, date, start_time, created_at").eq("company_id", ctx.companyId),
      window.cmSupabase.from("passes").select("id, company_id, customer_id, buyer_client_id, beneficiary_client_id, employee_id, service_id, service_name, pass_type, sale_id, name, number, sale_date, sale_time, valid_until, payment_method, buyer, customer_name, employee_name, value, remaining, total_units, remaining_units, description, status, active, created_at").eq("company_id", ctx.companyId).eq("active", true).gte("sale_date", fromDate).lte("sale_date", toDate).order("sale_date", { ascending: false })
    ]);
    const errors = [salesRes, itemsRes, paymentsRes, clientsRes, servicesRes, productsRes, categoriesRes, usersRes, appointmentsRes, passesRes].map((res) => res.error).filter(Boolean);
    if (errors.length) throw errors[0];
    return {
      sales: salesRes.data || [],
      items: itemsRes.data || [],
      payments: paymentsRes.data || [],
      clients: clientsRes.data || [],
      services: servicesRes.data || [],
      products: productsRes.data || [],
      serviceCategories: categoriesRes.data || [],
      users: usersRes.data || [],
      appointments: appointmentsRes.data || [],
      passes: passesRes.data || []
    };
  }

  function clientName(client) {
    if (!client) return "(brak)";
    return [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email || client.phone || "(brak)";
  }

  function userName(user) {
    return user?.full_name || user?.email || "(brak)";
  }

  function userNameOrEmpty(user) {
    return user?.full_name || user?.email || "";
  }

  function employeeDisplayName(userById, employeeId, appointment, sale) {
    return userNameOrEmpty(userById[employeeId]) || appointment?.employee_name || sale?.employee_name || "(brak)";
  }


  function isAppointmentCompleted(appointment) {
    if (!appointment || !appointment.id) return true;
    return appointment.finished === true || String(appointment.status || "").toLowerCase() === "zakończone";
  }

  function paymentLabelForSale(sale, appointment) {
    if (!isAppointmentCompleted(appointment)) return "usługa jeszcze nie opłacona";
    return appointment?.payment_method || sale?.payment_status || "paid";
  }

  function countedRevenue(value, sale, appointment) {
    return isAppointmentCompleted(appointment) ? Number(value || 0) : 0;
  }

  function isMissingEmployeeName(value) {
    const text = String(value || "").trim().toLowerCase();
    return !text || text === "(brak)" || text === "brak" || text === "null" || text === "undefined";
  }

  function saleRowDedupKey(row) {
    const day = String(row?.date || "").slice(0, 10);
    const client = String(row?.clientId || row?.customer || "").trim().toLowerCase();
    const name = String(row?.name || "").trim().toLowerCase();
    const value = Number(row?.value || 0).toFixed(2);
    return [day, client, name, value].join("|");
  }

  function preferResolvedEmployeeRows(rows) {
    const bestByKey = new Map();
    rows.forEach((row) => {
      const key = saleRowDedupKey(row);
      const best = bestByKey.get(key);
      const rowNamed = !isMissingEmployeeName(row.employee);
      const bestNamed = best && !isMissingEmployeeName(best.employee);
      if (!best || (rowNamed && !bestNamed) || (rowNamed === bestNamed && String(row.date || "") > String(best.date || ""))) {
        bestByKey.set(key, row);
      }
    });
    return [...bestByKey.values()].filter((row) => !isMissingEmployeeName(row.employee));
  }

  function applySalesFilters() {
    const { currentView, fromDate, toDate } = getParams();
    const form = document.querySelector(".cm-sales-report-controls");
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/[^/]*$/, "sales.html");
    url.search = "";
    url.searchParams.set("view", currentView);
    url.searchParams.set("from", form?.querySelector("input[name='from']")?.value || fromDate);
    url.searchParams.set("to", form?.querySelector("input[name='to']")?.value || toDate);
    url.searchParams.set("limit", document.querySelector("#salesLimit")?.value || getModulePageLimit());
    url.searchParams.set("search", document.querySelector("#salesSearch")?.value || "");
    document.querySelectorAll(".cm-sales-dropdown").forEach((drop) => {
      const name = drop.dataset.filter;
      const inputs = [...drop.querySelectorAll("input[type='checkbox']")];
      const selected = inputs.filter((input) => input.checked).map((input) => input.value);
      if (name && selected.length && selected.length < inputs.length) selected.forEach((value) => url.searchParams.append(name, value));
    });
    window.location.href = url.toString();
  }


  function setupSalesDatePickers() {
    const inputs = [document.querySelector("#salesFrom"), document.querySelector("#salesTo")].filter(Boolean);
    inputs.forEach((input) => {
      if (input.dataset.cmSalesPickerReady === "1") return;
      input.dataset.cmSalesPickerReady = "1";
      const openPicker = (event) => {
        // Działa po dynamicznym renderze Supabase. Nie zmienia wyglądu pola.
        try {
          if (typeof input.showPicker === "function" && !input.disabled && !input.readOnly) {
            input.showPicker();
            return;
          }
        } catch (_) {}
        input.focus();
      };
      input.addEventListener("click", openPicker);
      input.addEventListener("focus", openPicker);
      const label = input.closest("label");
      if (label && label.dataset.cmSalesPickerLabelReady !== "1") {
        label.dataset.cmSalesPickerLabelReady = "1";
        label.addEventListener("click", (event) => {
          if (event.target === input) return;
          event.preventDefault();
          input.focus();
          openPicker(event);
        });
      }
    });
  }

  function setupFilters() {
    const form = document.querySelector(".cm-sales-report-controls");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      applySalesFilters();
    });
    document.querySelector("#salesSearch")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") applySalesFilters();
    });
    const from = document.querySelector("#salesFrom");
    const to = document.querySelector("#salesTo");
    document.querySelector("#salesPreset")?.addEventListener("change", (event) => {
      const base = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), 1);
      let end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const day = base.getDay() || 7;
      const mode = event.target.value;
      if (mode === "today") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()); end = new Date(start); }
      if (mode === "yesterday") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1); end = new Date(start); }
      if (mode === "currentWeek") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day + 1); end = new Date(start); end.setDate(start.getDate() + 6); }
      if (mode === "previousWeek") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day - 6); end = new Date(start); end.setDate(start.getDate() + 6); }
      if (mode === "last7") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === "last14") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 13); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === "last30") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 29); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === "previousMonth") { start = new Date(base.getFullYear(), base.getMonth() - 1, 1); end = new Date(base.getFullYear(), base.getMonth(), 0); }
      if (mode === "currentYear") { start = new Date(base.getFullYear(), 0, 1); end = new Date(base.getFullYear(), 11, 31); }
      if (mode === "previousYear") { start = new Date(base.getFullYear() - 1, 0, 1); end = new Date(base.getFullYear() - 1, 11, 31); }
      if (mode === "last90") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 89); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === "last365") { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 364); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (from) from.value = iso(start);
      if (to) to.value = iso(end);
      applySalesFilters();
    });
    setupSalesDatePickers();
    setupSalesDropdowns();
    setupModuleLimitDropdowns(document);
  }

  function exportActiveTable() {
    const tableEl = document.querySelector(".cm-sales-view table");
    if (!tableEl) return;
    const rows = [...tableEl.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => `"${String(cell.textContent || "").trim().replace(/"/g, '""')}"`).join(";"));
    const csv = "\ufeff" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "companymanager-sprzedaz.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  async function renderSalesSupabase() {
    if (!isSalesPage()) return;
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `<section class="bm-page-card cm-sales-page"><h2>Sprzedaż</h2><p class="bm-muted">Ładowanie sprzedaży z Supabase...</p></section>`;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd sprzedaży</h2><pre class="cm-error-box">${escapeHtml(ctx.message)}</pre></section>`;
      return;
    }

    const { params, currentView, fromDate, toDate, limitValue, searchValue } = getParams();

    let data;
    try {
      data = await fetchData(ctx, fromDate, toDate);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd sprzedaży</h2><pre class="cm-error-box">${escapeHtml(JSON.stringify(error, null, 2))}</pre></section>`;
      return;
    }

    const views = [
      ["all", "Historia sprzedaży"],
      ["services", "Usługi"], ["servicesByName", "Usługi według nazw"], ["servicesByCategory", "Usługi według kategorii"], ["servicesByEmployee", "Usługi według pracowników"],
      ["products", "Produkty"], ["productsByName", "Produkty według nazw"], ["productsByCategory", "Produkty według kategorii"], ["productsByEmployee", "Produkty według pracowników"],
      ["passes", "Karnety"], ["passesByEmployee", "Karnety według pracowników"], ["payments", "Płatności"], ["paymentsByType", "Płatności według typów"]
    ];

    const isCancelledAppointmentForSales = (appointment) => {
      const status = normalizeText(appointment?.status || "");
      return appointment?.deleted === true || ["odwolane", "odwolana", "anulowane", "anulowana", "cancelled", "canceled", "usuniete", "usunieta", "deleted"].includes(status);
    };
    const appointmentById = Object.fromEntries((data.appointments || []).map((appointment) => [appointment.id, appointment]));
    const inactiveSaleStatuses = ["void", "deleted", "usunięte", "usuniete", "cancelled", "canceled", "anulowane", "anulowana"];
    const activeSales = (data.sales || []).filter((sale) => {
      const paymentStatus = String(sale.payment_status || "").toLowerCase();
      const saleStatus = String(sale.status || "").toLowerCase();
      if (inactiveSaleStatuses.includes(paymentStatus) || inactiveSaleStatuses.includes(saleStatus)) return false;
      const linkedAppointment = sale.appointment_id ? appointmentById[sale.appointment_id] : null;
      return !isCancelledAppointmentForSales(linkedAppointment);
    });
    const salesById = Object.fromEntries(activeSales.map((sale) => [sale.id, sale]));
    const clientById = Object.fromEntries(data.clients.map((client) => [client.id, client]));
    const userById = Object.fromEntries(data.users.map((user) => [user.id, user]));
    const serviceById = Object.fromEntries(data.services.map((service) => [service.id, service]));
    const productById = Object.fromEntries(data.products.map((product) => [product.id, product]));
    const categoryById = Object.fromEntries(data.serviceCategories.map((cat) => [cat.id, cat]));

    const employeeOptions = data.users.map((u) => ({ value: u.id, label: userName(u) }));
    const serviceOptions = data.services.map((s) => ({ value: s.id, label: s.name || "-" }));
    const productOptions = data.products.map((p) => ({ value: p.id, label: p.name || "-" }));
    const serviceCategoryOptions = data.serviceCategories.map((c) => ({ value: c.id, label: c.name || "-" }));
    const productCategories = uniq(data.products.map((p) => p.category || "(brak)"));
    const paymentTypes = uniq(data.payments.map((p) => p.method || "gotówka").concat(["gotówka"]));

    const selectedEmployees = getSelected(params, "employees", employeeOptions.map((o) => o.value));
    const selectedServiceCategories = getSelected(params, "serviceCategories", serviceCategoryOptions.map((o) => o.value));
    const selectedServiceNames = getSelected(params, "serviceNames", serviceOptions.map((o) => o.value));
    const selectedProductCategories = getSelected(params, "productCategories", productCategories);
    const selectedProductNames = getSelected(params, "productNames", productOptions.map((o) => o.value));
    const selectedPaymentTypes = getSelected(params, "paymentTypes", paymentTypes);

    // 038: sprzedaż z wizyt może mieć puste employee_id/service_id/category_id,
    // bo dashboard zachowuje kompatybilność ze starym modelem po nazwach.
    // Gdy filtr nie jest ręcznie zawężony w URL, nie odcinamy takich rekordów.
    const filterActive = (name) => params.getAll(name).filter(Boolean).length > 0;
    const passesFilter = (name, selected, value) => !filterActive(name) || selected.includes(String(value || ""));

    const searchNeedle = normalizeText(searchValue);
    const filterBySearch = (rows) => !searchNeedle ? rows : rows.filter((row) => normalizeText(row.join(" ")).includes(searchNeedle));
    const limit = Number(limitValue) || 50;
    const limited = (rows) => filterBySearch(rows).slice(0, limit);
    const summary = (left, count, right, value) => `<div class="cm-sales-summary"><b>${escapeHtml(left)}: ${count}</b><b>${escapeHtml(right)}: ${money(value)} PLN</b></div>`;
    const sectionTable = (headers, rows) => {
      const filtered = filterBySearch(rows);
      return `${table(headers, filtered.slice(0, limit))}${pager(filtered.length ? 1 : 0, Math.min(limit, filtered.length), filtered.length, 1, Math.ceil(filtered.length / limit))}`;
    };

    let serviceItemsRaw = data.items
      .filter((item) => String(item.item_type || "").toLowerCase() === "service" && salesById[item.sale_id])
      .map((item) => {
        const sale = salesById[item.sale_id] || {};
        const appointment = appointmentById[sale.appointment_id] || {};
        const serviceId = item.service_id || appointment.service_id || "";
        const service = serviceById[serviceId] || {};
        const employeeId = sale.employee_id || appointment.employee_id || "";
        const clientId = sale.client_id || appointment.client_id || "";
        const catId = service.category_id || "";
        const value = Number(item.total ?? item.total_price ?? item.unit_price ?? sale.total_gross ?? appointment.total ?? appointment.price ?? 0);
        const revenueValue = countedRevenue(value, sale, appointment);
        return {
          date: sale.created_at || appointment.starts_at || appointment.appointment_datetime || appointment.created_at,
          employeeId,
          clientId,
          serviceId,
          serviceCategoryId: catId,
          employee: employeeDisplayName(userById, employeeId, appointment, sale),
          customer: clientName(clientById[clientId]) || appointment.client_name || "(brak)",
          category: categoryById[catId]?.name || service.category || "(brak)",
          name: item.name || item.name_snapshot || service.name || appointment.service_name || "Usługa",
          value,
          revenueValue,
          paymentMethod: paymentLabelForSale(sale, appointment)
        };
      })
      .filter((row) => passesFilter("employees", selectedEmployees, row.employeeId) && passesFilter("serviceCategories", selectedServiceCategories, row.serviceCategoryId) && passesFilter("serviceNames", selectedServiceNames, row.serviceId));

    serviceItemsRaw = preferResolvedEmployeeRows(serviceItemsRaw);

    const productItemsRaw = data.items
      .filter((item) => String(item.item_type || "").toLowerCase() === "product" && salesById[item.sale_id])
      .map((item) => {
        const sale = salesById[item.sale_id] || {};
        const appointment = appointmentById[sale.appointment_id] || {};
        const productId = item.product_id || appointment.product_id || "";
        const product = productById[productId] || {};
        const employeeId = sale.employee_id || appointment.employee_id || "";
        const clientId = sale.client_id || appointment.client_id || "";
        return {
          date: sale.created_at || appointment.starts_at || appointment.appointment_datetime || appointment.created_at,
          employeeId, clientId, productId, productCategory: product.category || "(brak)",
          employee: employeeDisplayName(userById, employeeId, appointment, sale),
          customer: clientName(clientById[clientId]) || appointment.client_name || "(brak)",
          name: item.name || item.name_snapshot || product.name || appointment.product_name || "Produkt",
          qty: Number(item.quantity || 1),
          value: Number(item.total ?? item.total_price ?? 0),
          revenueValue: countedRevenue(Number(item.total ?? item.total_price ?? 0), sale, appointment),
          paymentMethod: paymentLabelForSale(sale, appointment)
        };
      })
      .filter((row) => passesFilter("employees", selectedEmployees, row.employeeId) && passesFilter("productCategories", selectedProductCategories, row.productCategory) && passesFilter("productNames", selectedProductNames, row.productId));

    const inactivePassStatuses = ["void", "deleted", "usunięte", "usuniete", "cancelled", "canceled", "anulowane", "anulowana"];
    const passItemsRaw = (data.passes || [])
      .filter((pass) => pass.active !== false && !inactivePassStatuses.includes(String(pass.status || "").toLowerCase()))
      .filter((pass) => !pass.sale_id || !!salesById[pass.sale_id])
      .map((pass) => {
      const employeeId = pass.employee_id || "";
      const clientId = pass.beneficiary_client_id || pass.customer_id || "";
      return {
        date: pass.sale_date || pass.created_at,
        time: pass.sale_time || "",
        employeeId,
        clientId,
        employee: userNameOrEmpty(userById[employeeId]) || pass.employee_name || pass.buyer || "(brak)",
        customer: clientName(clientById[clientId]) || pass.customer_name || "(brak)",
        value: Number(pass.value || 0),
        note: [pass.name || "Karnet", pass.number || "", pass.service_name || "", pass.description || ""].filter(Boolean).join(" — "),
        saleId: pass.sale_id || "",
        paymentMethod: pass.payment_method || "gotówka"
      };
    }).filter((row) => passesFilter("employees", selectedEmployees, row.employeeId));

    const paymentRowsRaw = data.payments
      .filter((payment) => String(payment.status || "").toLowerCase() !== "void")
      .map((payment) => {
        // Jeżeli płatność ma sale_id, ale sprzedaż jest usunięta/void albo poza aktywnym zbiorem,
        // nie pokazujemy jej jako osobnej płatności z (brak). To był efekt po usuwaniu sprzedaży.
        const sale = payment.sale_id ? salesById[payment.sale_id] : {};
        const hasVoidedOrDeletedSale = !!payment.sale_id && !sale?.id;
        const appointment = appointmentById[sale?.appointment_id || payment.appointment_id] || {};
        const employeeId = sale?.employee_id || appointment.employee_id || "";
        const clientId = sale?.client_id || appointment.client_id || "";
        return {
          date: payment.paid_at || payment.created_at,
          employeeId,
          employee: employeeDisplayName(userById, employeeId, appointment, sale || {}),
          customer: clientName(clientById[clientId]) || appointment.client_name || "(brak)",
          type: payment.method || appointment.payment_method || "gotówka",
          value: isAppointmentCompleted(appointment) ? Number(payment.amount || sale?.total_gross || appointment.total || appointment.price || 0) : 0,
          isPendingAppointment: !!appointment.id && !isAppointmentCompleted(appointment),
          isVoidedOrDeletedSale: hasVoidedOrDeletedSale
        };
      }).filter((row) => !row.isVoidedOrDeletedSale && !row.isPendingAppointment && passesFilter("employees", selectedEmployees, row.employeeId) && passesFilter("paymentTypes", selectedPaymentTypes, row.type));

    const passPaymentRowsRaw = passItemsRaw.filter((pass) => !pass.saleId).map((pass) => ({
      date: pass.date,
      time: pass.time,
      employeeId: pass.employeeId,
      employee: pass.employee,
      customer: pass.customer,
      type: pass.paymentMethod || "gotówka",
      value: pass.value
    })).filter((row) => passesFilter("paymentTypes", selectedPaymentTypes, row.type));
    const allPaymentRowsRaw = paymentRowsRaw.concat(passPaymentRowsRaw);

    const groupRows = (rows, keyFn) => {
      const grouped = new Map();
      rows.forEach((row) => {
        const key = keyFn(row) || "(brak)";
        const current = grouped.get(key) || { count: 0, value: 0 };
        current.count += Number(row.qty || 1);
        current.value += Number((row.revenueValue ?? row.value) || 0);
        grouped.set(key, current);
      });
      return [...grouped.entries()].map(([key, val]) => [key, String(val.count), money(val.value)]).sort((a, b) => Number(b[2]) - Number(a[2]));
    };

    const toTransactionRow = (r, type, category, name, qty, value, paymentMethod) => ({
      rawDate: r.date || "",
      row: [displayDateTime(r.date, r.time), type, r.employee, r.customer, category, name, String(qty), paymentMethod, money(value)]
    });
    const serviceTransactions = serviceItemsRaw.map((r) => toTransactionRow(r, "Usługa", r.category, r.name, 1, r.value, r.paymentMethod));
    const productTransactions = productItemsRaw.map((r) => toTransactionRow(r, "Produkt", r.productCategory, r.name, r.qty, r.value, r.paymentMethod));
    const passTransactions = passItemsRaw.map((r) => toTransactionRow(r, "Karnet", "Karnet", r.note || "Karnet", 1, r.value, r.paymentMethod));
    const serviceRows = serviceTransactions.map((item) => item.row);
    const productRows = productTransactions.map((item) => item.row);
    const passRows = passTransactions.map((item) => item.row);
    const allSalesRows = serviceTransactions.concat(productTransactions, passTransactions)
      .sort((a, b) => String(b.rawDate || "").localeCompare(String(a.rawDate || "")))
      .map((item) => item.row);
    const paymentRows = allPaymentRowsRaw.map((r) => [displayDateTime(r.date, r.time), r.employee, r.customer, r.type, money(r.value)]);
    const paymentByTypeRows = groupRows(allPaymentRowsRaw, (r) => r.type).map((row) => {
      const totalCount = allPaymentRowsRaw.length || 1;
      const percentage = Math.round(Number(row[1]) / totalCount * 100);
      return [row[0], row[1], `${percentage}%`, row[2]];
    });

    const presets = [
      ["today", "dziś"], ["yesterday", "wczoraj"], ["currentWeek", "bieżący tydzień"], ["previousWeek", "poprzedni tydzień"],
      ["last7", "ostatnie 7 dni"], ["last14", "ostatnie 2 tygodnie"], ["currentMonth", "bieżący miesiąc"], ["previousMonth", "poprzedni miesiąc"],
      ["last30", "ostatnie 30 dni"], ["last90", "ostatnie 90 dni"], ["currentYear", "bieżący rok"], ["previousYear", "poprzedni rok"], ["last365", "ostatnie 365 dni"]
    ];
    const dateFilters = (filters = "") => `<form class="cm-period-controls cm-customers-report-controls cm-sales-report-controls" method="get" action="sales.html">
      <input type="hidden" name="view" value="${escapeHtml(currentView)}">
      <label>od <input id="salesFrom" class="cm-date-input" type="date" name="from" value="${escapeHtml(fromDate)}"></label>
      <label>do <input id="salesTo" class="cm-date-input" type="date" name="to" value="${escapeHtml(toDate)}"></label>
      <select id="salesPreset">${presets.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
      ${filters}
      <button id="salesShow" class="bm-light-btn" type="submit">Pokaż</button>
    </form>`;
    const listTools = () => `<div class="bm-table-toolbar"><label class="cm-limit-label">${moduleLimitDropdownHtml("salesLimit", limitValue)}</label><label>Szukaj: <input id="salesSearch" type="search" value="${escapeHtml(searchValue)}" placeholder="Szukaj"></label></div>`;

    const employeeFilter = dropdown("employees", "Pracownicy", employeeOptions, selectedEmployees);
    const serviceCategoryFilter = dropdown("serviceCategories", "Kategorie usług", serviceCategoryOptions, selectedServiceCategories);
    const serviceNameFilter = dropdown("serviceNames", "Nazwa usługi", serviceOptions, selectedServiceNames);
    const productCategoryFilter = dropdown("productCategories", "Kategorie produktów", productCategories.map((c) => ({ value: c, label: c })), selectedProductCategories);
    const productNameFilter = dropdown("productNames", "Nazwa produktu", productOptions, selectedProductNames);
    const paymentTypeFilter = dropdown("paymentTypes", "Typ płatności", paymentTypes.map((p) => ({ value: p, label: p })), selectedPaymentTypes);

    const totalSalesCount = serviceItemsRaw.length + productItemsRaw.reduce((s, r) => s + Number(r.qty || 0), 0) + passItemsRaw.length;
    const totalSalesValue = serviceItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0) + productItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0) + passItemsRaw.reduce((s, r) => s + r.value, 0);
    const transactionHeaders = ["Data i godzina", "Typ", "Pracownik", "Klient", "Kategoria", "Nazwa", "Ilość", "Płatność", "Wartość"];

    const sections = {
      all: `<h2>Historia sprzedaży</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter + productCategoryFilter + productNameFilter + paymentTypeFilter)}${summary("Pozycje sprzedaży", totalSalesCount, "Wartość sprzedaży", totalSalesValue)}${listTools()}${sectionTable(transactionHeaders, allSalesRows)}`,
      services: `<h2>Sprzedaż usług</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary("Liczba usług", serviceItemsRaw.length, "Wartość usług", serviceItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(transactionHeaders, serviceRows)}`,
      servicesByName: `<h2>Sprzedaż usług według nazw</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary("Liczba usług", serviceItemsRaw.length, "Wartość usług", serviceItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Nazwa", "Liczba", "Wartość"], groupRows(serviceItemsRaw, (r) => r.name))}`,
      servicesByCategory: `<h2>Sprzedaż usług według kategorii</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary("Liczba usług", serviceItemsRaw.length, "Wartość usług", serviceItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Kategoria", "Liczba", "Wartość"], groupRows(serviceItemsRaw, (r) => r.category))}`,
      servicesByEmployee: `<h2>Sprzedaż usług według pracowników</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary("Liczba usług", serviceItemsRaw.length, "Wartość usług", serviceItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Pracownik", "Liczba", "Wartość"], groupRows(serviceItemsRaw, (r) => r.employee))}`,
      products: `<h2>Sprzedaż produktów</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary("Liczba produktów", productItemsRaw.reduce((s, r) => s + r.qty, 0), "Wartość produktów", productItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(transactionHeaders, productRows)}`,
      productsByName: `<h2>Sprzedaż produktów według nazw</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary("Liczba produktów", productItemsRaw.reduce((s, r) => s + r.qty, 0), "Wartość produktów", productItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Nazwa", "Liczba", "Wartość"], groupRows(productItemsRaw, (r) => r.name))}`,
      productsByCategory: `<h2>Sprzedaż produktów według kategorii</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary("Liczba produktów", productItemsRaw.reduce((s, r) => s + r.qty, 0), "Wartość produktów", productItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Kategoria", "Liczba", "Wartość"], groupRows(productItemsRaw, (r) => r.productCategory))}`,
      productsByEmployee: `<h2>Sprzedaż produktów według pracowników</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary("Liczba produktów", productItemsRaw.reduce((s, r) => s + r.qty, 0), "Wartość produktów", productItemsRaw.reduce((s, r) => s + (r.revenueValue ?? r.value), 0))}${listTools()}${sectionTable(["Pracownik", "Liczba", "Wartość"], groupRows(productItemsRaw, (r) => r.employee))}`,
      passes: `<h2>Sprzedaż - karnety</h2>${dateFilters(employeeFilter)}${summary("Liczba szt.", passItemsRaw.length, "Wartość", passItemsRaw.reduce((s, r) => s + r.value, 0))}${listTools()}${sectionTable(transactionHeaders, passRows)}`,
      passesByEmployee: `<h2>Sprzedaż - karnety według pracowników</h2>${dateFilters(employeeFilter)}${summary("Liczba szt.", passItemsRaw.length, "Wartość", passItemsRaw.reduce((s, r) => s + r.value, 0))}${listTools()}${sectionTable(["Pracownik", "Liczba", "Wartość"], groupRows(passItemsRaw, (r) => r.employee))}`,
      payments: `<h2>Płatności</h2>${dateFilters(employeeFilter + paymentTypeFilter)}${summary("Liczba płatności", allPaymentRowsRaw.length, "Wartość płatności", allPaymentRowsRaw.reduce((s, r) => s + r.value, 0))}${listTools()}${sectionTable(["Data i godzina", "Pracownik", "Klient", "Typ płatności", "Wartość"], paymentRows)}`,
      paymentsByType: `<h2>Płatności według typów</h2>${dateFilters(employeeFilter + paymentTypeFilter)}${summary("Liczba płatności", allPaymentRowsRaw.length, "Wartość płatności", allPaymentRowsRaw.reduce((s, r) => s + r.value, 0))}${listTools()}${sectionTable(["Typ płatności", "Liczba", "Procent", "Wartość"], paymentByTypeRows)}`
    };

    const subnav = `<div class="bm-filter-tabs cm-sales-tabs">${views.map(([id, label]) => `<a class="${currentView === id ? "active" : ""}" href="sales.html?view=${encodeURIComponent(id)}">${escapeHtml(label)}</a>`).join("")}</div>`;
    area.innerHTML = `<section class="bm-page-card cm-sales-page">${subnav}<div class="cm-sales-view"><div class="cm-sales-view-actions"><button id="salesExportBtn" class="cm-sales-export-btn" type="button">Export</button></div>${sections[currentView] || sections.all}</div></section>`;

    setupFilters();
    document.querySelector("#salesExportBtn")?.addEventListener("click", exportActiveTable);
    setupSalesDatePickers();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!isSalesPage()) return;
    window.setTimeout(renderSalesSupabase, 120);
  });
})();
