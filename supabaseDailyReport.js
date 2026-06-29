// CompanyManager — 046D Raport dzienny table totals and pagination
// daily-report.html: realne dane z sales / sale_items / payments / appointments / clients.
(function () {
  if (document.body?.dataset?.panelPage !== "dailyReport") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const int = (value) => String(Number(value || 0));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dayNames = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const paymentLabels = ["gotówka", "karta", "przelew", "karnet", "pakiet", "gratis"];
  const CANCELLATION_REASONS = ["Klient odwołał", "Klient nie przyszedł", "Klient przełożył wizytę", "Pomyłka", "Inne"];
  function cancellationReason(row) {
    const raw = String(row?.cancellation_reason || row?.cancel_reason || row?.cancelReason || row?.cancellationReason || row?.cancelReasonLabel || "").trim();
    if (CANCELLATION_REASONS.includes(raw)) return raw;
    return raw ? "Inne" : "Brak powodu";
  }
  function cancellationBreakdownRows(appointments) {
    const map = new Map([...CANCELLATION_REASONS, "Brak powodu"].map((reason) => [reason, 0]));
    (appointments || []).forEach((row) => {
      const reason = cancellationReason(row);
      map.set(reason, (map.get(reason) || 0) + 1);
    });
    return Array.from(map.entries()).filter(([, count]) => count > 0).map(([reason, count]) => ({ reason, count }));
  }

  function parseLocalDate(value) {
    const raw = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dateRange(day) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), dayIso: isoDate(start) };
  }

  function displayDate(day) {
    return `${dayNames[day.getDay()]}, ${pad(day.getDate())}.${pad(day.getMonth() + 1)}.${day.getFullYear()}`;
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

  function hasExplicitPermission(ctx, key) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1";
  }

  function canViewToday(ctx) {
    return hasExplicitPermission(ctx, "daily_report_today") || hasExplicitPermission(ctx, "daily_report_other_days");
  }

  function canViewOtherDays(ctx) {
    return hasExplicitPermission(ctx, "daily_report_other_days");
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
    if (!context || context.allowed !== true || !context.company_id) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!hasAnyPermission(ctx, ["open_daily_report", "daily_report_today", "daily_report_other_days"])) {
      return { ok: false, message: "Brak uprawnienia do raportu dziennego." };
    }
    if (!canViewToday(ctx) && !canViewOtherDays(ctx)) {
      return { ok: false, message: "Brak uprawnienia do przeglądania raportu dziennego." };
    }
    return ctx;
  }

  function panelArea() {
    return $(".bm-panel-area") || $("#dashboardRoot") || document.body;
  }

  function renderError(message) {
    panelArea().innerHTML = `<section class="bm-page-card cm-daily-report-card"><div class="bm-page-head"><h2>Raport dzienny</h2></div><p class="panel-message error">Błąd raportu dziennego: ${esc(message)}</p></section>`;
  }

  function table(headers, rows, cls = "", footer = null) {
    const tableId = `dailyTable_${Math.random().toString(36).slice(2, 9)}`;
    const bodyRows = rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")
      : `<tr data-empty-row="1"><td colspan="${headers.length}">Brak danych</td></tr>`;
    const footerHtml = footer && footer.length
      ? `<tfoot><tr>${footer.map(cell => `<td>${cell}</td>`).join("")}</tr></tfoot>`
      : "";
    return `
      <div class="cm-daily-table-shell ${esc(cls)}" data-daily-table="1">
        <div class="bm-table-tools cm-daily-table-tools">
          <label><select data-page-size aria-label="Liczba pozycji na stronę"><option value="50">50</option><option value="100">100</option><option value="200">200</option></select> ▾</label>
          <label>Szukaj:<input type="search" data-table-search placeholder="Szukaj"></label>
        </div>
        <div class="bm-table-wrap cm-daily-table-wrap">
          <table class="bm-table cm-daily-table" id="${tableId}">
            <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
            <tbody>${bodyRows}</tbody>
            ${footerHtml}
          </table>
        </div>
        <div class="cm-sales-pager cm-daily-table-pager">
          <span data-table-info>Pozycje od 0 do 0 z 0 łącznie</span>
          <button type="button" data-page-prev aria-label="Poprzednia strona">‹</button>
          <b data-table-page>1 z 1</b>
          <button type="button" data-page-next aria-label="Następna strona">›</button>
        </div>
      </div>`;
  }

  function setupDailyDataTables(root = document) {
    $$("[data-daily-table]", root).forEach((box) => {
      if (box.dataset.ready === "1") return;
      box.dataset.ready = "1";
      const rows = $$('tbody tr:not([data-empty-row])', box);
      const search = $('[data-table-search]', box);
      const pageSize = $('[data-page-size]', box);
      const info = $('[data-table-info]', box);
      const pageLabel = $('[data-table-page]', box);
      const prev = $('[data-page-prev]', box);
      const next = $('[data-page-next]', box);
      let page = 1;

      function filteredRows() {
        const q = String(search?.value || '').trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(row => row.textContent.toLowerCase().includes(q));
      }

      function renderTable() {
        const filtered = filteredRows();
        const size = Math.max(1, Number(pageSize?.value || 50));
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / size));
        page = Math.min(Math.max(1, page), pages);
        const start = total ? (page - 1) * size : 0;
        const end = Math.min(start + size, total);

        rows.forEach(row => { row.style.display = 'none'; });
        filtered.slice(start, end).forEach(row => { row.style.display = ''; });

        if (info) info.textContent = total ? `Pozycje od ${start + 1} do ${end} z ${total} łącznie` : 'Pozycje od 0 do 0 z 0 łącznie';
        if (pageLabel) pageLabel.textContent = `${page} z ${pages}`;
        if (prev) prev.disabled = page <= 1;
        if (next) next.disabled = page >= pages;
      }

      search?.addEventListener('input', () => { page = 1; renderTable(); });
      pageSize?.addEventListener('change', () => { page = 1; renderTable(); });
      prev?.addEventListener('click', () => { page -= 1; renderTable(); });
      next?.addEventListener('click', () => { page += 1; renderTable(); });
      renderTable();
    });
  }

  function groupBy(items, keyFn, initFn, updateFn) {
    const map = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, initFn(item, key));
      updateFn(map.get(key), item);
    });
    return Array.from(map.values());
  }

  function saleValue(sale) {
    return Number(sale.total_gross ?? sale.total_net ?? sale.paid_amount ?? 0) || 0;
  }

  function itemValue(item, saleMap) {
    const sale = saleMap.get(item.sale_id) || {};
    return Number(item.total ?? item.total_price ?? item.unit_price ?? saleValue(sale) ?? 0) || 0;
  }

  async function fetchDailyData(ctx, day) {
    const range = dateRange(day);
    const sb = window.cmSupabase;

    const [salesRes, paymentsRes, appointmentsRes, employeesRes, clientsRes, passesRes, notificationLogsRes, emailRecipientsRes] = await Promise.all([
      sb.from("sales").select("id,company_id,client_id,employee_id,employee_name,appointment_id,total_gross,total_net,payment_status,payment_method,status,created_at,updated_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("payments").select("id,company_id,sale_id,appointment_id,amount,method,status,paid_at,created_at").eq("company_id", ctx.companyId).gte("paid_at", range.startIso).lt("paid_at", range.endIso),
      sb.from("appointments").select("id,company_id,client_id,client_name,employee_id,employee_name,service_id,service_name,product_id,product_name,total,price,paid_amount,payment_status,payment_method,status,date,starts_at,appointment_datetime,created_at,cancellation_reason,cancel_reason,cancelled_at").eq("company_id", ctx.companyId).eq("date", range.dayIso),
      sb.from("profiles").select("id,full_name,email,role,company_id").eq("company_id", ctx.companyId),
      sb.from("clients").select("id,first_name,last_name,created_at,company_id").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("passes").select("id,company_id,sale_id,employee_id,employee_name,buyer_client_id,beneficiary_client_id,customer_id,name,number,value,payment_method,sale_date,sale_time,created_at,active,status").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("notification_logs").select("id,company_id,channel,type,status,provider_message_id,sent_at,created_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("marketing_campaign_recipients").select("id,channel,status,sent_at,created_at").eq("channel", "email").eq("status", "sent").gte("sent_at", range.startIso).lt("sent_at", range.endIso)
    ]);

    const errors = [salesRes.error, paymentsRes.error, appointmentsRes.error, employeesRes.error, clientsRes.error, passesRes.error, notificationLogsRes.error, emailRecipientsRes.error].filter(Boolean);
    if (errors.length) throw new Error(errors.map(e => e.message).join(" | "));

    const inactiveSaleStatuses = ["void", "deleted", "usunięte", "usuniete", "cancelled", "canceled", "anulowane", "anulowana"];
    const sales = (salesRes.data || []).filter(s => {
      const ps = String(s.payment_status || "").toLowerCase();
      const st = String(s.status || "").toLowerCase();
      return !inactiveSaleStatuses.includes(ps) && !inactiveSaleStatuses.includes(st);
    });
    const saleIds = sales.map(s => s.id).filter(Boolean);
    let saleItems = [];
    if (saleIds.length) {
      const itemsRes = await sb.from("sale_items").select("id,company_id,sale_id,item_type,service_id,product_id,pass_id,name,name_snapshot,quantity,unit_price,total,total_price,created_at").in("sale_id", saleIds);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      saleItems = itemsRes.data || [];
    }

    const activeSaleIds = new Set(sales.map(s => s.id).filter(Boolean));
    const payments = (paymentsRes.data || []).filter(p => {
      if (String(p.status || "").toLowerCase() === "void") return false;
      if (p.sale_id && !activeSaleIds.has(p.sale_id)) return false;
      return true;
    });

    // v63: Raport dzienny musi umieć rozpoznać pracownika także wtedy,
    // gdy sprzedaż została zapisana dziś, ale powiązana wizyta ma inną datę
    // albo appointment_id siedzi w payments, a nie bezpośrednio w sales.
    let appointments = appointmentsRes.data || [];
    const appointmentIds = new Set();
    sales.forEach(s => { if (s.appointment_id) appointmentIds.add(s.appointment_id); });
    payments.forEach(p => { if (p.appointment_id) appointmentIds.add(p.appointment_id); });
    const loadedAppointmentIds = new Set(appointments.map(a => a.id).filter(Boolean));
    const missingAppointmentIds = [...appointmentIds].filter(id => id && !loadedAppointmentIds.has(id));
    if (missingAppointmentIds.length) {
      const linkedAppointmentsRes = await sb.from("appointments")
        .select("id,company_id,client_id,client_name,employee_id,employee_name,service_id,service_name,product_id,product_name,total,price,paid_amount,payment_status,payment_method,status,date,starts_at,appointment_datetime,created_at,cancellation_reason,cancel_reason,cancelled_at")
        .eq("company_id", ctx.companyId)
        .in("id", missingAppointmentIds);
      if (linkedAppointmentsRes.error) throw new Error(linkedAppointmentsRes.error.message);
      appointments = appointments.concat(linkedAppointmentsRes.data || []);
    }

    return {
      dayIso: range.dayIso,
      sales,
      payments,
      appointments,
      employees: employeesRes.data || [],
      clients: clientsRes.data || [],
      saleItems,
      passes: passesRes.data || [],
      notificationLogs: notificationLogsRes.data || [],
      emailRecipients: emailRecipientsRes.data || []
    };
  }

  function buildReport(data) {
    const sales = data.sales || [];
    const payments = data.payments || [];
    const appointments = data.appointments || [];
    const employees = data.employees || [];
    let saleItems = data.saleItems || [];
    const passes = (data.passes || []).filter((pass) => pass.active !== false && !["void", "deleted", "usunięte", "usuniete", "cancelled", "canceled", "anulowane", "anulowana"].includes(String(pass.status || "").toLowerCase()));
    const clients = data.clients || [];
    const notificationLogs = data.notificationLogs || [];
    const emailRecipients = data.emailRecipients || [];
    const saleMap = new Map(sales.map(s => [s.id, s]));
    const paymentBySaleId = new Map();
    payments.forEach(p => { if (p.sale_id && !paymentBySaleId.has(p.sale_id)) paymentBySaleId.set(p.sale_id, p); });
    const appointmentById = new Map(appointments.map(a => [a.id, a]));
    const appointmentForSale = (sale) => {
      const payment = sale?.id ? paymentBySaleId.get(sale.id) : null;
      const appointmentId = sale?.appointment_id || payment?.appointment_id || "";
      return appointmentId ? (appointmentById.get(appointmentId) || {}) : {};
    };
    const passBySaleId = new Map();
    passes.forEach((pass) => { if (pass.sale_id && !passBySaleId.has(pass.sale_id)) passBySaleId.set(pass.sale_id, pass); });
    const passIdsInItems = new Set(saleItems.filter(i => ["pass", "karnet"].includes(String(i.item_type || "").toLowerCase())).map(i => String(i.pass_id || "")).filter(Boolean));
    passes.forEach((pass) => {
      if (pass.id && passIdsInItems.has(String(pass.id))) return;
      const sale = pass.sale_id ? saleMap.get(pass.sale_id) : null;
      saleItems.push({
        id: `pass-fallback-${pass.id}`,
        company_id: pass.company_id,
        sale_id: pass.sale_id || `pass-sale-${pass.id}`,
        item_type: "pass",
        pass_id: pass.id,
        name: pass.name || pass.number || "Karnet",
        name_snapshot: pass.name || pass.number || "Karnet",
        quantity: 1,
        unit_price: Number(pass.value || sale?.total_gross || 0),
        total: Number(pass.value || sale?.total_gross || 0),
        total_price: Number(pass.value || sale?.total_gross || 0),
        created_at: pass.created_at
      });
      if (!sale && pass.sale_id) {
        saleMap.set(pass.sale_id, { id: pass.sale_id, employee_id: pass.employee_id, employee_name: pass.employee_name, total_gross: Number(pass.value || 0), payment_method: pass.payment_method || "gotówka", created_at: pass.created_at });
      }
    });
    const employeeMap = new Map(employees.map(e => [e.id, e]));
    const employeeNameKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    const employeeByName = new Map();
    employees.forEach(e => {
      const name = e.full_name || e.fullName || e.name || e.email || "";
      const key = employeeNameKey(name);
      if (key && !employeeByName.has(key)) employeeByName.set(key, e);
    });
    const resolveEmployee = (id, ...fallbacks) => {
      if (id && employeeMap.has(id)) {
        const e = employeeMap.get(id);
        return { key: `id:${e.id}`, name: e.full_name || e.fullName || e.name || e.email || "Pracownik" };
      }
      for (const fallback of fallbacks) {
        const name = String(fallback || "").trim();
        const nk = employeeNameKey(name);
        if (!nk || nk === "(brak)") continue;
        const e = employeeByName.get(nk);
        if (e) return { key: `id:${e.id}`, name: e.full_name || e.fullName || e.name || e.email || name };
        return { key: `name:${nk}`, name };
      }
      return { key: "missing", name: "(brak)" };
    };

    const statusOf = (item) => String(item.status || "").toLowerCase();
    const isCancelled = (a) => ["odwołane", "odwolane", "usunięte", "usuniete"].includes(statusOf(a)) || a.is_cancelled === true;
    const isFinished = (a) => ["zakończone", "zakonczone", "completed"].includes(statusOf(a)) || a.finished === true;
    const isPlanned = (a) => !isCancelled(a) && !isFinished(a);

    const serviceItems = saleItems.filter(i => String(i.item_type || "").toLowerCase() === "service");
    const productItems = saleItems.filter(i => String(i.item_type || "").toLowerCase() === "product");
    const passItems = saleItems.filter(i => ["pass", "karnet"].includes(String(i.item_type || "").toLowerCase()));

    const revenue = sales.reduce((sum, sale) => sum + saleValue(sale), 0);
    const paidSaleIds = new Set(payments.map(p => p.sale_id).filter(Boolean));
    const syntheticSalePayments = sales
      .filter((sale) => sale.id && !paidSaleIds.has(sale.id) && saleValue(sale) > 0)
      .map((sale) => ({
        id: `sale-payment-${sale.id}`,
        sale_id: sale.id,
        amount: saleValue(sale),
        method: sale.payment_method || "gotówka",
        status: sale.payment_status || "paid",
        paid_at: sale.created_at,
        created_at: sale.created_at
      }));
    const reportPayments = payments.concat(syntheticSalePayments);
    const paymentSum = reportPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cash = reportPayments.filter(p => String(p.method || "").toLowerCase().includes("gotówka")).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const paymentsByMethod = groupBy(reportPayments, p => String(p.method || "gotówka").trim() || "gotówka", (_, key) => ({ method: key, count: 0, value: 0 }), (row, p) => { row.count += 1; row.value += Number(p.amount || 0); });

    const serviceRows = groupBy(serviceItems, i => i.name_snapshot || i.name || "Usługa", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });
    const productRows = groupBy(productItems, i => i.name_snapshot || i.name || "Produkt", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });
    const passRows = groupBy(passItems, i => i.name_snapshot || i.name || "Karnet", (_, key) => ({ name: key, count: 0, value: 0 }), (row, i) => { row.count += Number(i.quantity || 1); row.value += itemValue(i, saleMap); });

    const employeeRowsMap = new Map();
    function ensureEmployee(id, ...fallbacks) {
      const resolved = resolveEmployee(id, ...fallbacks);
      if (!employeeRowsMap.has(resolved.key)) {
        employeeRowsMap.set(resolved.key, {
          id: resolved.key,
          name: resolved.name,
          visits: 0,
          serviceCount: 0,
          serviceValue: 0,
          productCount: 0,
          productValue: 0,
          passCount: 0,
          passValue: 0
        });
      }
      return employeeRowsMap.get(resolved.key);
    }
    appointments.forEach((a) => {
      const apptDay = String(a.date || a.starts_at || a.appointment_datetime || "").slice(0, 10);
      if (data.dayIso && apptDay && apptDay !== data.dayIso) return;
      const row = ensureEmployee(a.employee_id, a.employee_name);
      row.visits += 1;
    });
    saleItems.forEach((i) => {
      const sale = saleMap.get(i.sale_id) || {};
      const linkedPass = i.pass_id ? passes.find(pass => String(pass.id) === String(i.pass_id)) : passBySaleId.get(i.sale_id) || {};
      const appointment = appointmentForSale(sale);
      const row = ensureEmployee(sale.employee_id || linkedPass.employee_id || appointment.employee_id, sale.employee_name, linkedPass.employee_name, appointment.employee_name);
      const type = String(i.item_type || "").toLowerCase();
      const qty = Number(i.quantity || 1);
      const val = itemValue(i, saleMap);
      if (type === "product") { row.productCount += qty; row.productValue += val; }
      else if (["pass", "karnet"].includes(type)) { row.passCount += qty; row.passValue += val; }
      else { row.serviceCount += qty; row.serviceValue += val; }
    });
    const employeeRows = Array.from(employeeRowsMap.values())
      .filter(row => row.visits || row.serviceCount || row.productCount || row.passCount)
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));

    const sentLogs = notificationLogs.filter((log) => String(log.status || "").toLowerCase() === "sent");
    const smsSent = sentLogs.filter((log) => String(log.channel || "").toLowerCase() === "sms").length;
    const emailSentFromLogs = sentLogs.filter((log) => String(log.channel || "").toLowerCase() === "email").length;
    const emailSentFromMarketing = emailRecipients.filter((row) => String(row.status || "").toLowerCase() === "sent").length;
    const emailSent = emailSentFromLogs + emailSentFromMarketing;

    const cancelledAppointments = appointments.filter(isCancelled);

    return {
      plannedVisits: appointments.filter(isPlanned).length,
      finishedVisits: appointments.filter(isFinished).length,
      cancelledVisits: cancelledAppointments.length,
      cancellationReasons: cancellationBreakdownRows(cancelledAppointments),
      newClients: clients.length,
      salesCount: sales.length,
      revenue,
      paymentSum,
      cash,
      paymentsByMethod,
      serviceRows,
      productRows,
      passRows,
      employeeRows,
      serviceItems,
      productItems,
      passItems,
      smsSent,
      emailSent
    };
  }

  function render(ctx, day, report) {
    const canBrowse = canViewOtherDays(ctx);
    const today = isoDate(new Date());
    const currentIso = isoDate(day);
    const headerDate = displayDate(day);

    const paymentRows = report.paymentsByMethod.length
      ? report.paymentsByMethod.map(row => `<div><span>${esc(row.method)}</span><b>${money(row.value)}</b><small>${int(row.count)} płatności</small></div>`).join("")
      : paymentLabels.map(method => `<div><span>${esc(method)}</span><b>${money(0)}</b></div>`).join("");

    const serviceTotals = report.serviceRows.reduce((acc, r) => { acc.count += Number(r.count || 0); acc.value += Number(r.value || 0); return acc; }, { count: 0, value: 0 });
    const productTotals = report.productRows.reduce((acc, r) => { acc.count += Number(r.count || 0); acc.value += Number(r.value || 0); return acc; }, { count: 0, value: 0 });
    const passTotals = report.passRows.reduce((acc, r) => { acc.count += Number(r.count || 0); acc.value += Number(r.value || 0); return acc; }, { count: 0, value: 0 });
    const employeeTotals = report.employeeRows.reduce((acc, r) => {
      acc.visits += Number(r.visits || 0);
      acc.serviceCount += Number(r.serviceCount || 0);
      acc.serviceValue += Number(r.serviceValue || 0);
      acc.productCount += Number(r.productCount || 0);
      acc.productValue += Number(r.productValue || 0);
      acc.passCount += Number(r.passCount || 0);
      acc.passValue += Number(r.passValue || 0);
      return acc;
    }, { visits: 0, serviceCount: 0, serviceValue: 0, productCount: 0, productValue: 0, passCount: 0, passValue: 0 });

    const servicesTable = table(
      ["L.szt.", "Wartość PLN", "Nazwa usługi"],
      report.serviceRows.map(r => [int(r.count), money(r.value), esc(r.name)]),
      "cm-daily-services-table",
      [int(serviceTotals.count), money(serviceTotals.value), "<b>Suma</b>"]
    );
    const productsTable = table(
      ["L.szt.", "Wartość PLN", "Nazwa produktu"],
      report.productRows.map(r => [int(r.count), money(r.value), esc(r.name)]),
      "cm-daily-products-table",
      [int(productTotals.count), money(productTotals.value), "<b>Suma</b>"]
    );
    const passesTable = table(
      ["L.szt.", "Wartość PLN", "Nazwa karnetu"],
      report.passRows.map(r => [int(r.count), money(r.value), esc(r.name)]),
      "cm-daily-passes-table",
      [int(passTotals.count), money(passTotals.value), "<b>Suma</b>"]
    );
    const employeeTable = table(
      ["Pracownik", "Wizyty", "Usługi", "Wartość usług", "Produkty", "Wartość produktów", "Karnety", "Wartość karnetów"],
      report.employeeRows.map(r => [esc(r.name), int(r.visits), int(r.serviceCount), money(r.serviceValue), int(r.productCount), money(r.productValue), int(r.passCount), money(r.passValue)]),
      "cm-daily-employees-table",
      ["<b>Suma</b>", int(employeeTotals.visits), int(employeeTotals.serviceCount), money(employeeTotals.serviceValue), int(employeeTotals.productCount), money(employeeTotals.productValue), int(employeeTotals.passCount), money(employeeTotals.passValue)]
    );

    panelArea().innerHTML = `
      <section class="bm-page-card cm-period-report-card cm-daily-report-card cm-supabase-daily-report">
        <div class="bm-page-head cm-period-head">
          <h2>Raport dzienny</h2>
          <button type="button" class="bm-light-btn" id="dailyExportExcel">Export - Excel</button>
        </div>

        <div class="cm-daily-date-row ${canBrowse ? "" : "cm-daily-date-row-locked"}">
          <button type="button" id="dailyPrevDay" class="bm-light-btn cm-daily-arrow" aria-label="Poprzedni dzień" ${canBrowse ? "" : "disabled"}>‹</button>
          <label class="cm-daily-date-field" id="dailyDateField" title="${canBrowse ? "Wybierz datę" : "Brak uprawnienia do innych dni"}">
            <span>${esc(headerDate)}</span>
            <input id="dailyReportDate" type="date" value="${esc(currentIso)}" aria-label="Wybierz datę raportu dziennego" ${canBrowse ? "" : "disabled"}>
          </label>
          <button type="button" id="dailyNextDay" class="bm-light-btn cm-daily-arrow" aria-label="Następny dzień" ${canBrowse ? "" : "disabled"}>›</button>
          ${canBrowse ? "" : `<small class="cm-permission-note">Masz dostęp tylko do raportu z dzisiaj.</small>`}
        </div>

        <div class="cm-period-kpis cm-daily-main-kpis">
          <div><span>Przychód</span><b>${money(report.revenue)}</b><small>zakończone/opłacone sprzedaże</small></div>
          <div><span>Sprzedaże</span><b>${int(report.salesCount)}</b><small>liczba paragonów/sprzedaży</small></div>
          <div><span>Nowi klienci</span><b>${int(report.newClients)}</b><small>zapisani dzisiaj</small></div>
        </div>

        <div class="cm-period-kpis">
          <div><span>Liczba zaplanowanych wizyt</span><b>${int(report.plannedVisits)}</b></div>
          <div><span>Liczba zakończonych wizyt</span><b>${int(report.finishedVisits)}</b></div>
          <div><span>Liczba odwołanych wizyt</span><b>${int(report.cancelledVisits)}</b></div>
        </div>

        <section class="cm-period-section"><h3>Finanse</h3><div class="cm-finance-grid"><div><span>Płatności</span><b>${money(report.paymentSum)}</b>${paymentRows}</div><div><span>Stan kasy</span><b>${money(report.cash)}</b><small>gotówka w wybranym dniu</small></div><div><span>Obrót</span><b>${money(report.revenue)}</b><small>łączny obrót w wybranym dniu</small></div></div></section>
        <section class="cm-period-section"><h3>Usługi</h3><p>Sprzedane usługi w tym dniu: <b>${int(report.serviceItems.length)}</b></p>${servicesTable}</section>
        <section class="cm-period-section"><h3>Produkty</h3><p>Sprzedane produkty w tym dniu: <b>${int(report.productItems.length)}</b></p>${productsTable}</section>
        <section class="cm-period-section"><h3>Karnety</h3><p>Sprzedane karnety w tym dniu: <b>${int(report.passItems.length)}</b></p>${passesTable}</section>
        <section class="cm-period-section"><h3>Powody odwołań</h3><p>Odwołane wizyty według powodu</p>${table(["Powód", "Liczba"], (report.cancellationReasons || []).map(r => [esc(r.reason), int(r.count)]), "cm-daily-cancel-reasons-table", ["<b>Suma</b>", int((report.cancellationReasons || []).reduce((sum, r) => sum + Number(r.count || 0), 0))])}</section>
        <section class="cm-period-section"><h3>Pracownicy</h3>${employeeTable}</section>
        <section class="cm-period-section cm-comm-grid"><div><h3>SMS</h3><p>Wysłane SMS</p><b>${int(report.smsSent)}</b></div><div><h3>Email</h3><p>Wysłane EMAIL</p><b>${int(report.emailSent)}</b></div></section>
      </section>`;

    const move = (delta) => {
      const next = new Date(day);
      next.setDate(next.getDate() + delta);
      const url = new URL(window.location.href);
      url.searchParams.set("date", isoDate(next));
      window.location.href = url.toString();
    };
    $("#dailyPrevDay")?.addEventListener("click", () => { if (canBrowse) move(-1); });
    $("#dailyNextDay")?.addEventListener("click", () => { if (canBrowse) move(1); });
    const dateInput = $("#dailyReportDate");
    $("#dailyDateField")?.addEventListener("click", (event) => {
      if (!dateInput || !canBrowse) return;
      if (event.target !== dateInput) event.preventDefault();
      if (typeof dateInput.showPicker === "function") dateInput.showPicker(); else dateInput.focus();
    });
    dateInput?.addEventListener("change", (event) => {
      const selected = event.target.value || currentIso;
      if (!canBrowse && selected !== today) {
        alert("Brak uprawnienia do raportu dziennego z innych dni.");
        event.target.value = today;
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("date", selected);
      window.location.href = url.toString();
    });
    $("#dailyExportExcel")?.addEventListener("click", () => exportExcel(day, report));
    setupDailyDataTables(panelArea());
    window.setupNativePickers?.();
  }

  function exportExcel(day, report) {
    const rows = [];
    rows.push(["Raport dzienny", isoDate(day)]);
    rows.push([]);
    rows.push(["Przychód", report.revenue.toFixed(2)]);
    rows.push(["Sprzedaże", report.salesCount]);
    rows.push(["Nowi klienci", report.newClients]);
    rows.push(["Wizyty zaplanowane", report.plannedVisits]);
    rows.push(["Wizyty zakończone", report.finishedVisits]);
    rows.push(["Wizyty odwołane", report.cancelledVisits]);
    rows.push(["SMS wysłane", report.smsSent || 0]);
    rows.push(["Email wysłane", report.emailSent || 0]);
    rows.push([]);
    rows.push(["Usługi", "L.szt.", "Wartość"]);
    report.serviceRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    rows.push([]);
    rows.push(["Produkty", "L.szt.", "Wartość"]);
    report.productRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    rows.push([]);
    rows.push(["Karnety", "L.szt.", "Wartość"]);
    report.passRows.forEach(r => rows.push([r.name, r.count, r.value.toFixed(2)]));
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-dzienny-${isoDate(day)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function init() {
    try {
      const ctx = await getContext();
      if (!ctx.ok) return renderError(ctx.message);
      const params = new URLSearchParams(window.location.search || "");
      const requested = parseLocalDate(params.get("date")) || new Date();
      const todayDate = new Date();
      const todayIso = isoDate(todayDate);
      let picked = requested;
      const requestedIso = isoDate(requested);
      if (!canViewOtherDays(ctx) && requestedIso !== todayIso) {
        picked = todayDate;
        const url = new URL(window.location.href);
        url.searchParams.set("date", todayIso);
        window.history.replaceState({}, "", url.toString());
      }
      const day = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
      const data = await fetchDailyData(ctx, day);
      render(ctx, day, buildReport(data));
    } catch (error) {
      console.error("Daily report Supabase error", error);
      renderError(error.message || String(error));
    }
  }

  function bootDailyReport() {
    const root = panelArea();
    if (root && !root.querySelector(".cm-supabase-daily-report")) {
      root.innerHTML = `<section class="bm-page-card cm-daily-report-card"><div class="bm-page-head"><h2>Raport dzienny</h2></div><p class="panel-message">Ładuję dane z Supabase...</p></section>`;
    }
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(bootDailyReport, 150));
  } else {
    setTimeout(bootDailyReport, 150);
  }
})();
