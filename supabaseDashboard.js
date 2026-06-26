// CompanyManager — Dashboard powered by Supabase
// 039H: Dashboard Supabase schedule + wybór karnetu klienta przy dodawaniu i kończeniu wizyty.

(function () {
  function isDashboardPage() {
    return document.body?.dataset?.panelPage === "dashboard" || window.location.pathname.includes("dashboard.html");
  }

  if (!isDashboardPage()) return;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
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

  function canOpenDashboard(ctx) {
    return hasAnyPermission(ctx, ["open_company_manager", "dashboard", "open_dashboard", "CompanyManager"]);
  }
  function canAddAppointments(ctx) { return hasAnyPermission(ctx, ["appointments_add", "wizyty (dodawanie, edycja, zakończenie, usuwanie)"]); }
  function canEditAppointments(ctx) { return hasAnyPermission(ctx, ["appointments_edit", "wizyty (dodawanie, edycja, zakończenie, usuwanie)"]); }
  function canFinishAppointments(ctx) { return hasAnyPermission(ctx, ["appointments_finish", "appointments_edit", "wizyty (dodawanie, edycja, zakończenie, usuwanie)"]); }
  function canCancelAppointments(ctx) { return hasAnyPermission(ctx, ["appointments_delete", "appointments_edit", "wizyty (dodawanie, edycja, zakończenie, usuwanie)"]); }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseIso(value) {
    const [y, m, d] = String(value || "").split("-").map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }

  function addDays(dateIso, amount) {
    const date = parseIso(dateIso);
    date.setDate(date.getDate() + amount);
    return iso(date);
  }

  function plDate(value) {
    if (!value) return "";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    if (y && m && d) return `${d}.${m}.${y}`;
    return String(value);
  }

  function dayHeader(dateIso) {
    const date = parseIso(dateIso);
    return `${date.toLocaleDateString("pl-PL", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase())}, ${date.getDate()} ${date.toLocaleDateString("pl-PL", { month: "long" })}, ${date.getFullYear()}`;
  }

  function normalizeTime(value) {
    if (!value) return "";
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return "";
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  function minutesFromTime(value) {
    const time = normalizeTime(value);
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function timeFromMinutes(total) {
    const safe = Math.max(0, Math.min(23 * 60 + 59, Number(total) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function intFrom(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function dashboardSettings(data) {
    const company = data?.company || {};
    const start = normalizeTime(company.working_day_start || "08:00") || "08:00";
    const end = normalizeTime(company.working_day_end || "20:00") || "20:00";
    const duration = Math.max(5, intFrom(company.default_visit_duration_minutes, 30));
    const breakMinutes = Math.max(0, intFrom(company.appointment_break_minutes, 0));
    return { start, end, duration, breakMinutes };
  }


  function normalizeCompanyPaymentMethods(company) {
    let raw = company?.payment_methods;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { raw = null; }
    }
    const source = Array.isArray(raw) && raw.length ? raw : [{ name: "gotówka" }, { name: "karta kredytowa" }, { name: "karnet" }, { name: "pakiet" }, { name: "gratis" }];
    const seen = new Set();
    return source.map((item) => String(item?.name || item || "").trim()).filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function paymentMethodOptions(company, selected = "gotówka") {
    const methods = normalizeCompanyPaymentMethods(company);
    if (!methods.some((m) => m.toLowerCase() === "gotówka")) methods.unshift("gotówka");
    return methods.map((name) => `<option value="${escapeHtml(name)}" ${String(name).toLowerCase() === String(selected || "").toLowerCase() ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
  }


  function combineDateTimeIso(dateValue, timeValue) {
    const date = String(dateValue || "").slice(0, 10);
    const time = normalizeTime(timeValue);
    if (!date || !time) return null;
    const localDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(localDate.getTime())) return `${date}T${time}:00`;
    return localDate.toISOString();
  }

  function customerName(customer) {
    return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.full_name || customer?.name || customer?.email || "-";
  }


  function isActiveClient(client) {
    const status = String(client?.status || "").trim().toLowerCase();
    return client?.deleted_at == null
      && client?.active !== false
      && !["usunięty", "usuniety", "deleted", "archived", "zarchiwizowany"].includes(status);
  }

  function clientSearchText(client) {
    return [customerName(client), client?.phone || "", client?.email || ""].filter(Boolean).join(" · ");
  }

  function clientSearchFieldHtml(prefix, options = {}) {
    const addHtml = options.addLabel && options.addTarget ? `<button type="button" class="bm-secondary-btn cm-related-add-btn" data-open-related="${escapeHtml(options.addTarget)}" data-related-type="client">${escapeHtml(options.addLabel)}</button>` : "";
    return `
      <label>Klient
        <div class="cm-client-search" data-client-search-wrap>
          <input type="search" id="${escapeHtml(prefix)}Search" class="cm-client-search-input" data-client-search data-client-hidden="${escapeHtml(prefix)}Id" placeholder="Szukaj klienta z bazy" autocomplete="off" required>
          <input type="hidden" id="${escapeHtml(prefix)}Id" name="customerId">
          <div class="cm-client-search-results" data-client-results hidden></div>
        </div>
        ${addHtml}
        <small class="cm-muted">Wpisz imię, nazwisko, telefon lub email klienta.</small>
      </label>`;
  }

  function setupClientSearchFields(clients) {
    const activeClients = (clients || []).filter(isActiveClient);
    const byId = new Map(activeClients.map((client) => [String(client.id), client]));
    const normalized = activeClients.map((client) => ({ client, label: clientSearchText(client), haystack: clientSearchText(client).toLowerCase() }));

    document.querySelectorAll("[data-client-search]").forEach((input) => {
      if (input.dataset.cmClientSearchReady === "1") return;
      input.dataset.cmClientSearchReady = "1";
      const wrap = input.closest("[data-client-search-wrap]");
      const results = wrap?.querySelector("[data-client-results]");
      const hidden = document.getElementById(input.dataset.clientHidden || "");
      if (!wrap || !results || !hidden) return;

      const close = () => { results.hidden = true; };
      const selectClient = (client) => {
        input.value = clientSearchText(client);
        hidden.value = client.id;
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        close();
      };
      const render = () => {
        const q = String(input.value || "").trim().toLowerCase();
        if (hidden.value) {
          const current = byId.get(String(hidden.value));
          if (!current || input.value !== clientSearchText(current)) {
            hidden.value = "";
            hidden.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        const matches = normalized.filter((row) => !q || row.haystack.includes(q)).slice(0, 12);
        if (!matches.length) {
          results.innerHTML = `<div class="cm-client-search-empty">Brak aktywnych klientów dla tej frazy.</div>`;
          results.hidden = false;
          return;
        }
        results.innerHTML = matches.map((row) => `
          <button type="button" class="cm-client-search-item" data-client-id="${escapeHtml(row.client.id)}">
            ${escapeHtml(row.label)}
          </button>
        `).join("");
        results.hidden = false;
      };

      input.addEventListener("input", render);
      input.addEventListener("focus", render);
      results.addEventListener("mousedown", (event) => {
        const button = event.target.closest("[data-client-id]");
        if (!button) return;
        event.preventDefault();
        const client = byId.get(String(button.dataset.clientId));
        if (client) selectClient(client);
      });
      document.addEventListener("click", (event) => {
        if (!wrap.contains(event.target)) close();
      });
    });
  }

  function setClientSearchValue(form, clientId, clientsById) {
    if (!form) return;
    const hidden = form.elements.customerId;
    const input = form.querySelector("[data-client-search]");
    if (hidden) hidden.value = clientId || "";
    if (input) {
      const client = clientsById?.[clientId];
      input.value = client ? clientSearchText(client) : "";
    }
  }

  function personName(person) { return person?.full_name || person?.email || person?.name || "-"; }
  function serviceName(service) { return service?.name || "-"; }
  function productName(product) { return product?.name || "-"; }



  function activeGenericItem(item) {
    const status = String(item?.status || '').trim().toLowerCase();
    return item?.deleted_at == null
      && item?.deleted !== true
      && item?.active !== false
      && !['usunięty','usuniety','deleted','archived','zarchiwizowany','usunięte'].includes(status);
  }

  function entitySearchFieldHtml(config) {
    const required = config.required ? 'required' : '';
    const addHtml = config.addLabel && config.addTarget ? `<button type="button" class="bm-secondary-btn cm-related-add-btn" data-open-related="${escapeHtml(config.addTarget)}" data-related-type="${escapeHtml(config.type)}">${escapeHtml(config.addLabel)}</button>` : "";
    return `
      <label>${escapeHtml(config.label)}
        <div class="cm-client-search cm-entity-search" data-entity-search-wrap>
          <input type="search" id="${escapeHtml(config.prefix)}Search" class="cm-client-search-input" data-entity-search data-entity-type="${escapeHtml(config.type)}" data-entity-hidden="${escapeHtml(config.prefix)}Id" data-entity-name="${escapeHtml(config.name)}" placeholder="${escapeHtml(config.placeholder)}" autocomplete="off" ${required}>
          <input type="hidden" id="${escapeHtml(config.prefix)}Id" name="${escapeHtml(config.name)}">
          <div class="cm-client-search-results" data-entity-results hidden></div>
        </div>
        ${addHtml}
        <small class="cm-muted">${escapeHtml(config.hint || 'Zacznij pisać, aby wyszukać z bazy.')}</small>
      </label>`;
  }

  function entityConfigs(data) {
    const employees = (data.users || []).filter(activeGenericItem).map((item) => ({
      type: 'employee',
      id: String(item.id || ''),
      label: personName(item),
      name: personName(item),
      haystack: [personName(item), item.email || '', item.phone || ''].join(' ').toLowerCase()
    })).filter((row) => row.id);
    const services = (data.services || []).filter(activeGenericItem).map((item) => {
      const price = servicePrice(item);
      const name = item.name || 'Usługa';
      return { type: 'service', id: String(item.id || ''), label: `${name}${price ? ` — ${price.toFixed(2).replace('.00','')} PLN` : ''}`, name, price, haystack: [name, item.category_name || '', price].join(' ').toLowerCase() };
    }).filter((row) => row.id);
    const products = (data.products || []).filter(activeGenericItem).map((item) => {
      const price = productPrice(item);
      const name = productName(item);
      return { type: 'product', id: String(item.id || ''), label: `${name}${price ? ` — ${price.toFixed(2).replace('.00','')} PLN` : ''}`, name, price, haystack: [name, item.sku || '', item.barcode || '', price].join(' ').toLowerCase() };
    }).filter((row) => row.id);
    return { employee: employees, service: services, product: products };
  }

  function setupEntitySearchFields(data) {
    const groups = entityConfigs(data);
    document.querySelectorAll('[data-entity-search]').forEach((input) => {
      if (input.dataset.cmEntitySearchReady === '1') return;
      input.dataset.cmEntitySearchReady = '1';
      const wrap = input.closest('[data-entity-search-wrap]');
      const results = wrap?.querySelector('[data-entity-results]');
      const hidden = document.getElementById(input.dataset.entityHidden || '');
      if (!wrap || !results || !hidden) return;
      const rows = groups[input.dataset.entityType] || [];
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      const close = () => { results.hidden = true; };
      const selectRow = (row) => {
        input.value = row.label;
        hidden.value = row.id;
        hidden.dataset.label = row.label || '';
        hidden.dataset.name = row.name || row.label || '';
        hidden.dataset.price = row.price != null ? String(row.price) : '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        close();
      };
      const render = () => {
        const q = String(input.value || '').trim().toLowerCase();
        if (hidden.value) {
          const current = byId.get(String(hidden.value));
          if (!current || input.value !== current.label) {
            hidden.value = '';
            hidden.dataset.label = '';
            hidden.dataset.name = '';
            hidden.dataset.price = '';
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        const matches = rows.filter((row) => !q || row.haystack.includes(q)).slice(0, 12);
        if (!matches.length) {
          results.innerHTML = `<div class="cm-client-search-empty">Brak wyników dla tej frazy.</div>`;
          results.hidden = false;
          return;
        }
        results.innerHTML = matches.map((row) => `
          <button type="button" class="cm-client-search-item" data-entity-id="${escapeHtml(row.id)}">
            ${escapeHtml(row.label)}
          </button>
        `).join('');
        results.hidden = false;
      };
      input.addEventListener('input', render);
      input.addEventListener('focus', render);
      results.addEventListener('mousedown', (event) => {
        const button = event.target.closest('[data-entity-id]');
        if (!button) return;
        event.preventDefault();
        const row = byId.get(String(button.dataset.entityId));
        if (row) selectRow(row);
      });
      document.addEventListener('click', (event) => {
        if (!wrap.contains(event.target)) close();
      });
    });
  }

  function setEntitySearchValue(form, fieldName, value, data) {
    if (!form) return;
    const hidden = form.elements[fieldName];
    const input = form.querySelector(`[data-entity-name="${CSS.escape(fieldName)}"]`);
    const groups = entityConfigs(data || {});
    const type = input?.dataset.entityType || '';
    const row = (groups[type] || []).find((item) => String(item.id) === String(value || '')) || null;
    if (hidden) {
      hidden.value = row ? row.id : (value || '');
      hidden.dataset.label = row?.label || '';
      hidden.dataset.name = row?.name || row?.label || '';
      hidden.dataset.price = row?.price != null ? String(row.price) : '';
    }
    if (input) input.value = row ? row.label : '';
  }
  function moneyNumber(value) {
    const n = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function servicePrice(service) {
    if (!service) return 0;
    return moneyNumber(service.price_from ?? service.price ?? service.price_to ?? 0);
  }

  function firstPositiveMoney(...values) {
    for (const value of values) {
      const n = moneyNumber(value);
      if (n > 0) return n;
    }
    return 0;
  }

  function productPrice(product) {
    if (!product) return 0;
    return firstPositiveMoney(
      product.sale_price,
      product.price,
      product.gross_price,
      product.net_price,
      product.retail_price,
      product.selling_price,
      product.sale_gross_price,
      product.unit_price,
      product.last_purchase_price
    );
  }

  function bindDashboardTotalCalculator(form, lookups) {
    if (!form) return;
    const serviceSelect = form.elements.serviceId;
    const productSelect = form.elements.productId;
    const passSelect = form.elements.passId;
    const totalInput = form.elements.total;
    if (!totalInput) return;

    const calculate = () => {
      const service = lookups.servicesById[String(serviceSelect?.value || "")];
      const product = lookups.productsById[String(productSelect?.value || "")];
      const serviceValue = firstPositiveMoney(serviceSelect?.dataset?.price, servicePrice(service));
      const productValue = firstPositiveMoney(productSelect?.dataset?.price, productPrice(product));
      const passId = String(passSelect?.value || "");
      const pass = lookups.passesById?.[passId];
      let serviceCharge = serviceValue;
      if (passId && pass) {
        if (pass.pass_type === "service" || pass.pass_type === "units") serviceCharge = 0;
        else serviceCharge = Math.max(0, serviceValue - Number(pass.remaining || 0));
      }
      const total = serviceCharge + productValue;
      totalInput.value = total.toFixed(2);
    };

    serviceSelect?.addEventListener("change", calculate);
    serviceSelect?.addEventListener("input", calculate);
    productSelect?.addEventListener("change", calculate);
    productSelect?.addEventListener("input", calculate);
    passSelect?.addEventListener("change", calculate);
    form.addEventListener("change", (event) => {
      const name = event.target?.name;
      if (["serviceId", "productId", "passId"].includes(name)) calculate();
    });
    calculate();
  }

  function uniqueUsers(users) {
    const seen = new Set();
    const out = [];
    (users || []).forEach((user) => {
      const key = String(user?.id || user?.email || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(user);
    });
    return out;
  }

  function workersStateKey(ctx, dateIso) {
    return `cm_dashboard_active_workers:${ctx.companyId}:${dateIso}`;
  }

  function loadActiveWorkerIds(ctx, dateIso, users) {
    const allIds = uniqueUsers(users).map((user) => user.id).filter(Boolean);
    try {
      const raw = localStorage.getItem(workersStateKey(ctx, dateIso));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id) => allIds.includes(id));
          if (valid.length) return valid;
        }
      }
    } catch (_) {}
    return allIds;
  }

  function saveActiveWorkerIds(ctx, dateIso, ids) {
    try { localStorage.setItem(workersStateKey(ctx, dateIso), JSON.stringify(ids || [])); } catch (_) {}
  }

  function optionList(items, labelFn, empty = "Brak danych", attrsFn = null) {
    if (!items.length) return `<option value="">${escapeHtml(empty)}</option>`;
    return items.map((item) => {
      const attrs = typeof attrsFn === "function" ? ` ${attrsFn(item)}` : "";
      return `<option value="${escapeHtml(item.id)}"${attrs}>${escapeHtml(labelFn(item))}</option>`;
    }).join("");
  }

  function timeOptions(selected = "") {
    const rows = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 5) {
        const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        rows.push(`<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`);
      }
    }
    return rows.join("");
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label || "Przekroczono czas oczekiwania na Supabase.")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function readCachedJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  async function getContext() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano połączenia z Supabase." };
    let accessResult;
    let contextResult;
    try {
      [accessResult, contextResult] = await withTimeout(Promise.all([
        window.cmSupabase.rpc("get_my_access"),
        window.cmSupabase.rpc("get_effective_company_context")
      ]), 9000, "Supabase nie odpowiedział przy ładowaniu Dashboardu. Odśwież stronę lub sprawdź połączenie.");
    } catch (error) {
      const cachedAccess = readCachedJson("cm_access");
      const cachedContext = readCachedJson("cm_effective_company");
      if (cachedAccess?.allowed === true && cachedContext?.company_id) {
        const cachedCtx = { ok: true, access: cachedAccess, context: cachedContext, companyId: cachedContext.company_id, cached: true };
        if (canOpenDashboard(cachedCtx)) return cachedCtx;
      }
      return { ok: false, message: error.message || "Nie udało się pobrać kontekstu Supabase." };
    }
    const { data: access, error: accessError } = accessResult || {};
    const { data: context, error: contextError } = contextResult || {};
    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    if (!context.company_id) return { ok: false, message: "Brak wybranej firmy. OWNER musi najpierw wejść w firmę z zakładki Firmy." };
    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!canOpenDashboard(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania CompanyManager." };
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
  }

  async function autoMarkUnfinishedAppointments(ctx) {
    if (!window.cmSupabase || !ctx?.companyId) return;
    try {
      const { error } = await window.cmSupabase.rpc("auto_mark_unfinished_appointments", { p_company_id: ctx.companyId });
      if (error) {
        console.warn("CompanyManager auto unfinished appointments skipped", error);
      }
    } catch (error) {
      console.warn("CompanyManager auto unfinished appointments failed", error);
    }
  }

  async function fetchDashboardData(ctx) {
    const [appointmentsRes, clientsRes, servicesRes, productsRes, usersRes, passesRes, companyRes, workSchedulesRes, daysOffRes, categoriesRes, positionsRes] = await Promise.all([
      window.cmSupabase
        .from("appointments")
        .select("id, company_id, date, time, start_time, end_time, customer_id, client_id, employee_id, employee_name, service_id, service_name, position_id, product_id, product_name, product_price, product_quantity, pass_id, pass_name, pass_used_value, pass_used_units, status, deleted, note, price, total, payment_method, cancellation_reason, cancelled_at, starts_at, ends_at, appointment_datetime, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
      window.cmSupabase
        .from("clients")
        .select("id, company_id, first_name, last_name, full_name, email, phone, status, active, deleted_at")
        .eq("company_id", ctx.companyId)
        .order("last_name", { ascending: true }),
      window.cmSupabase
        .from("services")
        .select("id, company_id, name, price_from, price_to, price, duration_hours, duration_minutes, position_id, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("products")
        .select("id, company_id, name, price, sale_price, gross_price, net_price, retail_price, selling_price, sale_gross_price, unit_price, last_purchase_price, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId }),
      window.cmSupabase
        .from("passes")
        .select("id, company_id, customer_id, beneficiary_client_id, buyer_client_id, service_id, service_name, name, number, pass_type, value, remaining, total_units, remaining_units, valid_until, status, active")
        .eq("company_id", ctx.companyId)
        .eq("active", true),
      window.cmSupabase
        .from("companies")
        .select("id, working_day_start, working_day_end, default_visit_duration_minutes, appointment_break_minutes, payment_methods")
        .eq("id", ctx.companyId)
        .maybeSingle(),
      window.cmSupabase
        .from("employee_work_schedules")
        .select("id, company_id, employee_id, employee_name, day_of_week, is_working, start_time, end_time, break_start, break_end")
        .eq("company_id", ctx.companyId),
      window.cmSupabase
        .from("days_off")
        .select("id, company_id, employee_id, employee_name, start_date, end_date, type, status, deleted_at")
        .eq("company_id", ctx.companyId)
        .is("deleted_at", null),
      window.cmSupabase
        .from("service_categories")
        .select("id, company_id, name, active, status, deleted_at")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("positions")
        .select("id, company_id, name, active, status, deleted_at")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true })
    ]);
    if (appointmentsRes.error) throw appointmentsRes.error;
    if (clientsRes.error) throw clientsRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (productsRes.error) throw productsRes.error;
    const safeUsersData = usersRes.error ? [] : (usersRes.data || []);
    if (usersRes.error) {
      console.warn("Dashboard users dropdown skipped", usersRes.error.message || usersRes.error);
    }
    if (passesRes.error) throw passesRes.error;
    if (companyRes.error) throw companyRes.error;
    if (workSchedulesRes.error) console.warn("Dashboard work schedules skipped", workSchedulesRes.error.message || workSchedulesRes.error);
    if (daysOffRes.error) console.warn("Dashboard days off skipped", daysOffRes.error.message || daysOffRes.error);
    if (categoriesRes.error) console.warn("Dashboard service categories skipped", categoriesRes.error.message || categoriesRes.error);
    if (positionsRes.error) console.warn("Dashboard positions skipped", positionsRes.error.message || positionsRes.error);
    return {
      company: companyRes.data || {},
      workSchedules: workSchedulesRes.data || [],
      daysOff: daysOffRes.data || [],
      appointments: appointmentsRes.data || [],
      clients: (clientsRes.data || []).filter(isActiveClient),
      services: (servicesRes.data || []).filter((item) => item.active !== false),
      products: (productsRes.data || []).filter((item) => item.active !== false),
      categories: (categoriesRes.data || []).filter(activeGenericItem),
      positions: (positionsRes.data || []).filter(activeGenericItem),
      users: uniqueUsers(safeUsersData),
      passes: (passesRes.data || []).filter((item) => item.status !== "usunięte" && item.status !== "zrealizowane")
    };
  }

  function appointmentDate(item) { return item.date || String(item.starts_at || item.appointment_datetime || item.created_at || "").slice(0, 10); }
  function appointmentStart(item) { return normalizeTime(item.start_time || item.time || item.starts_at || item.appointment_datetime || "06:00"); }
  function appointmentEnd(item) {
    const direct = normalizeTime(item.end_time || item.ends_at);
    if (direct) return direct;
    const start = minutesFromTime(appointmentStart(item));
    if (start == null) return "06:05";
    const end = start + 30;
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }
  function appointmentClientId(item) { return item.customer_id || item.client_id || ""; }
  function appointmentTotal(item, lookups = null) {
    const saved = firstPositiveMoney(item?.total, item?.price);
    if (saved > 0) return saved;
    const service = lookups?.servicesById?.[item?.service_id];
    const product = lookups?.productsById?.[item?.product_id];
    return servicePrice(service) + firstPositiveMoney(item?.product_price, productPrice(product));
  }

  function appointmentLabel(item, lookups) {
    const client = lookups.clientsById[appointmentClientId(item)];
    const employee = lookups.usersById[item.employee_id] || findUserByAppointmentEmployeeName(lookups, item);
    const service = lookups.servicesById[item.service_id];
    const product = lookups.productsById[item.product_id];
    const itemName = serviceName(service) !== "-" ? serviceName(service) : (item.product_name || productName(product));
    return [plDate(appointmentDate(item)), appointmentStart(item), appointmentEnd(item), customerName(client), personName(employee), itemName].filter(Boolean).join(" — ");
  }

  function buildLookups(data) {
    return {
      clientsById: Object.fromEntries(data.clients.map((item) => [item.id, item])),
      servicesById: Object.fromEntries(data.services.map((item) => [item.id, item])),
      productsById: Object.fromEntries(data.products.map((item) => [item.id, item])),
      usersById: Object.fromEntries(data.users.map((item) => [item.id, item])),
      passesById: Object.fromEntries((data.passes || []).map((item) => [item.id, item]))
    };
  }

  function passLabel(pass) {
    if (!pass) return "";
    const rest = pass.pass_type === "service" || pass.pass_type === "units"
      ? `${Number(pass.remaining_units || 0)}/${Number(pass.total_units || 0)} wejść`
      : `pozostało ${Number(pass.remaining || 0).toFixed(2)} PLN`;
    return [pass.name || "Karnet", pass.number || "", rest, pass.valid_until ? `ważny do ${plDate(pass.valid_until)}` : ""].filter(Boolean).join(" — ");
  }

  function passCanBeUsedFor(pass, clientId, serviceId) {
    if (!pass || pass.active === false) return false;
    const owner = pass.beneficiary_client_id || pass.customer_id;
    if (clientId && owner && String(owner) !== String(clientId)) return false;
    if (pass.valid_until && String(pass.valid_until).slice(0, 10) < iso(new Date())) return false;
    if ((pass.pass_type === "service" || pass.pass_type === "units") && Number(pass.remaining_units || 0) <= 0) return false;
    if (!(pass.pass_type === "service" || pass.pass_type === "units") && Number(pass.remaining || 0) <= 0) return false;
    if (pass.service_id && serviceId && String(pass.service_id) !== String(serviceId)) return false;
    return true;
  }

  function passOptionsFor(data, clientId = "", serviceId = "", selected = "") {
    const normalizedClientId = String(clientId || "").trim();
    const normalizedServiceId = String(serviceId || "").trim();
    if (!normalizedClientId) return `<option value="">Najpierw wybierz klienta</option>`;
    const passes = (data.passes || []).filter((pass) => passCanBeUsedFor(pass, normalizedClientId, normalizedServiceId));
    if (!passes.length) return `<option value="">Brak aktywnego karnetu klienta</option>`;
    return `<option value="">Nie używaj karnetu</option>` + passes.map((pass) => {
      const selectedAttr = String(pass.id) === String(selected) ? "selected" : "";
      const type = pass.pass_type || "amount";
      const isServicePass = type === "service" || type === "units";
      const note = isServicePass ? "rozliczy usługę" : "pomniejszy kwotę usługi";
      return `<option value="${escapeHtml(pass.id)}" ${selectedAttr} data-pass-type="${escapeHtml(type)}" data-remaining="${escapeHtml(String(pass.remaining || 0))}" data-remaining-units="${escapeHtml(String(pass.remaining_units || 0))}">${escapeHtml(passLabel(pass) + " — " + note)}</option>`;
    }).join("");
  }

  function findUserByAppointmentEmployeeName(lookups, item) {
    const wanted = String(item?.employee_name || "").trim().toLowerCase();
    if (!wanted) return null;
    return Object.values(lookups.usersById || {}).find((user) => String(personName(user)).trim().toLowerCase() === wanted) || null;
  }

  function appointmentEmployeeMatches(item, employee) {
    if (!item || !employee) return false;
    if (item.employee_id && item.employee_id === employee.id) return true;
    const savedName = String(item.employee_name || "").trim().toLowerCase();
    return savedName && savedName === String(personName(employee)).trim().toLowerCase();
  }

  function jsDayForIso(dateIso) {
    const [y, m, d] = String(dateIso || "").slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return new Date().getDay();
    return new Date(y, m - 1, d).getDay();
  }

  function employeeScheduleForDate(data, employee, dateIso) {
    const day = jsDayForIso(dateIso);
    return (data.workSchedules || []).find((row) => {
      if (Number(row.day_of_week) !== Number(day)) return false;
      if (row.employee_id && employee?.id && String(row.employee_id) === String(employee.id)) return true;
      const savedName = String(row.employee_name || "").trim().toLowerCase();
      return savedName && savedName === String(personName(employee)).trim().toLowerCase();
    }) || null;
  }

  function employeeDayOffForDate(data, employee, dateIso) {
    const date = String(dateIso || "").slice(0, 10);
    return (data.daysOff || []).some((row) => {
      const status = String(row.status || "").toLowerCase();
      if (["deleted", "usunięte", "void"].includes(status)) return false;
      const start = String(row.start_date || row.date || row.created_at || "").slice(0, 10);
      const end = String(row.end_date || row.start_date || row.date || "").slice(0, 10) || start;
      if (!start || date < start || date > end) return false;
      if (row.employee_id && employee?.id && String(row.employee_id) === String(employee.id)) return true;
      const savedName = String(row.employee_name || "").trim().toLowerCase();
      return savedName && savedName === String(personName(employee)).trim().toLowerCase();
    });
  }

  function employeeWorkWindow(data, employee, dateIso, settings) {
    const schedule = employeeScheduleForDate(data, employee, dateIso);
    if (schedule && schedule.is_working === false) return { off: true, start: null, end: null, source: "schedule" };
    const start = normalizeTime(schedule?.start_time || settings.start || "08:00") || "08:00";
    const end = normalizeTime(schedule?.end_time || settings.end || "20:00") || "20:00";
    return { off: false, start, end, source: schedule ? "schedule" : "company" };
  }

  function scheduleRows(data, lookups, dateIso, activeWorkerIds = []) {
    const active = data.appointments.filter((item) => appointmentDate(item) === dateIso && item.deleted !== true && !["odwołana", "odwołane", "usunięte"].includes(String(item.status || "").toLowerCase()));
    const settings = dashboardSettings(data);
    const visitDuration = Math.max(5, settings.duration || 30);
    const breakMinutes = Math.max(0, settings.breakMinutes || 0);
    const step = visitDuration + breakMinutes;
    const windows = new Map();
    data.users.forEach((employee) => windows.set(employee.id, employeeWorkWindow(data, employee, dateIso, settings)));
    const starts = Array.from(windows.values()).filter((w) => !w.off).map((w) => minutesFromTime(w.start)).filter((v) => v != null);
    const ends = Array.from(windows.values()).filter((w) => !w.off).map((w) => minutesFromTime(w.end)).filter((v) => v != null);
    const workStart = starts.length ? Math.min(...starts) : (minutesFromTime(settings.start) ?? minutesFromTime("08:00"));
    const workEnd = ends.length ? Math.max(...ends) : (minutesFromTime(settings.end) ?? minutesFromTime("20:00"));
    const rows = [];

    if (workStart == null || workEnd == null || workEnd <= workStart) {
      rows.push({ start: "08:00", end: "08:30", label: "08:00 - 08:30" });
    } else {
      for (let min = workStart; min + visitDuration <= workEnd; min += step) {
        const startTime = timeFromMinutes(min);
        const endTime = timeFromMinutes(min + visitDuration);
        rows.push({ start: startTime, end: endTime, label: `${startTime} - ${endTime}` });
        if (rows.length > 220) break;
      }
    }

    return rows.map((slot) => {
      const cells = data.users.map((employee) => {
        const slotMin = minutesFromTime(slot.start);
        const windowForEmployee = windows.get(employee.id) || employeeWorkWindow(data, employee, dateIso, settings);
        const windowStart = minutesFromTime(windowForEmployee.start);
        const windowEnd = minutesFromTime(windowForEmployee.end);
        const isDayOff = employeeDayOffForDate(data, employee, dateIso);
        const outsideWork = windowForEmployee.off || isDayOff || slotMin == null || windowStart == null || windowEnd == null || slotMin < windowStart || (slotMin + visitDuration) > windowEnd;
        const visit = active.find((item) => {
          if (!appointmentEmployeeMatches(item, employee)) return false;
          const start = minutesFromTime(appointmentStart(item));
          const end = minutesFromTime(appointmentEnd(item));
          return slotMin != null && start != null && end != null && slotMin >= start && slotMin < end;
        });
        const inactiveClass = outsideWork || !activeWorkerIds.includes(employee.id) ? " inactive-worker" : "";
        if (!visit) {
          const label = outsideWork ? (isDayOff ? "WOLNE" : "POZA GRAFIKIEM") : "FREE";
          return `<td class="bm-schedule-slot free${inactiveClass}" data-employee-id="${escapeHtml(employee.id)}" data-time="${escapeHtml(slot.start)}" data-date="${escapeHtml(dateIso)}" data-outside-work="${outsideWork ? "1" : "0"}"><span>${label}</span></td>`;
        }
        const client = lookups.clientsById[appointmentClientId(visit)];
        const service = lookups.servicesById[visit.service_id];
        const product = lookups.productsById[visit.product_id];
        const isStart = appointmentStart(visit) === slot.start;
        const label = isStart
          ? `${escapeHtml(appointmentStart(visit))} - ${escapeHtml(appointmentEnd(visit))}<br>${escapeHtml(customerName(client))}: ${escapeHtml(serviceName(service) !== "-" ? serviceName(service) : productName(product))}`
          : `<span class="bm-continuation">ZAJĘTE do ${escapeHtml(appointmentEnd(visit))}</span>`;
        const tooltip = [
          `Klient: ${customerName(client)}`,
          `Telefon: ${client?.phone || "Brak numeru"}`,
          `Cena: ${appointmentTotal(visit, lookups).toFixed(2)} PLN`,
          `Pracownik: ${personName(employee)}`,
          `Opis: ${visit.note || "Brak opisu"}`
        ].join("\n");
        return `<td class="bm-schedule-slot busy${inactiveClass}" data-visit-id="${escapeHtml(visit.id)}" data-employee-id="${escapeHtml(employee.id)}" data-time="${escapeHtml(slot.start)}" data-date="${escapeHtml(dateIso)}" data-slot-tooltip="${escapeHtml(tooltip)}"><span>${label}</span></td>`;
      }).join("");
      return `<tr><th class="bm-time-col">${escapeHtml(slot.label)}</th>${cells}</tr>`;
    }).join("");
  }

  function renderTable(headers, rows, emptyText) {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText || "Brak danych.")}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function showOnly(panel, allPanels) {
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(panel, allPanels);
    allPanels.forEach((item) => { if (item) item.hidden = item !== panel; });
  }


  function closeDashboardModals(panels = []) {
    panels.filter(Boolean).forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove('cm-modal-active', 'cm-as-modal');
    });
    if (typeof window.cmHardCloseAllModalPanels === 'function') {
      window.cmHardCloseAllModalPanels();
    } else if (typeof window.cmCloseAllModalPanels === 'function') {
      window.cmCloseAllModalPanels(panels);
    }
    document.querySelectorAll('#dashboardAppointmentForm, #dashboardEditVisitPanel, #dashboardFinishVisitPanel, #dashboardCancelVisitPanel').forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove('cm-modal-active', 'cm-as-modal');
    });
    document.body.classList.remove('cm-modal-open');
    const overlay = document.getElementById('cmGlobalFormOverlay');
    if (overlay) {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.pointerEvents = 'none';
      overlay.style.opacity = '0';
      window.setTimeout(() => {
        if (!document.body.classList.contains('cm-modal-open')) overlay.removeAttribute('style');
      }, 80);
    }
    if (typeof window.cmUpdateGlobalModalState === 'function') window.cmUpdateGlobalModalState();
  }

  function payloadFromForm(ctx, formData, form = null) {
    const serviceId = String(formData.get("serviceId") || "").trim();
    const productId = String(formData.get("productId") || "").trim();
    const currentForm = form;
    const productHidden = currentForm?.elements?.productId || null;
    const selectedProductName = productHidden?.dataset?.name || null;
    const selectedProductPrice = firstPositiveMoney(productHidden?.dataset?.price);
    const start = normalizeTime(formData.get("start"));
    const end = normalizeTime(formData.get("end"));
    const clientId = String(formData.get("customerId") || "").trim();
    const date = String(formData.get("date") || "").trim();
    const startsAt = combineDateTimeIso(date, start);
    const endsAt = combineDateTimeIso(date, end);
    const passId = String(formData.get("passId") || "").trim();
    const total = Number(String(formData.get("total") || "0").replace(",", ".")) || 0;
    const employeeId = String(formData.get("employeeId") || "").trim();
    const employeeHidden = currentForm?.elements?.employeeId || null;
    const employeeName = employeeHidden?.dataset?.name || String(formData.get("employeeName") || "").trim() || null;
    return {
      company_id: ctx.companyId,
      date,
      time: start || null,
      start_time: start || null,
      end_time: end || null,
      starts_at: startsAt,
      ends_at: endsAt,
      appointment_datetime: startsAt,
      customer_id: clientId || null,
      client_id: clientId || null,
      // 037H: nie wysyłamy starego/local employee_id do FK profiles.
      // Pracownika zapisujemy tekstowo, żeby FK nie blokował zapisu wizyty.
      employee_id: null,
      employee_name: employeeName,
      service_id: serviceId || null,
      product_id: productId || null,
      product_name: productId ? selectedProductName : null,
      product_price: productId ? selectedProductPrice : null,
      product_quantity: productId ? 1 : null,
      pass_id: passId || null,
      pass_name: passId ? (document.querySelector(`select[name="passId"] option[value="${CSS.escape(passId)}"]`)?.textContent || "Karnet") : null,
      status: String(formData.get("status") || "zaplanowane").trim() || "zaplanowane",
      deleted: false,
      note: String(formData.get("note") || "").trim() || null,
      price: total,
      total,
      payment_method: String(formData.get("payment") || "gotówka").trim(),
      updated_at: new Date().toISOString()
    };
  }

  function validatePayload(payload) {
    if (!payload.date || !payload.start_time || !payload.end_time || !payload.customer_id || !payload.employee_name) return "Uzupełnij datę, godzinę, klienta i pracownika.";
    if (!payload.service_id && !payload.product_id) return "Wybierz usługę albo produkt.";
    return "";
  }

  function fillEditForm(form, item) {
    if (!form || !item) return;
    form.elements.date.value = appointmentDate(item) || iso(new Date());
    form.elements.start.value = appointmentStart(item) || "06:00";
    form.elements.end.value = appointmentEnd(item) || "06:30";
    setClientSearchValue(form, appointmentClientId(item) || "", lookups.clientsById || {});
    setEntitySearchValue(form, "employeeId", item.employee_id || "", { users: Object.values(lookups.usersById || {}) });
    if (!form.elements.employeeId?.value && item.employee_name && form.elements.employeeId) {
      form.elements.employeeId.dataset.name = item.employee_name;
      const input = form.querySelector('[data-entity-name="employeeId"]');
      if (input) input.value = item.employee_name;
    }
    setEntitySearchValue(form, "serviceId", item.service_id || "", { services: Object.values(lookups.servicesById || {}) });
    setEntitySearchValue(form, "productId", item.product_id || "", { products: Object.values(lookups.productsById || {}) });
    if (form.elements.passId) {
      form.elements.passId.innerHTML = passOptionsFor({ passes: Object.values(lookups.passesById || {}) }, appointmentClientId(item), item.service_id || "", item.pass_id || "");
      form.elements.passId.value = item.pass_id || "";
    }
    const savedTotal = appointmentTotal(item, lookups);
    form.elements.total.value = savedTotal ? savedTotal.toFixed(2) : "0.00";
    if (!savedTotal) form.elements.serviceId?.dispatchEvent(new Event("change", { bubbles: true }));
    form.elements.payment.value = item.payment_method || "gotówka";
    form.elements.note.value = item.note || "";
  }

  async function renderDashboard() {
    const area = getPanelArea();
    if (!area) return;
    if (!window.cmSupabase) {
      area.innerHTML = `<section class="bm-page-card"><h2>Dashboard</h2><p class="panel-message" style="color:#fca5a5">Nie załadowano Supabase.</p></section>`;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const selectedDate = params.get("date") || iso(new Date());

    area.innerHTML = `<section class="bm-page-card"><h2>Dashboard</h2><p>Ładuję dane z Supabase...</p></section>`;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Dashboard</h2><p class="panel-message" style="color:#fca5a5">${escapeHtml(ctx.message)}</p></section>`;
      return;
    }

    await autoMarkUnfinishedAppointments(ctx);

    let data;
    try {
      data = await fetchDashboardData(ctx);
    } catch (error) {
      console.error("CompanyManager dashboard Supabase error", error);
      const details = error?.message || error?.details || error?.hint || error?.code || String(error);
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd dashboardu</h2><p class="panel-message" style="color:#fca5a5;white-space:pre-wrap">${escapeHtml(details)}</p><pre style="white-space:pre-wrap;background:rgba(15,23,42,.85);border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:12px;color:#fca5a5;overflow:auto;max-height:260px">${escapeHtml(JSON.stringify(error, null, 2))}</pre></section>`;
      return;
    }

    const lookups = buildLookups(data);
    const allowAdd = canAddAppointments(ctx);
    const allowEdit = canEditAppointments(ctx);
    const allowFinish = canFinishAppointments(ctx);
    const allowCancel = canCancelAppointments(ctx);
    const customerOptions = optionList(data.clients, customerName, "Brak klientów");
    const employeeOptions = optionList(data.users, personName, "Brak pracowników/użytkowników");
    const serviceOptions = optionList(
      data.services,
      (s) => `${s.name || "Usługa"}${servicePrice(s) ? ` — ${servicePrice(s).toFixed(2).replace(".00", "")} PLN` : ""}`,
      "Brak usług",
      (s) => `data-price="${escapeHtml(String(servicePrice(s)))}" data-name="${escapeHtml(s.name || "Usługa")}"`
    );
    const productOptions = optionList(
      data.products,
      (p) => `${productName(p)}${productPrice(p) ? ` — ${productPrice(p).toFixed(2).replace(".00", "")} PLN` : ""}`,
      "Brak produktów",
      (p) => `data-price="${escapeHtml(String(productPrice(p)))}" data-name="${escapeHtml(productName(p))}"`
    );
    const paymentOptionsHtml = paymentMethodOptions(data.company);
    const allPassOptions = passOptionsFor(data);
    const visibleVisits = data.appointments.filter((item) => item.deleted !== true && !["odwołana", "odwołane", "usunięte"].includes(String(item.status || "").toLowerCase()));
    const visitOptions = visibleVisits.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(appointmentLabel(item, lookups))}</option>`).join("");
    const finishableVisits = visibleVisits.filter((item) => !["zakończone", "odwołane", "usunięte"].includes(String(item.status || "").toLowerCase()));
    const finishVisitOptions = finishableVisits.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(appointmentLabel(item, lookups))}</option>`).join("");
    const appointmentRows = visibleVisits.slice(0, 20).map((item) => {
      const client = lookups.clientsById[appointmentClientId(item)];
      const employee = lookups.usersById[item.employee_id];
      const service = lookups.servicesById[item.service_id];
      return [escapeHtml(plDate(appointmentDate(item))), escapeHtml(`${appointmentStart(item)} - ${appointmentEnd(item)}`), escapeHtml(customerName(client)), escapeHtml(personName(employee)), escapeHtml(serviceName(service)), escapeHtml(item.status || "zaplanowane")];
    });

    const activeWorkerIds = loadActiveWorkerIds(ctx, selectedDate, data.users);
    const activeSet = new Set(activeWorkerIds);
    const workerChecks = data.users.map((employee) => {
      const checked = activeSet.has(employee.id) ? "checked" : "";
      return `<label data-worker-label="${escapeHtml(employee.id)}"><input type="checkbox" class="dash-worker-toggle" value="${escapeHtml(employee.id)}" ${checked}> ${escapeHtml(personName(employee))}</label>`;
    }).join("") || `<span class="bm-muted">Brak pracowników</span>`;
    const allWorkersChecked = data.users.length > 0 && activeWorkerIds.length === data.users.length;

    const employeeCount = Math.max(data.users.length, 1);
    const scheduleWidth = `${82 + (employeeCount * 180)}px`;
    const scheduleHead = `<thead><tr><th class="bm-time-head">Godzina</th>${data.users.map((employee) => `<th data-employee-head="${escapeHtml(employee.id)}" class="${activeSet.has(employee.id) ? "" : "inactive-worker"}">${escapeHtml(personName(employee))}</th>`).join("")}</tr></thead>`;
    const scheduleColgroup = `<colgroup><col class="bm-time-colgroup">${data.users.map(() => `<col class="bm-worker-colgroup">`).join("")}</colgroup>`;

    area.innerHTML = `
      <section class="bm-dashboard-schedule">
        <section class="bm-schedule-datebar">
          <button type="button" id="dashPrevDay" aria-label="Poprzedni dzień">‹</button>
          <strong id="dashRelativeLabel">${selectedDate === iso(new Date()) ? "dzisiaj" : escapeHtml(plDate(selectedDate))}</strong>
          <button type="button" id="dashNextDay" aria-label="Następny dzień">›</button>
          <span id="dashFullDate">${escapeHtml(dayHeader(selectedDate))}</span>
          <span class="bm-dashboard-actions">
            <button type="button" id="dashAddVisitBtn" ${allowAdd ? "" : "disabled"}>Dodaj</button>
            <button type="button" id="dashEditVisitBtn" class="bm-light-btn" ${allowEdit ? "" : "disabled"}>Edytuj</button>
            <button type="button" id="dashFinishVisitBtn" class="bm-light-btn" ${allowFinish ? "" : "disabled"}>Zakończ wizytę</button>
            <button type="button" id="dashCancelVisitBtn" class="bm-danger-btn" ${allowCancel ? "" : "disabled"}>Odwołaj wizytę</button>
            <button type="button" id="dashEmployeeCount" class="bm-worker-count">(${activeWorkerIds.length})</button>
          </span>
        </section>
        <div class="bm-schedule-table-wrap"><table class="bm-schedule-table" style="width:${scheduleWidth};min-width:${scheduleWidth};">${scheduleColgroup}${scheduleHead}<tbody>${scheduleRows(data, lookups, selectedDate, activeWorkerIds)}</tbody></table></div>
        <div class="bm-workers-popover" id="dashWorkersPopover" hidden>
          <h3>Pracownicy aktywni tego dnia</h3>
          <label><input type="checkbox" id="dashToggleAllWorkers" ${allWorkersChecked ? "checked" : ""}> Wszyscy</label>
          ${workerChecks}
        </div>
        <div class="bm-schedule-tooltip" id="dashSlotTooltip" hidden></div>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardAppointmentForm" hidden>
        <div class="bm-page-head"><h2>Dodaj wpis do grafiku</h2></div>
        <form id="dashboardAppointmentAddForm" class="bm-form-grid">
          <label>Data<input type="date" name="date" value="${escapeHtml(selectedDate)}" required></label>
          <label>Od<select name="start">${timeOptions(dashboardSettings(data).start)}</select></label>
          <label>Do<select name="end">${timeOptions(timeFromMinutes((minutesFromTime(dashboardSettings(data).start) || 480) + dashboardSettings(data).duration))}</select></label>
          ${clientSearchFieldHtml("dashAddClient", { addLabel: "Dodaj klienta", addTarget: "quick-client" })}
          ${entitySearchFieldHtml({ prefix: "dashEmployee", type: "employee", name: "employeeId", label: "Pracownik", placeholder: "Szukaj pracownika", required: true, hint: "Wpisz imię, email lub telefon pracownika." })}
          ${entitySearchFieldHtml({ prefix: "dashService", type: "service", name: "serviceId", label: "Usługi", placeholder: "Szukaj usługi", hint: "Wpisz nazwę usługi lub cenę.", addLabel: "Dodaj usługę", addTarget: "quick-service" })}
          ${entitySearchFieldHtml({ prefix: "dashProduct", type: "product", name: "productId", label: "Zakup produktów", placeholder: "Szukaj produktu", hint: "Wpisz nazwę produktu, SKU, kod lub cenę.", addLabel: "Dodaj produkt", addTarget: "quick-product" })}
          <label class="bm-full">Karnet klienta<select name="passId"><option value="">Najpierw wybierz klienta</option></select><small class="bm-muted">Karnet pojawi się po wyborze klienta. Karnet usługowy rozlicza usługę, produkty zostają doliczone normalnie.</small></label>
          <label>Razem do zapłaty<input name="total" value="0.00" readonly></label>
          <label>Płatność<select name="payment">${paymentOptionsHtml}</select></label>
          <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
          <button type="submit">Dodaj</button>
        </form>
        <p id="dashboardAppointmentMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardEditVisitPanel" hidden>
        <div class="bm-page-head"><h2>Edytuj wizytę</h2></div>
        <form id="dashboardEditVisitForm" class="bm-form-grid">
          <label class="bm-full">Wybierz wizytę<select name="visitId" id="dashEditVisitSelect" required><option value="">Wybierz wizytę</option>${visitOptions}</select></label>
          <label>Data<input type="date" name="date" value="${escapeHtml(selectedDate)}" required></label>
          <label>Od<select name="start">${timeOptions()}</select></label>
          <label>Do<select name="end">${timeOptions()}</select></label>
          ${clientSearchFieldHtml("dashEditClient", { addLabel: "Dodaj klienta", addTarget: "quick-client" })}
          ${entitySearchFieldHtml({ prefix: "dashEditEmployee", type: "employee", name: "employeeId", label: "Pracownik", placeholder: "Szukaj pracownika", required: true, hint: "Wpisz imię, email lub telefon pracownika." })}
          ${entitySearchFieldHtml({ prefix: "dashEditService", type: "service", name: "serviceId", label: "Usługi", placeholder: "Szukaj usługi", hint: "Wpisz nazwę usługi lub cenę.", addLabel: "Dodaj usługę", addTarget: "quick-service" })}
          ${entitySearchFieldHtml({ prefix: "dashEditProduct", type: "product", name: "productId", label: "Zakup produktów", placeholder: "Szukaj produktu", hint: "Wpisz nazwę produktu, SKU, kod lub cenę.", addLabel: "Dodaj produkt", addTarget: "quick-product" })}
          <label class="bm-full">Karnet klienta<select name="passId"><option value="">Najpierw wybierz klienta</option></select><small class="bm-muted">Karnet pojawi się po wyborze klienta. Karnet usługowy rozlicza usługę, produkty zostają doliczone normalnie.</small></label>
          <label>Razem do zapłaty<input name="total" value="0.00" readonly></label>
          <label>Płatność<select name="payment">${paymentOptionsHtml}</select></label>
          <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="dashboardEditVisitMessage" class="panel-message"></p>
      </section>



      <section class="bm-page-card bm-appointment-form" id="dashboardQuickClientCard" data-parent-panel="#dashboardAppointmentForm" hidden>
        <div class="bm-page-head"><h2>Dodaj klienta</h2></div>
        <p class="bm-muted">Klient zapisze się w module Klienci i od razu zostanie wybrany w formularzu grafiku.</p>
        <form id="dashboardQuickClientForm" class="bm-form-grid bm-wide-form">
          <label>Imię<input name="firstName" placeholder="Imię" required></label>
          <label>Nazwisko<input name="lastName" placeholder="Nazwisko"></label>
          <label>Telefon<input name="phone" placeholder="+48..." required></label>
          <label>Email<input name="email" type="email" placeholder="email@firma.pl"></label>
          <label>Płeć<select name="gender"><option value="">Nie wybrano</option><option value="female">Kobieta</option><option value="male">Mężczyzna</option></select></label>
          <label>Data urodzenia<input name="birthDate" type="date"></label>
          <label class="bm-full">Notatka<textarea name="notes" placeholder="Notatka o kliencie"></textarea></label>
          <div class="bm-full cm-modal-actions"><button type="button" class="bm-secondary-btn" data-dashboard-modal-cancel="true">Anuluj</button><button type="submit">Zapisz klienta</button></div>
        </form>
        <p id="dashboardQuickClientMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardQuickProductCard" data-parent-panel="#dashboardAppointmentForm" hidden>
        <div class="bm-page-head"><h2>Dodaj produkt</h2></div>
        <p class="bm-muted">Produkt zapisze się w module Produkty i od razu zostanie wybrany w formularzu grafiku.</p>
        <form id="dashboardQuickProductForm" class="bm-form-grid bm-wide-form">
          <label>Nazwa produktu<input name="name" placeholder="Nazwa produktu" required></label>
          <label>Kategoria<input name="category" placeholder="np. Kosmetyki"></label>
          <label>Cena sprzedaży<input name="price" type="number" min="0" step="0.01" placeholder="0.00" required></label>
          <label>Ilość / stan<input name="unitStock" type="number" min="0" step="1" value="0"></label>
          <label>Dostawca<input name="supplier" placeholder="Dostawca"></label>
          <label class="bm-full">Opis<textarea name="description" placeholder="Opis produktu"></textarea></label>
          <div class="bm-full cm-modal-actions"><button type="button" class="bm-secondary-btn" data-dashboard-modal-cancel="true">Anuluj</button><button type="submit">Zapisz produkt</button></div>
        </form>
        <p id="dashboardQuickProductMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardQuickServiceCard" data-parent-panel="#dashboardAppointmentForm" hidden>
        <div class="bm-page-head"><h2>Dodaj usługę</h2></div>
        <p class="bm-muted">Usługa zapisze się w module Usługi i od razu zostanie wybrana w formularzu grafiku.</p>
        <form id="dashboardQuickServiceForm" class="bm-form-grid bm-wide-form">
          <label>Kategoria usług<select name="categoryId"><option value="">Wybierz kategorię</option>${quickServiceCategoryOptions}</select></label>
          <label>Lub nowa kategoria<input name="newCategory" placeholder="np. Strzyżenie"></label>
          <label>Nazwa usługi<input name="name" placeholder="Nazwa usługi" required></label>
          <label>Stanowisko pracy<select name="positionId" required><option value="">Wybierz stanowisko</option>${quickServicePositionOptions}</select></label>
          <div class="bm-form-row-2 bm-full"><label>Czas — godziny<input name="durationHours" type="number" min="0" step="1" value="0" required></label><label>Czas — minuty<input name="durationMinutes" type="number" min="0" max="59" step="1" value="30" required></label></div>
          <label>Cena usługi<input name="price" type="number" min="0" step="0.01" placeholder="0.00" required></label>
          <label class="bm-full">Opis<textarea name="description" placeholder="Opis usługi"></textarea></label>
          <div class="bm-full cm-modal-actions"><button type="button" class="bm-secondary-btn" data-dashboard-modal-cancel="true">Anuluj</button><button type="submit">Zapisz usługę</button></div>
        </form>
        <p id="dashboardQuickServiceMessage" class="panel-message"></p>
      </section>
      <section class="bm-page-card bm-appointment-form" id="dashboardFinishVisitPanel" hidden>
        <div class="bm-page-head"><h2>Zakończ wizytę</h2></div>
        <form id="dashboardFinishVisitForm" class="bm-form-grid">
          <label class="bm-full">Wybierz wizytę<select name="visitId" required><option value="">Wybierz wizytę</option>${finishVisitOptions}</select></label>
          <label>Kwota do zapłaty<input name="total" value="0.00" readonly></label>
          <label>Zapłacono<input name="paidAmount" value="0.00" inputmode="decimal"></label>
          <label class="bm-full">Użyj karnetu<select name="passId"><option value="">Najpierw wybierz wizytę</option></select><small class="bm-muted">Po wyborze wizyty system pokaże aktywne karnety tego klienta pasujące do usługi.</small></label>
          <label>Płatność<select name="payment">${paymentOptionsHtml}</select></label>
          <label class="bm-full">Opis / notatka<textarea name="note" placeholder="Notatka do sprzedaży"></textarea></label>
          <button type="submit">Zakończ wizytę</button>
        </form>
        <p id="dashboardFinishVisitMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardCancelVisitPanel" hidden>
        <div class="bm-page-head"><h2>Odwołaj wizytę</h2></div>
        <form id="dashboardCancelVisitForm" class="bm-form-grid">
          <label class="bm-full">Wybierz wizytę<select name="visitId" required><option value="">Wybierz wizytę</option>${visitOptions}</select></label>
          <label class="bm-full">Powód<textarea name="reason" placeholder="Powód" required></textarea></label>
          <button type="submit" class="bm-danger-btn">Odwołaj wizytę</button>
        </form>
        <p id="dashboardCancelVisitMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card">
        <div class="bm-page-head"><h2>Najbliższe wizyty</h2></div>
        ${renderTable(["Data", "Godzina", "Klient", "Pracownik", "Usługa", "Status"], appointmentRows, "Brak wizyt w Supabase.")}
      </section>
    `;

    const addPanel = document.querySelector("#dashboardAppointmentForm");
    const editPanel = document.querySelector("#dashboardEditVisitPanel");
    const quickClientPanel = document.querySelector("#dashboardQuickClientCard");
    const quickProductPanel = document.querySelector("#dashboardQuickProductCard");
    const quickServicePanel = document.querySelector("#dashboardQuickServiceCard");
    const finishPanel = document.querySelector("#dashboardFinishVisitPanel");
    const cancelPanel = document.querySelector("#dashboardCancelVisitPanel");
    const panels = [addPanel, editPanel, quickClientPanel, quickProductPanel, quickServicePanel, finishPanel, cancelPanel];
    let relatedParentPanel = addPanel;

    document.querySelector("#dashPrevDay")?.addEventListener("click", () => { window.location.href = `dashboard.html?date=${encodeURIComponent(addDays(selectedDate, -1))}`; });
    document.querySelector("#dashNextDay")?.addEventListener("click", () => { window.location.href = `dashboard.html?date=${encodeURIComponent(addDays(selectedDate, 1))}`; });
    document.querySelector("#dashAddVisitBtn")?.addEventListener("click", () => showOnly(addPanel, panels));
    document.querySelector("#dashEditVisitBtn")?.addEventListener("click", () => showOnly(editPanel, panels));
    document.querySelector("#dashFinishVisitBtn")?.addEventListener("click", () => showOnly(finishPanel, panels));
    document.querySelector("#dashCancelVisitBtn")?.addEventListener("click", () => showOnly(cancelPanel, panels));

    const workersPopover = document.querySelector("#dashWorkersPopover");
    const employeeCountBtn = document.querySelector("#dashEmployeeCount");
    const updateWorkerVisibility = (persist = true) => {
      const active = Array.from(document.querySelectorAll(".dash-worker-toggle"))
        .filter((input) => input.checked && !input.disabled)
        .map((input) => input.value);
      document.querySelectorAll("[data-employee-id]").forEach((cell) => {
        cell.classList.toggle("inactive-worker", !active.includes(cell.dataset.employeeId));
      });
      document.querySelectorAll("[data-employee-head]").forEach((head) => {
        head.classList.toggle("inactive-worker", !active.includes(head.dataset.employeeHead));
      });
      if (employeeCountBtn) employeeCountBtn.textContent = `(${active.length})`;
      const allToggle = document.querySelector("#dashToggleAllWorkers");
      const enabled = Array.from(document.querySelectorAll(".dash-worker-toggle")).filter((input) => !input.disabled);
      if (allToggle) {
        allToggle.checked = enabled.length > 0 && active.length === enabled.length;
        allToggle.indeterminate = active.length > 0 && active.length < enabled.length;
      }
      if (persist) saveActiveWorkerIds(ctx, selectedDate, active);
    };
    function toggleWorkersPopover(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const popover = document.querySelector("#dashWorkersPopover");
      if (!popover) return;
      popover.hidden = !popover.hidden;
      popover.classList.toggle("is-open", !popover.hidden);
    }

    // Klik w licznik pracowników. Uwaga: używamy tylko jednego handlera w capture,
    // bo wcześniejsza wersja miała dwa listenery i popover otwierał się oraz natychmiast zamykał.
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const btn = target?.closest?.("#dashEmployeeCount");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      toggleWorkersPopover();
    }, true);
    document.querySelectorAll(".dash-worker-toggle").forEach((input) => {
      input.addEventListener("change", () => updateWorkerVisibility(true));
    });
    document.querySelector("#dashToggleAllWorkers")?.addEventListener("change", (event) => {
      document.querySelectorAll(".dash-worker-toggle").forEach((input) => {
        if (!input.disabled) input.checked = event.currentTarget.checked;
      });
      updateWorkerVisibility(true);
    });
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !workersPopover || workersPopover.hidden) return;
      if (target.closest("#dashWorkersPopover") || target.closest("#dashEmployeeCount")) return;
      workersPopover.hidden = true;
    }, { once: false });
    updateWorkerVisibility(false);
    setupClientSearchFields(data.clients);
    setupEntitySearchFields(data);

    function returnToRelatedParent(card) {
      const parent = card?.dataset?.parentPanel ? document.querySelector(card.dataset.parentPanel) : relatedParentPanel;
      if (window.cmReturnToParentModalPanel) window.cmReturnToParentModalPanel(card, parent || relatedParentPanel, panels);
      else showOnly(parent || relatedParentPanel, panels);
    }
    function openRelatedPanel(card, button) {
      relatedParentPanel = button?.closest("section.bm-page-card") || addPanel;
      if (card) card.dataset.parentPanel = relatedParentPanel?.id ? `#${relatedParentPanel.id}` : "#dashboardAppointmentForm";
      showOnly(card, panels);
    }
    function setHiddenSearchValue(parent, fieldName, row) {
      const form = parent?.querySelector("form:not([hidden])") || parent?.querySelector("form");
      if (!form || !row?.id) return;
      const hidden = form.elements[fieldName];
      let input = null;
      if (fieldName === "customerId") input = form.querySelector(`[data-client-hidden="${CSS.escape(hidden?.id || "")}"]`);
      else input = form.querySelector(`[data-entity-name="${CSS.escape(fieldName)}"]`);
      if (hidden) {
        hidden.value = row.id;
        hidden.dataset.label = row.label || row.name || "";
        hidden.dataset.name = row.name || row.label || "";
        hidden.dataset.price = row.price != null ? String(row.price) : "";
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        hidden.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (input) input.value = row.label || row.name || "";
      bindDashboardTotalCalculator(form, lookups);
    }
    document.querySelectorAll('[data-open-related="quick-client"]').forEach((button) => button.addEventListener("click", () => openRelatedPanel(quickClientPanel, button)));
    document.querySelectorAll('[data-open-related="quick-product"]').forEach((button) => button.addEventListener("click", () => openRelatedPanel(quickProductPanel, button)));
    document.querySelectorAll('[data-open-related="quick-service"]').forEach((button) => button.addEventListener("click", () => openRelatedPanel(quickServicePanel, button)));
    document.querySelectorAll('[data-dashboard-modal-cancel="true"]').forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); returnToRelatedParent(button.closest("section.bm-page-card")); }));

    document.querySelector("#dashboardQuickClientForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const fd = new FormData(form);
        const firstName = String(fd.get("firstName") || "").trim();
        const lastName = String(fd.get("lastName") || "").trim();
        const phone = String(fd.get("phone") || "").trim();
        const email = String(fd.get("email") || "").trim();
        if (!firstName) throw new Error("Podaj imię klienta.");
        if (!phone) throw new Error("Podaj telefon klienta.");
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const payload = { company_id: ctx.companyId, first_name: firstName, last_name: lastName, full_name: fullName, phone, email: email || null, gender: String(fd.get("gender") || "") || null, birth_date: String(fd.get("birthDate") || "") || null, notes: String(fd.get("notes") || "").trim() || null, active: true, updated_at: new Date().toISOString() };
        const { data: insertedClient, error } = await window.cmSupabase.from("clients").insert(payload).select("*").single();
        if (error) throw error;
        data.clients.push(insertedClient);
        await window.cmUndo?.record({ module: "clients", actionType: "insert", targetTable: "clients", targetId: insertedClient?.id, afterData: insertedClient || payload, companyId: ctx.companyId });
        setHiddenSearchValue(relatedParentPanel, "customerId", { id: insertedClient.id, label: clientSearchText(insertedClient), name: customerName(insertedClient) });
        setMessage("#dashboardQuickClientMessage", "Klient zapisany i wybrany w formularzu.", true);
        form.reset();
        returnToRelatedParent(quickClientPanel);
      } catch (error) {
        setMessage("#dashboardQuickClientMessage", "Błąd zapisu klienta: " + (error.message || JSON.stringify(error)), false);
      } finally { form.dataset.saving = "0"; if (submit) submit.disabled = false; }
    });

    document.querySelector("#dashboardQuickProductForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        const price = Number(fd.get("price") || 0);
        if (!name) throw new Error("Podaj nazwę produktu.");
        if (price <= 0) throw new Error("Podaj cenę produktu większą od 0.");
        const payload = { company_id: ctx.companyId, name, category: String(fd.get("category") || "").trim(), price, unit_stock: Number(fd.get("unitStock") || 0), package_stock: 0, low_package_stock: 0, units_per_package: 0, sale_only: true, supplier: String(fd.get("supplier") || "").trim(), description: String(fd.get("description") || "").trim(), include_commission: false, include_discount: false, active: true, updated_at: new Date().toISOString() };
        const { data: insertedProduct, error } = await window.cmSupabase.from("products").insert(payload).select("*").single();
        if (error) throw error;
        data.products.push(insertedProduct);
        lookups.productsById[insertedProduct.id] = insertedProduct;
        await window.cmUndo?.record({ module: "products", actionType: "insert", targetTable: "products", targetId: insertedProduct?.id, afterData: insertedProduct || payload, companyId: ctx.companyId });
        setHiddenSearchValue(relatedParentPanel, "productId", { id: insertedProduct.id, label: `${productName(insertedProduct)} — ${price.toFixed(2).replace('.00','')} PLN`, name: productName(insertedProduct), price });
        setMessage("#dashboardQuickProductMessage", "Produkt zapisany i wybrany w formularzu.", true);
        form.reset();
        returnToRelatedParent(quickProductPanel);
      } catch (error) {
        setMessage("#dashboardQuickProductMessage", "Błąd zapisu produktu: " + (error.message || JSON.stringify(error)), false);
      } finally { form.dataset.saving = "0"; if (submit) submit.disabled = false; }
    });

    document.querySelector("#dashboardQuickServiceForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        let categoryId = String(fd.get("categoryId") || "").trim();
        const newCategory = String(fd.get("newCategory") || "").trim();
        const positionId = String(fd.get("positionId") || "").trim();
        const durationHours = Number(fd.get("durationHours") || 0);
        const durationMinutes = Number(fd.get("durationMinutes") || 0);
        const price = Number(fd.get("price") || 0);
        if (!name) throw new Error("Podaj nazwę usługi.");
        if (!categoryId && !newCategory) throw new Error("Wybierz kategorię albo wpisz nową.");
        if (!positionId) throw new Error("Wybierz stanowisko pracy.");
        if (durationHours <= 0 && durationMinutes <= 0) throw new Error("Czas usługi musi być większy niż 0.");
        if (price <= 0) throw new Error("Podaj cenę usługi większą od 0.");
        if (!categoryId && newCategory) {
          const { data: category, error: categoryError } = await window.cmSupabase.from("service_categories").insert({ company_id: ctx.companyId, name: newCategory, active: true, updated_at: new Date().toISOString() }).select("*").single();
          if (categoryError) throw categoryError;
          categoryId = category?.id || "";
          if (category) data.categories.push(category);
        }
        const payload = { company_id: ctx.companyId, category_id: categoryId, name, duration_hours: durationHours, duration_minutes: durationMinutes, price_from: price, price_to: price, position_id: positionId, description: String(fd.get("description") || "").trim() || null, show_online: false, prevent_overlap: false, deposit: 0, include_commission: false, include_discount: false, active: true, updated_at: new Date().toISOString() };
        const { data: insertedService, error } = await window.cmSupabase.from("services").insert(payload).select("*").single();
        if (error) throw error;
        data.services.push(insertedService);
        lookups.servicesById[insertedService.id] = insertedService;
        await window.cmUndo?.record({ module: "services", actionType: "insert", targetTable: "services", targetId: insertedService?.id, afterData: insertedService || payload, companyId: ctx.companyId });
        setHiddenSearchValue(relatedParentPanel, "serviceId", { id: insertedService.id, label: `${insertedService.name || name} — ${price.toFixed(2).replace('.00','')} PLN`, name: insertedService.name || name, price });
        setMessage("#dashboardQuickServiceMessage", "Usługa zapisana i wybrana w formularzu.", true);
        form.reset();
        returnToRelatedParent(quickServicePanel);
      } catch (error) {
        setMessage("#dashboardQuickServiceMessage", "Błąd zapisu usługi: " + (error.message || JSON.stringify(error)), false);
      } finally { form.dataset.saving = "0"; if (submit) submit.disabled = false; }
    });

    function bindPassOptions(form) {
      if (!form || !form.elements.passId) return;
      const refresh = () => {
        const selected = form.elements.passId.value || "";
        form.elements.passId.innerHTML = passOptionsFor(data, form.elements.customerId?.value || "", form.elements.serviceId?.value || "", selected);
        if (selected && Array.from(form.elements.passId.options).some((opt) => opt.value === selected)) form.elements.passId.value = selected;
        if (form.elements.payment && form.elements.passId.value) form.elements.payment.value = "karnet";
        form.elements.passId.dispatchEvent(new Event("change", { bubbles: true }));
      };
      form.elements.customerId?.addEventListener("change", refresh);
      form.elements.serviceId?.addEventListener("change", refresh);
      refresh();
    }
    bindPassOptions(document.querySelector("#dashboardAppointmentAddForm"));
    bindPassOptions(document.querySelector("#dashboardEditVisitForm"));
    bindPassOptions(document.querySelector("#dashboardFinishVisitForm"));
    bindDashboardTotalCalculator(document.querySelector("#dashboardAppointmentAddForm"), lookups);
    bindDashboardTotalCalculator(document.querySelector("#dashboardEditVisitForm"), lookups);

    function openAddFromSlot(slot) {
      if (!allowAdd) {
        setMessage("#dashboardAppointmentMessage", "Brak uprawnienia do dodawania wizyt.", false);
        return;
      }
      showOnly(addPanel, panels);
      const form = document.querySelector("#dashboardAppointmentAddForm");
      if (!form) return;
      const slotDate = slot?.dataset?.date || selectedDate;
      const slotTime = slot?.dataset?.time || "10:00";
      const employeeId = slot?.dataset?.employeeId || "";
      if (form.elements.date) form.elements.date.value = slotDate;
      if (form.elements.start) form.elements.start.value = slotTime;
      if (form.elements.end) {
        const startMin = minutesFromTime(slotTime);
        const settings = dashboardSettings(data);
        const endMin = startMin == null ? minutesFromTime("10:30") : startMin + settings.duration;
        const endValue = timeFromMinutes(endMin);
        form.elements.end.value = endValue;
      }
      setEntitySearchValue(form, "employeeId", employeeId, { users: data.users || [] });
      if (form.elements.serviceId) form.elements.serviceId.dispatchEvent(new Event("change", { bubbles: true }));
      if (form.elements.customerId) form.elements.customerId.dispatchEvent(new Event("change", { bubbles: true }));
      if (form.elements.productId) form.elements.productId.dispatchEvent(new Event("change", { bubbles: true }));
      const firstInput = form.querySelector('[data-client-search], input, select, textarea');
      if (firstInput) window.setTimeout(() => firstInput.focus(), 50);
      if (typeof window.cmRefreshGlobalModalState === "function") window.cmRefreshGlobalModalState();
    }

    function openEditFromSlot(slot) {
      if (!allowEdit) {
        setMessage("#dashboardEditVisitMessage", "Brak uprawnienia do edycji wizyt.", false);
        return;
      }
      const visitId = slot?.dataset?.visitId || "";
      const selected = data.appointments.find((item) => item.id === visitId);
      if (!selected) return;
      showOnly(editPanel, panels);
      const select = document.querySelector("#dashEditVisitSelect");
      if (select) select.value = visitId;
      fillEditForm(document.querySelector("#dashboardEditVisitForm"), selected);
      if (typeof window.cmRefreshGlobalModalState === "function") window.cmRefreshGlobalModalState();
    }

    document.querySelectorAll(".bm-schedule-slot").forEach((slot) => {
      slot.addEventListener("mouseenter", () => {
        const tooltip = document.querySelector("#dashSlotTooltip");
        const text = slot.getAttribute("data-slot-tooltip");
        if (!tooltip || !text) return;
        tooltip.textContent = text;
        tooltip.hidden = false;
      });
      slot.addEventListener("mouseleave", () => {
        const tooltip = document.querySelector("#dashSlotTooltip");
        if (tooltip) tooltip.hidden = true;
      });
      slot.addEventListener("click", () => {
        const tooltip = document.querySelector("#dashSlotTooltip");
        if (tooltip) tooltip.hidden = true;
        if (slot.dataset.outsideWork === "1") {
          alert("Ten termin jest poza grafikiem pracy pracownika albo pracownik ma dzień wolny.");
          return;
        }
        if (slot.classList.contains("busy") && slot.dataset.visitId) openEditFromSlot(slot);
        else openAddFromSlot(slot);
      });
    });


    function fillFinishFormById(visitId) {
      const form = document.querySelector("#dashboardFinishVisitForm");
      if (!form) return;
      const selected = data.appointments.find((item) => item.id === visitId);
      const total = selected ? appointmentTotal(selected, lookups) : 0;
      if (form.elements.total) form.elements.total.value = total.toFixed(2);
      if (form.elements.paidAmount) form.elements.paidAmount.value = total.toFixed(2);
      if (form.elements.passId) {
        form.elements.passId.innerHTML = passOptionsFor(data, appointmentClientId(selected || {}), selected?.service_id || "", selected?.pass_id || "");
        form.elements.passId.value = selected?.pass_id || "";
      }
      if (form.elements.payment && form.elements.passId?.value) form.elements.payment.value = "karnet";
      else if (form.elements.payment && selected?.payment_method) form.elements.payment.value = selected.payment_method;
      if (form.elements.note) form.elements.note.value = selected?.note || "";
    }

    document.querySelector('#dashboardFinishVisitForm select[name="visitId"]')?.addEventListener("change", (event) => {
      fillFinishFormById(event.currentTarget.value);
    });

    document.querySelector("#dashboardAppointmentAddForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowAdd) { setMessage("#dashboardAppointmentMessage", "Brak uprawnienia do dodawania wizyt.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget), event.currentTarget);
      const validation = validatePayload(payload);
      if (validation) { setMessage("#dashboardAppointmentMessage", validation, false); return; }
      const { data: inserted, error } = await window.cmSupabase.from("appointments").insert(payload).select("*").single();
      if (error) { setMessage("#dashboardAppointmentMessage", `Błąd zapisu: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "insert", targetTable: "appointments", targetId: inserted?.id, afterData: inserted || payload, companyId: ctx.companyId });
      setMessage("#dashboardAppointmentMessage", "Wizyta zapisana w Supabase.", true);
      closeDashboardModals(panels);
      window.setTimeout(renderDashboard, 180);
    });

    document.querySelector("#dashEditVisitSelect")?.addEventListener("change", (event) => {
      const selected = data.appointments.find((item) => item.id === event.currentTarget.value);
      if (!selected) return;
      fillEditForm(document.querySelector("#dashboardEditVisitForm"), selected);
    });

    document.querySelector("#dashboardEditVisitForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowEdit) { setMessage("#dashboardEditVisitMessage", "Brak uprawnienia do edycji wizyt.", false); return; }
      const visitId = String(new FormData(event.currentTarget).get("visitId") || "").trim();
      if (!visitId) { setMessage("#dashboardEditVisitMessage", "Wybierz wizytę do edycji.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget), event.currentTarget);
      const validation = validatePayload(payload);
      if (validation) { setMessage("#dashboardEditVisitMessage", validation, false); return; }
      const before = data.appointments.find((item) => item.id === visitId);
      const { data: updated, error } = await window.cmSupabase.from("appointments").update(payload).eq("id", visitId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#dashboardEditVisitMessage", `Błąd edycji: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: before, afterData: updated || payload, companyId: ctx.companyId });
      setMessage("#dashboardEditVisitMessage", "Wizyta zaktualizowana.", true);
      closeDashboardModals(panels);
      window.setTimeout(renderDashboard, 180);
    });


    document.querySelector("#dashboardFinishVisitForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowFinish) { setMessage("#dashboardFinishVisitMessage", "Brak uprawnienia do zakończenia wizyt.", false); return; }
      const formData = new FormData(event.currentTarget);
      const visitId = String(formData.get("visitId") || "").trim();
      const paidAmount = moneyNumber(formData.get("paidAmount"));
      const paymentMethod = String(formData.get("payment") || "gotówka").trim();
      const note = String(formData.get("note") || "").trim();
      if (!visitId) { setMessage("#dashboardFinishVisitMessage", "Wybierz wizytę do zakończenia.", false); return; }
      const before = data.appointments.find((item) => item.id === visitId);
      if (!before) { setMessage("#dashboardFinishVisitMessage", "Nie znaleziono wizyty.", false); return; }
      const payload = {
        p_appointment_id: visitId,
        p_company_id: ctx.companyId,
        p_paid_amount: paidAmount,
        p_payment_method: paymentMethod,
        p_note: note,
        p_pass_id: String(formData.get("passId") || "").trim() || null
      };
      const { data: result, error } = await window.cmSupabase.rpc("finish_appointment_with_sale", payload);
      if (error) { setMessage("#dashboardFinishVisitMessage", `Błąd zakończenia: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "finish", targetTable: "appointments", targetId: visitId, beforeData: before, afterData: result || payload, companyId: ctx.companyId });
      setMessage("#dashboardFinishVisitMessage", "Wizyta zakończona i sprzedaż zapisana.", true);
      closeDashboardModals(panels);
      window.setTimeout(renderDashboard, 180);
    });

    document.querySelector("#dashboardCancelVisitForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowCancel) { setMessage("#dashboardCancelVisitMessage", "Brak uprawnienia do odwołania wizyt.", false); return; }
      const formData = new FormData(event.currentTarget);
      const visitId = String(formData.get("visitId") || "").trim();
      const reason = String(formData.get("reason") || "").trim();
      if (!visitId || !reason) { setMessage("#dashboardCancelVisitMessage", "Wybierz wizytę i wpisz powód.", false); return; }
      const before = data.appointments.find((item) => item.id === visitId);
      const patch = { status: "odwołane", deleted: false, cancellation_reason: reason, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { data: updated, error } = await window.cmSupabase.from("appointments").update(patch).eq("id", visitId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#dashboardCancelVisitMessage", `Błąd odwołania: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: before, afterData: updated || patch, companyId: ctx.companyId });
      setMessage("#dashboardCancelVisitMessage", "Wizyta odwołana.", true);
      closeDashboardModals(panels);
      window.setTimeout(renderDashboard, 180);
    });

    if (typeof window.cmRefreshGlobalModalState === "function") window.cmRefreshGlobalModalState();
  }

  function boot() {
    const tryRender = () => {
      const area = getPanelArea();
      if (!area) return window.setTimeout(tryRender, 120);
      renderDashboard();
    };
    tryRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
