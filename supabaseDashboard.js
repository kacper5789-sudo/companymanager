// CompanyManager — Dashboard powered by Supabase
// 037A: Dashboard Supabase schedule: appointments + clients + services + positions + users.

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

  function customerName(customer) {
    return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.full_name || customer?.name || customer?.email || "-";
  }

  function personName(person) { return person?.full_name || person?.email || person?.name || "-"; }
  function serviceName(service) { return service?.name || "-"; }
  function productName(product) { return product?.name || "-"; }

  function optionList(items, labelFn, empty = "Brak danych") {
    if (!items.length) return `<option value="">${escapeHtml(empty)}</option>`;
    return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(labelFn(item))}</option>`).join("");
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
    if (!canOpenDashboard(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania CompanyManager." };
    try {
      localStorage.setItem("cm_access", JSON.stringify(access));
      localStorage.setItem("cm_effective_company", JSON.stringify(context));
    } catch (_) {}
    return ctx;
  }

  async function fetchDashboardData(ctx) {
    const [appointmentsRes, clientsRes, servicesRes, productsRes, usersRes] = await Promise.all([
      window.cmSupabase
        .from("appointments")
        .select("id, company_id, date, time, start_time, end_time, customer_id, client_id, employee_id, service_id, position_id, product_id, status, deleted, note, price, total, payment_method, cancellation_reason, cancelled_at, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
      window.cmSupabase
        .from("clients")
        .select("id, company_id, first_name, last_name, email, phone, status")
        .eq("company_id", ctx.companyId)
        .order("last_name", { ascending: true }),
      window.cmSupabase
        .from("services")
        .select("id, company_id, name, price_from, price_to, price, duration_hours, duration_minutes, position_id, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("products")
        .select("id, company_id, name, price, sale_price, active")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase.rpc("company_users_for_dropdown", { target_company_id: ctx.companyId })
    ]);
    if (appointmentsRes.error) throw appointmentsRes.error;
    if (clientsRes.error) throw clientsRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (productsRes.error) throw productsRes.error;
    if (usersRes.error) throw usersRes.error;
    return {
      appointments: appointmentsRes.data || [],
      clients: (clientsRes.data || []).filter((item) => item.status !== "usunięty"),
      services: (servicesRes.data || []).filter((item) => item.active !== false),
      products: (productsRes.data || []).filter((item) => item.active !== false),
      users: usersRes.data || []
    };
  }

  function appointmentDate(item) { return item.date || String(item.created_at || "").slice(0, 10); }
  function appointmentStart(item) { return normalizeTime(item.start_time || item.time || "06:00"); }
  function appointmentEnd(item) {
    const direct = normalizeTime(item.end_time);
    if (direct) return direct;
    const start = minutesFromTime(appointmentStart(item));
    if (start == null) return "06:05";
    const end = start + 30;
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }
  function appointmentClientId(item) { return item.customer_id || item.client_id || ""; }
  function appointmentTotal(item) { return Number(item.total ?? item.price ?? 0) || 0; }

  function appointmentLabel(item, lookups) {
    const client = lookups.clientsById[appointmentClientId(item)];
    const employee = lookups.usersById[item.employee_id];
    const service = lookups.servicesById[item.service_id];
    return [plDate(appointmentDate(item)), appointmentStart(item), appointmentEnd(item), customerName(client), personName(employee), serviceName(service)].filter(Boolean).join(" — ");
  }

  function buildLookups(data) {
    return {
      clientsById: Object.fromEntries(data.clients.map((item) => [item.id, item])),
      servicesById: Object.fromEntries(data.services.map((item) => [item.id, item])),
      productsById: Object.fromEntries(data.products.map((item) => [item.id, item])),
      usersById: Object.fromEntries(data.users.map((item) => [item.id, item]))
    };
  }

  function scheduleRows(data, lookups, dateIso) {
    const active = data.appointments.filter((item) => appointmentDate(item) === dateIso && item.deleted !== true && !["odwołana", "odwołane", "usunięte"].includes(String(item.status || "").toLowerCase()));
    const rows = [];
    for (let hour = 6; hour <= 20; hour += 1) {
      rows.push(`${String(hour).padStart(2, "0")}:00`);
      if (hour < 20) rows.push(`${String(hour).padStart(2, "0")}:30`);
    }
    return rows.map((time) => {
      const cells = data.users.map((employee) => {
        const slotMin = minutesFromTime(time);
        const visit = active.find((item) => {
          if (item.employee_id !== employee.id) return false;
          const start = minutesFromTime(appointmentStart(item));
          const end = minutesFromTime(appointmentEnd(item));
          return slotMin != null && start != null && end != null && slotMin >= start && slotMin < end;
        });
        if (!visit) return `<td class="bm-schedule-slot free" data-employee-id="${escapeHtml(employee.id)}" data-time="${escapeHtml(time)}" data-date="${escapeHtml(dateIso)}"><span>FREE</span></td>`;
        const client = lookups.clientsById[appointmentClientId(visit)];
        const service = lookups.servicesById[visit.service_id];
        const product = lookups.productsById[visit.product_id];
        const isStart = appointmentStart(visit) === time;
        const label = isStart
          ? `${escapeHtml(appointmentStart(visit))} - ${escapeHtml(appointmentEnd(visit))}<br>${escapeHtml(customerName(client))}: ${escapeHtml(serviceName(service) !== "-" ? serviceName(service) : productName(product))}`
          : `<span class="bm-continuation">ZAJĘTE do ${escapeHtml(appointmentEnd(visit))}</span>`;
        const tooltip = [
          `Klient: ${customerName(client)}`,
          `Telefon: ${client?.phone || "Brak numeru"}`,
          `Cena: ${appointmentTotal(visit).toFixed(2)} PLN`,
          `Pracownik: ${personName(employee)}`,
          `Opis: ${visit.note || "Brak opisu"}`
        ].join("\n");
        return `<td class="bm-schedule-slot busy" data-visit-id="${escapeHtml(visit.id)}" data-employee-id="${escapeHtml(employee.id)}" data-time="${escapeHtml(time)}" data-date="${escapeHtml(dateIso)}" data-slot-tooltip="${escapeHtml(tooltip)}"><span>${label}</span></td>`;
      }).join("");
      return `<tr><th class="bm-time-col">${escapeHtml(time)}</th>${cells}</tr>`;
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

  function payloadFromForm(ctx, formData) {
    const serviceId = String(formData.get("serviceId") || "").trim();
    const productId = String(formData.get("productId") || "").trim();
    const start = normalizeTime(formData.get("start"));
    const end = normalizeTime(formData.get("end"));
    const clientId = String(formData.get("customerId") || "").trim();
    return {
      company_id: ctx.companyId,
      date: String(formData.get("date") || "").trim(),
      time: start || null,
      start_time: start || null,
      end_time: end || null,
      customer_id: clientId || null,
      client_id: clientId || null,
      employee_id: String(formData.get("employeeId") || "").trim() || null,
      service_id: serviceId || null,
      product_id: productId || null,
      status: String(formData.get("status") || "zaplanowane").trim(),
      deleted: false,
      note: String(formData.get("note") || "").trim() || null,
      price: Number(String(formData.get("total") || "0").replace(",", ".")) || 0,
      total: Number(String(formData.get("total") || "0").replace(",", ".")) || 0,
      payment_method: String(formData.get("payment") || "gotówka").trim(),
      updated_at: new Date().toISOString()
    };
  }

  function validatePayload(payload) {
    if (!payload.date || !payload.start_time || !payload.end_time || !payload.customer_id || !payload.employee_id) return "Uzupełnij datę, godzinę, klienta i pracownika.";
    if (!payload.service_id && !payload.product_id) return "Wybierz usługę albo produkt.";
    return "";
  }

  function fillEditForm(form, item) {
    if (!form || !item) return;
    form.elements.date.value = appointmentDate(item) || iso(new Date());
    form.elements.start.value = appointmentStart(item) || "06:00";
    form.elements.end.value = appointmentEnd(item) || "06:30";
    form.elements.customerId.value = appointmentClientId(item) || "";
    form.elements.employeeId.value = item.employee_id || "";
    form.elements.serviceId.value = item.service_id || "";
    form.elements.productId.value = item.product_id || "";
    form.elements.total.value = appointmentTotal(item).toFixed(2);
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
    const allowCancel = canCancelAppointments(ctx);
    const customerOptions = optionList(data.clients, customerName, "Brak klientów");
    const employeeOptions = optionList(data.users, personName, "Brak pracowników/użytkowników");
    const serviceOptions = optionList(data.services, (s) => `${s.name || "Usługa"}${s.price_from ? ` — ${s.price_from} PLN` : ""}`, "Brak usług");
    const productOptions = optionList(data.products, productName, "Brak produktów");
    const visibleVisits = data.appointments.filter((item) => item.deleted !== true && !["odwołana", "odwołane", "usunięte"].includes(String(item.status || "").toLowerCase()));
    const visitOptions = visibleVisits.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(appointmentLabel(item, lookups))}</option>`).join("");
    const appointmentRows = visibleVisits.slice(0, 20).map((item) => {
      const client = lookups.clientsById[appointmentClientId(item)];
      const employee = lookups.usersById[item.employee_id];
      const service = lookups.servicesById[item.service_id];
      return [escapeHtml(plDate(appointmentDate(item))), escapeHtml(`${appointmentStart(item)} - ${appointmentEnd(item)}`), escapeHtml(customerName(client)), escapeHtml(personName(employee)), escapeHtml(serviceName(service)), escapeHtml(item.status || "zaplanowane")];
    });

    const employeeCount = Math.max(data.users.length, 1);
    const scheduleWidth = `${82 + (employeeCount * 180)}px`;
    const scheduleHead = `<thead><tr><th class="bm-time-head">Godzina</th>${data.users.map((employee) => `<th>${escapeHtml(personName(employee))}</th>`).join("")}</tr></thead>`;
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
            <button type="button" id="dashCancelVisitBtn" class="bm-danger-btn" ${allowCancel ? "" : "disabled"}>Odwołaj wizytę</button>
            <button type="button" id="dashEmployeeCount" class="bm-worker-count">(${data.users.length})</button>
          </span>
        </section>
        <div class="bm-schedule-table-wrap"><table class="bm-schedule-table" style="width:${scheduleWidth};min-width:${scheduleWidth};">${scheduleColgroup}${scheduleHead}<tbody>${scheduleRows(data, lookups, selectedDate)}</tbody></table></div>
        <div class="bm-schedule-tooltip" id="dashSlotTooltip" hidden></div>
      </section>

      <section class="bm-page-card bm-appointment-form" id="dashboardAppointmentForm" hidden>
        <div class="bm-page-head"><h2>Dodaj wpis do grafiku</h2></div>
        <form id="dashboardAppointmentAddForm" class="bm-form-grid">
          <label>Data<input type="date" name="date" value="${escapeHtml(selectedDate)}" required></label>
          <label>Od<select name="start">${timeOptions("10:00")}</select></label>
          <label>Do<select name="end">${timeOptions("10:30")}</select></label>
          <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
          <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
          <label>Usługi<select name="serviceId"><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
          <label>Zakup produktów<select name="productId"><option value="">Wybierz produkt</option>${productOptions}</select></label>
          <label>Razem do zapłaty<input name="total" value="0.00"></label>
          <label>Płatność<select name="payment"><option>gotówka</option><option>karta kredytowa</option><option>karnet</option><option>pakiet</option><option>gratis</option></select></label>
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
          <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
          <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
          <label>Usługi<select name="serviceId"><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
          <label>Zakup produktów<select name="productId"><option value="">Wybierz produkt</option>${productOptions}</select></label>
          <label>Razem do zapłaty<input name="total" value="0.00"></label>
          <label>Płatność<select name="payment"><option>gotówka</option><option>karta kredytowa</option><option>karnet</option><option>pakiet</option><option>gratis</option></select></label>
          <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="dashboardEditVisitMessage" class="panel-message"></p>
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
    const cancelPanel = document.querySelector("#dashboardCancelVisitPanel");
    const panels = [addPanel, editPanel, cancelPanel];

    document.querySelector("#dashPrevDay")?.addEventListener("click", () => { window.location.href = `dashboard.html?date=${encodeURIComponent(addDays(selectedDate, -1))}`; });
    document.querySelector("#dashNextDay")?.addEventListener("click", () => { window.location.href = `dashboard.html?date=${encodeURIComponent(addDays(selectedDate, 1))}`; });
    document.querySelector("#dashAddVisitBtn")?.addEventListener("click", () => showOnly(addPanel, panels));
    document.querySelector("#dashEditVisitBtn")?.addEventListener("click", () => showOnly(editPanel, panels));
    document.querySelector("#dashCancelVisitBtn")?.addEventListener("click", () => showOnly(cancelPanel, panels));

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
        const endMin = startMin == null ? minutesFromTime("10:30") : startMin + 30;
        const endValue = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
        form.elements.end.value = endValue;
      }
      if (form.elements.employeeId) form.elements.employeeId.value = employeeId;
      const firstInput = form.querySelector('select[name="customerId"], input, select, textarea');
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
        if (slot.classList.contains("busy") && slot.dataset.visitId) openEditFromSlot(slot);
        else openAddFromSlot(slot);
      });
    });

    document.querySelector("#dashboardAppointmentAddForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowAdd) { setMessage("#dashboardAppointmentMessage", "Brak uprawnienia do dodawania wizyt.", false); return; }
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget));
      const validation = validatePayload(payload);
      if (validation) { setMessage("#dashboardAppointmentMessage", validation, false); return; }
      const { data: inserted, error } = await window.cmSupabase.from("appointments").insert(payload).select("*").single();
      if (error) { setMessage("#dashboardAppointmentMessage", `Błąd zapisu: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "insert", targetTable: "appointments", targetId: inserted?.id, afterData: inserted || payload, companyId: ctx.companyId });
      setMessage("#dashboardAppointmentMessage", "Wizyta zapisana w Supabase.", true);
      setTimeout(renderDashboard, 500);
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
      const payload = payloadFromForm(ctx, new FormData(event.currentTarget));
      const validation = validatePayload(payload);
      if (validation) { setMessage("#dashboardEditVisitMessage", validation, false); return; }
      const before = data.appointments.find((item) => item.id === visitId);
      const { data: updated, error } = await window.cmSupabase.from("appointments").update(payload).eq("id", visitId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#dashboardEditVisitMessage", `Błąd edycji: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: before, afterData: updated || payload, companyId: ctx.companyId });
      setMessage("#dashboardEditVisitMessage", "Wizyta zaktualizowana.", true);
      setTimeout(renderDashboard, 500);
    });

    document.querySelector("#dashboardCancelVisitForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!allowCancel) { setMessage("#dashboardCancelVisitMessage", "Brak uprawnienia do odwołania wizyt.", false); return; }
      const formData = new FormData(event.currentTarget);
      const visitId = String(formData.get("visitId") || "").trim();
      const reason = String(formData.get("reason") || "").trim();
      if (!visitId || !reason) { setMessage("#dashboardCancelVisitMessage", "Wybierz wizytę i wpisz powód.", false); return; }
      const before = data.appointments.find((item) => item.id === visitId);
      const patch = { status: "odwołana", deleted: false, cancellation_reason: reason, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { data: updated, error } = await window.cmSupabase.from("appointments").update(patch).eq("id", visitId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#dashboardCancelVisitMessage", `Błąd odwołania: ${error.message}`, false); return; }
      await window.cmUndo?.record({ module: "dashboard", actionType: "update", targetTable: "appointments", targetId: visitId, beforeData: before, afterData: updated || patch, companyId: ctx.companyId });
      setMessage("#dashboardCancelVisitMessage", "Wizyta odwołana.", true);
      setTimeout(renderDashboard, 500);
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
