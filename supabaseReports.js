// CompanyManager — 044A Wykresy / Statystyka Supabase
// reports.html: realne dane z sales / sale_items / appointments / clients.
(function () {
  if (document.body?.dataset?.panelPage !== "reports") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const int = (value) => String(Number(value || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function defaultDates() {
    const now = new Date();
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }

  function formatPeriod(value, group) {
    const raw = String(value || "").slice(0, 10);
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return raw;
    const date = new Date(y, m - 1, d);
    const months = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
    if (group === "years") return String(y);
    if (group === "quarters") return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    if (group === "months") return `${months[m - 1]} ${y}`;
    if (group === "weeks") {
      const end = new Date(date);
      end.setDate(end.getDate() + 6);
      return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}–${String(end.getDate()).padStart(2, "0")}.${String(end.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
  }

  function getRoot() {
    return $(".bm-panel-area") || $("#dashboardRoot") || $("#panelAppRoot") || document.body;
  }

  function normalizeRole(role) { return String(role || "").trim().toUpperCase(); }
  function normalizePermissions(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  function hasReportAccess(access, context) {
    const role = normalizeRole(access?.role || context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(access?.permissions || context?.permissions);
    return permissions.all === true || permissions.admin === true || permissions.open_stats === true || permissions.reports_access === true;
  }

  async function getContext() {
    if (!window.cmSupabase) throw new Error("Nie załadowano Supabase.");
    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);
    if (accessError) throw accessError;
    if (contextError) throw contextError;
    if (!access || access.allowed !== true) throw new Error(access?.reason || "Brak dostępu.");
    if (!context || context.allowed !== true || !context.company_id) throw new Error(context?.reason || "Brak kontekstu firmy.");
    if (!hasReportAccess(access, context)) throw new Error("Brak uprawnienia do Wykresów/Statystyki.");
    return { access, context, companyId: context.company_id };
  }

  function kpiCard(label, value, hint = "") {
    return `<article class="cm-report-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ""}</article>`;
  }

  function renderBars(rows, group) {
    const max = Math.max(1, ...rows.map((row) => Number(row.revenue || 0)), ...rows.map((row) => Number(row.finished_visits || 0) * 30));
    return `<div class="cm-supa-chart">
      ${rows.map((row) => {
        const revenueHeight = Math.max(Number(row.revenue || 0) ? 8 : 0, Math.round((Number(row.revenue || 0) / max) * 260));
        const visitsHeight = Math.max(Number(row.finished_visits || 0) ? 8 : 0, Math.round(((Number(row.finished_visits || 0) * 30) / max) * 260));
        return `<div class="cm-supa-chart-col" title="${esc(formatPeriod(row.period_start, group))} — ${esc(money(row.revenue))}, wizyty: ${esc(row.finished_visits)}">
          <div class="cm-supa-chart-bars">
            <span class="cm-supa-bar revenue" style="height:${revenueHeight}px"></span>
            <span class="cm-supa-bar visits" style="height:${visitsHeight}px"></span>
          </div>
          <small>${esc(formatPeriod(row.period_start, group))}</small>
        </div>`;
      }).join("")}
    </div>`;
  }

  function table(rows, group) {
    const body = rows.length ? rows.map((row) => `<tr>
      <td>${esc(formatPeriod(row.period_start, group))}</td>
      <td>${esc(money(row.revenue))}</td>
      <td>${esc(int(row.sales_count))}</td>
      <td>${esc(int(row.service_items))}</td>
      <td>${esc(int(row.product_items))}</td>
      <td>${esc(int(row.pass_items))}</td>
      <td>${esc(int(row.finished_visits))}</td>
      <td>${esc(int(row.planned_visits))}</td>
      <td>${esc(int(row.new_clients))}</td>
    </tr>`).join("") : `<tr><td colspan="9">Nie znaleziono żadnych danych</td></tr>`;
    return `<div class="bm-table-wrap"><table class="bm-table cm-supa-report-table">
      <thead><tr><th>Okres</th><th>Przychód</th><th>Sprzedaże</th><th>Usługi</th><th>Produkty</th><th>Karnety</th><th>Wizyty zakończone</th><th>Wizyty zaplanowane</th><th>Nowi klienci</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function renderLayout(data, filters) {
    const root = getRoot();
    const summary = data?.summary || {};
    const rows = Array.isArray(data?.series) ? data.series : [];

    root.innerHTML = `<section class="bm-page-card cm-report-card cm-supa-reports-module">
      <div class="bm-page-head"><h2>Wykres/Statystyka</h2></div>
      <form class="cm-supa-report-controls" id="cmReportsFilters">
        <label>Od<input type="date" name="from" value="${esc(filters.from)}"></label>
        <label>Do<input type="date" name="to" value="${esc(filters.to)}"></label>
        <label>Grupuj według<select name="group">
          <option value="days" ${filters.group === "days" ? "selected" : ""}>dni</option>
          <option value="weeks" ${filters.group === "weeks" ? "selected" : ""}>tygodnie</option>
          <option value="months" ${filters.group === "months" ? "selected" : ""}>miesiące</option>
          <option value="quarters" ${filters.group === "quarters" ? "selected" : ""}>kwartały</option>
          <option value="years" ${filters.group === "years" ? "selected" : ""}>lata</option>
        </select></label>
        <button type="submit" class="btn btn-primary">Pokaż</button>
      </form>
      <div class="cm-report-kpi-grid">
        ${kpiCard("Przychód", money(summary.revenue), "tylko paid/partial, bez void")}
        ${kpiCard("Sprzedaże", int(summary.sales_count), "sales")}
        ${kpiCard("Usługi", `${int(summary.service_items)} / ${money(summary.service_revenue)}`, "sale_items service")}
        ${kpiCard("Produkty", `${int(summary.product_items)} / ${money(summary.product_revenue)}`, "sale_items product")}
        ${kpiCard("Karnety", `${int(summary.pass_items)} / ${money(summary.pass_revenue)}`, "sprzedaż karnetów")}
        ${kpiCard("Wizyty", int(summary.finished_visits), "zakończone")}
        ${kpiCard("Zaplanowane", int(summary.planned_visits), "nie liczą się do przychodu")}
        ${kpiCard("Nowi klienci", int(summary.new_clients), "clients")}
      </div>
      <div class="cm-supa-chart-legend"><span><i class="revenue"></i>Przychód</span><span><i class="visits"></i>Wizyty zakończone</span></div>
      ${renderBars(rows, filters.group)}
      <div class="cm-report-table">${table(rows, filters.group)}</div>
    </section>`;

    $("#cmReportsFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      loadAndRender({ from: form.from.value, to: form.to.value, group: form.group.value });
    });

    window.cmReinitDatePickers?.();
    window.cmReinitCalendarInputs?.();
  }

  function renderError(message) {
    getRoot().innerHTML = `<section class="bm-page-card"><div class="bm-page-head"><h2>Wykres/Statystyka</h2></div><div class="bm-empty-state">Błąd statystyk: ${esc(message)}</div></section>`;
  }

  async function loadAndRender(overrides = {}) {
    const dates = defaultDates();
    const filters = {
      from: overrides.from || dates.from,
      to: overrides.to || dates.to,
      group: overrides.group || "days"
    };
    try {
      getRoot().innerHTML = `<section class="bm-page-card"><div class="bm-page-head"><h2>Wykres/Statystyka</h2></div><div class="bm-empty-state">Ładowanie statystyk z Supabase...</div></section>`;
      const ctx = await getContext();
      const { data, error } = await window.cmSupabase.rpc("cm_reports_stats", {
        p_company_id: ctx.companyId,
        p_from: filters.from,
        p_to: filters.to,
        p_group: filters.group
      });
      if (error) throw error;
      renderLayout(data || {}, filters);
    } catch (error) {
      renderError(error?.message || String(error));
    }
  }

  function boot() {
    setTimeout(() => loadAndRender(), 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
