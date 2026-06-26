// CompanyManager — Appointments Module powered by Supabase
// 032A: Wizyty Supabase CRUD: lista / dodaj / edytuj / usuń + company_id isolation + permission guard.

(function () {
  function isVisitsPage() {
    return document.body?.dataset?.panelPage === "visits" || window.location.pathname.includes("visits.html");
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
        document.querySelectorAll(".cm-limit-menu").forEach((item) => {
          if (item !== menu) item.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
      });
      dropdown.querySelectorAll("[data-limit-value]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setModulePageLimit(button.getAttribute("data-limit-value") || "50");
          if (menu) menu.hidden = true;
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
  });


  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        acc[String(item)] = true;
        return acc;
      }, {});
    }
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

  function canOpenAppointments(ctx) {
    return hasAnyPermission(ctx, [
      "open_appointments",
      "appointments_open",
      "open_visits",
      "wizyty",
      "Wizyty",
      "wizyty (niezakończone) - dostęp do historii",
      "wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)"
    ]);
  }

  function canAddAppointments(ctx) {
    return hasAnyPermission(ctx, [
      "appointments_add",
      "visits_add",
      "wizyty_add",
      "wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)",
      "wizyty (dodawanie, edycja, zakończenie, usuwanie)"
    ]);
  }

  function canEditAppointments(ctx) {
    return hasAnyPermission(ctx, [
      "appointments_edit",
      "visits_edit",
      "wizyty_edit",
      "wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)",
      "wizyty (dodawanie, edycja, zakończenie, usuwanie)"
    ]);
  }

  function canDeleteAppointments(ctx) {
    return hasAnyPermission(ctx, [
      "appointments_delete",
      "visits_delete",
      "wizyty_delete",
      "wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)",
      "wizyty (dodawanie, edycja, zakończenie, usuwanie)"
    ]);
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
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
    if (!canOpenAppointments(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Wizyty." };

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
  }

  function plDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    try { return new Date(value).toLocaleDateString("pl-PL"); } catch (_) { return String(value); }
  }

  function normalizeTime(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }


  function minutesFromTime(value) {
    const normalized = normalizeTime(value);
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function timeFromMinutes(total) {
    const safe = Math.max(0, Math.min(23 * 60 + 59, Number(total) || 0));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

  function combineDateTimeIso(date, time) {
    if (!date || !time) return null;
    const localDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(localDate.getTime())) return `${date}T${time}:00`;
    return localDate.toISOString();
  }

  function moneyNumber(value) {
    const n = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function firstPositiveMoney(...values) {
    for (const value of values) {
      const n = moneyNumber(value);
      if (n > 0) return n;
    }
    return 0;
  }

  function servicePrice(service) {
    if (!service) return 0;
    return firstPositiveMoney(service.price_from, service.price, service.price_to);
  }

  function productName(product) { return product?.name || "-"; }

  function productPrice(product) {
    if (!product) return 0;
    return firstPositiveMoney(product.sale_price, product.price, product.gross_price, product.net_price, product.retail_price, product.selling_price, product.sale_gross_price, product.unit_price, product.last_purchase_price);
  }

  function optionList(items, labelFn, empty = "Brak danych", attrsFn = null) {
    if (!items.length) return `<option value="">${escapeHtml(empty)}</option>`;
    return items.map((item) => {
      const attrs = typeof attrsFn === "function" ? ` ${attrsFn(item)}` : "";
      return `<option value="${escapeHtml(item.id)}"${attrs}>${escapeHtml(labelFn(item))}</option>`;
    }).join("");
  }

  function paymentMethodOptions(company = {}) {
    let methods = [];
    try {
      const raw = company?.payment_methods;
      if (Array.isArray(raw)) methods = raw;
      else if (typeof raw === "string" && raw.trim()) methods = JSON.parse(raw);
    } catch (_) { methods = []; }
    if (!Array.isArray(methods) || !methods.length) methods = [{ name: "gotówka" }, { name: "karta" }, { name: "przelew" }, { name: "blik" }, { name: "karnet" }];
    return methods.map((method) => {
      const name = String(method?.name || method || "gotówka");
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join("");
  }

  function passOptionsFor(data, clientId = "", serviceId = "", selected = "") {
    const passes = (data?.passes || []).filter((pass) => {
      const passClient = pass.customer_id || pass.beneficiary_client_id || pass.buyer_client_id;
      if (clientId && String(passClient) !== String(clientId)) return false;
      if (serviceId && pass.service_id && String(pass.service_id) !== String(serviceId)) return false;
      const remaining = Number(pass.remaining_units ?? pass.remaining ?? 0);
      return pass.active !== false && !["zrealizowane", "po terminie", "usunięte", "deleted"].includes(String(pass.status || "").toLowerCase()) && remaining !== 0;
    });
    if (!clientId) return `<option value="">Najpierw wybierz klienta</option>`;
    if (!passes.length) return `<option value="">Brak aktywnych karnetów</option>`;
    return `<option value="">Bez karnetu</option>` + passes.map((pass) => {
      const left = pass.remaining_units != null || pass.total_units != null
        ? `${Number(pass.remaining_units || 0)}/${Number(pass.total_units || 0)} wejść`
        : `${Number(pass.remaining || 0)} pozostało`;
      const label = `${pass.name || pass.number || "Karnet"} — ${left}`;
      return `<option value="${escapeHtml(pass.id)}" ${String(pass.id) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText || "Brak danych.")}</div>`;
    return `
      <div class="bm-table-wrap">
        <table class="bm-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function pagination(count) {
    if (!count) return "";
    return `
      <div class="cm-pagination-row">
        <span>Pozycje od 1 do ${count} z ${count} łącznie</span>
        <span class="cm-pagination-controls">&lt; <strong>1 z 1</strong> &gt;</span>
      </div>
    `;
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
    return [
      customerName(client),
      client?.phone || "",
      client?.email || ""
    ].filter(Boolean).join(" · ");
  }

  function clientSearchFieldHtml(prefix) {
    return `
      <div class="cm-connected-field cm-search-connected-field">
        <label>Klient
          <div class="cm-client-search" data-client-search-wrap>
            <input type="search" id="${escapeHtml(prefix)}Search" class="cm-client-search-input" data-client-search data-client-hidden="${escapeHtml(prefix)}Id" placeholder="Szukaj klienta z bazy" autocomplete="off" required>
            <input type="hidden" id="${escapeHtml(prefix)}Id" name="customerId">
            <div class="cm-client-search-results" data-client-results hidden></div>
          </div>
          <small class="cm-muted">Wpisz imię, nazwisko, telefon lub email klienta.</small>
        </label>
        <button type="button" class="bm-secondary-btn cm-related-add-btn" data-open-related-module="customers.html">Dodaj klienta</button>
      </div>`;
  }

  function setupClientSearchFields(clients) {
    const activeClients = (clients || []).filter(isActiveClient);
    const byId = new Map(activeClients.map((client) => [String(client.id), client]));
    const normalized = activeClients.map((client) => ({
      client,
      label: clientSearchText(client),
      haystack: clientSearchText(client).toLowerCase()
    }));

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
        const matches = normalized
          .filter((row) => !q || row.haystack.includes(q))
          .slice(0, 12);
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



  function activeGenericItem(item) {
    const status = String(item?.status || '').trim().toLowerCase();
    return item?.deleted_at == null
      && item?.deleted !== true
      && item?.active !== false
      && !['usunięty','usuniety','deleted','archived','zarchiwizowany','usunięte'].includes(status);
  }

  function entitySearchFieldHtml(config) {
    const required = config.required ? 'required' : '';
    const addTarget = config.addTarget || '';
    const addLabel = config.addLabel || '';
    const addHtml = addTarget && addLabel ? `<button type="button" class="bm-secondary-btn cm-related-add-btn" data-open-related-module="${escapeHtml(addTarget)}">${escapeHtml(addLabel)}</button>` : '';
    return `
      <div class="cm-connected-field cm-search-connected-field">
        <label>${escapeHtml(config.label)}
          <div class="cm-client-search cm-entity-search" data-entity-search-wrap>
            <input type="search" id="${escapeHtml(config.prefix)}Search" class="cm-client-search-input" data-entity-search data-entity-type="${escapeHtml(config.type)}" data-entity-hidden="${escapeHtml(config.prefix)}Id" data-entity-name="${escapeHtml(config.name)}" placeholder="${escapeHtml(config.placeholder)}" autocomplete="off" ${required}>
            <input type="hidden" id="${escapeHtml(config.prefix)}Id" name="${escapeHtml(config.name)}">
            <div class="cm-client-search-results" data-entity-results hidden></div>
          </div>
          <small class="cm-muted">${escapeHtml(config.hint || 'Zacznij pisać, aby wyszukać z bazy.')}</small>
        </label>
        ${addHtml}
      </div>`;
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
  function personName(person) {
    return person?.full_name || person?.email || person?.name || "-";
  }

  async function fetchAll(ctx) {
    const [appointmentsRes, clientsRes, servicesRes, positionsRes, productsRes, passesRes, companyRes, usersRes] = await Promise.all([
      window.cmSupabase
        .from("appointments")
        .select("id, company_id, date, time, start_time, end_time, starts_at, ends_at, appointment_datetime, customer_id, client_id, employee_id, employee_name, service_id, service_name, position_id, product_id, product_name, product_price, product_quantity, pass_id, pass_name, status, deleted, note, price, total, payment_method, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("date", { ascending: false })
        .order("time", { ascending: true }),
      window.cmSupabase
        .from("clients")
        .select("id, company_id, first_name, last_name, full_name, email, phone, status, active, deleted_at")
        .eq("company_id", ctx.companyId)
        .order("last_name", { ascending: true }),
      window.cmSupabase
        .from("services")
        .select("id, company_id, name, price_from, price_to, price, position_id, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("positions")
        .select("id, company_id, name, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("products")
        .select("id, company_id, name, price, sale_price, gross_price, net_price, retail_price, selling_price, sale_gross_price, unit_price, last_purchase_price, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("passes")
        .select("id, company_id, customer_id, beneficiary_client_id, buyer_client_id, service_id, service_name, name, number, pass_type, value, remaining, total_units, remaining_units, valid_until, status, active")
        .eq("company_id", ctx.companyId)
        .eq("active", true),
      window.cmSupabase
        .from("companies")
        .select("id, payment_methods")
        .eq("id", ctx.companyId)
        .maybeSingle(),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId })
    ]);

    if (appointmentsRes.error) throw appointmentsRes.error;
    if (clientsRes.error) throw clientsRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (positionsRes.error) throw positionsRes.error;
    if (productsRes.error) throw productsRes.error;
    if (passesRes.error) throw passesRes.error;
    if (companyRes.error) throw companyRes.error;
    if (usersRes.error) throw usersRes.error;

    return {
      company: companyRes.data || {},
      appointments: appointmentsRes.data || [],
      clients: (clientsRes.data || []).filter((item) => isActiveClient(item)),
      services: (servicesRes.data || []).filter((item) => item.active !== false),
      positions: (positionsRes.data || []).filter((item) => item.active !== false),
      products: (productsRes.data || []).filter((item) => item.active !== false),
      passes: (passesRes.data || []).filter((item) => item.status !== "usunięte" && item.status !== "zrealizowane"),
      users: usersRes.data || []
    };
  }

  function appointmentDate(item) { return item.date || ""; }
  function appointmentTime(item) { return normalizeTime(item.time || item.start_time); }
  function appointmentClientId(item) { return item.customer_id || item.client_id || ""; }

  function visitLabel(item, lookups) {
    const client = lookups.clientsById[appointmentClientId(item)];
    const user = lookups.usersById[item.employee_id];
    const service = lookups.servicesById[item.service_id];
    return `${plDate(appointmentDate(item))} ${appointmentTime(item)} — ${customerName(client)} — ${personName(user)} — ${service?.name || "-"} — ${item.status || "-"}`;
  }

  function options(items, labelFn, empty) {
    if (!items.length) return `<option value="">${escapeHtml(empty || "Brak danych")}</option>`;
    return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(labelFn(item))}</option>`).join("");
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function showOnly(cardToShow) {
    const panels = ["#visitFormCard", "#visitEditCard", "#visitDeleteCard"].map((selector) => document.querySelector(selector));
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(cardToShow, panels);
    panels.forEach((card) => {
      if (!card) return;
      card.hidden = card !== cardToShow ? true : !card.hidden;
    });
  }



  function setupVisitNativeDatePickers() {
    // Formularze Wizyt są renderowane dynamicznie przez Supabase,
    // więc globalny listener z app.js nie łapie inputów po pierwszym załadowaniu.
    // Podpinamy dokładnie natywny input[type=date] po renderze oraz po kliknięciu Dodaj/Edytuj.
    document.querySelectorAll('#visitFormCard input[type="date"], #visitEditCard input[type="date"]').forEach((input) => {
      if (input.dataset.cmVisitPickerReady === '1') return;
      input.dataset.cmVisitPickerReady = '1';
      input.classList.add('cm-date-input');
      input.style.pointerEvents = 'auto';

      const openPicker = () => {
        if (input.disabled || input.readOnly) return;
        try {
          input.focus({ preventScroll: true });
        } catch (_) {
          input.focus();
        }
        try {
          if (typeof input.showPicker === 'function') input.showPicker();
        } catch (_) {
          // Fallback: jeśli przeglądarka blokuje showPicker, zostaje natywny focus/click.
        }
      };

      input.addEventListener('click', openPicker);
      input.addEventListener('focus', openPicker);
    });
  }

  function payloadFromForm(ctx, formData, form = null) {
    const serviceId = String(formData.get("serviceId") || "").trim();
    const productId = String(formData.get("productId") || "").trim();
    const currentForm = form;
    const productHidden = currentForm?.elements?.productId || null;
    const selectedProductName = productHidden?.dataset?.name || null;
    const selectedProductPrice = firstPositiveMoney(productHidden?.dataset?.price);
    const start = normalizeTime(formData.get("start") || formData.get("time"));
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
    const status = String(formData.get("status") || "zaplanowane").trim() || "zaplanowane";
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
      employee_id: employeeId || null,
      employee_name: employeeName,
      service_id: serviceId || null,
      position_id: String(formData.get("positionId") || "").trim() || null,
      product_id: productId || null,
      product_name: productId ? selectedProductName : null,
      product_price: productId ? selectedProductPrice : null,
      product_quantity: productId ? 1 : null,
      pass_id: passId || null,
      pass_name: passId ? (currentForm?.elements?.passId?.selectedOptions?.[0]?.textContent || "Karnet") : null,
      status,
      deleted: status === "usunięte",
      note: String(formData.get("note") || "").trim() || null,
      price: total,
      total,
      payment_method: String(formData.get("payment") || "gotówka").trim(),
      updated_at: new Date().toISOString()
    };
  }

  function validatePayload(payload) {
    if (!payload.date || !payload.start_time || !payload.end_time || !payload.customer_id || !payload.employee_id) return "Uzupełnij datę, godzinę, klienta i pracownika.";
    if (!payload.service_id && !payload.product_id) return "Wybierz usługę albo produkt.";
    return "";
  }

  function bindAppointmentTotalCalculator(form, lookups) {
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
      totalInput.value = (serviceCharge + productValue).toFixed(2);
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

  function fillEditForm(form, item, lookups) {
    if (!form || !item) return;
    form.elements.date.value = appointmentDate(item) || "";
    form.elements.start.value = normalizeTime(item.start_time || item.time) || "10:00";
    form.elements.end.value = normalizeTime(item.end_time) || timeFromMinutes((minutesFromTime(form.elements.start.value) || 600) + 30);
    setClientSearchValue(form, appointmentClientId(item) || "", lookups?.clientsById || {});
    setEntitySearchValue(form, "employeeId", item.employee_id || "", { users: Object.values(lookups?.usersById || {}) });
    if (!form.elements.employeeId?.value && item.employee_name && form.elements.employeeId) {
      form.elements.employeeId.dataset.name = item.employee_name;
      const input = form.querySelector('[data-entity-name="employeeId"]');
      if (input) input.value = item.employee_name;
    }
    setEntitySearchValue(form, "serviceId", item.service_id || "", { services: Object.values(lookups?.servicesById || {}) });
    if (form.elements.positionId) form.elements.positionId.value = item.position_id || "";
    setEntitySearchValue(form, "productId", item.product_id || "", { products: Object.values(lookups?.productsById || {}) });
    if (form.elements.passId) {
      form.elements.passId.innerHTML = passOptionsFor({ passes: Object.values(lookups.passesById || {}) }, appointmentClientId(item), item.service_id || "", item.pass_id || "");
      form.elements.passId.value = item.pass_id || "";
    }
    if (form.elements.total) form.elements.total.value = firstPositiveMoney(item.total, item.price).toFixed(2);
    if (form.elements.payment) form.elements.payment.value = item.payment_method || "gotówka";
    if (form.elements.note) form.elements.note.value = item.note || "";
    form.elements.status.value = item.status || "zaplanowane";
  }

  async function renderAppointments() {
    if (!isVisitsPage()) return;
    const area = getPanelArea();
    if (!area) return;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Wizyty</h2><p class="panel-message" style="color:#fca5a5">${escapeHtml(ctx.message)}</p></section>`;
      return;
    }

    let data;
    try {
      data = await fetchAll(ctx);
    } catch (error) {
      console.error("CompanyManager appointments Supabase error:", error);
      const details = error?.message || error?.details || error?.hint || error?.code || JSON.stringify(error, null, 2) || String(error);
      area.innerHTML = `
        <section class="bm-page-card">
          <h2>Błąd wizyt</h2>
          <p class="panel-message" style="color:#fca5a5;white-space:pre-wrap">${escapeHtml(details)}</p>
          <pre style="white-space:pre-wrap;background:rgba(15,23,42,.85);border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:12px;color:#fca5a5;overflow:auto;max-height:260px">${escapeHtml(JSON.stringify(error, null, 2))}</pre>
        </section>
      `;
      return;
    }

    const allowAdd = canAddAppointments(ctx);
    const allowEdit = canEditAppointments(ctx);
    const allowDelete = canDeleteAppointments(ctx);
    const currentFilter = new URLSearchParams(window.location.search).get("status") || "niezakończone";
    const statuses = ["niezakończone", "zakończone", "zaplanowane", "odwołane", "usunięte"];

    const lookups = {
      clientsById: Object.fromEntries(data.clients.map((item) => [item.id, item])),
      servicesById: Object.fromEntries(data.services.map((item) => [item.id, item])),
      positionsById: Object.fromEntries(data.positions.map((item) => [item.id, item])),
      productsById: Object.fromEntries((data.products || []).map((item) => [item.id, item])),
      passesById: Object.fromEntries((data.passes || []).map((item) => [item.id, item])),
      usersById: Object.fromEntries(data.users.map((item) => [item.id, item]))
    };

    const filtered = data.appointments.filter((item) => {
      if (currentFilter === "usunięte") return item.deleted === true || item.status === "usunięte";
      return item.deleted !== true && String(item.status || "niezakończone") === currentFilter;
    });
    const editable = data.appointments.filter((item) => item.deleted !== true && item.status !== "usunięte");

    const rows = filtered.map((item) => {
      const client = lookups.clientsById[appointmentClientId(item)];
      const user = lookups.usersById[item.employee_id];
      const service = lookups.servicesById[item.service_id];
      return [
        escapeHtml(plDate(appointmentDate(item))),
        escapeHtml(appointmentTime(item)),
        escapeHtml(customerName(client)),
        escapeHtml(personName(user)),
        escapeHtml(service?.name || "-"),
        escapeHtml(item.status || "-")
      ];
    });

    const statusTabs = statuses.map((status) => `<button type="button" class="bm-tab-btn ${status === currentFilter ? "active" : ""}" data-visit-filter="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join("");
    const employeeOptions = options(data.users, personName, "Brak pracowników/użytkowników");
    const serviceOptions = optionList(
      data.services,
      (s) => `${s.name || "Usługa"}${servicePrice(s) ? ` — ${servicePrice(s).toFixed(2).replace(".00", "")} PLN` : ""}`,
      "Brak usług",
      (s) => `data-price="${escapeHtml(String(servicePrice(s)))}" data-name="${escapeHtml(s.name || "Usługa")}"`
    );
    const productOptions = optionList(
      data.products || [],
      (product) => `${productName(product)}${productPrice(product) ? ` — ${productPrice(product).toFixed(2).replace(".00", "")} PLN` : ""}`,
      "Brak produktów",
      (product) => `data-price="${escapeHtml(String(productPrice(product)))}" data-name="${escapeHtml(productName(product))}"`
    );
    const positionOptions = options(data.positions, (p) => p.name || "Stanowisko", "Brak stanowisk");
    const paymentOptionsHtml = paymentMethodOptions(data.company);
    const visitOptions = editable.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(visitLabel(item, lookups))}</option>`).join("");

    area.innerHTML = `
      <section class="bm-page-card visits-module">
        <div class="bm-page-head"><h2>Pokaż wizyty:</h2><div class="bm-action-row"><button id="showAddVisit" type="button" ${allowAdd ? "" : "disabled"}>Dodaj</button><button id="showEditVisit" type="button" class="bm-secondary-btn" ${allowEdit ? "" : "disabled"}>Edytuj</button><button id="showDeleteVisit" type="button" class="bm-danger-btn" ${allowDelete ? "" : "disabled"}>Usuń</button></div></div>
        <div class="bm-tabs">${statusTabs}</div>
        <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("visitsLimit")}</div>
        ${table(["Data", "Godzina", "Klient", "Pracownik", "Usługa", "Status"], rows, "Brak wizyt w Supabase.")}
        ${pagination(filtered.length)}
      </section>

      <section class="bm-page-card" id="visitFormCard" hidden>
        <h2>Dodaj wizytę</h2>
        <form id="visitForm" class="bm-form-grid">
          <label>Data<input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
          <label>Od<select name="start">${timeOptions("10:00")}</select></label>
          <label>Do<select name="end">${timeOptions("10:30")}</select></label>
          ${clientSearchFieldHtml("visitClient")}
          ${entitySearchFieldHtml({ prefix: "visitEmployee", type: "employee", name: "employeeId", label: "Pracownik", placeholder: "Szukaj pracownika", required: true, hint: "Wpisz imię, email lub telefon pracownika.", addLabel: "Dodaj pracownika", addTarget: "employees.html" })}
          ${entitySearchFieldHtml({ prefix: "visitService", type: "service", name: "serviceId", label: "Usługi", placeholder: "Szukaj usługi", hint: "Wpisz nazwę usługi lub cenę.", addLabel: "Dodaj usługę", addTarget: "services.html" })}
          ${entitySearchFieldHtml({ prefix: "visitProduct", type: "product", name: "productId", label: "Zakup produktów", placeholder: "Szukaj produktu", hint: "Wpisz nazwę produktu, SKU, kod lub cenę.", addLabel: "Dodaj produkt", addTarget: "products.html" })}
          <label class="bm-full">Karnet klienta<select name="passId"><option value="">Najpierw wybierz klienta</option></select><small class="bm-muted">Karnet pojawi się po wyborze klienta. Karnet usługowy rozlicza usługę, produkty zostają doliczone normalnie.</small></label>
          <label>Razem do zapłaty<input name="total" value="0.00" readonly></label>
          <label>Płatność<select name="payment">${paymentOptionsHtml}</select></label>
          <label>Stanowisko pracy<select name="positionId"><option value="">Wybierz stanowisko</option>${positionOptions}</select></label>
          <label>Status<select name="status">${statuses.filter((s) => s !== "usunięte").map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}</select></label>
          <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
          <button type="submit">Zapisz wizytę</button>
        </form>
        <p id="visitMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="visitEditCard" hidden>
        <h2>Edytuj wizytę</h2>
        <form id="visitEditSelectForm" class="bm-form-grid"><label>Wybierz wizytę<select name="visitId" id="editVisitSelect" required><option value="">Wybierz wizytę</option>${visitOptions}</select></label></form>
        <form id="visitEditForm" class="bm-form-grid" hidden>
          <label>Data<input type="date" name="date" required></label>
          <label>Od<select name="start">${timeOptions()}</select></label>
          <label>Do<select name="end">${timeOptions()}</select></label>
          ${clientSearchFieldHtml("visitEditClient")}
          ${entitySearchFieldHtml({ prefix: "visitEditEmployee", type: "employee", name: "employeeId", label: "Pracownik", placeholder: "Szukaj pracownika", required: true, hint: "Wpisz imię, email lub telefon pracownika.", addLabel: "Dodaj pracownika", addTarget: "employees.html" })}
          ${entitySearchFieldHtml({ prefix: "visitEditService", type: "service", name: "serviceId", label: "Usługi", placeholder: "Szukaj usługi", hint: "Wpisz nazwę usługi lub cenę.", addLabel: "Dodaj usługę", addTarget: "services.html" })}
          ${entitySearchFieldHtml({ prefix: "visitEditProduct", type: "product", name: "productId", label: "Zakup produktów", placeholder: "Szukaj produktu", hint: "Wpisz nazwę produktu, SKU, kod lub cenę.", addLabel: "Dodaj produkt", addTarget: "products.html" })}
          <label class="bm-full">Karnet klienta<select name="passId"><option value="">Najpierw wybierz klienta</option></select><small class="bm-muted">Karnet pojawi się po wyborze klienta. Karnet usługowy rozlicza usługę, produkty zostają doliczone normalnie.</small></label>
          <label>Razem do zapłaty<input name="total" value="0.00" readonly></label>
          <label>Płatność<select name="payment">${paymentOptionsHtml}</select></label>
          <label>Stanowisko pracy<select name="positionId"><option value="">Wybierz stanowisko</option>${positionOptions}</select></label>
          <label>Status<select name="status">${statuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}</select></label>
          <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="visitEditMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="visitDeleteCard" hidden>
        <h2>Usuń wizytę</h2>
        <div class="bm-form-row bm-delete-row"><select id="deleteVisitSelect"><option value="">Wybierz wizytę</option>${visitOptions}</select><button id="deleteVisitBtn" type="button" class="bm-danger-btn" ${allowDelete ? "" : "disabled"}>Usuń</button></div>
        <p id="visitDeleteMessage" class="panel-message"></p>
      </section>
    `;

    setupVisitNativeDatePickers();
    setupClientSearchFields(data.clients);
    setupEntitySearchFields(data);
    document.querySelectorAll("[data-open-related-module]").forEach((button) => {
      if (button.dataset.cmRelatedReady === "1") return;
      button.dataset.cmRelatedReady = "1";
      button.addEventListener("click", () => {
        const target = button.dataset.openRelatedModule;
        if (target) window.location.href = target;
      });
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
    bindPassOptions(document.querySelector("#visitForm"));
    bindPassOptions(document.querySelector("#visitEditForm"));
    bindAppointmentTotalCalculator(document.querySelector("#visitForm"), lookups);
    bindAppointmentTotalCalculator(document.querySelector("#visitEditForm"), lookups);

    document.querySelectorAll("[data-visit-filter]").forEach((button) => button.addEventListener("click", () => {
      window.location.href = `visits.html?status=${encodeURIComponent(button.dataset.visitFilter || "niezakończone")}`;
    }));

    const addCard = document.querySelector("#visitFormCard");
    const editCard = document.querySelector("#visitEditCard");
    const deleteCard = document.querySelector("#visitDeleteCard");
    document.querySelector("#showAddVisit")?.addEventListener("click", () => {
      showOnly(addCard);
      setupVisitNativeDatePickers();
      const dateInput = addCard?.querySelector('input[type="date"]');
      if (dateInput) setTimeout(() => dateInput.click(), 0);
    });
    document.querySelector("#showEditVisit")?.addEventListener("click", () => {
      showOnly(editCard);
      setupVisitNativeDatePickers();
    });
    document.querySelector("#showDeleteVisit")?.addEventListener("click", () => showOnly(deleteCard));

    document.querySelector("#visitForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowAdd) { setMessage("#visitMessage", "Brak uprawnienia do dodawania wizyt.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget), event.currentTarget);
      const validation = validatePayload(payload);
      if (validation) { setMessage("#visitMessage", validation, false); return; }
      const { data: insertedAppointment, error } = await window.cmSupabase.from("appointments").insert(payload).select("*").single();
      if (error) { setMessage("#visitMessage", "Błąd zapisu wizyty: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "appointments", actionType: "insert", targetTable: "appointments", targetId: insertedAppointment?.id, afterData: insertedAppointment || payload, companyId: ctx.companyId });

      // 104: powiadomienie po dodaniu wizyty musi iść natychmiast, a nie czekać na cron.
      // Błędu powiadomienia nie blokujemy zapisu wizyty, tylko pokazujemy go użytkownikowi.
      let notifyMessage = "";
      try {
        if (insertedAppointment?.id && window.cmSupabase?.functions?.invoke) {
          const { data: notifyData, error: notifyError } = await window.cmSupabase.functions.invoke("send-automatic-notifications", {
            body: {
              event: "appointment_created",
              type: "appointment_created",
              appointment_id: insertedAppointment.id,
              company_id: ctx.companyId,
            },
          });
          if (notifyError) {
            notifyMessage = ` Powiadomienie nie wyszło: ${notifyError.message || notifyError}`;
            console.warn("appointment_created notification failed", notifyError);
          } else if (notifyData?.error) {
            notifyMessage = ` Powiadomienie nie wyszło: ${notifyData.error}`;
            console.warn("appointment_created notification returned error", notifyData);
          } else if ((Number(notifyData?.sent || 0) + Number(notifyData?.failed || 0)) > 0) {
            notifyMessage = ` Powiadomienia: wysłano ${notifyData.sent || 0}, błędów ${notifyData.failed || 0}.`;
          } else {
            notifyMessage = " Powiadomienia: brak odbiorcy albo automat wyłączony.";
          }
        }
      } catch (notifyError) {
        notifyMessage = ` Powiadomienie nie wyszło: ${notifyError?.message || notifyError}`;
        console.warn("appointment_created notification exception", notifyError);
      }

      setMessage("#visitMessage", "Wizyta zapisana w Supabase." + notifyMessage, true);
      setTimeout(renderAppointments, 450);
    });

    document.querySelector("#editVisitSelect")?.addEventListener("change", (event) => {
      const selected = data.appointments.find((item) => item.id === event.currentTarget.value);
      const form = document.querySelector("#visitEditForm");
      if (!form || !selected) { if (form) form.hidden = true; return; }
      fillEditForm(form, selected, lookups);
      form.hidden = false;
      setupVisitNativeDatePickers();
    });

    document.querySelector("#visitEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowEdit) { setMessage("#visitEditMessage", "Brak uprawnienia do edycji wizyt.", false); return; }
      const visitId = document.querySelector("#editVisitSelect")?.value;
      if (!visitId) { setMessage("#visitEditMessage", "Wybierz wizytę do edycji.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget), event.currentTarget);
      const validation = validatePayload(payload);
      if (validation) { setMessage("#visitEditMessage", validation, false); return; }
      delete payload.company_id;
      const beforeVisit = data.appointments.find((item) => String(item.id) === String(visitId)) || null;
      const { data: updatedAppointment, error } = await window.cmSupabase.from("appointments").update(payload).eq("id", visitId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#visitEditMessage", "Błąd edycji wizyty: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "appointments", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: beforeVisit, afterData: updatedAppointment || { ...(beforeVisit || {}), ...payload }, companyId: ctx.companyId });
      setMessage("#visitEditMessage", "Wizyta zaktualizowana w Supabase.", true);
      setTimeout(renderAppointments, 450);
    });

    document.querySelector("#deleteVisitBtn")?.addEventListener("click", async () => {
      if (!allowDelete) { setMessage("#visitDeleteMessage", "Brak uprawnienia do usuwania wizyt.", false); return; }
      const visitId = document.querySelector("#deleteVisitSelect")?.value;
      if (!visitId) { setMessage("#visitDeleteMessage", "Wybierz wizytę do usunięcia.", false); return; }
      const beforeVisit = data.appointments.find((item) => String(item.id) === String(visitId)) || null;
      const deletePayload = { status: "usunięte", deleted: true, updated_at: new Date().toISOString() };
      const { data: updatedAppointment, error } = await window.cmSupabase
        .from("appointments")
        .update(deletePayload)
        .eq("id", visitId)
        .eq("company_id", ctx.companyId)
        .select("*")
        .single();
      if (error) { setMessage("#visitDeleteMessage", "Błąd usuwania wizyty: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "appointments", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: beforeVisit, afterData: updatedAppointment || { ...(beforeVisit || {}), ...deletePayload }, companyId: ctx.companyId });
      setMessage("#visitDeleteMessage", "Wizyta przeniesiona do usuniętych w Supabase.", true);
      setTimeout(renderAppointments, 450);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAppointments);
  } else {
    renderAppointments();
  }
})();
