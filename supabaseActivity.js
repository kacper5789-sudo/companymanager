// CompanyManager — Historia aktywności / Company audit log
// 080: Historia aktywności firmy — neutralny opis, zakres 60 dni i paginacja.

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

  function shortJson(value) {
    if (!value || typeof value !== "object") return "-";
    const keys = ["name", "full_name", "email", "status", "active", "sale_price", "value", "total_gross", "payment_status", "deleted_at"];
    const picked = {};
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) picked[key] = value[key];
    });
    const data = Object.keys(picked).length ? picked : value;
    const text = JSON.stringify(data, null, 0);
    return text.length > 180 ? text.slice(0, 180) + "..." : text;
  }

  function actionLabel(action) {
    const map = {
      CREATE: "Dodano",
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
        <td>${escapeHtml(item.record_label || item.record_id || "-")}</td>
        <td><code>${escapeHtml(shortJson(item.old_data))}</code></td>
        <td><code>${escapeHtml(shortJson(item.new_data))}</code></td>
      </tr>`).join("");
  }

  async function loadLogs(ctx) {
    const status = document.getElementById("auditStatus");
    if (status) {
      status.textContent = "Ładowanie historii...";
      status.style.color = "#93c5fd";
    }
    const pageSize = Number(document.getElementById("auditPageSize")?.value || 100);
    const params = {
      p_company_id: ctx.companyId || ctx.context?.company_id || null,
      p_limit: pageSize,
      p_offset: auditState.page * pageSize,
      p_action: document.getElementById("auditActionFilter")?.value || null,
      p_module: document.getElementById("auditModuleFilter")?.value || null,
      p_search: document.getElementById("auditSearch")?.value || null,
      p_date_from: getDateFromByRange(),
      p_date_to: null
    };
    const { data, error } = await window.cmSupabase.rpc("cm_list_company_audit_logs", params);
    if (error) {
      if (status) {
        status.textContent = error.message || "Błąd ładowania historii.";
        status.style.color = "#fca5a5";
      }
      renderRows([]);
      return;
    }
    fillModules(data || []);
    renderRows(data || []);
    auditState.lastCount = (data || []).length;
    updatePager(pageSize);
    if (status) {
      status.textContent = `Zakres: ostatnie ${document.getElementById("auditRangeFilter")?.selectedOptions?.[0]?.textContent || "60 dni"}. Wpisy na stronie: ${(data || []).length}`;
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
