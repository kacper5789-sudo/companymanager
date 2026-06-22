// CompanyManager — Supabase global modal bridge
// Globalny standard: wszystkie formularze Dodaj / Edytuj / Usuń w modułach Supabase
// otwierają się na środku ekranu z przyciemnionym / blurowanym tłem.
(function () {
  'use strict';

  const MODAL_ACTIVE = 'cm-modal-active';
  const MODAL_CLASS = 'cm-as-modal';
  const BODY_OPEN = 'cm-modal-open';
  const OVERLAY_ID = 'cmGlobalFormOverlay';

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

  function ensureCancelButton(panel) {
    if (!panel || panel.querySelector('[data-modal-cancel="true"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bm-light-btn cm-modal-cancel-btn';
    btn.dataset.modalCancel = 'true';
    btn.textContent = 'Anuluj';
    btn.addEventListener('click', function () {
      closePanel(panel);
    });
    panel.appendChild(btn);
  }

  function updateState() {
    ensureOverlay();
    const openPanels = Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ':not([hidden])'));
    document.querySelectorAll('.' + MODAL_CLASS).forEach(function (panel) {
      if (!openPanels.includes(panel)) panel.classList.remove(MODAL_CLASS);
    });
    openPanels.forEach(function (panel) {
      panel.classList.add(MODAL_CLASS);
      ensureCancelButton(panel);
    });
    document.body.classList.toggle(BODY_OPEN, openPanels.length > 0);
    if (openPanels.length === 0) {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) {
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.pointerEvents = 'none';
        overlay.style.opacity = '0';
      }
    }
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
    updateState();
  }

  function closeAll(panels) {
    (panels || Array.from(document.querySelectorAll('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS))).forEach(function (panel) {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
    });
    updateState();
  }

  function hardCloseAll() {
    document.querySelectorAll('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS).forEach(function (panel) {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove(MODAL_ACTIVE, MODAL_CLASS);
    });

    // 038D: twarde sprzątanie po dynamicznych modułach Supabase.
    // Przy produktach/użytkownikach formularz bywał usuwany przez rerender,
    // ale body zostawało z klasą cm-modal-open, więc ekran nadal był zblurowany.
    document.body.classList.remove(BODY_OPEN);
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.pointerEvents = 'none';
      overlay.style.opacity = '0';
    }

    window.setTimeout(function () {
      if (!document.querySelector('.' + MODAL_ACTIVE + ':not([hidden]), .' + MODAL_CLASS + ':not([hidden])')) {
        document.body.classList.remove(BODY_OPEN);
        const currentOverlay = document.getElementById(OVERLAY_ID);
        if (currentOverlay) {
          currentOverlay.setAttribute('aria-hidden', 'true');
          currentOverlay.style.pointerEvents = 'none';
          currentOverlay.style.opacity = '0';
        }
      }
    }, 0);
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
      ensureCancelButton(targetPanel);
    }

    updateState();
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
      ensureCancelButton(targetPanel);
    }
    updateState();
  }

  if (!window.__cmSupabaseGlobalModalsReady) {
    window.__cmSupabaseGlobalModalsReady = true;

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === OVERLAY_ID) {
        closeAll();
        return;
      }
      if (target.matches('[data-modal-cancel="true"]')) {
        const panel = target.closest('.' + MODAL_ACTIVE + ', .' + MODAL_CLASS);
        if (panel) {
          event.preventDefault();
          closePanel(panel);
        }
      }
    });

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
})();
