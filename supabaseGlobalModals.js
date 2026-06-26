// CompanyManager — Supabase global forms bridge
// 138: globalny stos formularzy — blur zostaje aktywny dopóki otwarty jest jakikolwiek formularz; formularz nadrzędny wraca po zamknięciu pomocniczego.
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
    '#walkinDeleteCard'
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
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  function shouldPromoteAsModal(panel) {
    if (!panel || panel.nodeType !== 1) return false;
    if (!panel.matches || !panel.matches(FORM_PANEL_SELECTOR)) return false;
    if (!isActuallyOpen(panel)) return false;
    if (panel.closest && panel.closest('.cm-client-search-results, .cm-limit-menu, .cm-cr-dropdown-menu, .bm-workers-popover')) return false;
    return !!(panel.querySelector('form, input, select, textarea, button') || panel.matches('.cm-modal-backdrop'));
  }

  function promoteOpenFormPanels() {
    const candidates = Array.from(document.querySelectorAll(FORM_PANEL_SELECTOR));
    candidates.forEach(function (panel) {
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
    return !!document.querySelector('.' + MODAL_ACTIVE + ':not([hidden]), .' + MODAL_CLASS + ':not([hidden])');
  }

  function refreshBlurState() {
    promoteOpenFormPanels();
    syncModalDepths();
    const isOpen = anyOpenModal();
    document.body.classList.toggle(BODY_OPEN, isOpen);
    document.documentElement.classList.toggle(BODY_OPEN, isOpen);
    const overlay = ensureOverlay();
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.hidden = !isOpen;
    overlay.style.display = isOpen ? 'block' : 'none';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';
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
    overlay.hidden = !anyOpenModal();
    overlay.style.display = anyOpenModal() ? 'block' : 'none';
    overlay.style.pointerEvents = anyOpenModal() ? 'auto' : 'none';
    overlay.style.opacity = anyOpenModal() ? '1' : '0';
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
      if (target.matches('[data-modal-cancel="true"]')) {
        const panel = target.closest('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS);
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
      if (event.key === 'Escape') closeAll();
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
