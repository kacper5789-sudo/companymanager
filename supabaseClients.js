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

  function clientOptionLabel(client) {
    return [clientName(client), client.phone, client.email].filter(Boolean).join(" — ");
  }

  function getCustomerRows(customers) {
    return customers.map((client) => [
      escapeHtml(clientName(client)),
      escapeHtml(client.gender || ""),
      escapeHtml(client.phone || ""),
      escapeHtml(client.email || ""),
      escapeHtml(plDate(client.updated_at)),
      escapeHtml(plDate(client.last_visit_at)),
      escapeHtml(client.notes || ""),
      `<span class="bm-status ${client.active === false ? "inactive" : "active"}">${client.active === false ? "nieaktywny" : "aktywny"}</span>`
    ]);
  }

  async function fetchCustomers(companyId) {
    return window.cmSupabase
      .from("clients")
      .select("id, company_id, first_name, last_name, full_name, gender, phone, email, birth_date, address, city, postal_code, notes, source, marketing_sms, marketing_email, active, tags, total_visits, total_spent, last_visit_at, created_at, updated_at")
      .eq("company_id", companyId)
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

    renderContent(ctx, customers || []);
    setupClientNativeDatePickers();
  }



  function isoToDisplayDate(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return raw;
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  function displayToIsoDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return raw;
    const pl = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!pl) return null;
    const day = Number(pl[1]);
    const month = Number(pl[2]);
    const year = Number(pl[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  function setupClientNativeDatePickers() {
    // 029I: własny, stabilny kalendarz inline dla Klienci -> Dodaj/Edytuj.
    // Nie używamy showPicker(), bo w tej platformie natywny picker bywa blokowany przez CSS/układ.
    document.removeEventListener('click', handleClientDateClick, true);
    document.addEventListener('click', handleClientDateClick, true);
  }

  function handleClientDateClick(event) {
    const field = event.target.closest?.('.customers-module .cm-client-date-field');
    const picker = event.target.closest?.('.cm-client-date-dropdown');

    if (picker) {
      handleClientDatePickerAction(event, picker);
      return;
    }

    if (field) {
      event.preventDefault();
      const input = field.querySelector('input[name="birthDate"]');
      if (!input) return;
      openClientInlineDatePicker(field, input);
      return;
    }

    closeClientInlineDatePickers();
  }

  function closeClientInlineDatePickers(exceptField) {
    document.querySelectorAll('.customers-module .cm-client-date-field').forEach((field) => {
      if (exceptField && field === exceptField) return;
      field.querySelectorAll('.cm-client-date-dropdown').forEach((el) => el.remove());
      field.classList.remove('is-open');
    });
  }

  function openClientInlineDatePicker(field, input, baseDate) {
    closeClientInlineDatePickers(field);

    const old = field.querySelector('.cm-client-date-dropdown');
    if (old && !baseDate) {
      old.remove();
      field.classList.remove('is-open');
      return;
    }
    if (old) old.remove();

    const selectedIso = displayToIsoDate(input.value) || input.dataset.iso || '';
    const selected = selectedIso ? new Date(`${selectedIso}T12:00:00`) : null;
    const view = baseDate || selected || new Date();
    const year = view.getFullYear();
    const month = view.getMonth();

    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    const weekDays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let daysHtml = weekDays.map((d) => `<span class="cm-client-date-weekday">${d}</span>`).join('');
    for (let i = 0; i < startOffset; i += 1) daysHtml += '<span class="cm-client-date-empty"></span>';
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const active = selectedIso === iso ? ' is-active' : '';
      daysHtml += `<button type="button" class="cm-client-date-day${active}" data-date="${iso}">${day}</button>`;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'cm-client-date-dropdown';
    dropdown.dataset.year = String(year);
    dropdown.dataset.month = String(month);
    dropdown.innerHTML = `
      <div class="cm-client-date-head">
        <button type="button" data-client-date-nav="prev" aria-label="Poprzedni miesiąc">‹</button>
        <strong>${monthNames[month]} ${year}</strong>
        <button type="button" data-client-date-nav="next" aria-label="Następny miesiąc">›</button>
      </div>
      <div class="cm-client-date-grid">${daysHtml}</div>
      <div class="cm-client-date-actions">
        <button type="button" data-client-date-action="today">Dzisiaj</button>
        <button type="button" data-client-date-action="clear">Wyczyść</button>
      </div>
    `;
    field.appendChild(dropdown);
    field.classList.add('is-open');
  }

  function handleClientDatePickerAction(event, picker) {
    const field = picker.closest('.cm-client-date-field');
    const input = field?.querySelector('input[name="birthDate"]');
    if (!field || !input) return;

    const year = Number(picker.dataset.year);
    const month = Number(picker.dataset.month);

    const nav = event.target.closest('[data-client-date-nav]');
    if (nav) {
      event.preventDefault();
      event.stopPropagation();
      const direction = nav.dataset.clientDateNav === 'prev' ? -1 : 1;
      openClientInlineDatePicker(field, input, new Date(year, month + direction, 1));
      return;
    }

    const action = event.target.closest('[data-client-date-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      if (action.dataset.clientDateAction === 'today') {
        const today = new Date();
        const iso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
        input.value = isoToDisplayDate(iso);
        input.dataset.iso = iso;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (action.dataset.clientDateAction === 'clear') {
        input.value = '';
        input.dataset.iso = '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeClientInlineDatePickers();
      return;
    }

    const day = event.target.closest('[data-date]');
    if (day) {
      event.preventDefault();
      event.stopPropagation();
      input.value = isoToDisplayDate(day.dataset.date);
      input.dataset.iso = day.dataset.date;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      closeClientInlineDatePickers();
    }
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
      <label>Zgoda na reklamę — SMS<select name="marketingSms">${yesNoOptions.map((v) => `<option value="${v}" ${boolToTakNie(customer.marketing_sms) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Zgoda na reklamę — Email<select name="marketingEmail">${yesNoOptions.map((v) => `<option value="${v}" ${boolToTakNie(customer.marketing_email) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="cm-client-date-label">Dzień, miesiąc i rok urodzin<span class="cm-client-date-field"><input name="birthDate" type="text" class="cm-client-birthdate-input" value="${escapeHtml(isoToDisplayDate(customer.birth_date || ""))}" data-iso="${escapeHtml(customer.birth_date || "")}" placeholder="dd.mm.rrrr" autocomplete="off" inputmode="none" readonly aria-label="Dzień, miesiąc i rok urodzin"></span></label>
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
      full_name: `${firstName} ${lastName}`.trim(),
      gender: String(data.gender || "").trim(),
      phone,
      email: String(data.email || "").trim() || null,
      address: String(data.address || "").trim() || null,
      postal_code: String(data.postalCode || "").trim() || null,
      city: String(data.city || "").trim() || null,
      source: String(data.source || "").trim() || null,
      birth_date: displayToIsoDate(data.birthDate) || null,
      notes: String(data.importantInfo || "").trim() || null,
      marketing_sms: takNieToBool(data.marketingSms),
      marketing_email: takNieToBool(data.marketingEmail),
      active: String(data.status || "aktywny") !== "nieaktywny",
      updated_at: new Date().toISOString()
    };
  }

  function renderContent(ctx, customers) {
    const area = getPanelArea();
    if (!area) return;

    const allowAdd = canAddClients(ctx);
    const allowEdit = canEditClients(ctx);
    const allowDelete = canDeleteClients(ctx);
    const customerOptions = customers.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(clientOptionLabel(client))}</option>`).join("");

    area.innerHTML = `
      <section class="bm-page-card customers-module">
        <div class="bm-page-head customers-head">
          <h2>Lista klientów</h2>
          <div class="bm-actions-row">
            <button id="exportCustomersBtn" type="button" class="bm-excel-btn">Export</button>
            <button id="importCustomersBtn" type="button" class="bm-excel-btn">Import</button>
            <input id="importCustomersFile" type="file" accept=".xls,.xlsx,.csv" hidden>
            ${allowAdd ? `<button id="showAddCustomer" type="button">Dodaj</button>` : ""}
            ${allowEdit ? `<button id="showEditCustomer" type="button">Edytuj</button>` : ""}
            ${allowDelete ? `<button id="showDeleteCustomer" type="button" class="bm-danger-btn">Usuń</button>` : ""}
          </div>
        </div>

        <div class="bm-table-toolbar">
          <label>Szukaj: <input id="customersSearch" type="search" placeholder="Szukaj klienta"></label>
        </div>

        <div id="customersTableWrap">
          ${table(["Imię Nazwisko", "Płeć", "Telefon", "Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(customers), "Brak klientów w Supabase.")}
          ${pagination(customers.length)}
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

    bindActions(ctx, customers);
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
        client.city,
        client.address,
        client.postal_code,
        client.notes,
        client.active === false ? "nieaktywny" : "aktywny"
      ].join(" ").toLowerCase();
      return text.includes(search);
    });
  }

  function rerenderTable(customers) {
    const filtered = filterCustomers(customers);
    const wrap = document.querySelector("#customersTableWrap");
    if (!wrap) return;
    wrap.innerHTML = `
      ${table(["Imię Nazwisko", "Płeć", "Telefon", "Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(filtered), "Brak klientów w Supabase.")}
      ${pagination(filtered.length)}
    `;
  }

  function showOnly(cardToShow) {
    ["#customerFormCard", "#customerEditCard", "#customerDeleteCard"].forEach((selector) => {
      const card = document.querySelector(selector);
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
    form.birthDate.value = isoToDisplayDate(client.birth_date || "");
    form.birthDate.dataset.iso = client.birth_date || "";
    form.importantInfo.value = client.notes || "";
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function bindActions(ctx, customers) {
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

    document.querySelector("#customersSearch")?.addEventListener("input", () => rerenderTable(customers));

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
      const { error } = await window.cmSupabase.from("clients").insert(payload);
      if (error) {
        setMessage("#customerFormMessage", "Błąd zapisu: " + error.message, false);
        return;
      }

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
      const { error } = await window.cmSupabase
        .from("clients")
        .update(payload)
        .eq("id", selectedEditClientId)
        .eq("company_id", ctx.companyId);

      if (error) {
        setMessage("#customerEditMessage", "Błąd edycji: " + error.message, false);
        return;
      }

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
        .delete()
        .eq("id", clientId)
        .eq("company_id", ctx.companyId);

      if (error) {
        setMessage("#customerDeleteMessage", "Błąd usuwania: " + error.message, false);
        return;
      }

      setMessage("#customerDeleteMessage", "Klient usunięty z Supabase.", true);
      await renderCustomers();
    });

    document.querySelector("#exportCustomersBtn")?.addEventListener("click", () => {
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
