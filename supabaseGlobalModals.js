// CompanyManager — Supabase global forms bridge
// 041E: globalnie wyłączone blur/overlay. Formularze działają inline jak zwykłe sekcje.
(function () {
  'use strict';

  const MODAL_ACTIVE = 'cm-modal-active';
  const MODAL_CLASS = 'cm-as-modal';
  const BODY_OPEN = 'cm-modal-open';
  const OVERLAY_ID = 'cmGlobalFormOverlay';

  function cleanupBlur() {
    document.body.classList.remove(BODY_OPEN);
    document.documentElement.classList.remove(BODY_OPEN);
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
      overlay.style.opacity = '0';
    }
    document.querySelectorAll('.' + MODAL_CLASS).forEach(function (panel) {
      panel.classList.remove(MODAL_CLASS);
    });
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
    overlay.hidden = true;
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
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
    cleanupBlur();
  }

  function closeAll(panels) {
    (panels || Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS))).forEach(function (panel) {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
    });
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
    });

    if (targetPanel && shouldOpen) {
      targetPanel.hidden = false;
      targetPanel.classList.add(MODAL_ACTIVE);
      targetPanel.classList.remove(MODAL_CLASS);
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
      }
    });
    if (targetPanel) {
      targetPanel.hidden = false;
      targetPanel.classList.add(MODAL_ACTIVE);
      targetPanel.classList.remove(MODAL_CLASS);
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
          mutation.addedNodes.forEach(function (node) {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches && node.matches('input[type="date"], input[type="time"], .' + MODAL_CLASS + ', .' + MODAL_ACTIVE)) shouldRun = true;
            if (node.querySelector && node.querySelector('input[type="date"], input[type="time"], .' + MODAL_CLASS + ', .' + MODAL_ACTIVE)) shouldRun = true;
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

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-modal-cancel="true"]')) {
        const panel = target.closest('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS);
        if (panel) {
          event.preventDefault();
          closePanel(panel);
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
  window.cmCloseAllModalPanels = closeAll;
  window.cmHardCloseAllModalPanels = hardCloseAll;
  window.cmUpdateGlobalModalState = updateState;
  window.cmRefreshGlobalModalState = updateState;
  window.cmReinitNativeDatePickers = reinitNativePickers;
  window.cmScheduleDatePickerReinit = schedulePickerReinit;
  window.cmReinitNativePickers = reinitNativePickers;
  window.cmScheduleNativePickerReinit = schedulePickerReinit;
})();
