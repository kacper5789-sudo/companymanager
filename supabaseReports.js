// CompanyManager — 045D Wykresy / Statystyka Supabase
// Główny wykres: Zapisało się klientów / Liczba klientów.
// Grupowanie pokazuje zawsze 20 ostatnich okresów wybranego typu, razem z dzisiejszym.
(function () {
  if (document.body?.dataset?.panelPage !== "reports") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const int = (value) => String(Number(value || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  let lastReportPayload = null;
  let activeChartIndex = 0;

  const CHARTS = [
    {
      id: "clients",
      title: "Zapisało się klientów",
      subtitle: "Nowi klienci i łączna liczba klientów",
      leftLabel: "Zapisało się klientów",
      rightLabel: "Liczba klientów",
      leftKey: "new_clients",
      rightKey: "total_clients",
      leftClass: "clients",
      rightClass: "total-clients",
      leftFormat: int,
      rightFormat: int
    },
    {
      id: "revenue",
      title: "Przychód",
      subtitle: "Przychód i liczba sprzedaży",
      leftLabel: "Przychód",
      rightLabel: "Sprzedaże",
      leftKey: "revenue",
      rightKey: "sales_count",
      leftClass: "revenue",
      rightClass: "visits",
      leftFormat: money,
      rightFormat: int
    },
    {
      id: "visits",
      title: "Wizyty",
      subtitle: "Zakończone i zaplanowane wizyty",
      leftLabel: "Wizyty zakończone",
      rightLabel: "Wizyty zaplanowane",
      leftKey: "finished_visits",
      rightKey: "planned_visits",
      leftClass: "visits",
      rightClass: "planned",
      leftFormat: int,
      rightFormat: int
    },
    {
      id: "items",
      title: "Pozycje sprzedaży",
      subtitle: "Usługi i produkty",
      leftLabel: "Usługi",
      rightLabel: "Produkty",
      leftKey: "service_items",
      rightKey: "product_items",
      leftClass: "service",
      rightClass: "product",
      leftFormat: int,
      rightFormat: int
    }
  ];

  function safeFilename(value) {
    return String(value || "raport").toLowerCase().replace(/[^a-z0-9ąćęłńóśźż_-]+/gi, "-").replace(/^-+|-+$/g, "") || "raport";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportStatsExcel() {
    const payload = lastReportPayload;
    if (!payload) return;
    const rows = Array.isArray(payload.data?.series) ? payload.data.series : [];
    const group = payload.filters?.group || "days";
    const header = ["Okres", "Zapisało się klientów", "Liczba klientów", "Przychód", "Sprzedaże", "Usługi", "Produkty", "Karnety", "Wizyty zakończone", "Wizyty zaplanowane"];
    const csvRows = [header].concat(rows.map((row) => [
      formatPeriod(row.period_start, group),
      Number(row.new_clients || 0),
      Number(row.total_clients || 0),
      Number(row.revenue || 0).toFixed(2),
      Number(row.sales_count || 0),
      Number(row.service_items || 0),
      Number(row.product_items || 0),
      Number(row.pass_items || 0),
      Number(row.finished_visits || 0),
      Number(row.planned_visits || 0)
    ]));
    const content = csvRows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";" )).join("\n");
    const blob = new Blob(["\ufeff" + content], { type: "application/vnd.ms-excel;charset=utf-8;" });
    downloadBlob(blob, `statystyka-${safeFilename(payload.filters?.group)}-${safeFilename(payload.filters?.to)}.xls`);
  }

  function exportChartJpg() {
    const payload = lastReportPayload;
    if (!payload) return;
    const rows = Array.isArray(payload.data?.series) ? payload.data.series : [];
    const group = payload.filters?.group || "days";
    const chart = CHARTS[activeChartIndex] || CHARTS[0];
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    const pad = 90;
    const chartTop = 170;
    const chartBottom = 720;
    const chartHeight = chartBottom - chartTop;
    const leftMax = Math.max(1, ...rows.map((row) => Number(row[chart.leftKey] || 0)));
    const rightMax = Math.max(1, ...rows.map((row) => Number(row[chart.rightKey] || 0)));
    ctx.fillStyle = "#07111f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 42px Arial";
    ctx.fillText(chart.title, pad, 80);
    ctx.font = "24px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(`Ostatnie 20 okresów — ${groupLabel(group)}`, pad, 122);
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = chartBottom - (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(canvas.width - pad, y);
      ctx.stroke();
    }
    const count = Math.max(rows.length, 1);
    const colW = (canvas.width - pad * 2) / count;
    rows.forEach((row, index) => {
      const x = pad + index * colW + colW * 0.22;
      const leftValue = Number(row[chart.leftKey] || 0);
      const rightValue = Number(row[chart.rightKey] || 0);
      const leftH = Math.max(leftValue ? 8 : 0, (leftValue / leftMax) * chartHeight);
      const rightH = Math.max(rightValue ? 8 : 0, (rightValue / rightMax) * chartHeight);
      ctx.fillStyle = "rgba(90, 190, 255, 0.78)";
      ctx.fillRect(x, chartBottom - leftH, Math.max(8, colW * 0.20), leftH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      ctx.fillRect(x + Math.max(10, colW * 0.25), chartBottom - rightH, Math.max(8, colW * 0.20), rightH);
      ctx.save();
      ctx.translate(x + colW * 0.15, chartBottom + 28);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "18px Arial";
      ctx.fillText(formatPeriod(row.period_start, group), 0, 0);
      ctx.restore();
    });
    ctx.fillStyle = "rgba(90, 190, 255, 0.78)";
    ctx.fillRect(pad, 785, 24, 14);
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.font = "22px Arial";
    ctx.fillText(chart.leftLabel, pad + 36, 800);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(pad + 360, 785, 24, 14);
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fillText(chart.rightLabel, pad + 396, 800);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `wykres-${safeFilename(chart.id)}-${safeFilename(group)}.jpg`);
    }, "image/jpeg", 0.92);
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseIsoDate(value) {
    const raw = String(value || "").slice(0, 10);
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function dateLabel(value) {
    if (!value) return "Wybierz datę";
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(value);
    const [y, m, d] = parts;
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }

  function groupLabel(group) {
    return ({ days: "dni", weeks: "tygodnie", months: "miesiące", quarters: "kwartały", years: "lata" })[group] || group;
  }

  function isoFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function startOfBucket(date, group) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (group === "weeks") {
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return d;
    }
    if (group === "months") return new Date(d.getFullYear(), d.getMonth(), 1);
    if (group === "quarters") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    if (group === "years") return new Date(d.getFullYear(), 0, 1);
    return d;
  }

  function addBucket(date, group, count = 1) {
    const d = new Date(date);
    if (group === "weeks") d.setDate(d.getDate() + 7 * count);
    else if (group === "months") d.setMonth(d.getMonth() + count);
    else if (group === "quarters") d.setMonth(d.getMonth() + 3 * count);
    else if (group === "years") d.setFullYear(d.getFullYear() + count);
    else d.setDate(d.getDate() + count);
    return d;
  }

  function rangeForLast20(group) {
    const today = new Date();
    const end = today;
    const currentBucket = startOfBucket(today, group);
    const start = addBucket(currentBucket, group, -19);
    return { from: iso(start), to: iso(end), group };
  }

  function defaultFilters() {
    return rangeForLast20("days");
  }

  function normalizePeriodStart(value, group) {
    const parsed = parseIsoDate(value);
    if (!parsed) return String(value || "").slice(0, 10);
    return isoFromDate(startOfBucket(parsed, group));
  }

  function bucketEndDate(startDate, group) {
    const next = addBucket(startDate, group, 1);
    next.setDate(next.getDate() - 1);
    return next;
  }

  function fillReportSeries(rows, filters) {
    const group = filters.group || "days";
    const from = parseIsoDate(filters.from);
    if (!from) return rows || [];
    const byPeriod = new Map();
    (rows || []).forEach((row) => {
      const key = normalizePeriodStart(row.period_start, group);
      const existing = byPeriod.get(key) || { period_start: key };
      byPeriod.set(key, {
        period_start: key,
        revenue: Number(existing.revenue || 0) + Number(row.revenue || 0),
        sales_count: Number(existing.sales_count || 0) + Number(row.sales_count || 0),
        service_items: Number(existing.service_items || 0) + Number(row.service_items || 0),
        product_items: Number(existing.product_items || 0) + Number(row.product_items || 0),
        pass_items: Number(existing.pass_items || 0) + Number(row.pass_items || 0),
        finished_visits: Number(existing.finished_visits || 0) + Number(row.finished_visits || 0),
        planned_visits: Number(existing.planned_visits || 0) + Number(row.planned_visits || 0),
        new_clients: Number(existing.new_clients || 0) + Number(row.new_clients || 0),
        total_clients: Math.max(Number(existing.total_clients || 0), Number(row.total_clients || 0))
      });
    });

    const out = [];
    let cursor = startOfBucket(from, group);
    let runningTotal = 0;
    for (let i = 0; i < 20; i++) {
      const key = isoFromDate(cursor);
      const row = byPeriod.get(key) || { period_start: key };
      runningTotal = Math.max(runningTotal, Number(row.total_clients || 0));
      out.push({
        period_start: key,
        revenue: Number(row.revenue || 0),
        sales_count: Number(row.sales_count || 0),
        service_items: Number(row.service_items || 0),
        product_items: Number(row.product_items || 0),
        pass_items: Number(row.pass_items || 0),
        finished_visits: Number(row.finished_visits || 0),
        planned_visits: Number(row.planned_visits || 0),
        new_clients: Number(row.new_clients || 0),
        total_clients: Number(row.total_clients || runningTotal || 0)
      });
      cursor = addBucket(cursor, group, 1);
    }
    return out;
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
      const end = bucketEndDate(date, group);
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

  function renderBars(rows, group, chart) {
    const leftMax = Math.max(1, ...rows.map((row) => Number(row[chart.leftKey] || 0)));
    const rightMax = Math.max(1, ...rows.map((row) => Number(row[chart.rightKey] || 0)));
    return `<div class="cm-supa-chart">
      ${rows.map((row) => {
        const leftValue = Number(row[chart.leftKey] || 0);
        const rightValue = Number(row[chart.rightKey] || 0);
        const leftHeight = Math.max(leftValue ? 8 : 0, Math.round((leftValue / leftMax) * 260));
        const rightHeight = Math.max(rightValue ? 8 : 0, Math.round((rightValue / rightMax) * 260));
        return `<div class="cm-supa-chart-col" title="${esc(formatPeriod(row.period_start, group))} — ${esc(chart.leftLabel)}: ${esc(chart.leftFormat(leftValue))}, ${esc(chart.rightLabel)}: ${esc(chart.rightFormat(rightValue))}">
          <div class="cm-supa-chart-bars">
            <span class="cm-supa-bar ${esc(chart.leftClass)}" style="height:${leftHeight}px"></span>
            <span class="cm-supa-bar ${esc(chart.rightClass)}" style="height:${rightHeight}px"></span>
          </div>
          <small>${esc(formatPeriod(row.period_start, group))}</small>
        </div>`;
      }).join("")}
    </div>`;
  }

  function table(rows, group) {
    const body = rows.length ? rows.map((row) => `<tr>
      <td>${esc(formatPeriod(row.period_start, group))}</td>
      <td>${esc(int(row.new_clients))}</td>
      <td>${esc(int(row.total_clients))}</td>
      <td>${esc(money(row.revenue))}</td>
      <td>${esc(int(row.sales_count))}</td>
      <td>${esc(int(row.service_items))}</td>
      <td>${esc(int(row.product_items))}</td>
      <td>${esc(int(row.pass_items))}</td>
      <td>${esc(int(row.finished_visits))}</td>
      <td>${esc(int(row.planned_visits))}</td>
    </tr>`).join("") : `<tr><td colspan="10">Nie znaleziono żadnych danych</td></tr>`;
    return `<div class="bm-table-wrap"><table class="bm-table cm-supa-report-table">
      <thead><tr><th>Okres</th><th>Zapisało się klientów</th><th>Liczba klientów</th><th>Przychód</th><th>Sprzedaże</th><th>Usługi</th><th>Produkty</th><th>Karnety</th><th>Wizyty zakończone</th><th>Wizyty zaplanowane</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function renderLayout(data, filters) {
    const root = getRoot();
    const summary = data?.summary || {};
    const rows = fillReportSeries(Array.isArray(data?.series) ? data.series : [], filters);
    const group = filters.group || "days";
    const hydratedData = { ...(data || {}), series: rows };
    lastReportPayload = { data: hydratedData, filters: { ...filters, group } };
    const chart = CHARTS[activeChartIndex] || CHARTS[0];

    root.innerHTML = `<section class="bm-page-card cm-report-card cm-supa-reports-module">
      <div class="bm-page-head"><h2>Wykres/Statystyka</h2><div class="bm-actions-row"><button id="cmReportExcelExportBtn" type="button" class="bm-excel-btn">Export - Excel</button><button id="cmReportJpgExportBtn" type="button" class="cm-sales-export-btn">Export - JPG</button></div></div>
      <form class="cm-supa-report-controls cm-reports-polished-controls" id="cmReportsFilters">
        <label class="cm-report-date-field">
          <span>Od</span>
          <div class="cm-report-date-pill">
            <strong data-date-label="from">${esc(dateLabel(filters.from))}</strong>
            <input type="date" name="from" value="${esc(filters.from)}" aria-label="Data od" readonly>
          </div>
        </label>
        <label class="cm-report-date-field">
          <span>Do</span>
          <div class="cm-report-date-pill">
            <strong data-date-label="to">${esc(dateLabel(filters.to))}</strong>
            <input type="date" name="to" value="${esc(filters.to)}" aria-label="Data do" readonly>
          </div>
        </label>
        <label class="cm-report-group-field">
          <span>Grupuj według</span>
          <div class="cm-report-select-pill">
            <select name="group" aria-label="Grupuj według">
              <option value="days" ${group === "days" ? "selected" : ""}>Dni — ostatnie 20 dni</option>
              <option value="weeks" ${group === "weeks" ? "selected" : ""}>Tygodnie — ostatnie 20 tygodni</option>
              <option value="months" ${group === "months" ? "selected" : ""}>Miesiące — ostatnie 20 miesięcy</option>
              <option value="quarters" ${group === "quarters" ? "selected" : ""}>Kwartały — ostatnie 20 kwartałów</option>
              <option value="years" ${group === "years" ? "selected" : ""}>Lata — ostatnie 20 lat</option>
            </select>
          </div>
        </label>
        <div class="cm-report-auto-hint">Zakres: ostatnie 20 × ${esc(groupLabel(group))}, razem z dzisiaj</div>
        <button type="submit" class="btn btn-primary cm-report-show-btn">Pokaż</button>
      </form>
      <div class="cm-report-kpi-grid">
        ${kpiCard("Zapisało się klientów", int(summary.new_clients), "nowi klienci w zakresie")}
        ${kpiCard("Liczba klientów", int(summary.total_clients), "wszyscy klienci firmy")}
        ${kpiCard("Przychód", money(summary.revenue), "paid/partial, bez void")}
        ${kpiCard("Sprzedaże", int(summary.sales_count), "sales")}
        ${kpiCard("Usługi", `${int(summary.service_items)} / ${money(summary.service_revenue)}`, "sale_items service")}
        ${kpiCard("Produkty", `${int(summary.product_items)} / ${money(summary.product_revenue)}`, "sale_items product")}
        ${kpiCard("Karnety", `${int(summary.pass_items)} / ${money(summary.pass_revenue)}`, "sprzedaż karnetów")}
        ${kpiCard("Wizyty", int(summary.finished_visits), "zakończone")}
      </div>
      <div class="cm-report-chart-head">
        <button id="cmReportChartPrev" type="button" class="cm-report-chart-arrow" aria-label="Poprzedni wykres">‹</button>
        <div><strong>${esc(chart.title)}</strong><small>${esc(chart.subtitle)}</small></div>
        <button id="cmReportChartNext" type="button" class="cm-report-chart-arrow" aria-label="Następny wykres">›</button>
      </div>
      <div class="cm-supa-chart-legend"><span><i class="${esc(chart.leftClass)}"></i>${esc(chart.leftLabel)}</span><span><i class="${esc(chart.rightClass)}"></i>${esc(chart.rightLabel)}</span></div>
      ${renderBars(rows, group, chart)}
      <div class="cm-report-table">${table(rows, group)}</div>
    </section>`;

    $("#cmReportExcelExportBtn")?.addEventListener("click", exportStatsExcel);
    $("#cmReportJpgExportBtn")?.addEventListener("click", exportChartJpg);
    $("#cmReportChartPrev")?.addEventListener("click", () => {
      activeChartIndex = (activeChartIndex - 1 + CHARTS.length) % CHARTS.length;
      renderLayout(data, filters);
    });
    $("#cmReportChartNext")?.addEventListener("click", () => {
      activeChartIndex = (activeChartIndex + 1) % CHARTS.length;
      renderLayout(data, filters);
    });
    $("#cmReportsFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const next = rangeForLast20(form.group.value || "days");
      loadAndRender(next);
    });

    window.cmReinitDatePickers?.();
    window.cmReinitCalendarInputs?.();
  }

  function renderError(message) {
    getRoot().innerHTML = `<section class="bm-page-card"><div class="bm-page-head"><h2>Wykres/Statystyka</h2></div><div class="bm-empty-state">Błąd statystyk: ${esc(message)}</div></section>`;
  }

  async function loadAndRender(overrides = {}) {
    const base = overrides.group ? rangeForLast20(overrides.group) : defaultFilters();
    const filters = {
      from: overrides.from || base.from,
      to: overrides.to || base.to,
      group: overrides.group || base.group || "days"
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
    setTimeout(() => loadAndRender(defaultFilters()), 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
