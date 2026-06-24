// CompanyManager — Historia aktywności / Company audit log
// 085: Historia aktywności — pełny tryb ludzki, bez UUID w kolumnie Rekord.

(function () {
  function isPage() {
    return document.body?.dataset?.panelPage === "activity" || window.location.pathname.includes("activity.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return date.toLocaleString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const TECHNICAL_AUDIT_KEYS = new Set([
    "id", "company_id", "actor_id", "actor_role", "user_id", "created_by", "updated_by", "deleted_by",
    "target_id", "record_id", "sale_id", "sale_item_id", "appointment_id", "pass_id", "pass_template_id",
    "client_id", "customer_id", "buyer_client_id", "beneficiary_client_id", "employee_id", "service_id", "product_id",
    "undo_action_id", "source", "metadata", "raw", "table_name", "schema", "search_path"
  ]);

  const FIELD_LABELS = {
    name: "Nazwa",
    full_name: "Imię i nazwisko",
    first_name: "Imię",
    last_name: "Nazwisko",
    email: "Email",
    phone: "Telefon",
    status: "Status",
    active: "Aktywne",
    deleted_at: "Data usunięcia",
    updated_at: "Data aktualizacji",
    sale_price: "Cena sprzedaży",
    value: "Wartość",
    total_gross: "Brutto",
    total_net: "Netto",
    total_price: "Suma",
    payment_status: "Status płatności",
    payment_method: "Płatność",
    method: "Płatność",
    price: "Cena",
    price_gross: "Cena brutto",
    price_net: "Cena netto",
    quantity: "Ilość",
    stock_quantity: "Pula",
    sold_count: "Sprzedano",
    remaining_stock: "Pozostało w puli",
    pass_type: "Typ karnetu",
    type: "Typ",
    service_name: "Usługa",
    product_name: "Produkt",
    employee_name: "Pracownik",
    customer_name: "Klient",
    buyer: "Kupujący",
    description: "Opis",
    note: "Notatka",
    date_from: "Od",
    date_to: "Do",
    start_date: "Od",
    end_date: "Do",
    starts_at: "Start",
    ends_at: "Koniec",
    valid_until: "Ważny do",
    number: "Numer",
    sale_number: "Numer sprzedaży",
    module: "Moduł",
    action_type: "Akcja",
    target_label: "Rekord",
    record_label: "Rekord",
    old_data: "Przed",
    new_data: "Po",
    undone_at: "Data cofnięcia"
  };

  const MODULE_LABELS = {
    profiles: "Użytkownicy",
    employees: "Zespół",
    positions: "Stanowiska pracy",
    days_off: "Dni wolne pracowników",
    clients: "Klienci",
    services: "Usługi",
    products: "Produkty",
    appointments: "Wizyty",
    sales: "Sprzedaż",
    sale_items: "Pozycje sprzedaży",
    payments: "Płatności",
    passes: "Karnety",
    pass_templates: "Typy karnetów",
    marketing_campaigns: "Marketing",
    undo_actions: "Cofnij Czas"
  };

  function normalizeActionText(value) {
    const raw = String(value || "").toUpperCase();
    return actionLabel(raw) || value || "-";
  }

  function normalizeModuleText(value) {
    const key = String(value || "").toLowerCase();
    return MODULE_LABELS[key] || value || "-";
  }

  function normalizeStatusText(value) {
    const text = String(value ?? "").toLowerCase();
    const map = {
      active: "aktywny",
      true: "tak",
      false: "nie",
      deleted: "usunięty",
      void: "unieważniony",
      cancelled: "odwołany",
      canceled: "odwołany",
      completed: "zakończony",
      paid: "opłacony",
      pending: "oczekuje",
      approved: "zatwierdzony",
      inactive: "nieaktywny",
      aktualne: "aktualny"
    };
    return map[text] || String(value ?? "-");
  }

  function formatAuditValue(value, key) {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "tak" : "nie";
    if (key && ["status", "payment_status", "active"].includes(key)) return normalizeStatusText(value);
    if (key && /(_at|_date|date_from|date_to|starts_at|ends_at|valid_until)$/i.test(key)) return formatDateTime(value);
    if (typeof value === "number") return String(value);
    if (typeof value === "object") return summarizeObject(value);
    return String(value);
  }

  function labelForField(key) {
    return FIELD_LABELS[key] || String(key || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
  }

  function isTechnicalText(value) {
    const s = String(value || "").trim();
    if (!s) return true;
    if (isUuid(s)) return true;
    if (/^\{.*\}$/.test(s) || /^\[.*\]$/.test(s)) return true;
    return false;
  }

  function cleanRecordName(v) {
    const s = String(v || "").trim();
    if (isTechnicalText(s)) return "Zmieniony rekord";
    return s;
  }

  function extractReadableName(value) {
    if (!value || typeof value !== "object") return "";
    const candidates = [
      value.record_label, value.target_label, value.name, value.full_name,
      value.service_name, value.product_name, value.customer_name, value.client_name,
      value.employee_name, value.buyer, value.email, value.phone, value.number, value.sale_number,
      value.title, value.label
    ];
    for (const candidate of candidates) {
      const text = String(candidate || "").trim();
      if (text && !isTechnicalText(text)) return text;
    }
    if (value.old_data && typeof value.old_data === "object") {
      const nested = extractReadableName(value.old_data);
      if (nested) return nested;
    }
    if (value.new_data && typeof value.new_data === "object") {
      const nested = extractReadableName(value.new_data);
      if (nested) return nested;
    }
    return "";
  }

  function summarizeObject(obj) {
    if (!obj || typeof obj !== "object") return "-";
    return extractReadableName(obj) || "szczegóły";
  }

  function displayRecordName(item) {
    const direct = [item?.record_label, item?.target_label];
    for (const candidate of direct) {
      const text = String(candidate || "").trim();
      if (text && !isTechnicalText(text)) return text;
    }
    const fromNew = extractReadableName(item?.new_data);
    if (fromNew) return fromNew;
    const fromOld = extractReadableName(item?.old_data);
    if (fromOld) return fromOld;
    return "Zmieniony rekord";
  }

  function pickReadableEntries(value) {
    if (!value || typeof value !== "object") return [];

    // Przy logach Cofnij Czas często wpada cały rekord undo_actions. Pokazujemy sens, nie technikalia.
    if (value.module || value.action_type || value.undone_at || value.old_data || value.new_data) {
      const rows = [];
      if (value.module) rows.push(["Moduł", normalizeModuleText(value.module)]);
      if (value.action_type) rows.push(["Cofnięta akcja", normalizeActionText(value.action_type)]);
      const label = extractReadableName(value);
      if (label) rows.push(["Rekord", label]);
      if (value.undone_at) rows.push(["Data cofnięcia", formatDateTime(value.undone_at)]);
      const nested = value.new_data || value.old_data;
      if (nested && typeof nested === "object") {
        pickReadableEntries(nested).slice(0, 4).forEach(([k, v]) => rows.push([k, v]));
      }
      return rows;
    }

    const priority = [
      "name", "full_name", "email", "phone", "status", "active", "deleted_at",
      "employee_name", "customer_name", "buyer", "service_name", "product_name",
      "price", "sale_price", "value", "total_gross", "payment_status", "payment_method",
      "quantity", "stock_quantity", "sold_count", "remaining_stock", "pass_type", "type",
      "date_from", "date_to", "start_date", "end_date", "starts_at", "ends_at", "valid_until",
      "description", "note"
    ];

    const seen = new Set();
    const entries = [];
    function addKey(key) {
      if (seen.has(key) || TECHNICAL_AUDIT_KEYS.has(key)) return;
      if (!Object.prototype.hasOwnProperty.call(value, key)) return;
      const val = value[key];
      if (val === null || val === undefined || val === "") return;
      seen.add(key);
      entries.push([labelForField(key), formatAuditValue(val, key)]);
    }
    priority.forEach(addKey);
    return entries.slice(0, 8);
  }

  function formatChangeHtml(value, item, side) {
    if (!value || typeof value !== "object") return `<span class="bm-muted">-</span>`;

    if (String(item?.action || "").toUpperCase() === "UNDO" && (value.module || value.action_type || value.undone_at)) {
      const module = normalizeModuleText(value.module || item.module);
      const action = normalizeActionText(value.action_type || value.action || item.action);
      const label = displayRecordName({ ...item, old_data: value.old_data || item.old_data, new_data: value.new_data || item.new_data, record_label: value.record_label || value.target_label || item.record_label });
      const undone = value.undone_at ? `<div><strong>Data cofnięcia:</strong> ${escapeHtml(formatDateTime(value.undone_at))}</div>` : "";
      return `<div class="cm-audit-readable"><div><strong>Cofnięto akcję:</strong></div><div>${escapeHtml(module)} → ${escapeHtml(action)} → ${escapeHtml(label)}</div>${undone}</div>`;
    }

    const entries = pickReadableEntries(value);
    if (!entries.length) return `<span class="bm-muted">Brak czytelnych zmian</span>`;
    return `<div class="cm-audit-readable">${entries.map(([key, val]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</div>`).join("")}</div>`;
  }

  function actionLabel(action) {
    const map = {
      CREATE: "Dodano",
      INSERT: "Dodano",
      UPDATE: "Edytowano",
      DELETE: "Usunięto",
      CANCEL: "Odwołano",
      UNDO: "Cofnij Czas",
      RESTORE: "Przywrócono"
    };
    return map[String(action || "").toUpperCase()] || action || "-";
  }

  function actionClass(action) {
    const normalized = String(action || "").toUpperCase();
    if (normalized === "CREATE") return "is-create";
    if (normalized === "UPDATE") return "is-update";
    if (normalized === "DELETE") return "is-delete";
    if (normalized === "CANCEL") return "is-cancel";
    if (normalized === "UNDO") return "is-undo";
    return "";
  }

  const auditState = { page: 0, lastCount: 0 };

  function getDateFromByRange() {
    const range = document.getElementById("auditRangeFilter")?.value || "60";
    const now = new Date();
    if (range === "today") {
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    const days = Math.min(Math.max(Number(range) || 60, 1), 60);
    now.setDate(now.getDate() - days);
    return now.toISOString();
  }

  function resetAuditPage() {
    auditState.page = 0;
  }

  function updatePager(pageSize) {
    const info = document.getElementById("auditPageInfo");
    const prev = document.getElementById("auditPrevPage");
    const next = document.getElementById("auditNextPage");
    if (info) info.textContent = `Strona ${auditState.page + 1}`;
    if (prev) prev.disabled = auditState.page <= 0;
    if (next) next.disabled = auditState.lastCount < pageSize;
  }

  async function getContext() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano Supabase." };
    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);
    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    const role = String(access.role || "").toUpperCase();
    const companyId = context?.company_id || access.company_id || null;
    if (role !== "OWNER" && role !== "ADMIN") return { ok: false, message: "Dostęp do historii aktywności ma ADMIN/OWNER." };
    if (!companyId && role !== "OWNER") return { ok: false, message: "Brak firmy." };
    return { ok: true, access, context, role, companyId };
  }

  function renderShell(area) {
    area.innerHTML = `
      <section class="bm-page-card cm-audit-module">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Dziennik firmy</span>
            <h2>Historia aktywności</h2>
            <p class="bm-muted">Podgląd ostatnich działań i zmian w systemie. Domyślny zakres: ostatnie 60 dni.</p>
          </div>
        </div>
        <div class="cm-audit-filters">
          <label>Okres
            <select id="auditRangeFilter">
              <option value="today">Dzisiaj</option>
              <option value="7">7 dni</option>
              <option value="30">30 dni</option>
              <option value="60" selected>60 dni</option>
            </select>
          </label>
          <label>Akcja
            <select id="auditActionFilter">
              <option value="">Wszystkie</option>
              <option value="CREATE">Dodane</option>
              <option value="UPDATE">Edytowane</option>
              <option value="UNDO">Cofnięte</option>
              <option value="CANCEL">Odwołane</option>
              <option value="DELETE">Usunięte</option>
            </select>
          </label>
          <label>Moduł
            <select id="auditModuleFilter">
              <option value="">Wszystkie</option>
            </select>
          </label>
          <label>Szukaj
            <input id="auditSearch" type="search" placeholder="Pracownik, moduł, rekord...">
          </label>
          <label>Na stronę
            <select id="auditPageSize">
              <option value="50">50</option>
              <option value="100" selected>100</option>
              <option value="200">200</option>
            </select>
          </label>
          <button id="auditRefreshBtn" class="bm-primary-btn" type="button">Odśwież</button>
        </div>
        <div id="auditStatus" class="panel-message"></div>
        <div class="bm-table-wrap cm-audit-table-wrap">
          <table class="bm-table cm-audit-table">
            <thead>
              <tr>
                <th>Data i godzina</th>
                <th>Pracownik</th>
                <th>Moduł</th>
                <th>Akcja</th>
                <th>Rekord</th>
                <th>Przed</th>
                <th>Po</th>
              </tr>
            </thead>
            <tbody id="auditRows"><tr><td colspan="7">Ładowanie...</td></tr></tbody>
          </table>
        </div>
        <div class="cm-audit-pager">
          <button id="auditPrevPage" class="bm-secondary-btn" type="button">Poprzednia strona</button>
          <span id="auditPageInfo">Strona 1</span>
          <button id="auditNextPage" class="bm-secondary-btn" type="button">Następna strona</button>
        </div>
      </section>`;
  }

  function fillModules(logs) {
    const select = document.getElementById("auditModuleFilter");
    if (!select || select.dataset.ready === "1") return;
    const modules = [...new Set((logs || []).map((item) => item.module).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
    select.innerHTML = `<option value="">Wszystkie</option>` + modules.map((module) => `<option value="${escapeHtml(module)}">${escapeHtml(module)}</option>`).join("");
    select.dataset.ready = "1";
  }

  function renderRows(logs) {
    const tbody = document.getElementById("auditRows");
    if (!tbody) return;
    if (!logs || !logs.length) {
      tbody.innerHTML = `<tr><td colspan="7">Brak wpisów dla wybranych filtrów.</td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map((item) => `
      <tr>
        <td>${escapeHtml(formatDateTime(item.created_at))}</td>
        <td><strong>${escapeHtml(item.actor_name || "-")}</strong><br><small>${escapeHtml(item.actor_email || "")}</small></td>
        <td>${escapeHtml(item.module || item.table_name || "-")}</td>
        <td><span class="cm-audit-badge ${actionClass(item.action)}">${escapeHtml(actionLabel(item.action))}</span></td>
        <td>${escapeHtml(displayRecordName(item))}</td>
        <td>${formatChangeHtml(item.old_data, item, "old")}</td>
        <td>${formatChangeHtml(item.new_data, item, "new")}</td>
      </tr>`).join("");
  }

  function normalizeAuditRows(rows) {
    return (rows || []).map((item) => ({
      id: item.id,
      company_id: item.company_id,
      created_at: item.created_at,
      actor_name: item.actor_name,
      actor_email: item.actor_email,
      actor_role: item.actor_role,
      module: item.module,
      table_name: item.table_name,
      action: item.action,
      record_id: item.record_id,
      record_label: item.record_label,
      old_data: item.old_data,
      new_data: item.new_data,
      source: item.source
    }));
  }

  async function loadLogsDirect(ctx, params) {
    let query = window.cmSupabase
      .from("company_audit_logs")
      .select("id, company_id, created_at, actor_name, actor_email, actor_role, module, table_name, action, record_id, record_label, old_data, new_data, source")
      .gte("created_at", params.p_date_from)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(params.p_offset, params.p_offset + params.p_limit - 1);

    // ADMIN ma RLS tylko na swoją firmę. OWNER ogląda kontekst aktualnie wybranej firmy.
    if (params.p_company_id) query = query.eq("company_id", params.p_company_id);
    if (params.p_action) query = query.eq("action", params.p_action);
    if (params.p_module) query = query.eq("module", params.p_module);

    const search = String(params.p_search || "").trim();
    if (search) {
      const safe = search.replace(/[%_,]/g, "");
      query = query.or(`actor_name.ilike.%${safe}%,actor_email.ilike.%${safe}%,module.ilike.%${safe}%,action.ilike.%${safe}%,record_label.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return normalizeAuditRows(data || []);
  }

  async function loadLogs(ctx) {
    const status = document.getElementById("auditStatus");
    if (status) {
      status.textContent = "Ładowanie historii...";
      status.style.color = "#93c5fd";
    }
    const pageSize = Number(document.getElementById("auditPageSize")?.value || 100);
    const params = {
      p_company_id: ctx.companyId || ctx.context?.company_id || ctx.access?.company_id || null,
      p_limit: pageSize,
      p_offset: auditState.page * pageSize,
      p_action: document.getElementById("auditActionFilter")?.value || null,
      p_module: document.getElementById("auditModuleFilter")?.value || null,
      p_search: document.getElementById("auditSearch")?.value || null,
      p_date_from: getDateFromByRange(),
      p_date_to: null
    };

    let logs = [];
    let rpcError = null;

    // Najpierw RPC, ale jeśli zwróci pustkę przez kontekst firmy, robimy bezpieczny direct select pod RLS.
    try {
      const { data, error } = await window.cmSupabase.rpc("cm_list_company_audit_logs", params);
      if (error) rpcError = error;
      else logs = normalizeAuditRows(data || []);
    } catch (err) {
      rpcError = err;
    }

    if (!logs.length) {
      try {
        logs = await loadLogsDirect(ctx, params);
      } catch (directError) {
        if (status) {
          status.textContent = directError.message || rpcError?.message || "Błąd ładowania historii.";
          status.style.color = "#fca5a5";
        }
        renderRows([]);
        return;
      }
    }

    fillModules(logs || []);
    renderRows(logs || []);
    auditState.lastCount = (logs || []).length;
    updatePager(pageSize);
    if (status) {
      status.textContent = `Zakres: ostatnie ${document.getElementById("auditRangeFilter")?.selectedOptions?.[0]?.textContent || "60 dni"}. Wpisy na stronie: ${(logs || []).length}`;
      status.style.color = "#86efac";
    }
  }

  async function start() {
    if (!isPage()) return;
    const area = getPanelArea();
    if (!area) return;
    renderShell(area);
    const ctx = await getContext();
    if (!ctx.ok) {
      const status = document.getElementById("auditStatus");
      if (status) {
        status.textContent = ctx.message || "Brak dostępu.";
        status.style.color = "#fca5a5";
      }
      renderRows([]);
      return;
    }
    await loadLogs(ctx);
    document.getElementById("auditRefreshBtn")?.addEventListener("click", () => loadLogs(ctx));
    ["auditRangeFilter", "auditActionFilter", "auditModuleFilter", "auditPageSize"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => { resetAuditPage(); loadLogs(ctx); });
    });
    document.getElementById("auditPrevPage")?.addEventListener("click", () => {
      auditState.page = Math.max(0, auditState.page - 1);
      loadLogs(ctx);
    });
    document.getElementById("auditNextPage")?.addEventListener("click", () => {
      auditState.page += 1;
      loadLogs(ctx);
    });
    let timer = null;
    document.getElementById("auditSearch")?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { resetAuditPage(); loadLogs(ctx); }, 350);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
