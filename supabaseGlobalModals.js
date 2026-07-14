// CompanyManager — Supabase global forms bridge
// 142: globalny blur formularzy — wykrywa wszystkie otwarte panele formularzy i wymusza overlay/blur do zamknięcia ostatniego formularza.
(function () {
  'use strict';

  const MODAL_ACTIVE = 'cm-modal-active';
  const MODAL_CLASS = 'cm-as-modal';
  const BODY_OPEN = 'cm-modal-open';
  const OVERLAY_ID = 'cmGlobalFormOverlay';
  const MODAL_DEPTH_ATTR = 'data-cm-modal-depth';
  const FORM_PANEL_SELECTOR = [
    '.bm-appointment-form',
    '.bm-nested-modal',
    '.bm-nested-form',
    '.cm-admin-user-modal',
    '.cm-work-schedule-modal',
    '.cm-payment-method-modal',
    '.cm-modal-backdrop',
    '[id$=\"FormCard\"]',
    '[id$=\"FormPanel\"]',
    '[id$=\"EditCard\"]',
    '[id$=\"EditPanel\"]',
    '[id$=\"DeleteCard\"]',
    '[id$=\"DeletePanel\"]',
    '#marketingSmsCard',
    '#marketingEmailCard',
    '#addPassPanel',
    '#deletePassPanel',
    '#addWorkSchedulePanel',
    '#editWorkSchedulePanel',
    '#deleteWorkSchedulePanel',
    '#addPaymentMethodPanel',
    '#dashboardAppointmentForm',
    '#dashboardEditVisitPanel',
    '#dashboardCancelVisitPanel',
    '#visitFormCard',
    '#visitEditCard',
    '#visitDeleteCard',
    '#walkinFormCard',
    '#walkinDeleteCard',
    '.bm-page-card',
    '.bm-card',
    '.panel-card',
    '.form-card',
    '.cm-form-card',
    '.modal',
    '.bm-modal',
    '.cm-modal'
  ].join(',');
  const modalStack = [];

  function normalizePanel(panel) {
    return panel && panel.nodeType === 1 ? panel : null;
  }

  function isActuallyOpen(panel) {
    if (!panel || panel.nodeType !== 1) return false;
    if (panel.hidden) return false;
    if (panel.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle ? window.getComputedStyle(panel) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    return true;
  }

  function looksLikeFormPanel(panel) {
    if (!panel || panel.nodeType !== 1) return false;
    const id = panel.id || '';
    const cls = panel.className ? String(panel.className) : '';
    const signature = `${id} ${cls}`;
    if (/FormCard|FormPanel|EditCard|EditPanel|DeleteCard|DeletePanel|Quick[A-Za-z]+Card|Modal|modal|payment-method|work-schedule/i.test(signature)) return true;
    if (panel.matches && panel.matches('.cm-as-modal,.cm-modal-active,.bm-nested-modal,.bm-appointment-form')) return true;
    return false;
  }

  function hasRealFormControls(panel) {
    if (!panel || panel.nodeType !== 1) return false;
    if (panel.matches && panel.matches('.cm-modal-backdrop')) return true;
    return !!panel.querySelector('form, input:not([type="hidden"]), select, textarea');
  }

  function shouldPromoteAsModal(panel) {
    if (!panel || panel.nodeType !== 1) return false;
    if (panel.matches && panel.matches('[data-cm-no-modal="true"], .cm-no-modal, .cm-pass-inline-panel, .cm-centered-no-overlay-panel, .cm-marketing-centered-panel')) return false;
    if (panel.closest && panel.closest('[data-cm-no-modal="true"], .cm-no-modal, .cm-pass-inline-panel, .cm-centered-no-overlay-panel, .cm-marketing-centered-panel')) return false;
    if (!panel.matches || !panel.matches(FORM_PANEL_SELECTOR)) return false;
    if (!isActuallyOpen(panel)) return false;
    if (panel.closest && panel.closest('.cm-client-search-results, .cm-limit-menu, .cm-cr-dropdown-menu, .bm-workers-popover, #cmGlobalFormOverlay')) return false;
    if (!looksLikeFormPanel(panel)) return false;
    return hasRealFormControls(panel);
  }

  function promoteOpenFormPanels() {
    const candidates = Array.from(document.querySelectorAll(FORM_PANEL_SELECTOR));
    candidates.forEach(function (panel) {
      if (panel.matches && panel.matches('[data-cm-no-modal="true"], .cm-no-modal, .cm-pass-inline-panel, .cm-centered-no-overlay-panel, .cm-marketing-centered-panel')) {
        panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
        panel.removeAttribute(MODAL_DEPTH_ATTR);
        panel.style.removeProperty('z-index');
        removeFromStack(panel);
        return;
      }
      if (shouldPromoteAsModal(panel)) {
        if (!panel.classList.contains(MODAL_ACTIVE)) panel.classList.add(MODAL_ACTIVE);
        if (!panel.classList.contains(MODAL_CLASS)) panel.classList.add(MODAL_CLASS);
        pushModal(panel);
      } else if (panel.classList && (panel.classList.contains(MODAL_ACTIVE) || panel.classList.contains(MODAL_CLASS)) && !isActuallyOpen(panel)) {
        panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
        panel.removeAttribute(MODAL_DEPTH_ATTR);
        panel.style.removeProperty('z-index');
        removeFromStack(panel);
      }
    });
  }

  function removeFromStack(panel) {
    const p = normalizePanel(panel);
    if (!p) return;
    for (let i = modalStack.length - 1; i >= 0; i -= 1) {
      if (modalStack[i] === p) modalStack.splice(i, 1);
    }
  }

  function pushModal(panel) {
    const p = normalizePanel(panel);
    if (!p) return;
    removeFromStack(p);
    modalStack.push(p);
    syncModalDepths();
  }

  function syncModalDepths() {
    modalStack.forEach(function (panel, index) {
      if (!panel || panel.hidden) return;
      panel.setAttribute(MODAL_DEPTH_ATTR, String(index + 1));
      panel.style.zIndex = String(10000 + index);
    });
  }


  function anyOpenModal() {
    for (let i = modalStack.length - 1; i >= 0; i -= 1) {
      const panel = modalStack[i];
      if (!panel || !isActuallyOpen(panel) || !document.documentElement.contains(panel)) {
        modalStack.splice(i, 1);
      }
    }
    const active = Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS))
      .some(function (panel) { return isActuallyOpen(panel); });
    return active || modalStack.length > 0;
  }

  function getTopOpenModal() {
    for (let i = modalStack.length - 1; i >= 0; i -= 1) {
      const panel = modalStack[i];
      if (panel && isActuallyOpen(panel) && document.documentElement.contains(panel)) return panel;
    }
    const active = Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ':not([hidden]), .' + MODAL_CLASS + ':not([hidden])'))
      .filter(function (panel) { return isActuallyOpen(panel); });
    return active.length ? active[active.length - 1] : null;
  }

  function isNavigationClickTarget(target) {
    if (!target || !target.closest) return false;
    const link = target.closest('a[href]');
    if (!link) return false;
    const href = String(link.getAttribute('href') || '').trim();
    if (!href || href === '#' || href.startsWith('javascript:')) return false;
    return !!link.closest('.bm-nav, .bm-nav-top, .bm-side-nav, .bm-panel-user, .bm-horizontal-menu, .bm-admin-dropdown-menu, header, nav, aside');
  }

  function isExplicitCloseTarget(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('[data-modal-cancel="true"], [data-dashboard-modal-cancel="true"], #dashCancelAppointment, #cancelAddWorkScheduleBtn, #cancelEditWorkScheduleBtn, #cancelDeleteWorkScheduleBtn, .cm-modal-cancel-btn');
  }

  function refreshBlurState() {
    promoteOpenFormPanels();
    syncModalDepths();
    const isOpen = anyOpenModal();
    document.body.classList.toggle(BODY_OPEN, isOpen);
    document.documentElement.classList.toggle(BODY_OPEN, isOpen);
    document.body.setAttribute('data-cm-modal-open', isOpen ? 'true' : 'false');
    document.documentElement.setAttribute('data-cm-modal-open', isOpen ? 'true' : 'false');
    const overlay = ensureOverlay();
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.hidden = !isOpen;
    overlay.style.display = isOpen ? 'block' : 'none';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = isOpen ? '1' : '0';
  }

  function cleanupBlur() {
    refreshBlurState();
  }

  function reinitNativePickers(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const inputs = [];
    if (scope.matches && scope.matches('input[type="date"], input[type="time"]')) inputs.push(scope);
    scope.querySelectorAll('input[type="date"], input[type="time"]').forEach(function (input) { inputs.push(input); });

    inputs.forEach(function (input) {
      if (!input) return;
      input.classList.add(input.type === 'time' ? 'cm-time-input' : 'cm-date-input');
      input.style.pointerEvents = 'auto';
      input.style.touchAction = 'manipulation';

      if (input.dataset.cmNativePickerReady === '1') return;
      input.dataset.cmNativePickerReady = '1';

      input.addEventListener('click', function () {
        if (input.disabled || input.readOnly) return;
        try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (__) {} }
        try {
          if (typeof input.showPicker === 'function') input.showPicker();
        } catch (_) {}
      });
    });
  }

  function schedulePickerReinit(root) {
    window.setTimeout(function () { reinitNativePickers(root || document); cleanupBlur(); }, 0);
    window.setTimeout(function () { reinitNativePickers(root || document); cleanupBlur(); }, 80);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function updateState() {
    ensureOverlay();
    cleanupBlur();
    schedulePickerReinit(document);
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
    panel.removeAttribute(MODAL_DEPTH_ATTR);
    panel.style.removeProperty('z-index');
    removeFromStack(panel);
    cleanupBlur();
  }

  function returnToPanel(childPanel, parentPanel, panels) {
    if (childPanel) {
      childPanel.hidden = true;
      childPanel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
      childPanel.removeAttribute(MODAL_DEPTH_ATTR);
      childPanel.style.removeProperty('z-index');
      removeFromStack(childPanel);
    }
    if (parentPanel) {
      (panels || []).forEach(function (panel) {
        if (panel && panel !== parentPanel) {
          panel.hidden = true;
          panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
        }
      });
      parentPanel.hidden = false;
      parentPanel.classList.add(MODAL_ACTIVE, MODAL_CLASS);
      pushModal(parentPanel);
      schedulePickerReinit(parentPanel);
    }
    cleanupBlur();
  }

  function closeAll(panels) {
    (panels || Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS))).forEach(function (panel) {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
      panel.removeAttribute(MODAL_DEPTH_ATTR);
      panel.style.removeProperty('z-index');
      removeFromStack(panel);
    });
    modalStack.length = 0;
    cleanupBlur();
  }

  function hardCloseAll() {
    closeAll();
    window.setTimeout(cleanupBlur, 0);
    window.setTimeout(cleanupBlur, 80);
  }

  function showOnly(targetPanel, panels) {
    const list = (panels && panels.length ? panels : [targetPanel]).filter(Boolean);
    const shouldOpen = !!targetPanel && targetPanel.hidden;

    list.forEach(function (panel) {
      panel.hidden = true;
      panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
      panel.removeAttribute(MODAL_DEPTH_ATTR);
      panel.style.removeProperty('z-index');
      removeFromStack(panel);
    });

    if (targetPanel && shouldOpen) {
      targetPanel.hidden = false;
      targetPanel.classList.add(MODAL_ACTIVE, MODAL_CLASS);
      pushModal(targetPanel);
    }

    cleanupBlur();
    schedulePickerReinit(targetPanel || document);
  }

  function open(targetPanel, panels) {
    const list = (panels && panels.length ? panels : [targetPanel]).filter(Boolean);
    list.forEach(function (panel) {
      if (panel !== targetPanel) {
        panel.hidden = true;
        panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
        panel.removeAttribute(MODAL_DEPTH_ATTR);
        panel.style.removeProperty('z-index');
        removeFromStack(panel);
      }
    });
    if (targetPanel) {
      targetPanel.hidden = false;
      targetPanel.classList.add(MODAL_ACTIVE, MODAL_CLASS);
      pushModal(targetPanel);
    }
    cleanupBlur();
    schedulePickerReinit(targetPanel || document);
  }

  if (!window.__cmSupabaseGlobalModalsReady) {
    window.__cmSupabaseGlobalModalsReady = true;
    ensureOverlay();
    schedulePickerReinit();
    cleanupBlur();

    if (typeof MutationObserver !== 'undefined') {
      let timer = null;
      const observer = new MutationObserver(function (mutations) {
        let shouldRun = false;
        mutations.forEach(function (mutation) {
          if (mutation.type === 'attributes') shouldRun = true;
          mutation.addedNodes.forEach(function (node) {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches && node.matches('input[type="date"], input[type="time"], ' + FORM_PANEL_SELECTOR + ', .' + MODAL_CLASS + ', .' + MODAL_ACTIVE)) shouldRun = true;
            if (node.querySelector && node.querySelector('input[type="date"], input[type="time"], ' + FORM_PANEL_SELECTOR + ', .' + MODAL_CLASS + ', .' + MODAL_ACTIVE)) shouldRun = true;
          });
        });
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          if (shouldRun) reinitNativePickers(document);
          cleanupBlur();
        }, 30);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    }

    window.setInterval(function () { cleanupBlur(); }, 350);

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      // Akcje eksportu muszą pozostać klikalne nawet wtedy, gdy globalny system
      // omyłkowo widzi inny panel jako aktywny modal. Bez tego handler capture
      // zatrzymywał kliknięcie przed modułem Grafiku pracy.
      if (target.closest('[data-cm-work-export-action], [data-final-schedule-export], [data-final-schedule-print]')) {
        return;
      }

      // Formularze użytkowników posiadają własną walidację i zapis Supabase.
      // Nie wolno globalnemu systemowi modali przechwycić przycisku przed handlerem modułu.
      if (target.closest('[data-cm-users-submit-action]')) {
        return;
      }

      const activePanel = getTopOpenModal();

      // v314: overlay/tło nigdy nie zamyka formularza. Menu główne ma jednak działać normalnie,
      // żeby użytkownik mógł świadomie przejść do innej zakładki bez klikania Anuluj.
      if (target.id === OVERLAY_ID || target.closest('#' + OVERLAY_ID)) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        return;
      }

      // Kliknięcie w krawędź / tło aktywnego formularza NIE może zamykać formularza.
      // To jest globalne zabezpieczenie dla wszystkich modułów: wizyty, klienci, produkty, usługi,
      // karnety, marketing, dni wolne, grafik pracy, użytkownicy itd.
      if (activePanel && activePanel.contains(target)) {
        const interactive = target.closest('button, a[href], input, select, textarea, label, summary, [role="button"], [data-modal-cancel="true"], [data-dashboard-modal-cancel="true"], [data-open-related], [data-action], [data-cm-action], [onclick]');
        if (!interactive) {
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          window.setTimeout(cleanupBlur, 0);
          return;
        }
      }

      // Klik poza aktywnym formularzem nie może zamykać ani resetować edycji.
      // Wyjątek: klik w link menu/nawigacji — przepuszczamy, bo to świadoma zmiana zakładki.
      if (activePanel && !activePanel.contains(target) && !isNavigationClickTarget(target)) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        window.setTimeout(cleanupBlur, 0);
        return;
      }

      if (target.matches('[data-modal-cancel="true"]') || isExplicitCloseTarget(target)) {
        const panel = target.closest('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS) || activePanel;
        if (panel) {
          event.preventDefault();
          const parentSelector = panel.getAttribute('data-parent-panel');
          const parentPanel = parentSelector ? document.querySelector(parentSelector) : null;
          if (parentPanel) returnToPanel(panel, parentPanel, Array.from(document.querySelectorAll('.bm-page-card')));
          else closePanel(panel);
        }
      }
      window.setTimeout(cleanupBlur, 0);
    }, true);

    document.addEventListener('keydown', function (event) {
      // Nie zamykamy formularzy przez Escape — użytkownik musi użyć Anuluj/Zapisz/Zatwierdź.
      if (event.key === 'Escape' && anyOpenModal()) {
        event.preventDefault();
      }
    });
  }

  window.cmShowOnlyModalPanel = showOnly;
  window.cmOpenModalPanel = open;
  window.cmCloseModalPanel = closePanel;
  window.cmReturnToParentModalPanel = returnToPanel;
  window.cmCloseAllModalPanels = closeAll;
  window.cmHardCloseAllModalPanels = hardCloseAll;
  window.cmUpdateGlobalModalState = updateState;
  window.cmRefreshGlobalModalState = updateState;
  window.cmReinitNativeDatePickers = reinitNativePickers;
  window.cmScheduleDatePickerReinit = schedulePickerReinit;
  window.cmReinitNativePickers = reinitNativePickers;
  window.cmScheduleNativePickerReinit = schedulePickerReinit;
  // 141: Safety net — quick-add pseudo targets are modal actions, never navigation targets.
  // Do not call stopImmediatePropagation here, because module-level handlers still need to open inline forms.
  document.addEventListener("click", function(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-open-related^="quick-"]') : null;
    if (!button) return;
    event.preventDefault();
    if (button.tagName === "A") button.removeAttribute("href");
  }, true);

})();
