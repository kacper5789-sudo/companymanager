// CompanyManager — Passes Module powered by Supabase
// 070: Karnety Supabase — sprzedaż karnetu + osoba korzystająca + użycie na Dashboardzie.

(function () {
  function isPassesPage() {
    return document.body?.dataset?.panelPage === "passes" || window.location.pathname.includes("passes.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
          renderPasses();
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
  });

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

  function canOpenPasses(ctx) { return hasAnyPermission(ctx, ["open_passes", "passes_open", "Karnety", "karnety"]); }
  function canAddPasses(ctx) { return hasAnyPermission(ctx, ["passes_add", "karnety_add", "karnety (dodawanie, edycja, usuwanie)"]); }
  function canDeletePasses(ctx) { return hasAnyPermission(ctx, ["passes_delete", "karnety_delete", "karnety (dodawanie, edycja, usuwanie)"]); }

  function getPanelArea() { return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot"); }

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
    if (!canOpenPasses(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Karnety." };
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
  }

  function parseNumber(value, fallback = 0) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return fallback;
    const n = Number(text);
    return Number.isFinite(n) ? n : fallback;
  }

  function isoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isoPlusMonths(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? `${n.toFixed(2)} PLN` : "0.00 PLN";
  }
  const DEFAULT_PAYMENT_METHODS = [
    { name: "gotówka", turnover: true, commission: true, default: true }
  ];

  function normalizePaymentMethods(company) {
    let raw = company?.payment_methods;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { raw = null; }
    }
    const source = Array.isArray(raw) && raw.length ? raw : DEFAULT_PAYMENT_METHODS;
    const seen = new Set();
    const methods = source.map((item) => {
      const name = String(item?.name || item?.label || "").trim();
      if (!name) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        name,
        turnover: item?.turnover !== false,
        commission: item?.commission !== false,
        default: item?.default === true || key === "gotówka"
      };
    }).filter(Boolean);
    return methods.length ? methods : DEFAULT_PAYMENT_METHODS;
  }


  function formatDatePL(value) {
    if (!value) return "-";
    const date = String(value).slice(0, 10);
    const [y, m, d] = date.split("-");
    return y && m && d ? `${d}.${m}.${y}` : value;
  }

  function displayDateTime(date, time = "") {
    return `${formatDatePL(date)}${time ? " " + String(time).slice(0, 5) : ""}`;
  }

  function clientName(client) {
    if (!client) return "";
    return [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email || client.phone || "";
  }

  function userName(user) {
    return user?.full_name || user?.email || "";
  }

  function table(headers, rows, emptyText = "Nie znaleziono żadnych danych") {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText)}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function tableRaw(headers, rowsHtml, emptyText = "Nie znaleziono żadnych danych") {
    if (!rowsHtml.length) return `<div class="bm-empty-state">${escapeHtml(emptyText)}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rowsHtml.join("")}</tbody></table></div>`;
  }

  function pagination(count) {
    if (!count) return "";
    return `<div class="cm-pagination-row"><span>Pozycje od 1 do ${count} z ${count} łącznie</span><span class="cm-pagination-controls">&lt; <strong>1 z 1</strong> &gt;</span></div>`;
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function showOnlyPanel(target, panels) {
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(target, panels || []);
    panels.forEach((panel) => { if (panel) panel.hidden = panel !== target ? true : !panel.hidden; });
  }

  function closePassesModals() {
    if (window.cmHardCloseAllModalPanels) {
      window.cmHardCloseAllModalPanels();
      return;
    }
    if (window.cmCloseAllModalPanels) {
      window.cmCloseAllModalPanels();
      return;
    }
    document.querySelectorAll(".cm-modal-active, .cm-as-modal").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("cm-modal-active", "cm-as-modal");
    });
    document.body?.classList?.remove("cm-modal-open");
  }

  function rerenderPassesAfterSuccess(delay = 450) {
    closePassesModals();
    setTimeout(() => {
      closePassesModals();
      renderPasses();
    }, delay);
  }

  async function fetchPassesData(ctx) {
    const [passesRes, clientsRes, usersRes, servicesRes, templatesRes, companyRes] = await Promise.all([
      window.cmSupabase
        .from("passes")
        .select("id, company_id, customer_id, buyer_client_id, beneficiary_client_id, employee_id, service_id, service_name, pass_type, total_units, remaining_units, used_value, used_units, sale_id, name, number, sale_date, sale_time, valid_until, payment_method, buyer, customer_name, employee_name, value, remaining, description, status, active, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      window.cmSupabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, status")
        .eq("company_id", ctx.companyId),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId }),
      window.cmSupabase
        .from("services")
        .select("id, name, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("pass_templates")
        .select("id, company_id, name, pass_type, service_id, service_name, total_units, amount, sale_price, stock_quantity, remaining_stock, sold_count, valid_days, description, active, created_at")
        .eq("company_id", ctx.companyId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      window.cmSupabase.rpc("company_panel_get")
    ]);
    const errors = [passesRes, clientsRes, usersRes, servicesRes, templatesRes, companyRes].map((res) => res.error).filter(Boolean);
    if (errors.length) throw errors[0];
    return {
      passes: passesRes.data || [],
      clients: clientsRes.data || [],
      users: usersRes.data || [],
      services: (servicesRes.data || []).filter((s) => s.active !== false),
      templates: templatesRes.data || [],
      paymentMethods: normalizePaymentMethods(companyRes.data || {})
    };
  }

  async function getNextPassNumber(ctx, fallbackCount = 0) {
    const { data, error } = await window.cmSupabase.rpc("cm_next_pass_number", { p_company_id: ctx.companyId });
    if (!error && data) return data;
    return `KARNET-${String(fallbackCount + 1).padStart(4, "0")}`;
  }

  async function insertInlineClient(ctx, form) {
    const fullName = String(form?.newCustomerName?.value || "").trim();
    if (!form || !fullName) throw new Error("Uzupełnij imię i nazwisko klienta.");
    const parts = fullName.split(/\s+/);
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ");
    const payload = {
      company_id: ctx.companyId,
      first_name: firstName,
      last_name: lastName,
      phone: String(form.newCustomerPhone?.value || "").trim(),
      email: String(form.newCustomerEmail?.value || "").trim(),
      notes: String(form.newCustomerDescription?.value || "").trim(),
      status: "aktywny",
      updated_at: new Date().toISOString()
    };
    const { data, error } = await window.cmSupabase.from("clients").insert(payload).select("id, first_name, last_name, email, phone").single();
    if (error) throw error;
    await window.cmUndo?.record({ module: "clients", actionType: "insert", targetTable: "clients", targetId: data?.id, afterData: data || payload, companyId: ctx.companyId });
    return data;
  }

  function passTemplateLabel(tpl, servicesById = {}) {
    if (!tpl) return "";
    const type = String(tpl.pass_type || "amount") === "amount" ? "kwotowy" : "wejściowy";
    const serviceName = tpl.service_name || servicesById[tpl.service_id]?.name || "bez usługi";
    const value = String(tpl.pass_type || "amount") === "amount"
      ? `${money(tpl.amount || 0)} do wykorzystania`
      : `${Number(tpl.total_units || 0)} wejść`;
    const remaining = Number(tpl.remaining_stock ?? tpl.stock_quantity ?? 0);
    const stock = Number(tpl.stock_quantity ?? 0);
    const pool = Number.isFinite(remaining) && Number.isFinite(stock) ? `pula ${remaining}/${stock}` : "pula -";
    return [tpl.name || "Karnet", type, serviceName, value, `cena ${money(tpl.sale_price || 0)}`, pool].filter(Boolean).join(" — ");
  }

  function passPayload(ctx, formData, usersById, clientsById, servicesById, number, templatesById = {}) {
    const employeeId = String(formData.get("employeeId") || "").trim() || null;
    const buyerClientId = String(formData.get("buyerClientId") || "").trim() || null;
    const beneficiaryClientId = String(formData.get("beneficiaryClientId") || "").trim() || buyerClientId;
    const templateId = String(formData.get("passTemplateId") || "").trim() || null;
    const template = templateId ? templatesById[templateId] : null;
    const rawType = String(template?.pass_type || formData.get("passType") || "amount").trim();
    const passType = rawType === "service" || rawType === "units" || rawType === "entries" ? "units" : "amount";
    const serviceId = String(template?.service_id || formData.get("serviceId") || "").trim() || null;
    const service = servicesById[serviceId];
    const salePrice = parseNumber(formData.get("value"), Number(template?.sale_price || 0));
    const passAmount = passType === "amount" ? parseNumber(formData.get("passAmount"), Number(template?.amount || salePrice || 0)) : 0;
    const totalUnits = passType === "units" ? parseNumber(formData.get("totalUnits"), Number(template?.total_units || 0)) : 0;
    const name = String(template?.name || "").trim() || (passType === "units"
      ? `Karnet ${totalUnits || 1}x ${service?.name || "usługa"}`
      : `Karnet kwotowy ${money(passAmount || salePrice || 0)}`);
    return {
      company_id: ctx.companyId,
      customer_id: beneficiaryClientId,
      buyer_client_id: buyerClientId,
      beneficiary_client_id: beneficiaryClientId,
      employee_id: employeeId,
      service_id: serviceId,
      pass_template_id: templateId,
      name,
      number,
      sale_date: String(formData.get("saleDate") || isoToday()),
      sale_time: String(formData.get("saleTime") || "").slice(0, 5),
      valid_until: String(formData.get("validUntil") || "") || null,
      payment_method: String(formData.get("paymentMethod") || "gotówka"),
      pass_type: passType,
      total_units: totalUnits,
      pass_amount: passAmount,
      value: salePrice,
      description: String(formData.get("description") || template?.description || "").trim()
    };
  }

  async function renderPasses() {
    if (!isPassesPage()) return;
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `<section class="bm-page-card passes-module"><h2>Karnety</h2><p class="bm-muted">Ładowanie karnetów z Supabase...</p></section>`;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><pre class="cm-error-details">${escapeHtml(ctx.message)}</pre></section>`;
      return;
    }

    let data;
    try {
      data = await fetchPassesData(ctx);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd karnetów</h2><pre class="cm-error-details">${escapeHtml(JSON.stringify(error, null, 2))}</pre></section>`;
      return;
    }

    renderContent(ctx, data);
  }

  function renderContent(ctx, data) {
    const area = getPanelArea();
    if (!area) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") || "all";
    const q = normalizeText(params.get("q") || "");
    const limit = Number(getModulePageLimit(params.get("limit") || "50")) || 50;
    const allowAdd = canAddPasses(ctx);
    const allowDelete = canDeletePasses(ctx);

    const clientsById = Object.fromEntries(data.clients.map((c) => [c.id, c]));
    const usersById = Object.fromEntries(data.users.map((u) => [u.id, u]));
    const servicesById = Object.fromEntries((data.services || []).map((svc) => [svc.id, svc]));
    const customerOptions = data.clients.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(clientName(c) || "-")}</option>`).join("");
    const employeeOptions = data.users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(userName(u) || "-")}</option>`).join("");
    const serviceOptions = (data.services || []).map((svc) => `<option value="${escapeHtml(svc.id)}">${escapeHtml(svc.name || "Usługa")}</option>`).join("");
    const templatesById = Object.fromEntries((data.templates || []).map((tpl) => [tpl.id, tpl]));
    const templateOptions = (data.templates || []).map((tpl) => {
      const remaining = Number(tpl.remaining_stock ?? 0);
      const disabled = remaining <= 0 ? " disabled" : "";
      const suffix = remaining <= 0 ? " — brak w puli" : "";
      return `<option value="${escapeHtml(tpl.id)}"${disabled}>${escapeHtml(passTemplateLabel(tpl, servicesById) + suffix)}</option>`;
    }).join("");
    const paymentOptions = (data.paymentMethods || DEFAULT_PAYMENT_METHODS).map((method) => `<option value="${escapeHtml(method.name)}"${method.default ? " selected" : ""}>${escapeHtml(method.name)}</option>`).join("");
    const templatesRowsHtml = (data.templates || []).map((tpl) => {
      const stock = Number(tpl.stock_quantity ?? 0);
      const sold = Number(tpl.sold_count ?? Math.max(stock - Number(tpl.remaining_stock ?? stock), 0));
      const remaining = Number(tpl.remaining_stock ?? Math.max(stock - sold, 0));
      const poolLabel = stock > 0 ? `${remaining}/${stock}` : "brak puli";
      return `<tr>
        <td>${escapeHtml(tpl.name || "Karnet")}</td>
        <td>${escapeHtml(String(tpl.pass_type || "amount") === "amount" ? "Kwotowy" : "Ilość wejść")}</td>
        <td>${escapeHtml(tpl.service_name || servicesById[tpl.service_id]?.name || "-")}</td>
        <td>${escapeHtml(String(tpl.pass_type || "amount") === "amount" ? money(tpl.amount) : `${Number(tpl.total_units || 0)} wejść`)}</td>
        <td>${escapeHtml(money(tpl.sale_price || 0))}</td>
        <td>${escapeHtml(poolLabel)}</td>
        <td>${escapeHtml(tpl.valid_days ? `${Number(tpl.valid_days)} dni` : "-")}</td>
        <td><button type="button" class="bm-danger-btn cm-delete-template-btn" data-delete-template-id="${escapeHtml(tpl.id)}">Usuń typ</button></td>
      </tr>`;
    });

    const filtered = data.passes.filter((pass) => {
      const statusOk = status === "all" || normalizeText(pass.status || "") === normalizeText(status);
      const text = normalizeText([pass.name, pass.number, pass.valid_until, pass.description, pass.buyer, pass.customer_name, pass.employee_name, pass.service_name, clientName(clientsById[pass.buyer_client_id]), clientName(clientsById[pass.beneficiary_client_id || pass.customer_id]), userName(usersById[pass.employee_id]), pass.value, pass.remaining, pass.remaining_units, pass.status].join(" "));
      return statusOk && (!q || text.includes(q));
    });
    const visible = filtered.slice(0, limit);
    const newestPass = data.passes[0]?.number || "XXXX";

    const rows = visible.map((pass) => [
      [pass.name || "Karnet", pass.number || ""].filter(Boolean).join(" / ") || "-",
      formatDatePL(pass.valid_until),
      pass.description || "",
      pass.employee_name || userName(usersById[pass.employee_id]) || pass.buyer || "-",
      pass.buyer || clientName(clientsById[pass.buyer_client_id]) || "-",
      pass.customer_name || clientName(clientsById[pass.beneficiary_client_id || pass.customer_id]) || "-",
      pass.service_name || (pass.pass_type === "amount" ? "Kwotowy" : "-"),
      pass.pass_type === "service" || pass.pass_type === "units" || pass.pass_type === "entries" ? `${Number(pass.remaining_units || 0)}/${Number(pass.total_units || 0)}` : money(pass.remaining),
      money(pass.value)
    ]);
    const passOptions = data.passes.map((pass) => `<option value="${escapeHtml(pass.id)}">${escapeHtml([pass.name || "Karnet", pass.number || "", pass.customer_name || clientName(clientsById[pass.customer_id]) || "-", `ważny do ${formatDatePL(pass.valid_until)}`, money(pass.value), `pozostało ${money(pass.remaining)}`, pass.status || ""].filter(Boolean).join(" — "))}</option>`).join("");
    const filterTabs = `
      <div class="bm-filter-tabs">
        <a class="${status === "all" ? "active" : ""}" href="passes.html?status=all" title="Wszystkie karnety, niezależnie od stanu.">pokaż wszystkie</a>
        <a class="${status === "aktualne" ? "active" : ""}" href="passes.html?status=aktualne" title="Karnet jest ważny i ma jeszcze saldo albo wejścia do wykorzystania.">aktualne</a>
        <a class="${status === "zrealizowane" ? "active" : ""}" href="passes.html?status=zrealizowane" title="Karnet został wykorzystany do zera: brak wejść albo salda.">zrealizowane</a>
        <a class="${status === "po terminie" ? "active" : ""}" href="passes.html?status=po%20terminie" title="Karnet ma niewykorzystane saldo/wejścia, ale minęła data ważności.">po terminie</a>
      </div>
      <p class="cm-pass-status-help"><strong>Aktualne</strong> = można używać. <strong>Zrealizowane</strong> = wykorzystane do zera. <strong>Po terminie</strong> = minęła data ważności.</p>`;

    area.innerHTML = `<section class="bm-page-card passes-module">
      <div class="bm-page-head customers-head"><h2>Karnety</h2><div class="bm-actions-row">${allowAdd ? `<button id="showTemplatePass" type="button" class="bm-primary-btn">+ Dodaj typ karnetu</button><button id="showAddPass" type="button">Sprzedaj karnet</button>` : ""}${allowDelete ? `<button id="showDeletePass" type="button" class="bm-danger-btn">Usuń</button>` : ""}</div></div>
      ${filterTabs}
      <section id="templatePassPanel" class="bm-page-card bm-inner-card" hidden>
        <div class="bm-page-head customers-head"><h2>Dodaj typ karnetu do puli</h2></div>
        <form id="templatePassForm" class="bm-form-grid bm-wide-form">
          <label class="full">Nazwa typu karnetu<input name="templateName" placeholder="Np. Karnet 5 wejść / Karnet 500 PLN" required></label>
          <div class="bm-form-row-2 full">
            <label>Rodzaj<select name="templateType" required><option value="units">Ilość wejść</option><option value="amount">Kwotowy</option></select></label>
            <label>Usługa<select name="templateServiceId"><option value="">Bez konkretnej usługi</option>${serviceOptions}</select></label>
          </div>
          <div class="bm-form-row-2 full">
            <label data-template-units>Liczba wejść<input name="templateTotalUnits" type="number" min="1" step="1" value="5"></label>
            <label data-template-amount hidden>Kwota karnetu klienta (PLN)<input name="templateAmount" type="number" min="0" step="0.01" value="0.00"></label>
            <label>Cena sprzedaży (PLN)<input name="templateSalePrice" type="number" min="0" step="0.01" value="0.00" required></label>
          </div>
          <div class="bm-form-row-2 full">
            <label>Ilość w puli<input name="templateStockQuantity" type="number" min="1" step="1" value="1" required></label>
            <label>Ważność domyślna (dni)<input name="templateValidDays" type="number" min="1" step="1" value="30"></label>
          </div>
          <label class="full">Opis<textarea name="templateDescription" rows="2" placeholder="Opis typu karnetu"></textarea></label>
          <div class="bm-form-actions full"><button type="submit">Zapisz typ karnetu</button></div>
        </form>
        <p id="templatePassMessage" class="panel-message"></p>
        <div class="bm-page-head customers-head"><h3>Aktualna pula karnetów</h3></div>
        ${tableRaw(["Nazwa", "Typ", "Usługa", "Wartość", "Cena", "Pula", "Ważność", "Akcja"], templatesRowsHtml, "Brak typów karnetów w puli.")}
      </section>
      <section id="addPassPanel" class="bm-page-card bm-inner-card" hidden>
        <h2>Dodaj karnet</h2>
        <form id="addPassForm" class="bm-form-grid bm-wide-form">
          <div class="bm-form-row-2 full"><label>Data i godzina sprzedaży<input name="saleDate" type="date" value="${isoToday()}" required></label><label>Godzina<input name="saleTime" type="time" value="06:00" required></label></div>
          <label>Sprzedawca<select name="employeeId"><option value="">Automatycznie / brak</option>${employeeOptions}</select></label>
          <label class="full">Wybierz karnet z puli<select name="passTemplateId" required><option value="">Wybierz typ karnetu</option>${templateOptions}</select></label>
          <label>Typ<input name="passTypeLabel" type="text" value="-" readonly><input name="passType" type="hidden" value="amount"></label>
          <label>Kupujący<select name="buyerClientId" required><option value="">Wybierz kupującego</option>${customerOptions}</select></label>
          <label>Osoba korzystająca<select name="beneficiaryClientId" required><option value="">Wybierz osobę korzystającą</option>${customerOptions}</select></label>
          <label>Usługa<input name="serviceLabel" type="text" value="-" readonly><input name="serviceId" type="hidden" value=""></label>
          <label data-pass-units hidden>Liczba wejść<input name="totalUnits" type="number" min="0" step="1" value="0" readonly></label>
          <label data-pass-amount hidden>Kwota karnetu klienta (PLN)<input name="passAmount" type="number" min="0" step="0.01" value="0.00" readonly></label>
          <label>Data ważności karnetu<input name="validUntil" type="date" value="${isoPlusMonths(1)}" required></label>
          <label>Cena sprzedaży (PLN)<input name="value" type="number" min="0" step="0.01" value="0.00" required></label>
          <label>Sposób płatności<select name="paymentMethod" required>${paymentOptions}</select></label>
          <div class="full"><button type="button" id="showInlinePassCustomer" class="bm-secondary-btn">Dodaj klienta</button></div>
          <div id="inlinePassCustomerPanel" class="bm-page-card bm-inner-card full bm-nested-modal" hidden>
            <h3>Dodaj nowego klienta</h3>
            <div class="bm-form-grid">
              <label>Imię i nazwisko*<input name="newCustomerName" placeholder="Imię i nazwisko"></label>
              <label>Nr telefonu<input name="newCustomerPhone" placeholder="Nr telefonu"></label>
              <label>Adres email<input name="newCustomerEmail" type="email" placeholder="Adres email"></label>
              <label class="full">Opis<textarea name="newCustomerDescription" placeholder="Opis"></textarea></label>
              <div class="full bm-action-row"><button type="button" id="addInlinePassCustomer">Zatwierdź</button><button type="button" id="cancelInlinePassCustomer" class="bm-light-btn">Anuluj</button></div>
            </div>
          </div>
          <label class="full">Opis<textarea name="description" placeholder="Opis"></textarea></label>
          <div class="full"><button type="submit">Dodaj</button></div>
        </form>
        <p id="passFormMessage" class="panel-message"></p>
      </section>
      <section id="deletePassPanel" class="bm-page-card bm-inner-card" hidden>
        <h2>Usuń karnet</h2>
        <div class="bm-form-grid bm-wide-form">
          <label class="full">Wybierz karnet<select id="deletePassSelect"><option value="">Wybierz karnet</option>${passOptions}</select></label>
          <div class="full"><button id="deletePassBtn" type="button" class="bm-danger-btn">Usuń</button></div>
        </div>
        <p id="passDeleteMessage" class="panel-message"></p>
      </section>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("passesLimit")}<label>Szukaj: <input id="passesSearch" type="search" placeholder="Szukaj karnetów" value="${escapeHtml(params.get("q") || "")}"></label></div>
      <div class="bm-latest-pass"><strong>Najnowszy karnet:</strong> <input id="latestPassNumber" type="text" value="${escapeHtml(newestPass)}" aria-label="Najnowszy karnet"></div>
      ${table(["Nazwa / nr. karnetu", "Ważny do", "Opis", "Sprzedawca", "Kupujący", "Korzysta", "Usługa", "Pozostało", "Cena sprzedaży"], rows)}
      ${pagination(filtered.length)}
    </section>`;

    bindActions(ctx, data, usersById, clientsById, servicesById, templatesById, status);
  }

  function bindActions(ctx, data, usersById, clientsById, servicesById, templatesById, status) {
    const templateTypeSelect = document.querySelector('[name="templateType"]');
    const templateUnitsBox = document.querySelector('[data-template-units]');
    const templateAmountBox = document.querySelector('[data-template-amount]');
    const refreshTemplateTypeFields = () => {
      if (!templateTypeSelect) return;
      const isAmount = templateTypeSelect.value === "amount";
      if (templateUnitsBox) templateUnitsBox.hidden = isAmount;
      if (templateAmountBox) templateAmountBox.hidden = !isAmount;
    };
    templateTypeSelect?.addEventListener("change", refreshTemplateTypeFields);
    refreshTemplateTypeFields();


    const templatePanel = document.querySelector("#templatePassPanel");
    const addPanel = document.querySelector("#addPassPanel");
    const deletePanel = document.querySelector("#deletePassPanel");
    const panels = [templatePanel, addPanel, deletePanel];
    document.querySelector("#showTemplatePass")?.addEventListener("click", () => showOnlyPanel(templatePanel, panels));
    document.querySelector("#showAddPass")?.addEventListener("click", () => showOnlyPanel(addPanel, panels));
    document.querySelector("#showDeletePass")?.addEventListener("click", () => showOnlyPanel(deletePanel, panels));
    setupModuleLimitDropdowns(document);

    const apply = () => {
      const q = encodeURIComponent(document.querySelector("#passesSearch")?.value || "");
      const limit = encodeURIComponent(document.querySelector("#passesLimit")?.value || getModulePageLimit());
      window.location.href = `passes.html?status=${encodeURIComponent(status)}&limit=${limit}${q ? `&q=${q}` : ""}`;
    };
    document.querySelector("#passesSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });

    function toggleTemplateType() {
      const form = document.querySelector("#templatePassForm");
      if (!form) return;
      const type = String(form.templateType?.value || "units");
      const units = form.querySelector("[data-template-units]");
      const amount = form.querySelector("[data-template-amount]");
      if (units) units.hidden = type === "amount";
      if (amount) amount.hidden = type !== "amount";
    }
    document.querySelector('#templatePassForm [name="templateType"]')?.addEventListener("change", toggleTemplateType);
    toggleTemplateType();

    document.querySelector("#templatePassForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const type = String(form.templateType?.value || "units");
      const serviceId = String(form.templateServiceId?.value || "").trim() || null;
      const service = servicesById[serviceId] || null;
      const payload = {
        company_id: ctx.companyId,
        name: String(form.templateName?.value || "").trim(),
        pass_type: type,
        service_id: serviceId,
        service_name: service?.name || null,
        total_units: type === "units" ? parseNumber(form.templateTotalUnits?.value, 0) : 0,
        amount: type === "amount" ? parseNumber(form.templateAmount?.value, 0) : 0,
        sale_price: parseNumber(form.templateSalePrice?.value, 0),
        stock_quantity: Math.max(1, Math.round(parseNumber(form.templateStockQuantity?.value, 1))),
        remaining_stock: Math.max(1, Math.round(parseNumber(form.templateStockQuantity?.value, 1))),
        sold_count: 0,
        valid_days: Math.max(1, Math.round(parseNumber(form.templateValidDays?.value, 30))),
        description: String(form.templateDescription?.value || "").trim(),
        active: true
      };
      try {
        if (!payload.name) throw new Error("Wpisz nazwę typu karnetu.");
        if (payload.pass_type === "units" && !payload.total_units) throw new Error("Wpisz liczbę wejść.");
        if (payload.pass_type === "amount" && !payload.amount) throw new Error("Wpisz kwotę karnetu klienta.");
        if (!payload.stock_quantity) throw new Error("Wpisz ilość w puli.");
        const { data: inserted, error } = await window.cmSupabase.from("pass_templates").insert(payload).select("*").single();
        if (error) throw error;
        await window.cmUndo?.record({ module: "passes", actionType: "insert", targetTable: "pass_templates", targetId: inserted?.id, afterData: inserted || payload, companyId: ctx.companyId });
        setMessage("#templatePassMessage", "Typ karnetu zapisany w puli.", true);
        rerenderPassesAfterSuccess(450);
      } catch (error) {
        setMessage("#templatePassMessage", "Błąd zapisu typu karnetu: " + (error.message || JSON.stringify(error)), false);
        form.dataset.saving = "0";
      }
    });

    document.querySelectorAll("[data-delete-template-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-delete-template-id");
        if (!id) return;
        const before = data.templates.find((tpl) => String(tpl.id) === String(id)) || null;
        if (!window.confirm(`Usunąć typ karnetu: ${before?.name || "Karnet"}?`)) return;
        button.disabled = true;
        const { data: updated, error } = await window.cmSupabase
          .from("pass_templates")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("company_id", ctx.companyId)
          .select("*")
          .single();
        if (error) {
          button.disabled = false;
          setMessage("#templatePassMessage", "Błąd usuwania typu karnetu: " + (error.message || JSON.stringify(error)), false);
          return;
        }
        await window.cmUndo?.record({ module: "passes", actionType: "update", targetTable: "pass_templates", targetId: id, beforeData: before, afterData: updated || { ...(before || {}), active: false }, companyId: ctx.companyId });
        setMessage("#templatePassMessage", "Typ karnetu usunięty z puli.", true);
        rerenderPassesAfterSuccess(350);
      });
    });

    function applySelectedPassTemplate() {
      const form = document.querySelector("#addPassForm");
      if (!form) return;
      const tpl = templatesById[String(form.passTemplateId?.value || "")];
      const remainingStock = Number(tpl?.remaining_stock ?? 0);
      const type = String(tpl?.pass_type || "amount") === "amount" ? "amount" : "units";
      const service = tpl?.service_name || servicesById[tpl?.service_id]?.name || "-";
      const validDays = Math.max(1, Number(tpl?.valid_days || 30));
      const valid = new Date();
      valid.setDate(valid.getDate() + validDays);
      const validIso = `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, "0")}-${String(valid.getDate()).padStart(2, "0")}`;
      if (form.passType) form.passType.value = type;
      if (form.passTypeLabel) form.passTypeLabel.value = type === "amount" ? "Kwotowy" : "Ilość wejść";
      if (form.serviceId) form.serviceId.value = tpl?.service_id || "";
      if (form.serviceLabel) form.serviceLabel.value = service;
      if (form.totalUnits) form.totalUnits.value = Number(tpl?.total_units || 0);
      if (form.passAmount) form.passAmount.value = Number(tpl?.amount || 0).toFixed(2);
      if (form.value) form.value.value = Number(tpl?.sale_price || 0).toFixed(2);
      if (form.validUntil) form.validUntil.value = validIso;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !!tpl && remainingStock <= 0;
      const units = form.querySelector("[data-pass-units]");
      const amount = form.querySelector("[data-pass-amount]");
      if (units) units.hidden = type !== "units";
      if (amount) amount.hidden = type !== "amount";
    }
    document.querySelector('#addPassForm [name="passTemplateId"]')?.addEventListener("change", applySelectedPassTemplate);
    applySelectedPassTemplate();

    document.querySelector("#showInlinePassCustomer")?.addEventListener("click", (event) => {
      event.preventDefault();
      const panel = document.querySelector("#inlinePassCustomerPanel");
      if (panel) { panel.hidden = false; panel.classList.add("bm-nested-modal"); }
      if (window.updateGlobalModalState) window.updateGlobalModalState();
    });
    document.querySelector("#cancelInlinePassCustomer")?.addEventListener("click", (event) => {
      event.preventDefault();
      const panel = document.querySelector("#inlinePassCustomerPanel");
      if (panel) panel.hidden = true;
      if (window.updateGlobalModalState) window.updateGlobalModalState();
    });
    document.querySelector("#addInlinePassCustomer")?.addEventListener("click", async () => {
      const form = document.querySelector("#addPassForm");
      try {
        const client = await insertInlineClient(ctx, form);
        if (client) {
          ["buyerClientId", "beneficiaryClientId"].forEach((selectName) => {
            const select = form?.querySelector(`[name="${selectName}"]`);
            if (!select) return;
            const option = document.createElement("option");
            option.value = client.id;
            option.textContent = clientName(client) || "Nowy klient";
            option.selected = true;
            select.appendChild(option);
          });
        }
        ["newCustomerName", "newCustomerPhone", "newCustomerEmail", "newCustomerDescription"].forEach((name) => { if (form?.[name]) form[name].value = ""; });
        const panel = document.querySelector("#inlinePassCustomerPanel");
        if (panel) panel.hidden = true;
        if (window.updateGlobalModalState) window.updateGlobalModalState();
      } catch (error) {
        setMessage("#passFormMessage", "Błąd dodania klienta: " + (error.message || JSON.stringify(error)), false);
      }
    });

    document.querySelector("#addPassForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const payload = passPayload(ctx, new FormData(form), usersById, clientsById, servicesById, null, templatesById);
        if (!payload.buyer_client_id) throw new Error("Wybierz kupującego.");
        if (!payload.beneficiary_client_id) throw new Error("Wybierz osobę korzystającą.");
        if (!payload.pass_template_id) throw new Error("Wybierz typ karnetu z puli.");
        const selectedTemplate = templatesById[payload.pass_template_id];
        if (Number(selectedTemplate?.remaining_stock ?? 0) <= 0) throw new Error("Ten typ karnetu nie ma już dostępnych sztuk w puli.");
        if (!payload.valid_until) throw new Error("Wybierz datę ważności.");
        if (payload.pass_type === "units" && !payload.total_units) throw new Error("Wpisz liczbę wejść.");
        if (payload.pass_type === "amount" && !payload.pass_amount) throw new Error("Wpisz kwotę karnetu klienta.");
        const { data: inserted, error } = await window.cmSupabase.rpc("cm_create_pass_sale", { p_payload: payload });
        if (error) throw error;
        await window.cmUndo?.record({ module: "passes", actionType: "insert", targetTable: "passes", targetId: inserted?.pass_id, afterData: inserted || payload, companyId: ctx.companyId });
        setMessage("#passFormMessage", "Karnet sprzedany i zapisany w sprzedaży.", true);
        rerenderPassesAfterSuccess(450);
      } catch (error) {
        setMessage("#passFormMessage", "Błąd zapisu karnetu: " + (error.message || JSON.stringify(error)), false);
        form.dataset.saving = "0";
        if (submit) submit.disabled = false;
      }
    });

    document.querySelector("#deletePassBtn")?.addEventListener("click", async () => {
      const id = document.querySelector("#deletePassSelect")?.value;
      if (!id) { setMessage("#passDeleteMessage", "Wybierz karnet do usunięcia.", false); return; }
      const before = data.passes.find((item) => String(item.id) === String(id)) || null;
      const payload = { active: false, status: "usunięte", updated_at: new Date().toISOString() };
      const { data: updated, error } = await window.cmSupabase.from("passes").update(payload).eq("id", id).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#passDeleteMessage", "Błąd usuwania karnetu: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "passes", actionType: "update", targetTable: "passes", targetId: id, beforeData: before, afterData: updated || { ...(before || {}), ...payload }, companyId: ctx.companyId });
      setMessage("#passDeleteMessage", "Karnet usunięty z listy.", true);
      rerenderPassesAfterSuccess(450);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!isPassesPage()) return;
    window.setTimeout(renderPasses, 120);
  });
})();
