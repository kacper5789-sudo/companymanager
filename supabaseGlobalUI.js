/* CompanyManager 057 — global UI + left date frame polish */
(function(){
  'use strict';
  const VERSION = '057';
  const pad = (n) => String(n).padStart(2,'0');
  const parseIso = (value) => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const formatDate = (value) => {
    const d = parseIso(value);
    if (!d) return value || 'Wybierz datę';
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
  };
  function enhanceDateInput(input){
    if (!input || input.dataset.cmDateUi === VERSION || input.closest('.cm-unified-date')) return;
    if (input.type !== 'date') return;
    input.dataset.cmDateUi = VERSION;
    const shell = document.createElement('span');
    shell.className = 'cm-unified-date';
    if (input.disabled || input.readOnly) shell.classList.add('is-disabled');
    const text = document.createElement('strong');
    text.className = 'cm-unified-date-text';
    const update = () => { text.textContent = formatDate(input.value); };
    update();
    const parent = input.parentNode;
    parent.insertBefore(shell, input);
    shell.appendChild(text);
    shell.appendChild(input);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    shell.addEventListener('click', (event) => {
      if (input.disabled || input.readOnly) return;
      if (event.target === input) return;
      try { if (typeof input.showPicker === 'function') input.showPicker(); else input.focus(); }
      catch(_) { input.focus(); }
    });
  }
  function enhanceDateInputs(root=document){
    root.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
  }
  function normalizeTables(root=document){
    root.querySelectorAll('table').forEach((table) => {
      if (table.closest('.bm-month')) return;
      if (table.classList.contains('cm-ui-normalized')) return;
      table.classList.add('cm-ui-normalized');
      if (!table.closest('.cm-unified-table-wrap') && !table.closest('.table-wrap') && !table.closest('.bm-table-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'cm-unified-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }
  function normalizeButtons(root=document){
    root.querySelectorAll('button, .btn, a.button, input[type="button"], input[type="submit"]').forEach((el) => {
      if (el.closest('.bm-month')) return;
      el.classList.add('cm-unified-action');
      const text = (el.textContent || el.value || '').toLowerCase();
      if (/usuń|usun|delete|blokuj|anuluj|sprzedaj/.test(text)) el.classList.add('cm-danger-action');
      else if (/edytuj|edit/.test(text)) el.classList.add('cm-edit-action');
      else if (/pobierz|export|excel|jpg|drukuj/.test(text)) el.classList.add('cm-export-action');
      else if (/zapisz|dodaj|pokaż|pokaz|zatwierdź|zatwierdz/.test(text)) el.classList.add('cm-primary-action');
    });
  }
  function normalizeInputs(root=document){
    root.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea').forEach((el) => {
      if (el.closest('.cm-unified-date')) return;
      el.classList.add('cm-unified-field');
    });
  }
  function normalizeCards(root=document){
    root.querySelectorAll('.bm-page-card, .panel-card, .dashboard-panel, .doc-card').forEach(el => el.classList.add('cm-unified-card'));
  }
  function normalizeMenus(root=document){
    root.querySelectorAll('.bm-nav a, .panel-nav a, .bm-nav-top a, .bm-horizontal-menu a').forEach(a => a.classList.add('cm-unified-nav-link'));
    root.querySelectorAll('.bm-topbar, .panel-topbar, .bm-left-info-panel, .bm-sidebar').forEach(el => el.classList.add('cm-unified-nav-surface'));
    root.querySelectorAll('.bm-month').forEach(el => el.classList.add('cm-unified-menu-calendar'));
  }

  function markSpecialActions(root=document){
    root.querySelectorAll('button, a, .btn').forEach((el) => {
      const text = (el.textContent || el.value || '').trim().toLowerCase();
      if (!text) return;
      if (/cofnij\s+czas/.test(text)) el.classList.add('cm-gold-action');
      if (/właściciel|wlasciciel/.test(text)) el.classList.add('cm-owner-action');
      if (/^pl$|^eng$|pl\s*\/\s*eng|eng\s*\/\s*pl/.test(text)) el.classList.add('cm-lang-action');
      if (/^admin\b|admin\s*[▾▼]/.test(text)) el.classList.add('cm-admin-action');
    });
    root.querySelectorAll('.bm-admin-dropdown-toggle').forEach((el) => el.classList.add('cm-admin-action'));
  }



  /* CompanyManager 162 — global table totals row
     Adds one SUMA row at the end of every data table with numeric totals.
     It intentionally skips dates, status/text/action columns and existing SUMA rows. */
  const TOTAL_VERSION = '162';
  const moneySuffixRe = /(zł|pln|eur|usd|€|\$)\s*$/i;
  const timeMinRe = /^-?\d+(?:[\s,.]\d+)?\s*min$/i;
  const percentRe = /%\s*$/;
  const dateLikeRe = /^(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{4}-\d{2}-\d{2})(\s|$)/;
  const phoneLikeRe = /^\+?\d[\d\s-]{6,}$/;

  function normalizeNumberText(text){
    let v = String(text || '').trim();
    if (!v) return '';
    v = v.replace(/\u00a0/g, ' ');
    v = v.replace(/\s+/g, '');
    v = v.replace(/[zł€$]|PLN|EUR|USD/gi, '');
    v = v.replace(/min/gi, '');
    v = v.replace(/%/g, '');
    // Polish decimal comma support; remove thousands separators conservatively.
    if (/,\d{1,4}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
    return v;
  }
  function parseTotalCell(text, headerText){
    const raw = String(text || '').trim();
    const header = String(headerText || '').toLowerCase();
    if (!raw || raw === '—' || raw === '-' || raw === '✓') return null;
    if (dateLikeRe.test(raw)) return null;
    if (/@/.test(raw) || /^https?:/i.test(raw)) return null;
    if (phoneLikeRe.test(raw) && !/(ilość|ilosc|liczba|l\.|count|suma|wartość|wartosc|czas|dni|wizyt|usług|uslug|produkt|karnet|przychód|przychod)/i.test(header)) return null;
    if (/akcje|status|metoda|płatność|platnosc|typ|nazwa|klient|pracownik|kategoria|email|telefon|data|ostatnia|najbliższa|najblizsza|dzień|dzien/i.test(header)) return null;
    if (percentRe.test(raw) || /%/.test(header)) return null;
    const isMoney = moneySuffixRe.test(raw) || /(wartość|wartosc|przychód|przychod|cena|razem|netto|brutto|sprzedaż|sprzedaz)/i.test(header);
    const isTime = timeMinRe.test(raw) || /(czas|min)/i.test(header);
    const n = Number(normalizeNumberText(raw));
    if (!Number.isFinite(n)) return null;
    if (!isMoney && !isTime && !/(ilość|ilosc|liczba|l\.|count|dni|wizyt|usług|uslug|produkt|karnet|pozycje|klienci|nowi|urlop|zwolnienie|inne|stan)/i.test(header)) {
      return null;
    }
    return { value:n, kind:isTime ? 'time' : (isMoney ? 'money' : 'number') };
  }
  function formatTotalValue(value, kind, samples){
    if (kind === 'time') return `${Math.round(value)}min`;
    if (kind === 'money') {
      const sample = (samples || []).find(Boolean) || '';
      const currency = /eur|€/i.test(sample) ? 'EUR' : (/usd|\$/i.test(sample) ? 'USD' : 'PLN');
      try {
        if (window.CompanyManagerFormat && typeof window.CompanyManagerFormat.money === 'function') return window.CompanyManagerFormat.money(value);
      } catch(_){ }
      return `${value.toFixed(2)} ${currency}`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }
  function getTableHeaderTexts(table){
    const ths = Array.from(table.querySelectorAll('thead th'));
    if (ths.length) return ths.map(th => (th.textContent || '').trim());
    const firstRow = table.querySelector('tr');
    if (!firstRow) return [];
    return Array.from(firstRow.children).map(cell => (cell.textContent || '').trim());
  }
  function isSumaRow(row){
    return /^\s*suma\s*$/i.test((row?.cells?.[0]?.textContent || '').trim());
  }
  function hasManualTotalRow(table){
    // Some report modules, especially Employees reports, already render their own SUMA row.
    // In those cases the global totalizer must not add a second footer row.
    return Array.from(table.querySelectorAll('tbody tr, tfoot tr')).some((row) => !row.classList.contains('cm-table-total-row') && isSumaRow(row));
  }
  function getDataRows(table){
    const bodyRows = table.tBodies && table.tBodies.length ? Array.from(table.tBodies).flatMap(tb => Array.from(tb.rows)) : Array.from(table.rows).slice(1);
    return bodyRows.filter(row => !row.classList.contains('cm-table-total-row') && !isSumaRow(row));
  }
  function ensureTfoot(table){
    let foot = table.tFoot;
    if (!foot) foot = table.createTFoot();
    return foot;
  }
  function addOrUpdateTableTotal(table){
    if (!table || table.closest('.bm-month')) return;
    if (hasManualTotalRow(table)) {
      table.querySelectorAll('tr.cm-table-total-row').forEach(r => r.remove());
      return;
    }
    const headers = getTableHeaderTexts(table);
    const rows = getDataRows(table);
    const colCount = Math.max(headers.length, ...rows.map(r => r.cells.length), 0);
    if (!colCount || !rows.length) {
      table.querySelectorAll('tr.cm-table-total-row').forEach(r => r.remove());
      return;
    }
    const totals = Array.from({length:colCount}, () => ({sum:0, kind:null, count:0, samples:[]}));
    rows.forEach(row => {
      Array.from({length:colCount}).forEach((_, idx) => {
        const cell = row.cells[idx];
        if (!cell) return;
        const txt = (cell.textContent || '').trim();
        const parsed = parseTotalCell(txt, headers[idx] || '');
        if (!parsed) return;
        totals[idx].sum += parsed.value;
        totals[idx].kind = totals[idx].kind === 'money' || parsed.kind === 'money' ? 'money' : (totals[idx].kind === 'time' || parsed.kind === 'time' ? 'time' : 'number');
        totals[idx].count += 1;
        totals[idx].samples.push(txt);
      });
    });
    const hasAny = totals.some(t => t.count > 0);
    if (!hasAny) {
      table.querySelectorAll('tr.cm-table-total-row').forEach(r => r.remove());
      return;
    }
    const foot = ensureTfoot(table);
    let totalRow = foot.querySelector('tr.cm-table-total-row');
    if (!totalRow) {
      totalRow = document.createElement('tr');
      totalRow.className = 'cm-table-total-row';
      foot.appendChild(totalRow);
    }
    totalRow.innerHTML = '';
    const firstTotalIdx = totals.findIndex(t => t.count > 0);
    for (let i=0;i<colCount;i++) {
      const td = document.createElement('td');
      if (i === 0) td.textContent = 'SUMA';
      else if (totals[i].count > 0) td.textContent = formatTotalValue(totals[i].sum, totals[i].kind, totals[i].samples);
      else if (i < firstTotalIdx && i !== 0) td.textContent = '';
      else td.textContent = '';
      totalRow.appendChild(td);
    }
  }
  function addTableTotals(root=document){
    root.querySelectorAll('table').forEach((table) => {
      try { addOrUpdateTableTotal(table); } catch(err) { console.warn('CompanyManager table total skipped', err); }
    });
  }

  function normalizeAll(root=document){
    document.documentElement.dataset.cmUi = VERSION;
    enhanceDateInputs(root);
    normalizeCards(root);
    normalizeInputs(root);
    normalizeButtons(root);
    normalizeTables(root);
    addTableTotals(root);
    normalizeMenus(root);
    markSpecialActions(root);
  }
  function boot(){
    normalizeAll(document);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) normalizeAll(node);
        });
      }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
    window.CompanyManagerUI = Object.assign(window.CompanyManagerUI || {}, { normalizeAll, enhanceDateInputs, addTableTotals, version: VERSION, todayIso });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
