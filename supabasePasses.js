// CompanyManager — Passes Module powered by Supabase
// 039B: Karnety Supabase — sprzedaż karnetu + osoba korzystająca + użycie na Dashboardzie.

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
    const [passesRes, clientsRes, usersRes, servicesRes] = await Promise.all([
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
        .order("name", { ascending: true })
    ]);
    const errors = [passesRes, clientsRes, usersRes, servicesRes].map((res) => res.error).filter(Boolean);
    if (errors.length) throw errors[0];
    return { passes: passesRes.data || [], clients: clientsRes.data || [], users: usersRes.data || [], services: (servicesRes.data || []).filter((s) => s.active !== false) };
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

  function passPayload(ctx, formData, usersById, clientsById, servicesById, number) {
    const employeeId = String(formData.get("employeeId") || "").trim() || null;
    const buyerClientId = String(formData.get("buyerClientId") || "").trim() || null;
    const beneficiaryClientId = String(formData.get("beneficiaryClientId") || "").trim() || buyerClientId;
    const serviceId = String(formData.get("serviceId") || "").trim() || null;
    const passType = String(formData.get("passType") || "amount").trim();
    const value = parseNumber(formData.get("value"), 0);
    const totalUnits = parseNumber(formData.get("totalUnits"), 0);
    const service = servicesById[serviceId];
    const name = passType === "service" || passType === "units"
      ? `Karnet ${totalUnits || 1}x ${service?.name || "usługa"}`
      : "Karnet kwotowy";
    return {
      company_id: ctx.companyId,
      customer_id: beneficiaryClientId,
      buyer_client_id: buyerClientId,
      beneficiary_client_id: beneficiaryClientId,
      employee_id: employeeId,
      service_id: serviceId,
      name,
      number,
      sale_date: String(formData.get("saleDate") || isoToday()),
      sale_time: String(formData.get("saleTime") || "").slice(0, 5),
      valid_until: String(formData.get("validUntil") || "") || null,
      payment_method: String(formData.get("paymentMethod") || "gotówka"),
      pass_type: passType,
      total_units: totalUnits,
      value,
      description: String(formData.get("description") || "").trim()
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
      pass.pass_type === "service" || pass.pass_type === "units" ? `${Number(pass.remaining_units || 0)}/${Number(pass.total_units || 0)}` : money(pass.remaining),
      money(pass.value)
    ]);
    const passOptions = data.passes.map((pass) => `<option value="${escapeHtml(pass.id)}">${escapeHtml([pass.name || "Karnet", pass.number || "", pass.customer_name || clientName(clientsById[pass.customer_id]) || "-", `ważny do ${formatDatePL(pass.valid_until)}`, money(pass.value), `pozostało ${money(pass.remaining)}`, pass.status || ""].filter(Boolean).join(" — "))}</option>`).join("");
    const filterTabs = `
      <div class="bm-filter-tabs">
        <a class="${status === "all" ? "active" : ""}" href="passes.html?status=all">pokaż wszystkie</a>
        <a class="${status === "aktualne" ? "active" : ""}" href="passes.html?status=aktualne">aktualne</a>
        <a class="${status === "zrealizowane" ? "active" : ""}" href="passes.html?status=zrealizowane">zrealizowane</a>
        <a class="${status === "po terminie" ? "active" : ""}" href="passes.html?status=po%20terminie">po terminie</a>
      </div>`;

    area.innerHTML = `<section class="bm-page-card passes-module">
      <div class="bm-page-head customers-head"><h2>Karnety</h2><div class="bm-actions-row">${allowAdd ? `<button id="showAddPass" type="button">Dodaj</button>` : ""}${allowDelete ? `<button id="showDeletePass" type="button" class="bm-danger-btn">Usuń</button>` : ""}</div></div>
      ${filterTabs}
      <section id="addPassPanel" class="bm-page-card bm-inner-card" hidden>
        <h2>Dodaj karnet</h2>
        <form id="addPassForm" class="bm-form-grid bm-wide-form">
          <div class="bm-form-row-2 full"><label>Data i godzina sprzedaży<input name="saleDate" type="date" value="${isoToday()}" required></label><label>Godzina<input name="saleTime" type="time" value="06:00" required></label></div>
          <label>Sprzedawca<select name="employeeId"><option value="">Automatycznie / brak</option>${employeeOptions}</select></label>
          <label>Typ karnetu<select name="passType"><option value="service">Ilościowy / usługowy</option><option value="amount">Kwotowy</option></select></label>
          <label>Kupujący<select name="buyerClientId" required><option value="">Wybierz kupującego</option>${customerOptions}</select></label>
          <label>Osoba korzystająca<select name="beneficiaryClientId" required><option value="">Wybierz osobę korzystającą</option>${customerOptions}</select></label>
          <label>Usługa<select name="serviceId"><option value="">Bez konkretnej usługi</option>${serviceOptions}</select></label>
          <label>Liczba wejść<input name="totalUnits" type="number" min="0" step="1" value="5"></label>
          <label>Data ważności karnetu<input name="validUntil" type="date" value="${isoPlusMonths(1)}" required></label>
          <label>Cena sprzedaży (PLN)<input name="value" type="number" min="0" step="0.01" value="0.00" required></label>
          <label>Sposób płatności<select name="paymentMethod" required><option value="gotówka">gotówka</option><option value="karta kredytowa">karta kredytowa</option><option value="przelew">przelew</option><option value="gratis">gratis</option></select></label>
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

    bindActions(ctx, data, usersById, clientsById, servicesById, status);
  }

  function bindActions(ctx, data, usersById, clientsById, servicesById, status) {
    const addPanel = document.querySelector("#addPassPanel");
    const deletePanel = document.querySelector("#deletePassPanel");
    const panels = [addPanel, deletePanel];
    document.querySelector("#showAddPass")?.addEventListener("click", () => showOnlyPanel(addPanel, panels));
    document.querySelector("#showDeletePass")?.addEventListener("click", () => showOnlyPanel(deletePanel, panels));
    setupModuleLimitDropdowns(document);

    const apply = () => {
      const q = encodeURIComponent(document.querySelector("#passesSearch")?.value || "");
      const limit = encodeURIComponent(document.querySelector("#passesLimit")?.value || getModulePageLimit());
      window.location.href = `passes.html?status=${encodeURIComponent(status)}&limit=${limit}${q ? `&q=${q}` : ""}`;
    };
    document.querySelector("#passesSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });

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
        const payload = passPayload(ctx, new FormData(form), usersById, clientsById, servicesById, null);
        if (!payload.buyer_client_id) throw new Error("Wybierz kupującego.");
        if (!payload.beneficiary_client_id) throw new Error("Wybierz osobę korzystającą.");
        if (!payload.valid_until) throw new Error("Wybierz datę ważności.");
        if ((payload.pass_type === "service" || payload.pass_type === "units") && !payload.total_units) throw new Error("Wpisz liczbę wejść.");
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
