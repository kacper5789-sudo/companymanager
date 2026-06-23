// CompanyManager — Walk-ins Module powered by Supabase
// 041C: Sprzedaż bez wizyty + szybkie dodawanie produktu/usługi do właściwych modułów.

(function () {
  function isWalkinsPage() {
    return document.body?.dataset?.panelPage === "walkins" || window.location.pathname.includes("walkins.html");
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
          renderWalkins();
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

  function canOpenWalkins(ctx) { return hasAnyPermission(ctx, ["open_sales_without_visit", "open_walkins", "sprzedaż bez wizyty"]); }
  function canAddWalkins(ctx) { return hasAnyPermission(ctx, ["sales_without_visit_add", "sprzedaż bez wizyt (dodawanie, edycja, usuwanie)"]); }
  function canDeleteWalkins(ctx) { return hasAnyPermission(ctx, ["sales_without_visit_delete", "sprzedaż bez wizyt (dodawanie, edycja, usuwanie)"]); }
  function canHistoryWalkins(ctx) { return hasAnyPermission(ctx, ["sales_without_visit_history", "sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)"]); }

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
    if (!canOpenWalkins(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Sprzedaż bez wizyty." };
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
  }

  function parseNumber(value, fallback = 0) {
    const n = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function isoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function currentTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? `${n.toFixed(2)} PLN` : "0.00 PLN";
  }

  function formatDateTime(value, fallbackTime = "") {
    if (!value) return "-";
    const text = String(value);
    const date = text.slice(0, 10);
    const [y, m, d] = date.split("-");
    let time = fallbackTime ? String(fallbackTime).slice(0, 5) : "";
    if (!time && text.includes("T")) time = text.split("T")[1]?.slice(0, 5) || "";
    if (!time && text.includes(" ")) time = text.split(" ")[1]?.slice(0, 5) || "";
    return y && m && d ? `${d}.${m}.${y}${time ? " " + time : ""}` : text;
  }

  function clientName(client) {
    if (!client) return "";
    return [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email || client.phone || "";
  }

  function userName(user) { return user?.full_name || user?.email || ""; }

  function productPrice(product) {
    return parseNumber(product?.price) || parseNumber(product?.sale_price) || parseNumber(product?.gross_price) || parseNumber(product?.retail_price) || parseNumber(product?.selling_price) || parseNumber(product?.unit_price) || parseNumber(product?.last_purchase_price) || 0;
  }

  function servicePrice(service) {
    return parseNumber(service?.price) || parseNumber(service?.price_from) || parseNumber(service?.price_to) || 0;
  }

  function table(headers, rows, emptyText = "Nie znaleziono żadnych danych") {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText)}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
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

  function normalizeCompanyPaymentMethods(company) {
    let raw = company?.payment_methods;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { raw = null; }
    }
    const source = Array.isArray(raw) && raw.length ? raw : [{ name: "gotówka" }, { name: "karta kredytowa" }, { name: "przelew" }, { name: "pakiet" }, { name: "karnet" }, { name: "gratis" }];
    const seen = new Set();
    return source.map((item) => String(item?.name || item || "").trim()).filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function paymentMethodOptions(company) {
    const methods = normalizeCompanyPaymentMethods(company);
    if (!methods.some((m) => m.toLowerCase() === "gotówka")) methods.unshift("gotówka");
    return methods.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }

  function showOnlyPanel(target, panels) {
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(target, panels || []);
    panels.forEach((panel) => { if (panel) panel.hidden = panel !== target ? true : !panel.hidden; });
  }

  function closeWalkinsModals() {
    if (window.cmHardCloseAllModalPanels) return window.cmHardCloseAllModalPanels();
    if (window.cmCloseAllModalPanels) return window.cmCloseAllModalPanels();
    document.querySelectorAll(".cm-modal-active, .cm-as-modal").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("cm-modal-active", "cm-as-modal");
    });
    document.body?.classList?.remove("cm-modal-open");
  }

  function rerenderWalkinsAfterSuccess(delay = 450) {
    closeWalkinsModals();
    setTimeout(() => {
      closeWalkinsModals();
      renderWalkins();
    }, delay);
  }

  async function fetchWalkinsData(ctx) {
    const [salesRes, itemsRes, paymentsRes, clientsRes, usersRes, categoriesRes, positionsRes, servicesRes, productsRes, companyRes] = await Promise.all([
      window.cmSupabase
        .from("sales")
        .select("id, company_id, client_id, employee_id, employee_name, sale_number, sale_source, sale_date, sale_time, total_gross, payment_status, payment_method, note, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .eq("sale_source", "walkin")
        .neq("payment_status", "void")
        .order("created_at", { ascending: false }),
      window.cmSupabase
        .from("sale_items")
        .select("id, company_id, sale_id, item_type, service_id, product_id, name, name_snapshot, quantity, unit_price, total, total_price, created_at")
        .eq("company_id", ctx.companyId),
      window.cmSupabase
        .from("payments")
        .select("id, company_id, sale_id, amount, method, status, paid_at, created_at")
        .eq("company_id", ctx.companyId),
      window.cmSupabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, status")
        .eq("company_id", ctx.companyId),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId }),
      window.cmSupabase
        .from("service_categories")
        .select("id, name")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("positions")
        .select("id, name, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("services")
        .select("id, name, active, price, price_from, price_to")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("products")
        .select("id, name, active, price, sale_price, gross_price, net_price, retail_price, selling_price, sale_gross_price, unit_price, last_purchase_price")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("companies")
        .select("id, payment_methods")
        .eq("id", ctx.companyId)
        .maybeSingle()
    ]);
    const errors = [salesRes, itemsRes, paymentsRes, clientsRes, usersRes, categoriesRes, positionsRes, servicesRes, productsRes, companyRes].map((res) => res.error).filter(Boolean);
    if (errors.length) throw errors[0];
    return {
      sales: salesRes.data || [],
      items: itemsRes.data || [],
      payments: paymentsRes.data || [],
      clients: clientsRes.data || [],
      users: usersRes.data || [],
      categories: categoriesRes.data || [],
      positions: (positionsRes.data || []).filter((p) => p.active !== false),
      services: (servicesRes.data || []).filter((s) => s.active !== false),
      products: (productsRes.data || []).filter((p) => p.active !== false),
      company: companyRes.data || {}
    };
  }

  async function renderWalkins() {
    if (!isWalkinsPage()) return;
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `<section class="bm-page-card walkins-module"><h2>Sprzedaż bez wizyty</h2><p class="bm-muted">Ładowanie sprzedaży bez wizyty z Supabase...</p></section>`;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><pre class="cm-error-details">${escapeHtml(ctx.message)}</pre></section>`;
      return;
    }

    let data;
    try {
      data = await fetchWalkinsData(ctx);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd sprzedaży bez wizyty</h2><pre class="cm-error-details">${escapeHtml(JSON.stringify(error, null, 2))}</pre></section>`;
      return;
    }

    renderContent(ctx, data);
  }

  function saleItemsLabel(sale, items) {
    const saleItems = items.filter((item) => String(item.sale_id) === String(sale.id));
    return saleItems.map((item) => item.name_snapshot || item.name).filter(Boolean).join(" + ") || "-";
  }

  function renderContent(ctx, data) {
    const area = getPanelArea();
    if (!area) return;

    const params = new URLSearchParams(window.location.search || "");
    const q = normalizeText(params.get("q") || "");
    const limit = Number(getModulePageLimit(params.get("limit") || "50")) || 50;
    const allowAdd = canAddWalkins(ctx);
    const allowDelete = canDeleteWalkins(ctx);
    const allowHistory = canHistoryWalkins(ctx);

    const clientsById = Object.fromEntries(data.clients.map((c) => [c.id, c]));
    const usersById = Object.fromEntries(data.users.map((u) => [u.id, u]));
    const productOptions = data.products.map((p) => {
      const price = productPrice(p);
      return `<option value="${escapeHtml(p.id)}" data-price="${escapeHtml(price)}">${escapeHtml(p.name || "Produkt")}${price ? ` — ${escapeHtml(price)} PLN` : ""}</option>`;
    }).join("");
    const serviceOptions = data.services.map((s) => {
      const price = servicePrice(s);
      return `<option value="${escapeHtml(s.id)}" data-price="${escapeHtml(price)}">${escapeHtml(s.name || "Usługa")}${price ? ` — ${escapeHtml(price)} PLN` : ""}</option>`;
    }).join("");
    const customerOptions = data.clients.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(clientName(c) || "-")}</option>`).join("");
    const employeeOptions = data.users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(userName(u) || "-")}</option>`).join("");
    const quickServiceCategoryOptions = (data.categories || []).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "Kategoria")}</option>`).join("");
    const quickServicePositionOptions = (data.positions || []).map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || "Stanowisko")}</option>`).join("");

    const paymentBySale = Object.fromEntries(data.payments.map((p) => [p.sale_id, p]));
    const filtered = data.sales.filter((sale) => {
      const client = clientsById[sale.client_id];
      const employee = usersById[sale.employee_id];
      const payment = paymentBySale[sale.id];
      const text = normalizeText([
        sale.sale_number,
        sale.sale_date,
        sale.sale_time,
        sale.created_at,
        clientName(client),
        userName(employee),
        sale.employee_name,
        saleItemsLabel(sale, data.items),
        sale.total_gross,
        sale.payment_method,
        payment?.method,
        sale.note
      ].join(" "));
      return !q || text.includes(q);
    }).slice(0, limit);

    const rows = allowHistory ? filtered.map((sale) => {
      const payment = paymentBySale[sale.id] || {};
      const employee = usersById[sale.employee_id];
      return [
        clientName(clientsById[sale.client_id]) || "-",
        userName(employee) || sale.employee_name || "-",
        formatDateTime(sale.created_at || sale.sale_date, sale.sale_time),
        saleItemsLabel(sale, data.items),
        money(sale.total_gross || payment.amount),
        payment.method || sale.payment_method || "gotówka"
      ];
    }) : [];

    const paymentOptionsHtml = paymentMethodOptions(data.company);

    const saleOptions = data.sales.map((sale) => `<option value="${escapeHtml(sale.id)}">${escapeHtml([formatDateTime(sale.created_at || sale.sale_date, sale.sale_time), clientName(clientsById[sale.client_id]) || "-", saleItemsLabel(sale, data.items), money(sale.total_gross), paymentBySale[sale.id]?.method || sale.payment_method || "gotówka"].join(" — "))}</option>`).join("");

    area.innerHTML = `<section class="bm-page-card walkins-module">
      <div class="bm-page-head customers-head"><h2>Sprzedaż bez wizyty</h2><div class="bm-actions-row">${allowAdd ? `<button id="showAddWalkin" type="button">Dodaj</button>` : ""}${allowDelete ? `<button id="showDeleteWalkin" type="button" class="bm-danger-btn">Usuń</button>` : ""}</div></div>
      ${allowHistory ? `<div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("walkinsLimit")}<label>Szukaj: <input id="walkinsSearch" type="search" placeholder="Szukaj sprzedaży" value="${escapeHtml(params.get("q") || "")}"></label></div>` : ""}
      <div id="walkinsTableWrap">${allowHistory ? table(["Klient", "Pracownik", "Data i godzina", "Produkt/usługa", "Kwota", "Płatność"], rows) + pagination(filtered.length) : `<div class="bm-empty-state">Brak uprawnienia do historii sprzedaży bez wizyty.</div>`}</div>
      <p id="walkinsMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinFormCard" hidden>
      <h2>Dodaj sprzedaż bez wizyty</h2>
      <form id="walkinForm" class="bm-form-grid bm-wide-form">
        <label>Pracownik<select name="employeeId"><option value="">Automatycznie / brak</option>${employeeOptions}</select></label>
        <label>Klient<select name="clientId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
        <div class="bm-form-row-2 full">
          <label>Data sprzedaży<input name="saleDate" type="date" value="${isoToday()}" required></label>
          <label>Godzina<input name="saleTime" type="time" value="${currentTime()}" required></label>
        </div>
        <div class="cm-connected-field">
          <label>Produkt<select name="productId" id="walkinProductSelect"><option value="">Nie dodawaj produktu</option>${productOptions}</select></label>
          <button type="button" id="walkinOpenQuickProduct" class="bm-secondary-btn">Dodaj nowy produkt</button>
        </div>
        <div class="cm-connected-field">
          <label>Usługa<select name="serviceId" id="walkinServiceSelect"><option value="">Nie dodawaj usługi</option>${serviceOptions}</select></label>
          <button type="button" id="walkinOpenQuickService" class="bm-secondary-btn">Dodaj nową usługę</button>
        </div>
        <label>Razem do zapłaty<input name="amount" id="walkinAmount" type="number" min="0" step="0.01" value="0.00"></label>
        <label>Płatność<select name="paymentMethod" required>${paymentOptionsHtml}</select></label>
        <label class="full">Opis<textarea name="description" placeholder="Opis sprzedaży"></textarea></label>
        <div class="full"><button type="submit">Zapisz sprzedaż</button></div>
      </form>
      <p id="walkinFormMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinQuickProductCard" hidden>
      <h2>Dodaj produkt do bazy</h2>
      <p class="bm-muted">Produkt zapisze się w module Produkty i od razu będzie dostępny w Sprzedaży bez wizyty.</p>
      <form id="walkinQuickProductForm" class="bm-form-grid bm-wide-form">
        <label>Nazwa produktu<input name="name" placeholder="Nazwa produktu" required></label>
        <label>Kategoria<input name="category" placeholder="np. Kosmetyki"></label>
        <label>Cena sprzedaży<input name="price" type="number" min="0" step="0.01" placeholder="0.00" required></label>
        <label>Ilość / stan<input name="unitStock" type="number" min="0" step="1" value="0"></label>
        <label>Dostawca<input name="supplier" placeholder="Dostawca"></label>
        <label class="full">Opis<textarea name="description" placeholder="Opis produktu"></textarea></label>
        <div class="full"><button type="submit">Zapisz produkt</button></div>
      </form>
      <p id="walkinQuickProductMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinQuickServiceCard" hidden>
      <h2>Dodaj usługę do bazy</h2>
      <p class="bm-muted">Usługa zapisze się w module Usługi i od razu będzie dostępna w Sprzedaży bez wizyty.</p>
      <form id="walkinQuickServiceForm" class="bm-form-grid bm-wide-form">
        <label>Kategoria usług
          <select name="categoryId">
            <option value="">Wybierz kategorię</option>
            ${quickServiceCategoryOptions}
          </select>
        </label>
        <label>Lub nowa kategoria<input name="newCategory" placeholder="np. Strzyżenie"></label>
        <label>Nazwa usługi<input name="name" placeholder="Nazwa usługi" required></label>
        <label>Stanowisko pracy<select name="positionId" required><option value="">Wybierz stanowisko</option>${quickServicePositionOptions}</select></label>
        <div class="bm-form-row-2 full">
          <label>Czas — godziny<input name="durationHours" type="number" min="0" step="1" value="0" required></label>
          <label>Czas — minuty<input name="durationMinutes" type="number" min="0" max="59" step="1" value="30" required></label>
        </div>
        <label>Cena usługi<input name="price" type="number" min="0" step="0.01" placeholder="0.00" required></label>
        <label class="full">Opis<textarea name="description" placeholder="Opis usługi"></textarea></label>
        <div class="full"><button type="submit">Zapisz usługę</button></div>
      </form>
      <p id="walkinQuickServiceMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinDeleteCard" hidden>
      <h2>Usuń sprzedaż bez wizyty</h2>
      <div class="bm-form-grid bm-wide-form">
        <label class="full">Wybierz sprzedaż<select id="deleteWalkinSelect" required><option value="">Wybierz z obecnych</option>${saleOptions}</select></label>
        <div class="full"><button id="deleteWalkinBtn" type="button" class="bm-danger-btn">Usuń sprzedaż</button></div>
      </div>
      <p id="walkinDeleteMessage" class="panel-message"></p>
    </section>`;

    bindActions(ctx, data);
  }

  function bindActions(ctx, data) {
    const formCard = document.querySelector("#walkinFormCard");
    const deleteCard = document.querySelector("#walkinDeleteCard");
    const quickProductCard = document.querySelector("#walkinQuickProductCard");
    const quickServiceCard = document.querySelector("#walkinQuickServiceCard");
    const panels = [formCard, deleteCard, quickProductCard, quickServiceCard];
    document.querySelector("#showAddWalkin")?.addEventListener("click", () => showOnlyPanel(formCard, panels));
    document.querySelector("#showDeleteWalkin")?.addEventListener("click", () => showOnlyPanel(deleteCard, panels));
    document.querySelector("#walkinOpenQuickProduct")?.addEventListener("click", () => showOnlyPanel(quickProductCard, panels));
    document.querySelector("#walkinOpenQuickService")?.addEventListener("click", () => showOnlyPanel(quickServiceCard, panels));
    setupModuleLimitDropdowns(document);

    const apply = () => {
      const q = encodeURIComponent(document.querySelector("#walkinsSearch")?.value || "");
      const limit = encodeURIComponent(document.querySelector("#walkinsLimit")?.value || getModulePageLimit());
      window.location.href = `walkins.html?limit=${limit}${q ? `&q=${q}` : ""}`;
    };
    document.querySelector("#walkinsSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });

    const updateAmount = () => {
      const productSelect = document.querySelector("#walkinProductSelect");
      const serviceSelect = document.querySelector("#walkinServiceSelect");
      const productPrice = parseNumber(productSelect?.selectedOptions?.[0]?.dataset?.price, 0);
      const servicePrice = parseNumber(serviceSelect?.selectedOptions?.[0]?.dataset?.price, 0);
      const amount = document.querySelector("#walkinAmount");
      if (amount) amount.value = (productPrice + servicePrice).toFixed(2);
    };
    document.querySelector("#walkinProductSelect")?.addEventListener("change", updateAmount);
    document.querySelector("#walkinServiceSelect")?.addEventListener("change", updateAmount);

    document.querySelector("#walkinQuickProductForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        const price = parseNumber(fd.get("price"), 0);
        if (!name) throw new Error("Podaj nazwę produktu.");
        if (price <= 0) throw new Error("Podaj cenę produktu większą od 0.");
        const payload = {
          company_id: ctx.companyId,
          name,
          category: String(fd.get("category") || "").trim(),
          price,
          unit_stock: parseNumber(fd.get("unitStock"), 0),
          package_stock: 0,
          low_package_stock: 0,
          units_per_package: 0,
          sale_only: true,
          supplier: String(fd.get("supplier") || "").trim(),
          description: String(fd.get("description") || "").trim(),
          include_commission: false,
          include_discount: false,
          active: true,
          updated_at: new Date().toISOString()
        };
        const { data: insertedProduct, error } = await window.cmSupabase.from("products").insert(payload).select("*").single();
        if (error) throw error;
        await window.cmUndo?.record({ module: "products", actionType: "insert", targetTable: "products", targetId: insertedProduct?.id, afterData: insertedProduct || payload, companyId: ctx.companyId });
        setMessage("#walkinQuickProductMessage", "Produkt zapisany. Odświeżam listę sprzedaży...", true);
        setTimeout(renderWalkins, 450);
      } catch (error) {
        setMessage("#walkinQuickProductMessage", "Błąd zapisu produktu: " + (error.message || JSON.stringify(error)), false);
        form.dataset.saving = "0";
        if (submit) submit.disabled = false;
      }
    });

    document.querySelector("#walkinQuickServiceForm")?.addEventListener("submit", async (event) => {
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
        const price = parseNumber(fd.get("price"), 0);
        if (!name) throw new Error("Podaj nazwę usługi.");
        if (!categoryId && !newCategory) throw new Error("Wybierz kategorię albo wpisz nową.");
        if (!positionId) throw new Error("Wybierz stanowisko pracy.");
        if (durationHours <= 0 && durationMinutes <= 0) throw new Error("Czas usługi musi być większy niż 0.");
        if (price <= 0) throw new Error("Podaj cenę usługi większą od 0.");
        if (!categoryId && newCategory) {
          const { data: category, error: categoryError } = await window.cmSupabase
            .from("service_categories")
            .insert({ company_id: ctx.companyId, name: newCategory, updated_at: new Date().toISOString() })
            .select("*")
            .single();
          if (categoryError) throw categoryError;
          categoryId = category?.id || "";
        }
        const payload = {
          company_id: ctx.companyId,
          category_id: categoryId,
          name,
          duration_hours: durationHours,
          duration_minutes: durationMinutes,
          price_from: price,
          price_to: price,
          position_id: positionId,
          description: String(fd.get("description") || "").trim() || null,
          show_online: false,
          prevent_overlap: false,
          deposit: 0,
          include_commission: false,
          include_discount: false,
          active: true,
          updated_at: new Date().toISOString()
        };
        const { data: insertedService, error } = await window.cmSupabase.from("services").insert(payload).select("*").single();
        if (error) throw error;
        await window.cmUndo?.record({ module: "services", actionType: "insert", targetTable: "services", targetId: insertedService?.id, afterData: insertedService || payload, companyId: ctx.companyId });
        setMessage("#walkinQuickServiceMessage", "Usługa zapisana. Odświeżam listę sprzedaży...", true);
        setTimeout(renderWalkins, 450);
      } catch (error) {
        setMessage("#walkinQuickServiceMessage", "Błąd zapisu usługi: " + (error.message || JSON.stringify(error)), false);
        form.dataset.saving = "0";
        if (submit) submit.disabled = false;
      }
    });

    document.querySelector("#walkinForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const formData = new FormData(form);
        const payload = {
          company_id: ctx.companyId,
          employee_id: String(formData.get("employeeId") || "").trim(),
          client_id: String(formData.get("clientId") || "").trim(),
          sale_date: String(formData.get("saleDate") || isoToday()),
          sale_time: String(formData.get("saleTime") || currentTime()).slice(0, 5),
          product_id: String(formData.get("productId") || "").trim(),
          product_custom: "",
          service_id: String(formData.get("serviceId") || "").trim(),
          service_custom: "",
          amount: parseNumber(formData.get("amount"), 0),
          payment_method: String(formData.get("paymentMethod") || "gotówka"),
          description: String(formData.get("description") || "").trim()
        };
        if (!payload.client_id) throw new Error("Wybierz klienta.");
        if (!payload.product_id && !payload.service_id) throw new Error("Dodaj produkt albo usługę do sprzedaży.");
        const { data: inserted, error } = await window.cmSupabase.rpc("cm_create_walkin_sale", { p_payload: payload });
        if (error) throw error;
        await window.cmUndo?.record({ module: "walkins", actionType: "insert", targetTable: "sales", targetId: inserted?.sale_id, afterData: inserted || payload, companyId: ctx.companyId });
        setMessage("#walkinFormMessage", "Sprzedaż bez wizyty zapisana.", true);
        rerenderWalkinsAfterSuccess(450);
      } catch (error) {
        setMessage("#walkinFormMessage", "Błąd zapisu sprzedaży: " + (error.message || JSON.stringify(error)), false);
        form.dataset.saving = "0";
        if (submit) submit.disabled = false;
      }
    });

    document.querySelector("#deleteWalkinBtn")?.addEventListener("click", async () => {
      const saleId = document.querySelector("#deleteWalkinSelect")?.value;
      if (!saleId) { setMessage("#walkinDeleteMessage", "Wybierz sprzedaż do usunięcia.", false); return; }
      const before = data.sales.find((sale) => String(sale.id) === String(saleId)) || null;
      const { data: updated, error } = await window.cmSupabase.rpc("cm_void_walkin_sale", { p_sale_id: saleId });
      if (error) { setMessage("#walkinDeleteMessage", "Błąd usuwania sprzedaży: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "walkins", actionType: "update", targetTable: "sales", targetId: saleId, beforeData: before, afterData: updated || { ...(before || {}), payment_status: "void" }, companyId: ctx.companyId });
      setMessage("#walkinDeleteMessage", "Sprzedaż usunięta z listy.", true);
      rerenderWalkinsAfterSuccess(450);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!isWalkinsPage()) return;
    window.setTimeout(renderWalkins, 140);
  });
})();
