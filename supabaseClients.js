// CompanyManager — Clients Module powered by Supabase
// 029C: Klienci pełny CRUD Supabase: lista / dodaj / edytuj / usuń + company_id isolation + permission guard.

(function () {
  function isCustomersPage() {
    return document.body?.dataset?.panelPage === "customers" || window.location.pathname.includes("customers.html");
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


  function plDate(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString("pl-PL");
    } catch (_) {
      return "";
    }
  }

  function boolToTakNie(value) {
    return value ? "tak" : "nie";
  }

  function takNieToBool(value) {
    return String(value || "").trim().toLowerCase() === "tak";
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

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
    try {
      const parsed = JSON.parse(raw);
      return normalizePermissions(parsed);
    } catch (_) {
      return {};
    }
  }

  function hasAnyPermission(ctx, keys) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return keys.some((key) => permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1");
  }


  function canExportData(ctx) {
    return hasAnyPermission(ctx, [
      "export_data",
      "export danych",
      "export danych z całej platformy",
      "export/import danych"
    ]);
  }

  function canImportData(ctx) {
    return hasAnyPermission(ctx, [
      "import_data",
      "import danych",
      "import danych do całej platformy",
      "export/import danych"
    ]);
  }

  function guardExportImport(ctx, type, selector) {
    const ok = type === "export" ? canExportData(ctx) : canImportData(ctx);
    if (ok) return true;
    const permission = type === "export" ? "export danych z całej platformy" : "import danych do całej platformy";
    setMessage(selector, "Brak uprawnienia: " + permission, false);
    return false;
  }

  function canOpenClients(ctx) {
    return hasAnyPermission(ctx, [
      "open_clients",
      "open:customers",
      "customers_open",
      "klienci",
      "Klienci"
    ]);
  }

  function canAddClients(ctx) {
    return hasAnyPermission(ctx, [
      "clients_add",
      "customers_add",
      "klienci_add",
      "klienci (dodawanie, edycja, usuwanie)"
    ]);
  }

  function canEditClients(ctx) {
    return hasAnyPermission(ctx, [
      "clients_edit",
      "customers_edit",
      "klienci_edit",
      "klienci (dodawanie, edycja, usuwanie)"
    ]);
  }

  function canDeleteClients(ctx) {
    return hasAnyPermission(ctx, [
      "clients_delete",
      "customers_delete",
      "klienci_delete",
      "klienci (dodawanie, edycja, usuwanie)"
    ]);
  }

  function canViewClientHistory(ctx) {
    return hasAnyPermission(ctx, [
      "clients_history",
      "customers_history",
      "klienci_history",
      "klienci — historia",
      "klienci - historia (przeglądanie historii klientów)",
      "klienci - historia (przeglądanie historii klientów - tabeli poniżej)"
    ]);
  }

  async function getContext() {
    if (!window.cmSupabase) {
      return { ok: false, message: "Nie załadowano połączenia z Supabase." };
    }

    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);

    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    if (!context.company_id) {
      return {
        ok: false,
        message: "Brak wybranej firmy. OWNER musi najpierw wejść w firmę z zakładki Firmy."
      };
    }

    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!canOpenClients(ctx)) {
      return { ok: false, message: "Brak uprawnienia do otwierania zakładki Klienci." };
    }

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
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

  function clientName(client) {
    const joined = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    return joined || client.full_name || "-";
  }


  function cmMoneyNumber(value) {
    const n = Number(String(value ?? "").replace(/[^0-9,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function cmMoneyLabel(value) {
    const n = cmMoneyNumber(value);
    return n > 0 ? `${n.toFixed(2)} PLN` : "";
  }

  function clientOptionLabel(client) {
    return [clientName(client), client.phone, client.email].filter(Boolean).join(" — ");
  }

  function appointmentClientId(item) {
    return String(item?.client_id || item?.customer_id || "").trim();
  }

  function clientImportantEntries(client, importantNotesByClient = {}) {
    const entries = [];
    if (String(client?.notes || "").trim()) {
      entries.push({ date: client.updated_at || client.created_at || "", label: "Karta klienta", text: String(client.notes || "").trim() });
    }
    (importantNotesByClient[String(client?.id || "")] || []).forEach((item) => {
      const note = String(item.note || "").trim();
      if (!note) return;
      const when = [plDate(item.date || String(item.starts_at || item.appointment_datetime || item.created_at || "").slice(0, 10)), item.start_time || item.time || ""].filter(Boolean).join(" ");
      const amount = cmMoneyLabel(item.total ?? item.price ?? item.paid_amount ?? item.amount);
      const payment = item.payment_method || item.payment || "";
      const label = [when, item.service_name || "Wizyta", item.employee_name || "", amount, payment].filter(Boolean).join(" — ");
      entries.push({ date: item.date || item.created_at || "", label, text: note });
    });
    return entries;
  }

  function clientImportantCell(client, importantNotesByClient = {}) {
    const entries = clientImportantEntries(client, importantNotesByClient);
    const current = String(client.notes || "").trim() || entries[0]?.text || "";
    if (!entries.length) return "";
    const tooltip = entries.map((entry) => `${entry.label}: ${entry.text}`).join("\n\n");
    const preview = current.length > 90 ? current.slice(0, 87) + "..." : current;
    return `<span class="cm-client-important-hover" tabindex="0" title="${escapeHtml(tooltip)}">${escapeHtml(preview)}<span class="cm-client-important-popover">${entries.map((entry) => `<b>${escapeHtml(entry.label)}</b><br>${escapeHtml(entry.text)}`).join("<hr>")}</span></span>`;
  }

  async function fetchClientImportantNotes(companyId) {
    try {
      const { data, error } = await window.cmSupabase
        .from("appointments")
        .select("id, company_id, date, time, start_time, starts_at, appointment_datetime, customer_id, client_id, employee_name, service_name, note, price, total, paid_amount, payment_method, created_at")
        .eq("company_id", companyId)
        .not("note", "is", null)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });
      if (error) throw error;
      return (data || []).reduce((acc, item) => {
        const note = String(item.note || "").trim();
        const id = appointmentClientId(item);
        if (!id || !note) return acc;
        (acc[id] ||= []).push(item);
        return acc;
      }, {});
    } catch (error) {
      console.warn("Client important notes skipped", error?.message || error);
      return {};
    }
  }

  function getCustomerRows(customers, importantNotesByClient = {}) {
    return customers.map((client) => [
      escapeHtml(clientName(client)),
      escapeHtml(client.gender || ""),
      escapeHtml(client.phone || ""),
      escapeHtml(client.email || ""),
      `<span class="bm-status ${client.marketing_sms ? "active" : "inactive"}">${client.marketing_sms ? "tak" : "nie"}</span>`,
      `<span class="bm-status ${client.marketing_email ? "active" : "inactive"}">${client.marketing_email ? "tak" : "nie"}</span>`,
      escapeHtml(plDate(client.updated_at)),
      escapeHtml(plDate(client.last_visit_at)),
      clientImportantCell(client, importantNotesByClient),
      `<span class="bm-status ${client.active === false ? "inactive" : "active"}">${client.active === false ? "nieaktywny" : "aktywny"}</span>`
    ]);
  }

  async function fetchCustomers(companyId) {
    return window.cmSupabase
      .from("clients")
      .select("id, company_id, first_name, last_name, gender, phone, email, birth_date, address, city, postal_code, notes, source, marketing_sms, marketing_email, active, tags, total_visits, total_spent, last_visit_at, created_at, updated_at")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("created_at", { ascending: false });
  }

  async function renderCustomers() {
    if (!isCustomersPage()) return;

    const area = getPanelArea();
    if (!area) return;

    area.innerHTML = `
      <section class="bm-page-card customers-module">
        <h2>Lista klientów</h2>
        <p class="bm-muted">Ładowanie klientów z Supabase...</p>
      </section>
    `;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>${escapeHtml(ctx.message)}</p></section>`;
      return;
    }

    const { data: customers, error } = await fetchCustomers(ctx.companyId);
    if (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd klientów</h2><p>${escapeHtml(error.message)}</p></section>`;
      return;
    }

    const importantNotesByClient = await fetchClientImportantNotes(ctx.companyId);
    renderContent(ctx, customers || [], importantNotesByClient);
    setupClientNativeDatePickers();
  }


  function setupClientNativeDatePickers() {
    // Uwaga: formularze Dodaj/Edytuj są osobnymi sekcjami obok .customers-module,
    // dlatego nie można ograniczać selektora tylko do .customers-module.
    // Używamy dokładnie natywnego input[type=date] jak w działających lokalnych Wizytach,
    // ale podpinamy showPicker po renderze Supabase, bo app.js podpinał pickery przed nadpisaniem widoku klientów.
    document.querySelectorAll('#customerFormCard input[type="date"], #customerEditCard input[type="date"]').forEach((input) => {
      if (input.dataset.cmClientPickerReady === '1') return;
      input.dataset.cmClientPickerReady = '1';
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

  function customerFormFields(prefix, customer = {}) {
    const genderOptions = ["kobieta", "mężczyzna"];
    const statusOptions = ["aktywny", "nieaktywny"];
    const yesNoOptions = ["tak", "nie"];
    const status = customer.active === false ? "nieaktywny" : "aktywny";
    return `
      <label>Imię<input name="firstName" placeholder="Imię" value="${escapeHtml(customer.first_name || "")}" required></label>
      <label>Nazwisko<input name="lastName" placeholder="Nazwisko" value="${escapeHtml(customer.last_name || "")}" required></label>
      <label>Płeć<select name="gender" required>${genderOptions.map((g) => `<option value="${g}" ${String(customer.gender || "") === g ? "selected" : ""}>${g}</option>`).join("")}</select></label>
      <label>Telefon<input name="phone" placeholder="Telefon" value="${escapeHtml(customer.phone || "")}" required></label>
      <label>Email<input name="email" type="email" placeholder="email@firma.pl" value="${escapeHtml(customer.email || "")}"></label>
      <label>Adres<input name="address" placeholder="Adres" value="${escapeHtml(customer.address || "")}"></label>
      <label>Kod pocztowy<input name="postalCode" placeholder="XX-XXX" value="${escapeHtml(customer.postal_code || "")}"></label>
      <label>Miejscowość<input name="city" placeholder="Miejscowość" value="${escapeHtml(customer.city || "")}"></label>
      <label>Status<select name="status">${statusOptions.map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>Skąd klient wie o firmie<input name="source" placeholder="np. Google, Facebook, polecenie" value="${escapeHtml(customer.source || "")}"></label>
      <label>Zgoda na reklamę SMS<select name="marketingSms">${yesNoOptions.map((v) => `<option value="${v}" ${boolToTakNie(customer.marketing_sms) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Zgoda na reklamę Email<select name="marketingEmail">${yesNoOptions.map((v) => `<option value="${v}" ${boolToTakNie(customer.marketing_email) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Dzień, miesiąc i rok urodzin<input name="birthDate" type="date" value="${escapeHtml(customer.birth_date || "")}" aria-label="Dzień, miesiąc i rok urodzin"></label>
      <label class="full">Ważna informacja<textarea name="importantInfo" placeholder="Ważna informacja">${escapeHtml(customer.notes || "")}</textarea></label>
    `;
  }

  function buildPayload(ctx, data) {
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();
    const phone = String(data.phone || "").trim();
    return {
      company_id: ctx.companyId,
      first_name: firstName,
      last_name: lastName,
      gender: String(data.gender || "").trim(),
      phone,
      email: String(data.email || "").trim() || null,
      address: String(data.address || "").trim() || null,
      postal_code: String(data.postalCode || "").trim() || null,
      city: String(data.city || "").trim() || null,
      source: String(data.source || "").trim() || null,
      birth_date: String(data.birthDate || "").trim() || null,
      notes: String(data.importantInfo || "").trim() || null,
      marketing_sms: takNieToBool(data.marketingSms),
      marketing_email: takNieToBool(data.marketingEmail),
      active: String(data.status || "aktywny") !== "nieaktywny",
      updated_at: new Date().toISOString()
    };
  }

  function renderContent(ctx, customers, importantNotesByClient = {}) {
    const area = getPanelArea();
    if (!area) return;

    const allowAdd = canAddClients(ctx);
    const allowEdit = canEditClients(ctx);
    const allowDelete = canDeleteClients(ctx);
    const allowHistory = canViewClientHistory(ctx);
    const allowExport = canExportData(ctx);
    const allowImport = canImportData(ctx);
    const customerHistoryPermission = "klienci — historia";
    const customerOptions = customers.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(clientOptionLabel(client))}</option>`).join("");

    area.innerHTML = `
      <section class="bm-page-card customers-module">
        <div class="bm-page-head customers-head">
          <h2>Lista klientów</h2>
          <div class="bm-actions-row">
            ${allowExport ? `<button id="exportCustomersBtn" type="button" class="bm-excel-btn" data-required-permission="export danych z całej platformy">Export</button>` : ""}
            ${allowImport ? `<button id="importCustomersBtn" type="button" class="bm-excel-btn" data-required-permission="import danych do całej platformy">Import</button><input id="importCustomersFile" type="file" accept=".xls,.xlsx,.csv" hidden>` : ""}
            ${allowAdd ? `<button id="showAddCustomer" type="button">Dodaj</button>` : ""}
            ${allowEdit ? `<button id="showEditCustomer" type="button">Edytuj</button>` : ""}
            ${allowDelete ? `<button id="showDeleteCustomer" type="button" class="bm-danger-btn">Usuń</button>` : ""}
          </div>
        </div>

        ${allowHistory ? `
          <div class="bm-table-toolbar cm-limit-toolbar">
            ${moduleLimitDropdownHtml("customersLimit")}
            <label>Szukaj: <input id="customersSearch" type="search" placeholder="Szukaj klienta"></label>
          </div>
        ` : ""}

        <div id="customersTableWrap">
          ${allowHistory ? `
            ${table(["Imię Nazwisko", "Płeć", "Telefon", "Email", "Reklama SMS", "Reklama Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(customers, importantNotesByClient), "Brak klientów w Supabase.")}
            ${pagination(customers.length)}
          ` : `<div class="bm-empty-state cm-permission-notice">Brak uprawnienia: ${escapeHtml(customerHistoryPermission)}</div>`}
        </div>
        <p id="customersMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="customerFormCard" hidden>
        <h2>Dodaj klienta</h2>
        <form id="customerForm" class="bm-form-grid">
          ${customerFormFields("add")}
          <button type="submit">Zapisz klienta</button>
        </form>
        <p id="customerFormMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="customerEditCard" hidden>
        <h2>Edytuj klienta</h2>
        <form id="customerEditSelectForm" class="bm-form-grid">
          <label class="full">Wybierz klienta<select name="clientId" required><option value="">Wybierz...</option>${customerOptions}</select></label>
        </form>
        <form id="customerEditForm" class="bm-form-grid" hidden>
          ${customerFormFields("edit")}
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="customerEditMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="customerDeleteCard" hidden>
        <h2>Usuń klienta</h2>
        <form id="customerDeleteForm" class="bm-form-grid">
          <label class="full">Wybierz klienta<select name="clientId" required><option value="">Wybierz...</option>${customerOptions}</select></label>
          <button type="submit" class="bm-danger-btn">Usuń</button>
        </form>
        <p id="customerDeleteMessage" class="panel-message"></p>
      </section>
    `;

    bindActions(ctx, customers, importantNotesByClient);
  }

  function filterCustomers(customers) {
    const search = String(document.querySelector("#customersSearch")?.value || "").toLowerCase().trim();
    if (!search) return customers;

    return customers.filter((client) => {
      const text = [
        client.first_name,
        client.last_name,
        client.full_name,
        client.gender,
        client.phone,
        client.email,
        client.marketing_sms ? "zgoda sms tak" : "zgoda sms nie",
        client.marketing_email ? "zgoda email tak" : "zgoda email nie",
        client.city,
        client.address,
        client.postal_code,
        client.notes,
        client.active === false ? "nieaktywny" : "aktywny"
      ].join(" ").toLowerCase();
      return text.includes(search);
    });
  }

  function rerenderTable(customers, importantNotesByClient = {}) {
    const wrap = document.querySelector("#customersTableWrap");
    if (!wrap || wrap.querySelector(".cm-permission-notice")) return;
    const filtered = filterCustomers(customers);
    if (!wrap) return;
    wrap.innerHTML = `
      ${table(["Imię Nazwisko", "Płeć", "Telefon", "Email", "Reklama SMS", "Reklama Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(filtered, importantNotesByClient), "Brak klientów w Supabase.")}
      ${pagination(filtered.length)}
    `;
  }

  function showOnly(cardToShow) {
    const panels = ["#customerFormCard", "#customerEditCard", "#customerDeleteCard"].map((selector) => document.querySelector(selector));
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(cardToShow, panels);
    panels.forEach((card) => {
      if (!card) return;
      card.hidden = card !== cardToShow ? true : !card.hidden;
    });
  }

  function fillForm(form, client) {
    if (!form || !client) return;
    form.firstName.value = client.first_name || "";
    form.lastName.value = client.last_name || "";
    form.gender.value = client.gender || "kobieta";
    form.phone.value = client.phone || "";
    form.email.value = client.email || "";
    form.address.value = client.address || "";
    form.postalCode.value = client.postal_code || "";
    form.city.value = client.city || "";
    form.status.value = client.active === false ? "nieaktywny" : "aktywny";
    form.source.value = client.source || "";
    form.marketingSms.value = boolToTakNie(client.marketing_sms);
    form.marketingEmail.value = boolToTakNie(client.marketing_email);
    form.birthDate.value = client.birth_date || "";
    form.importantInfo.value = client.notes || "";
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function bindActions(ctx, customers, importantNotesByClient = {}) {
    const customerFormCard = document.querySelector("#customerFormCard");
    const customerEditCard = document.querySelector("#customerEditCard");
    const customerDeleteCard = document.querySelector("#customerDeleteCard");
    const editSelectForm = document.querySelector("#customerEditSelectForm");
    const editForm = document.querySelector("#customerEditForm");
    const customersById = Object.fromEntries(customers.map((client) => [client.id, client]));
    let selectedEditClientId = "";

    document.querySelector("#showAddCustomer")?.addEventListener("click", () => showOnly(customerFormCard));
    document.querySelector("#showEditCustomer")?.addEventListener("click", () => showOnly(customerEditCard));
    document.querySelector("#showDeleteCustomer")?.addEventListener("click", () => showOnly(customerDeleteCard));

    document.querySelector("#customersSearch")?.addEventListener("input", () => rerenderTable(customers, importantNotesByClient));

    document.querySelector("#customerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const firstName = String(data.firstName || "").trim();
      const lastName = String(data.lastName || "").trim();
      const phone = String(data.phone || "").trim();

      if (!firstName || !lastName || !phone) {
        setMessage("#customerFormMessage", "Uzupełnij wymagane dane klienta.", false);
        return;
      }

      const payload = buildPayload(ctx, data);
      const { data: insertedClient, error } = await window.cmSupabase.from("clients").insert(payload).select("*").single();
      if (error) {
        setMessage("#customerFormMessage", "Błąd zapisu: " + error.message, false);
        return;
      }

      await window.cmUndo?.record({ module: "clients", actionType: "insert", targetTable: "clients", targetId: insertedClient?.id, afterData: insertedClient || payload, companyId: ctx.companyId });
      setMessage("#customerFormMessage", "Klient zapisany w Supabase.", true);
      form.reset();
      await renderCustomers();
    });

    editSelectForm?.clientId?.addEventListener("change", () => {
      selectedEditClientId = editSelectForm.clientId.value;
      const selected = customersById[selectedEditClientId];
      if (!selected) {
        if (editForm) editForm.hidden = true;
        return;
      }
      fillForm(editForm, selected);
      if (editForm) editForm.hidden = false;
    });

    editForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedEditClientId) {
        setMessage("#customerEditMessage", "Wybierz klienta do edycji.", false);
        return;
      }
      const data = Object.fromEntries(new FormData(editForm).entries());
      const firstName = String(data.firstName || "").trim();
      const lastName = String(data.lastName || "").trim();
      const phone = String(data.phone || "").trim();
      if (!firstName || !lastName || !phone) {
        setMessage("#customerEditMessage", "Uzupełnij wymagane dane klienta.", false);
        return;
      }

      const payload = buildPayload(ctx, data);
      const beforeClient = customersById[selectedEditClientId] || null;
      const { data: updatedClient, error } = await window.cmSupabase
        .from("clients")
        .update(payload)
        .eq("id", selectedEditClientId)
        .eq("company_id", ctx.companyId)
        .select("*")
        .single();

      if (error) {
        setMessage("#customerEditMessage", "Błąd edycji: " + error.message, false);
        return;
      }

      await window.cmUndo?.record({ module: "clients", actionType: "update", targetTable: "clients", targetId: selectedEditClientId, beforeData: beforeClient, afterData: updatedClient || { ...(beforeClient || {}), ...payload }, companyId: ctx.companyId });
      setMessage("#customerEditMessage", "Klient zaktualizowany w Supabase.", true);
      await renderCustomers();
    });

    document.querySelector("#customerDeleteForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = String(event.currentTarget.clientId?.value || "").trim();
      const selected = customersById[clientId];
      if (!clientId || !selected) {
        setMessage("#customerDeleteMessage", "Wybierz klienta do usunięcia.", false);
        return;
      }

      if (!confirm(`Usunąć klienta: ${clientOptionLabel(selected)}?`)) return;

      const { error } = await window.cmSupabase
        .from("clients")
        .update({ active: false, status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", clientId)
        .eq("company_id", ctx.companyId);

      if (error) {
        setMessage("#customerDeleteMessage", "Błąd usuwania: " + error.message, false);
        return;
      }

      await window.cmUndo?.record({ module: "clients", actionType: "delete", targetTable: "clients", targetId: clientId, beforeData: selected, companyId: ctx.companyId });
      setMessage("#customerDeleteMessage", "Klient usunięty z Supabase.", true);
      await renderCustomers();
    });

    document.querySelector("#exportCustomersBtn")?.addEventListener("click", () => {
      if (!guardExportImport(ctx, "export", "#customersMessage")) return;
      const headers = ["Imię", "Nazwisko", "Płeć", "Telefon", "Email", "Adres", "Kod pocztowy", "Miejscowość", "Urodziny", "Ważna informacja", "Marketing SMS", "Marketing Email", "Status"];
      const rows = customers.map((client) => [
        client.first_name || "",
        client.last_name || "",
        client.gender || "",
        client.phone || "",
        client.email || "",
        client.address || "",
        client.postal_code || "",
        client.city || "",
        client.birth_date || "",
        client.notes || "",
        boolToTakNie(client.marketing_sms),
        boolToTakNie(client.marketing_email),
        client.active === false ? "nieaktywny" : "aktywny"
      ]);
      const lines = [headers, ...rows].map((row) => row.map((value) => String(value).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"));
      const blob = new Blob([lines.join("\n")], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "klienci-companymanager-supabase.xls";
      link.click();
      URL.revokeObjectURL(url);
    });

    document.querySelector("#importCustomersBtn")?.addEventListener("click", () => {
      if (!guardExportImport(ctx, "import", "#customersMessage")) return;
      document.querySelector("#importCustomersFile")?.click();
    });

    document.querySelector("#importCustomersFile")?.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        setMessage("#customersMessage", `Wybrano plik do importu: ${file.name}. Import danych z pliku podepniemy po stabilizacji CRUD klientów.`, true);
      }
    });
  }

  window.addEventListener("load", () => {
    if (!isCustomersPage()) return;
    window.setTimeout(renderCustomers, 450);
  });
})();
