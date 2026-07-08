// CompanyManager — Kreator pierwszego uruchomienia / Akademia v308
(function () {
  function isTutorialPage() {
    return document.body?.dataset?.panelPage === 'tutorial' || window.location.pathname.includes('tutorial.html');
  }
  if (!isTutorialPage()) return;

  const STORAGE_KEY = 'cmTutorialChecklistV2';
  const COMPLETE_KEY = 'cmTutorialCompleted';
  const PATH_KEY = 'cmTutorialPath';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }
  function getPanelArea() {
    return document.querySelector('.bm-panel-area') || document.getElementById('dashboardRoot') || document.body;
  }
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {})); }
  function profile() { return window.cmTutorialGetProfile ? window.cmTutorialGetProfile() : { role:'EMPLOYEE', path:'employee', isAdmin:false, permissions:{} }; }
  function stepsFor(path) { return window.cmTutorialGetSteps ? window.cmTutorialGetSteps(path) : []; }
  function currentPath() { const saved = localStorage.getItem(PATH_KEY); if (saved === 'admin' || saved === 'employee') return saved; return profile().isAdmin ? 'admin' : 'employee'; }
  function progressText(state, steps) {
    const done = steps.filter(step => state[step.id]).length;
    const total = Math.max(steps.length, 1);
    const pct = Math.round((done / total) * 100);
    const complete = done === total && steps.length > 0;
    try { localStorage.setItem(COMPLETE_KEY, complete ? 'true' : 'false'); } catch (_) {}
    return { done, total, pct, complete };
  }
  function permissionSummary(p) {
    const perms = p.permissions || {};
    if (p.isAdmin) return 'Pełna ścieżka wdrożenia firmy: konfiguracja, pracownicy, usługi, grafik, sprzedaż i raporty.';
    const keys = Object.keys(perms).filter(k => perms[k] === true || perms[k] === 'true' || perms[k] === 1 || perms[k] === '1');
    return keys.length ? `Ścieżka pracownika została skrócona do modułów zgodnych z jego uprawnieniami (${keys.length}).` : 'Pracownik ma bardzo ograniczone uprawnienia, więc szkolenie pokaże tylko podstawowe kroki.';
  }

  function render() {
    const area = getPanelArea();
    const state = loadState();
    const p = profile();
    const path = currentPath();
    const steps = stepsFor(path);
    const progress = progressText(state, steps);
    const pathName = path === 'admin' ? 'Właściciel firmy / ADMIN' : 'Pracownik / EMPLOYEE';

    const cards = steps.map((step, i) => {
      const checked = !!state[step.id];
      return `
        <article class="cm-tutorial-step ${checked ? 'is-done' : ''}" data-tutorial-step="${escapeHtml(step.id)}">
          <div class="cm-tutorial-step-top">
            <label class="cm-tutorial-check">
              <input type="checkbox" data-tutorial-check="${escapeHtml(step.id)}" ${checked ? 'checked' : ''}>
              <span>${checked ? 'Gotowe' : 'Do zrobienia'}</span>
            </label>
            ${step.optional ? '<span class="cm-tutorial-badge">Opcjonalne</span>' : ''}
            ${path === 'employee' && step.requiredPermission ? '<span class="cm-tutorial-badge">Z uprawnień</span>' : ''}
          </div>
          <div class="cm-tutorial-title"><span>${escapeHtml(step.icon || (path === 'admin' ? '🚀' : '👤'))}</span><h3>${escapeHtml(step.title || ('Krok ' + (i + 1)))}</h3></div>
          <p>${escapeHtml(step.text || step.lead || '')}</p>
          ${Array.isArray(step.bullets) && step.bullets.length ? `<details><summary>Instrukcja krok po kroku</summary><ul>${step.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
          <div class="cm-tutorial-actions"><a class="bm-secondary-btn" href="${escapeHtml(step.href || 'dashboard.html')}">Przejdź do modułu</a></div>
        </article>`;
    }).join('');

    area.innerHTML = `
      <section class="cm-tutorial-hero cm-tutorial-hero-v308">
        <div>
          <span class="cm-tutorial-kicker">Kreator pierwszego uruchomienia</span>
          <h2>CompanyManager prowadzi użytkownika krok po kroku</h2>
          <p>System rozpoznaje rolę użytkownika. ADMIN dostaje pełne wdrożenie firmy, a EMPLOYEE dostaje tylko szkolenie z modułów, do których ma uprawnienia.</p>
          <div class="cm-tutorial-path-cards">
            <button type="button" class="cm-tutorial-path-card ${path === 'admin' ? 'active' : ''}" data-tutorial-path="admin">
              <strong>👑 Właściciel / ADMIN</strong><span>Pełna konfiguracja firmy od stanowisk do raportów.</span>
            </button>
            <button type="button" class="cm-tutorial-path-card ${path === 'employee' ? 'active' : ''}" data-tutorial-path="employee">
              <strong>👤 Pracownik / EMPLOYEE</strong><span>Szkolenie dopasowane do nadanych uprawnień.</span>
            </button>
          </div>
          <div class="cm-tutorial-detected">Wykryto: <strong>${escapeHtml(pathName)}</strong>. ${escapeHtml(permissionSummary(p))}</div>
        </div>
        <div class="cm-tutorial-progress-card">
          <strong>${progress.done}/${progress.total}</strong>
          <span>ukończonych kroków</span>
          <div class="cm-tutorial-progress"><i style="width:${progress.pct}%"></i></div>
          <button type="button" class="bm-primary-btn" id="cmTutorialGuidedStart">Uruchom prowadzenie</button>
          <button type="button" class="bm-secondary-btn" id="cmTutorialReset">Resetuj postęp</button>
        </div>
      </section>
      ${progress.complete ? `<section class="cm-tutorial-complete"><strong>🎓 Szkolenie ukończone.</strong> Link do Samouczka po odświeżeniu przejdzie na koniec menu.</section>` : ''}
      <section class="cm-tutorial-warning"><strong>Jak to działa:</strong> pracownik nie dostaje całej ścieżki właściciela. Jeżeli ma dostęp do Karnetów, zobaczy Karnety. Jeżeli nie ma dostępu do Marketingu, krok Marketing zostanie pominięty.</section>
      <section class="cm-tutorial-grid">${cards}</section>
    `;

    area.querySelectorAll('[data-tutorial-path]').forEach(btn => {
      btn.addEventListener('click', () => { localStorage.setItem(PATH_KEY, btn.dataset.tutorialPath); render(); });
    });
    area.querySelectorAll('[data-tutorial-check]').forEach((input) => {
      input.addEventListener('change', () => { const next = loadState(); next[input.dataset.tutorialCheck] = input.checked; saveState(next); render(); });
    });
    area.querySelector('#cmTutorialGuidedStart')?.addEventListener('click', () => {
      const selected = currentPath();
      if (window.cmTutorialStart) window.cmTutorialStart(selected);
      else { localStorage.setItem('cmTutorialGuideActive', 'true'); localStorage.setItem('cmTutorialGuideIndex', '0'); window.location.href = steps[0]?.href || 'dashboard.html'; }
    });
    area.querySelector('#cmTutorialReset')?.addEventListener('click', () => {
      if (!confirm('Zresetować postęp samouczka? Dane firmy nie zostaną usunięte.')) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(COMPLETE_KEY, 'false');
      localStorage.removeItem('cmTutorialGuideIndex');
      render();
    });
  }

  function boot() {
    const area = getPanelArea();
    if (!area || !document.querySelector('.bm-panel')) { setTimeout(boot, 80); return; }
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
