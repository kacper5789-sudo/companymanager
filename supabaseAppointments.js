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
      "wizyty (zakończone, zaplanowane, usunięte) - dostęp do historii (tabeli poniżej)"
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

  function personName(person) {
    return person?.full_name || person?.email || person?.name || "-";
  }

  async function fetchAll(ctx) {
    const [appointmentsRes, clientsRes, servicesRes, positionsRes, usersRes] = await Promise.all([
      window.cmSupabase
        .from("appointments")
        .select("id, company_id, date, time, start_time, end_time, customer_id, client_id, employee_id, service_id, position_id, status, deleted, note, price, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("date", { ascending: false })
        .order("time", { ascending: true }),
      window.cmSupabase
        .from("clients")
        .select("id, company_id, first_name, last_name, email, phone, status")
        .eq("company_id", ctx.companyId)
        .order("last_name", { ascending: true }),
      window.cmSupabase
        .from("services")
        .select("id, company_id, name, position_id, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("positions")
        .select("id, company_id, name, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId })
    ]);

    if (appointmentsRes.error) throw appointmentsRes.error;
    if (clientsRes.error) throw clientsRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (positionsRes.error) throw positionsRes.error;
    if (usersRes.error) throw usersRes.error;

    return {
      appointments: appointmentsRes.data || [],
      clients: (clientsRes.data || []).filter((item) => item.status !== "usunięty"),
      services: (servicesRes.data || []).filter((item) => item.active !== false),
      positions: (positionsRes.data || []).filter((item) => item.active !== false),
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
    ["#visitFormCard", "#visitEditCard", "#visitDeleteCard"].forEach((selector) => {
      const card = document.querySelector(selector);
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

  function payloadFromForm(ctx, formData) {
    const date = String(formData.get("date") || "").trim();
    const time = String(formData.get("time") || "").trim();
    const clientId = String(formData.get("customerId") || "").trim();
    const serviceId = String(formData.get("serviceId") || "").trim();
    const employeeId = String(formData.get("employeeId") || "").trim();
    const positionId = String(formData.get("positionId") || "").trim();
    const status = String(formData.get("status") || "niezakończone").trim();
    return {
      company_id: ctx.companyId,
      date,
      time,
      start_time: time || null,
      customer_id: clientId || null,
      client_id: clientId || null,
      employee_id: employeeId || null,
      service_id: serviceId || null,
      position_id: positionId || null,
      status,
      deleted: status === "usunięte",
      updated_at: new Date().toISOString()
    };
  }

  function validatePayload(payload) {
    if (!payload.date || !payload.time || !payload.customer_id || !payload.employee_id || !payload.service_id) return "Uzupełnij datę, godzinę, klienta, pracownika i usługę.";
    return "";
  }

  function fillEditForm(form, item) {
    if (!form || !item) return;
    form.elements.date.value = appointmentDate(item) || "";
    form.elements.time.value = appointmentTime(item) || "";
    form.elements.customerId.value = appointmentClientId(item) || "";
    form.elements.employeeId.value = item.employee_id || "";
    form.elements.serviceId.value = item.service_id || "";
    form.elements.positionId.value = item.position_id || "";
    form.elements.status.value = item.status || "niezakończone";
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
    const statuses = ["niezakończone", "zakończone", "zaplanowane", "usunięte"];

    const lookups = {
      clientsById: Object.fromEntries(data.clients.map((item) => [item.id, item])),
      servicesById: Object.fromEntries(data.services.map((item) => [item.id, item])),
      positionsById: Object.fromEntries(data.positions.map((item) => [item.id, item])),
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
    const customerOptions = options(data.clients, customerName, "Brak klientów");
    const employeeOptions = options(data.users, personName, "Brak pracowników/użytkowników");
    const serviceOptions = options(data.services, (s) => s.name || "Usługa", "Brak usług");
    const positionOptions = options(data.positions, (p) => p.name || "Stanowisko", "Brak stanowisk");
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
          <label>Data<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
          <label>Godzina<input name="time" type="time" value="10:00" required></label>
          <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
          <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
          <label>Usługa<select name="serviceId" required><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
          <label>Stanowisko pracy<select name="positionId"><option value="">Wybierz stanowisko</option>${positionOptions}</select></label>
          <label>Status<select name="status">${statuses.filter((s) => s !== "usunięte").map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}</select></label>
          <button type="submit">Zapisz wizytę</button>
        </form>
        <p id="visitMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="visitEditCard" hidden>
        <h2>Edytuj wizytę</h2>
        <form id="visitEditSelectForm" class="bm-form-grid"><label>Wybierz wizytę<select name="visitId" id="editVisitSelect" required><option value="">Wybierz wizytę</option>${visitOptions}</select></label></form>
        <form id="visitEditForm" class="bm-form-grid" hidden>
          <label>Data<input name="date" type="date" required></label>
          <label>Godzina<input name="time" type="time" required></label>
          <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
          <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
          <label>Usługa<select name="serviceId" required><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
          <label>Stanowisko pracy<select name="positionId"><option value="">Wybierz stanowisko</option>${positionOptions}</select></label>
          <label>Status<select name="status">${statuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}</select></label>
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
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget));
      const validation = validatePayload(payload);
      if (validation) { setMessage("#visitMessage", validation, false); return; }
      const { data: insertedAppointment, error } = await window.cmSupabase.from("appointments").insert(payload).select("*").single();
      if (error) { setMessage("#visitMessage", "Błąd zapisu wizyty: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "appointments", actionType: "insert", targetTable: "appointments", targetId: insertedAppointment?.id, afterData: insertedAppointment || payload, companyId: ctx.companyId });
      setMessage("#visitMessage", "Wizyta zapisana w Supabase.", true);
      setTimeout(renderAppointments, 450);
    });

    document.querySelector("#editVisitSelect")?.addEventListener("change", (event) => {
      const selected = data.appointments.find((item) => item.id === event.currentTarget.value);
      const form = document.querySelector("#visitEditForm");
      if (!form || !selected) { if (form) form.hidden = true; return; }
      fillEditForm(form, selected);
      form.hidden = false;
      setupVisitNativeDatePickers();
    });

    document.querySelector("#visitEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowEdit) { setMessage("#visitEditMessage", "Brak uprawnienia do edycji wizyt.", false); return; }
      const visitId = document.querySelector("#editVisitSelect")?.value;
      if (!visitId) { setMessage("#visitEditMessage", "Wybierz wizytę do edycji.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget));
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
