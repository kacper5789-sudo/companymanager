// CompanyManager — 048C Raport z okresu Supabase — filtr pracowników + szybkie zakresy
// period-report.html: realne dane z sales / sale_items / payments / appointments / clients / profiles.
(function () {
  if (document.body?.dataset?.panelPage !== "periodReport") return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => new Date();

  function parseLocalDate(value) {
    const raw = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function defaultRange() {
    const now = today();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }

  function normalizeRange(fromValue, toValue) {
    const def = defaultRange();
    let from = parseLocalDate(fromValue) || def.from;
    let to = parseLocalDate(toValue) || def.to;
    if (from > to) [from, to] = [to, from];
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
    const endExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0);
    return { from, to, startIso: start.toISOString(), endIso: endExclusive.toISOString(), fromIso: isoDate(from), toIso: isoDate(to) };
  }

  function displayRange(range) {
    return `${pad(range.from.getDate())}.${pad(range.from.getMonth() + 1)}.${range.from.getFullYear()} – ${pad(range.to.getDate())}.${pad(range.to.getMonth() + 1)}.${range.to.getFullYear()}`;
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
    if (!hasAnyPermission(ctx, ["open_period_report", "open_stats", "daily_report_other_days", "period_report_access"])) {
      return { ok: false, message: "Brak uprawnienia do raportu z okresu." };
    }
    return ctx;
  }

  function panelArea() {
    return $(".bm-panel-area") || $("#dashboardRoot") || document.body;
  }

  function renderError(message) {
    panelArea().innerHTML = `<section class="bm-page-card cm-period-supa"><div class="bm-page-head"><h2>Raport z okresu</h2></div><p class="panel-message error">Błąd raportu z okresu: ${esc(message)}</p></section>`;
  }

  function setupStyles() {
    if (document.getElementById("cm-period-supabase-style")) return;
    const style = document.createElement("style");
    style.id = "cm-period-supabase-style";
    style.textContent = `
      .cm-period-supa{max-width:1380px;margin:0 auto;padding:22px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(15,23,42,.76),rgba(2,6,23,.48));border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.22);}
      .cm-period-supa .bm-page-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px;}
      .cm-period-supa .bm-page-head h2{margin:0;color:#fff;letter-spacing:-.03em;}
      .cm-period-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:end;margin-bottom:18px;padding:14px;border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(2,6,23,.34);}
      .cm-period-filters label{display:flex;flex-direction:column;gap:6px;color:rgba(226,232,240,.72);font-weight:800;font-size:12px;}
      .cm-period-input,.cm-period-select{height:42px;border:1px solid rgba(148,163,184,.22);border-radius:13px;background:rgba(2,6,23,.62);color:#e5eefb;font:inherit;font-weight:800;padding:0 12px;outline:none;color-scheme:dark;}
      .cm-period-input:focus,.cm-period-select:focus{border-color:rgba(56,189,248,.72);box-shadow:0 0 0 3px rgba(56,189,248,.12);}
      .cm-period-actions{display:flex;gap:10px;justify-content:flex-end;align-items:center;}
      .cm-period-btn{height:42px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(255,255,255,.075);color:#f8fafc;font-weight:900;padding:0 16px;cursor:pointer;box-shadow:0 14px 38px rgba(0,0,0,.14);backdrop-filter:blur(12px);}
      .cm-period-btn:hover{background:rgba(59,130,246,.18);border-color:rgba(125,211,252,.44);}
      .cm-period-export{background:linear-gradient(180deg,rgba(34,197,94,.32),rgba(21,128,61,.16));}
      .cm-period-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;}
      .cm-period-kpi{border:1px solid rgba(148,163,184,.14);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));padding:15px;min-height:86px;}
      .cm-period-kpi span{display:block;color:rgba(226,232,240,.65);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;}
      .cm-period-kpi b{display:block;color:#fff;font-size:25px;line-height:1.15;margin-top:8px;}
      .cm-period-grid{display:grid;grid-template-columns:1fr;gap:16px;}
      .cm-period-section{border:1px solid rgba(148,163,184,.14);border-radius:20px;background:rgba(2,6,23,.28);padding:14px;overflow:hidden;}
      .cm-period-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px;}
      .cm-period-section h3{margin:0;color:#f8fafc;font-size:17px;letter-spacing:-.02em;}
      .cm-period-section p{margin:4px 0 0;color:rgba(226,232,240,.68);font-size:13px;}
      .cm-period-dt{border:1px solid rgba(148,163,184,.12);border-radius:16px;background:rgba(2,6,23,.28);padding:12px;overflow:hidden;}
      .cm-period-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
      .cm-period-tools label{display:flex;align-items:center;gap:8px;color:rgba(226,232,240,.7);font-size:13px;font-weight:800;}
      .cm-period-page-size,.cm-period-search{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(2,6,23,.62);color:#e5eefb;font:inherit;outline:none;color-scheme:dark;}
      .cm-period-page-size{min-width:84px;padding:0 10px;font-weight:900;}
      .cm-period-search{min-width:220px;padding:0 12px;}
      .cm-period-table-wrap{overflow-x:auto;border-radius:14px;border:1px solid rgba(148,163,184,.10);}
      .cm-period-table{width:100%;min-width:780px;border-collapse:separate;border-spacing:0;table-layout:fixed;}
      .cm-period-table th,.cm-period-table td{padding:10px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,.075);vertical-align:middle;line-height:1.22;}
      .cm-period-table th{font-size:11px;color:rgba(219,234,254,.84);font-weight:900;background:rgba(37,99,235,.12);text-transform:uppercase;letter-spacing:.045em;white-space:normal;}
      .cm-period-table td{font-size:13px;color:rgba(255,255,255,.88);}
      .cm-period-table td:first-child,.cm-period-table th:first-child{text-align:left;width:26%;}
      .cm-period-table tbody tr:hover td{background:rgba(56,189,248,.055);}
      .cm-period-table tfoot td{font-weight:900;background:rgba(255,255,255,.055);color:#fff;border-bottom:0;}
      .cm-period-pager{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px;color:rgba(226,232,240,.62);font-size:12px;}
      .cm-period-pager-controls{display:flex;align-items:center;gap:8px;}
      .cm-period-pager button{min-width:34px;height:32px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(255,255,255,.055);color:#e5eefb;font-weight:900;cursor:pointer;}
      .cm-period-pager button:disabled{opacity:.42;cursor:not-allowed;}
      .cm-period-pager b{min-width:54px;text-align:center;color:#dbeafe;}
      .cm-period-employee-filter{margin:10px 0 14px;padding:12px;border:1px solid rgba(148,163,184,.12);border-radius:16px;background:rgba(2,6,23,.28);display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;}
      .cm-period-employee-filter-title{width:100%;font-size:12px;font-weight:900;color:rgba(219,234,254,.78);letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px;}
      .cm-period-employee-pill{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:7px 10px;border:1px solid rgba(148,163,184,.16);border-radius:999px;background:rgba(255,255,255,.055);color:#e5eefb;font-size:12px;font-weight:900;cursor:pointer;user-select:none;}
      .cm-period-employee-pill input{accent-color:#60a5fa;cursor:pointer;}
      .cm-period-employee-pill:hover{background:rgba(59,130,246,.14);border-color:rgba(125,211,252,.34);}
      .cm-period-table tr[data-period-employee-row][hidden]{display:none!important;}
      @media(max-width:1000px){.cm-period-filters{grid-template-columns:1fr 1fr}.cm-period-kpis{grid-template-columns:1fr 1fr}.cm-period-actions{grid-column:1/-1;justify-content:flex-start}.cm-period-tools{align-items:stretch}.cm-period-tools label{width:100%}.cm-period-search{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function table(headers, rows, footer = null) {
    const bodyRows = rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")
      : `<tr data-empty-row="1"><td colspan="${headers.length}">Brak danych</td></tr>`;
    const footerHtml = footer && footer.length ? `<tfoot><tr>${footer.map(cell => `<td>${cell}</td>`).join("")}</tr></tfoot>` : "";
    return `
      <div class="cm-period-dt" data-period-table="1">
        <div class="cm-period-tools">
          <label><select class="cm-period-page-size" data-page-size><option value="50">50</option><option value="100">100</option><option value="200">200</option></select> ▾</label>
          <label>Szukaj:<input class="cm-period-search" type="search" data-table-search placeholder="Szukaj"></label>
        </div>
        <div class="cm-period-table-wrap">
          <table class="cm-period-table">
            <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
            <tbody>${bodyRows}</tbody>
            ${footerHtml}
          </table>
        </div>
        <div class="cm-period-pager">
          <span data-table-info>Pozycje od 0 do 0 z 0 łącznie</span>
          <div class="cm-period-pager-controls"><button type="button" data-page-prev>‹</button><b data-table-page>1 z 1</b><button type="button" data-page-next>›</button></div>
        </div>
      </div>`;
  }


  function employeeKey(value) {
    return String(value || '(brak)')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brak';
  }

  function employeeReportSection(rows) {
    const sorted = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pl'));
    const filters = sorted.map((r) => {
      const key = employeeKey(r.name);
      return `<label class="cm-period-employee-pill"><input type="checkbox" data-period-employee-check value="${esc(key)}" checked> ${esc(r.name)}</label>`;
    }).join('');
    const bodyRows = sorted.length
      ? sorted.map((r) => {
          const key = employeeKey(r.name);
          return `<tr data-period-employee-row="1" data-employee-key="${esc(key)}" data-visits="${Number(r.visits||0)}" data-sales="${Number(r.sales||0)}" data-revenue="${Number(r.revenue||0)}" data-services="${Number(r.services||0)}" data-service-value="${Number(r.serviceValue||0)}" data-products="${Number(r.products||0)}" data-product-value="${Number(r.productValue||0)}" data-passes="${Number(r.passes||0)}" data-pass-value="${Number(r.passValue||0)}"><td>${esc(r.name)}</td><td>${Number(r.visits||0)}</td><td>${Number(r.sales||0)}</td><td>${money(r.revenue)}</td><td>${Number(r.services||0)}</td><td>${money(r.serviceValue)}</td><td>${Number(r.products||0)}</td><td>${money(r.productValue)}</td><td>${Number(r.passes||0)}</td><td>${money(r.passValue)}</td></tr>`;
        }).join('')
      : `<tr data-empty-row="1"><td colspan="10">Brak danych</td></tr>`;
    return `
      <div class="cm-period-employee-filter" data-period-employee-filter>
        <div class="cm-period-employee-filter-title">Pracownicy</div>
        <label class="cm-period-employee-pill"><input type="checkbox" data-period-employee-all checked> Zaznacz wszystkich</label>
        ${filters}
      </div>
      <div class="cm-period-dt" data-period-table="1" data-period-employee-table="1">
        <div class="cm-period-tools">
          <label><select class="cm-period-page-size" data-page-size><option value="50">50</option><option value="100">100</option><option value="200">200</option></select> ▾</label>
          <label>Szukaj:<input class="cm-period-search" type="search" data-table-search placeholder="Szukaj"></label>
        </div>
        <div class="cm-period-table-wrap">
          <table class="cm-period-table">
            <thead><tr><th>Pracownik</th><th>Wizyty</th><th>Sprzedaże</th><th>Przychód</th><th>Usługi</th><th>Wartość usług</th><th>Produkty</th><th>Wartość produktów</th><th>Karnety</th><th>Wartość karnetów</th></tr></thead>
            <tbody>${bodyRows}</tbody>
            <tfoot><tr><td><b>SUMA</b></td><td data-emp-total="visits"><b>0</b></td><td data-emp-total="sales"><b>0</b></td><td data-emp-total="revenue"><b>0.00 PLN</b></td><td data-emp-total="services"><b>0</b></td><td data-emp-total="serviceValue"><b>0.00 PLN</b></td><td data-emp-total="products"><b>0</b></td><td data-emp-total="productValue"><b>0.00 PLN</b></td><td data-emp-total="passes"><b>0</b></td><td data-emp-total="passValue"><b>0.00 PLN</b></td></tr></tfoot>
          </table>
        </div>
        <div class="cm-period-pager">
          <span data-table-info>Pozycje od 0 do 0 z 0 łącznie</span>
          <div class="cm-period-pager-controls"><button type="button" data-page-prev>‹</button><b data-table-page>1 z 1</b><button type="button" data-page-next>›</button></div>
        </div>
      </div>`;
  }

  function setupEmployeeFilter(root = document) {
    const filter = $('[data-period-employee-filter]', root);
    const tableBox = $('[data-period-employee-table]', root);
    if (!filter || !tableBox || filter.dataset.ready === '1') return;
    filter.dataset.ready = '1';
    const all = $('[data-period-employee-all]', filter);
    const checks = $$('[data-period-employee-check]', filter);
    const rows = $$('[data-period-employee-row]', tableBox);
    const totals = {
      visits: $('[data-emp-total="visits"]', tableBox),
      sales: $('[data-emp-total="sales"]', tableBox),
      revenue: $('[data-emp-total="revenue"]', tableBox),
      services: $('[data-emp-total="services"]', tableBox),
      serviceValue: $('[data-emp-total="serviceValue"]', tableBox),
      products: $('[data-emp-total="products"]', tableBox),
      productValue: $('[data-emp-total="productValue"]', tableBox),
      passes: $('[data-emp-total="passes"]', tableBox),
      passValue: $('[data-emp-total="passValue"]', tableBox)
    };
    const setTotal = (key, value, isMoney = false) => { if (totals[key]) totals[key].innerHTML = `<b>${isMoney ? money(value) : String(value)}</b>`; };
    function selectedKeys() { return new Set(checks.filter(ch => ch.checked).map(ch => ch.value)); }
    function updateTotals() {
      const sums = { visits:0, sales:0, revenue:0, services:0, serviceValue:0, products:0, productValue:0, passes:0, passValue:0 };
      rows.forEach(row => {
        if (row.hidden) return;
        sums.visits += Number(row.dataset.visits || 0);
        sums.sales += Number(row.dataset.sales || 0);
        sums.revenue += Number(row.dataset.revenue || 0);
        sums.services += Number(row.dataset.services || 0);
        sums.serviceValue += Number(row.dataset.serviceValue || 0);
        sums.products += Number(row.dataset.products || 0);
        sums.productValue += Number(row.dataset.productValue || 0);
        sums.passes += Number(row.dataset.passes || 0);
        sums.passValue += Number(row.dataset.passValue || 0);
      });
      setTotal('visits', sums.visits); setTotal('sales', sums.sales); setTotal('revenue', sums.revenue, true);
      setTotal('services', sums.services); setTotal('serviceValue', sums.serviceValue, true);
      setTotal('products', sums.products); setTotal('productValue', sums.productValue, true);
      setTotal('passes', sums.passes); setTotal('passValue', sums.passValue, true);
    }
    function applyFilter() {
      const keys = selectedKeys();
      rows.forEach(row => { row.dataset.employeeFilterHidden = keys.has(row.dataset.employeeKey) ? '0' : '1'; });
      tableBox.dataset.employeeFilterVersion = String(Date.now());
      tableBox.dispatchEvent(new CustomEvent('cm:employee-filter-changed'));
      if (all) all.checked = checks.length > 0 && checks.every(ch => ch.checked);
      updateTotals();
    }
    all?.addEventListener('change', () => {
      checks.forEach(ch => { ch.checked = Boolean(all.checked); });
      applyFilter();
    });
    checks.forEach(ch => ch.addEventListener('change', applyFilter));
    applyFilter();
  }

  function setupTables(root = document) {
    $$('[data-period-table]', root).forEach((box) => {
      if (box.dataset.ready === '1') return;
      box.dataset.ready = '1';
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
        return rows.filter(row => {
          if (row.dataset.employeeFilterHidden === '1') return false;
          return !q || row.textContent.toLowerCase().includes(q);
        });
      }
      function render() {
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
      search?.addEventListener('input', () => { page = 1; render(); });
      pageSize?.addEventListener('change', () => { page = 1; render(); });
      prev?.addEventListener('click', () => { page -= 1; render(); });
      next?.addEventListener('click', () => { page += 1; render(); });
      box.addEventListener('cm:employee-filter-changed', () => { page = 1; render(); });
      render();
    });
  }

  function saleValue(sale) { return Number(sale.total_gross ?? sale.total_net ?? 0) || 0; }
  function itemValue(item, saleMap) {
    const sale = saleMap.get(item.sale_id) || {};
    return Number(item.total ?? item.total_price ?? 0) || (Number(item.quantity || 1) * Number(item.unit_price || 0)) || saleValue(sale);
  }
  function itemQty(item) { return Number(item.quantity || 1) || 1; }
  function normalizeItemType(value) {
    const v = String(value || "").toLowerCase();
    if (v.includes("product")) return "product";
    if (v.includes("pass") || v.includes("karnet")) return "pass";
    return "service";
  }
  function clientName(row) { return [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() || "(brak)"; }
  function employeeName(row, fallback = "") {
    return row?.full_name || row?.fullName || row?.name || row?.email || fallback || "(brak)";
  }
  function nameKey(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }
  function createEmployeeResolver(employees) {
    const byId = new Map((employees || []).filter(e => e?.id).map(e => [e.id, e]));
    const byName = new Map();
    (employees || []).forEach(e => {
      const nm = nameKey(employeeName(e, ""));
      if (nm && nm !== "(brak)" && !byName.has(nm)) byName.set(nm, e);
    });
    const resolve = (id, ...fallbacks) => {
      if (id && byId.has(id)) {
        const e = byId.get(id);
        return { key: `id:${e.id}`, id: e.id, name: employeeName(e) };
      }
      for (const fallback of fallbacks) {
        const nm = String(fallback || "").trim();
        const nk = nameKey(nm);
        if (!nk || nk === "(brak)") continue;
        const e = byName.get(nk);
        if (e) return { key: `id:${e.id}`, id: e.id, name: employeeName(e) };
        return { key: `name:${nk}`, id: "", name: nm };
      }
      return { key: "missing", id: "", name: "(brak)" };
    };
    return { byId, resolve };
  }
  function appointmentDate(row) { return row?.appointment_datetime || row?.starts_at || row?.date || row?.created_at; }
  function isFinished(row) { const s = String(row?.status || "").toLowerCase(); return row?.finished === true || ["zakończone", "zakończona", "completed"].includes(s); }
  function isCancelled(row) { const s = String(row?.status || "").toLowerCase(); return ["odwołane", "odwołana", "cancelled", "usunięte", "deleted"].includes(s); }

  async function fetchPeriodData(ctx, range) {
    const sb = window.cmSupabase;
    const [salesRes, paymentsRes, appointmentsRes, clientsRes, employeesRes] = await Promise.all([
      sb.from("sales").select("id,company_id,client_id,employee_id,employee_name,appointment_id,total_gross,total_net,payment_status,payment_method,status,created_at,updated_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("payments").select("id,company_id,sale_id,appointment_id,amount,method,status,paid_at,created_at").eq("company_id", ctx.companyId).gte("created_at", range.startIso).lt("created_at", range.endIso),
      sb.from("appointments").select("id,company_id,client_id,client_name,employee_id,employee_name,service_id,service_name,product_id,product_name,total,price,paid_amount,payment_status,payment_method,status,finished,date,starts_at,appointment_datetime,created_at").eq("company_id", ctx.companyId).gte("date", range.fromIso).lte("date", range.toIso),
      sb.from("clients").select("id,first_name,last_name,created_at,company_id").eq("company_id", ctx.companyId).lte("created_at", range.endIso),
      sb.from("profiles").select("id,full_name,email,role,company_id").eq("company_id", ctx.companyId)
    ]);
    const errors = [salesRes.error, paymentsRes.error, appointmentsRes.error, clientsRes.error, employeesRes.error].filter(Boolean);
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
      const itemsRes = await sb.from("sale_items").select("id,company_id,sale_id,item_type,service_id,product_id,name,name_snapshot,quantity,unit_price,total,total_price,created_at").in("sale_id", saleIds);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      saleItems = itemsRes.data || [];
    }
    const activeSaleIds = new Set(sales.map(s => s.id).filter(Boolean));
    const payments = (paymentsRes.data || []).filter(p => {
      if (String(p.status || "").toLowerCase() === "void") return false;
      if (p.sale_id && !activeSaleIds.has(p.sale_id)) return false;
      return true;
    });
    return {
      sales,
      payments,
      appointments: appointmentsRes.data || [],
      clients: clientsRes.data || [],
      employees: employeesRes.data || [],
      saleItems
    };
  }

  function buildReport(data, range) {
    const saleMap = new Map(data.sales.map(s => [s.id, s]));
    const employeeResolver = createEmployeeResolver(data.employees || []);
    const employeeMap = employeeResolver.byId;
    const appointmentById = new Map((data.appointments || []).map(a => [a.id, a]));
    const clientMap = new Map(data.clients.map(c => [c.id, c]));
    const items = data.saleItems.map(item => ({ ...item, sale: saleMap.get(item.sale_id) || {} }));
    const services = items.filter(i => normalizeItemType(i.item_type) === 'service');
    const products = items.filter(i => normalizeItemType(i.item_type) === 'product');
    const passes = items.filter(i => normalizeItemType(i.item_type) === 'pass');
    const revenue = data.sales.reduce((sum, sale) => sum + saleValue(sale), 0);
    const finished = data.appointments.filter(isFinished);
    const planned = data.appointments.filter(a => !isCancelled(a) && !isFinished(a));
    const cancelled = data.appointments.filter(isCancelled);
    const newClients = data.clients.filter(c => {
      const d = c.created_at ? new Date(c.created_at) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      return d >= new Date(range.startIso) && d < new Date(range.endIso);
    });

    const groupItems = (source) => {
      const map = new Map();
      source.forEach(item => {
        const name = item.name_snapshot || item.name || (normalizeItemType(item.item_type) === 'pass' ? 'Karnet' : 'Pozycja');
        if (!map.has(name)) map.set(name, { name, qty: 0, value: 0 });
        const row = map.get(name);
        row.qty += itemQty(item);
        row.value += itemValue(item, saleMap);
      });
      return Array.from(map.values()).sort((a, b) => b.value - a.value);
    };

    const paymentMap = new Map();
    data.payments.forEach(p => {
      const method = p.method || 'brak';
      if (!paymentMap.has(method)) paymentMap.set(method, { method, qty: 0, value: 0 });
      paymentMap.get(method).qty += 1;
      paymentMap.get(method).value += Number(p.amount || 0);
    });

    const employeeRowsMap = new Map();
    function ensureEmployee(id, ...fallbacks) {
      const resolved = employeeResolver.resolve(id, ...fallbacks);
      if (!employeeRowsMap.has(resolved.key)) {
        employeeRowsMap.set(resolved.key, { name: resolved.name, visits: 0, services: 0, serviceValue: 0, products: 0, productValue: 0, passes: 0, passValue: 0, sales: 0, revenue: 0 });
      }
      return employeeRowsMap.get(resolved.key);
    }
    data.appointments.forEach(a => {
      const row = ensureEmployee(a.employee_id, a.employee_name);
      row.visits += 1;
    });
    data.sales.forEach(s => {
      const appointment = appointmentById.get(s.appointment_id) || {};
      const row = ensureEmployee(s.employee_id || appointment.employee_id, s.employee_name, appointment.employee_name);
      row.sales += 1;
      row.revenue += saleValue(s);
    });
    items.forEach(item => {
      const sale = item.sale || {};
      const appointment = appointmentById.get(sale.appointment_id) || {};
      const row = ensureEmployee(sale.employee_id || appointment.employee_id, sale.employee_name, appointment.employee_name);
      const type = normalizeItemType(item.item_type);
      const qty = itemQty(item);
      const value = itemValue(item, saleMap);
      if (type === 'service') { row.services += qty; row.serviceValue += value; }
      else if (type === 'product') { row.products += qty; row.productValue += value; }
      else { row.passes += qty; row.passValue += value; }
    });

    const groupedServices = groupItems(services);
    const groupedProducts = groupItems(products);
    const groupedPasses = groupItems(passes);
    const salesItemsCount = [...groupedServices, ...groupedProducts, ...groupedPasses]
      .reduce((sum, row) => sum + Number(row.qty || 0), 0);

    return {
      kpis: { revenue, sales: data.sales.length, newClients: newClients.length, finished: finished.length, planned: planned.length, cancelled: cancelled.length, salesItems: salesItemsCount },
      services: groupedServices,
      products: groupedProducts,
      passes: groupedPasses,
      payments: Array.from(paymentMap.values()).sort((a, b) => b.value - a.value),
      employees: Array.from(employeeRowsMap.values()).filter((r) => String(r.name || "").trim() !== "(brak)").sort((a, b) => b.revenue - a.revenue)
    };
  }

  function rowsForItems(items) {
    return items.map(r => [esc(r.name), String(r.qty), money(r.value)]);
  }
  function footerForItems(label, items) {
    return [`<b>${esc(label)}</b>`, `<b>${items.reduce((s, r) => s + Number(r.qty || 0), 0)}</b>`, `<b>${money(items.reduce((s, r) => s + Number(r.value || 0), 0))}</b>`];
  }

  function renderReport(ctx, data, range) {
    const report = buildReport(data, range);
    const content = `
      <section class="bm-page-card cm-period-supa">
        <div class="bm-page-head"><h2>Raport z okresu</h2><div class="cm-period-actions"><button type="button" class="cm-period-btn cm-period-export" id="periodExportExcel">Export - Excel</button></div></div>
        <div class="cm-period-filters">
          <label>Od<input class="cm-period-input" id="periodFrom" type="date" value="${range.fromIso}"></label>
          <label>Do<input class="cm-period-input" id="periodTo" type="date" value="${range.toIso}"></label>
          <label>Zakres<select class="cm-period-select" id="periodPreset"><option value="custom">Własny zakres</option><option value="today">Dzisiaj</option><option value="week">Tydzień</option><option value="twoWeeks">2 tygodnie</option><option value="month">Miesiąc</option><option value="twoMonths">2 miesiące</option><option value="quarter">Kwartał</option><option value="sixMonths">6 miesięcy</option><option value="twelveMonths">12 miesięcy</option><option value="eighteenMonths">18 miesięcy</option><option value="twentyFourMonths">24 miesiące</option><option value="thirtySixMonths">36 miesięcy</option></select></label>
          <div class="cm-period-actions"><button type="button" class="cm-period-btn" id="periodShowBtn">Pokaż</button></div>
        </div>
        <div class="cm-period-kpis">
          <div class="cm-period-kpi"><span>Okres</span><b>${esc(displayRange(range))}</b></div>
          <div class="cm-period-kpi"><span>Przychód</span><b>${money(report.kpis.revenue)}</b></div>
          <div class="cm-period-kpi"><span>Sprzedaże</span><b>${report.kpis.sales}</b></div>
          <div class="cm-period-kpi"><span>Nowi klienci</span><b>${report.kpis.newClients}</b></div>
          <div class="cm-period-kpi"><span>Wizyty zakończone</span><b>${report.kpis.finished}</b></div>
          <div class="cm-period-kpi"><span>Wizyty zaplanowane</span><b>${report.kpis.planned}</b></div>
          <div class="cm-period-kpi"><span>Wizyty odwołane</span><b>${report.kpis.cancelled}</b></div>
          <div class="cm-period-kpi"><span>Pozycje sprzedaży</span><b>${report.kpis.salesItems}</b></div>
        </div>
        <div class="cm-period-grid">
          <section class="cm-period-section"><div class="cm-period-section-head"><div><h3>Usługi</h3><p>Sprzedane usługi w okresie: <b>${report.services.reduce((s,r)=>s+Number(r.qty||0),0)}</b></p></div></div>${table(['Nazwa usługi','L.szt.','Wartość PLN'], rowsForItems(report.services), footerForItems('SUMA', report.services))}</section>
          <section class="cm-period-section"><div class="cm-period-section-head"><div><h3>Produkty</h3><p>Sprzedane produkty w okresie: <b>${report.products.reduce((s,r)=>s+Number(r.qty||0),0)}</b></p></div></div>${table(['Nazwa produktu','L.szt.','Wartość PLN'], rowsForItems(report.products), footerForItems('SUMA', report.products))}</section>
          <section class="cm-period-section"><div class="cm-period-section-head"><div><h3>Karnety</h3><p>Sprzedane karnety w okresie: <b>${report.passes.reduce((s,r)=>s+Number(r.qty||0),0)}</b></p></div></div>${table(['Nazwa karnetu','L.szt.','Wartość PLN'], rowsForItems(report.passes), footerForItems('SUMA', report.passes))}</section>
          <section class="cm-period-section"><div class="cm-period-section-head"><div><h3>Płatności</h3><p>Metody płatności w wybranym okresie</p></div></div>${table(['Płatność','Liczba','Wartość PLN'], report.payments.map(r => [esc(r.method), String(r.qty), money(r.value)]), ['<b>SUMA</b>', `<b>${report.payments.reduce((s,r)=>s+r.qty,0)}</b>`, `<b>${money(report.payments.reduce((s,r)=>s+r.value,0))}</b>`])}</section>
          <section class="cm-period-section"><div class="cm-period-section-head"><div><h3>Pracownicy</h3><p>Podsumowanie sprzedaży i wizyt</p></div></div>${employeeReportSection(report.employees)}</section>
        </div>
      </section>`;
    panelArea().innerHTML = content;
    setupEmployeeFilter(panelArea());
    setupTables(panelArea());
    bindControls(ctx);
  }

  function currentRangeFromInputs() {
    return normalizeRange($("#periodFrom")?.value, $("#periodTo")?.value);
  }

  async function reload(ctx, range) {
    panelArea().innerHTML = `<section class="bm-page-card cm-period-supa"><div class="bm-page-head"><h2>Raport z okresu</h2></div><p class="panel-message">Ładowanie raportu...</p></section>`;
    try {
      const data = await fetchPeriodData(ctx, range);
      renderReport(ctx, data, range);
    } catch (error) {
      console.error('Period report Supabase error', error);
      renderError(error.message || String(error));
    }
  }

  function addDays(date, days) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  }

  function addMonths(date, months) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const wantedDay = d.getDate();
    d.setMonth(d.getMonth() + Number(months || 0));
    if (d.getDate() !== wantedDay) d.setDate(0);
    return d;
  }

  function presetRange(value) {
    const now = today();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (value === "today") return { from: to, to };
    if (value === "week") return { from: addDays(to, -6), to };
    if (value === "twoWeeks") return { from: addDays(to, -13), to };
    if (value === "month") return { from: addMonths(to, -1), to };
    if (value === "twoMonths") return { from: addMonths(to, -2), to };
    if (value === "quarter") return { from: addMonths(to, -3), to };
    if (value === "sixMonths") return { from: addMonths(to, -6), to };
    if (value === "twelveMonths") return { from: addMonths(to, -12), to };
    if (value === "eighteenMonths") return { from: addMonths(to, -18), to };
    if (value === "twentyFourMonths") return { from: addMonths(to, -24), to };
    if (value === "thirtySixMonths") return { from: addMonths(to, -36), to };
    return null;
  }

  function bindControls(ctx) {
    $("#periodShowBtn")?.addEventListener("click", () => reload(ctx, currentRangeFromInputs()));
    $("#periodPreset")?.addEventListener("change", (event) => {
      const picked = presetRange(event.target.value);
      if (!picked) return;
      $("#periodFrom").value = isoDate(picked.from);
      $("#periodTo").value = isoDate(picked.to);
      reload(ctx, normalizeRange(isoDate(picked.from), isoDate(picked.to)));
    });
    $("#periodExportExcel")?.addEventListener("click", exportTables);
  }

  function exportTables() {
    const rows = [];
    rows.push(['Raport z okresu']);
    $$(".cm-period-section").forEach(section => {
      const title = section.querySelector('h3')?.textContent?.trim() || '';
      rows.push([]); rows.push([title]);
      const tableEl = section.querySelector('table');
      if (!tableEl) return;
      $$('tr', tableEl).forEach(tr => rows.push($$('th,td', tr).map(td => td.textContent.trim())));
    });
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raport-z-okresu-${isoDate(today())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function init() {
    setupStyles();
    const ctx = await getContext();
    if (!ctx.ok) { renderError(ctx.message); return; }
    await reload(ctx, normalizeRange());
  }

  function boot() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (window.cmSupabase && ($(".bm-panel-area") || attempts > 20)) {
        clearInterval(timer);
        init().catch(error => renderError(error.message || String(error)));
      }
    }, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
