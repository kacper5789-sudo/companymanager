/* CompanyManager 056 — global UI + one calendar system */
(function(){
  'use strict';
  const VERSION = '056';
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

  function normalizeAll(root=document){
    document.documentElement.dataset.cmUi = VERSION;
    enhanceDateInputs(root);
    normalizeCards(root);
    normalizeInputs(root);
    normalizeButtons(root);
    normalizeTables(root);
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
    window.CompanyManagerUI = Object.assign(window.CompanyManagerUI || {}, { normalizeAll, enhanceDateInputs, version: VERSION, todayIso });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
