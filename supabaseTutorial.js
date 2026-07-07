// CompanyManager — Samouczek wdrożeniowy v303
(function () {
  function isTutorialPage() {
    return document.body?.dataset?.panelPage === 'tutorial' || window.location.pathname.includes('tutorial.html');
  }
  if (!isTutorialPage()) return;

  const STORAGE_KEY = 'cmTutorialChecklistV1';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function getPanelArea() {
    return document.querySelector('.bm-panel-area') || document.getElementById('dashboardRoot') || document.body;
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
  }

  const steps = [
    {
      id: 'positions',
      title: '1. Dodaj stanowiska pracy',
      icon: '🪑',
      href: 'positions.html',
      lead: 'Najpierw utwórz stanowiska, bo później przypiszesz do nich pracowników i łatwiej uporządkujesz uprawnienia.',
      bullets: [
        'Dodaj stanowiska typu: fryzjer, kosmetolog, recepcja, manager, mechanik lub inne zgodne z firmą.',
        'Stanowisko powinno opisywać rolę w firmie, a nie konkretną osobę.',
        'Dopiero po stanowiskach przejdź do dodawania pracowników.'
      ]
    },
    {
      id: 'employees',
      title: '2. Dodaj pracowników / użytkowników',
      icon: '👥',
      href: 'users.html',
      lead: 'Pracownik powinien mieć konto dopiero wtedy, gdy istnieje jego stanowisko pracy.',
      bullets: [
        'Dodaj użytkownika z imieniem, nazwiskiem, telefonem, adresem e-mail i hasłem.',
        'Przypisz stanowisko pracy.',
        'Ustal rolę: ADMIN dla osoby zarządzającej firmą albo EMPLOYEE dla zwykłego pracownika.',
        'Jeżeli pracownik nie ma się logować, możesz zablokować logowanie.'
      ]
    },
    {
      id: 'permissions',
      title: '3. Nadaj uprawnienia',
      icon: '🔐',
      href: 'users.html',
      lead: 'Uprawnienia decydują, które zakładki pracownik widzi i jakie operacje może wykonać.',
      bullets: [
        'Najpierw zaznacz zakładki, które pracownik może otwierać.',
        'Potem nadaj funkcje: dodawanie, edycja, usuwanie, historia, eksport, import.',
        'Dla zwykłego pracownika możesz użyć podstawowego zestawu uprawnień.',
        'ADMIN i OWNER mają szerszy dostęp, ale zwykły pracownik działa według checkboxów.'
      ]
    },
    {
      id: 'serviceCategories',
      title: '4. Dodaj kategorie usług',
      icon: '🗂️',
      href: 'services.html',
      lead: 'Kategorie porządkują cennik i późniejsze raporty.',
      bullets: [
        'Dodaj kategorie, np. Fryzjer damski, Fryzjer męski, Paznokcie, Masaż, Diagnostyka.',
        'Nie mieszaj wszystkich usług w jednej kategorii.',
        'Kategorie powinny być proste i zrozumiałe dla pracowników.'
      ]
    },
    {
      id: 'services',
      title: '5. Dodaj usługi w kategoriach',
      icon: '✂️',
      href: 'services.html',
      lead: 'Usługi są podstawą dodawania wizyt, sprzedaży i raportów.',
      bullets: [
        'Każda usługa powinna mieć nazwę, kategorię, czas trwania i cenę.',
        'Czas usługi wpływa na zajętość slotów na Dashboardzie.',
        'Cena usługi później trafia do sprzedaży i raportów.'
      ]
    },
    {
      id: 'products',
      title: '6. Dodaj produkty — opcjonalnie',
      icon: '📦',
      href: 'products.html',
      lead: 'Produkty są potrzebne tylko firmom, które sprzedają lub zużywają towar.',
      optional: true,
      bullets: [
        'Jeżeli firma nie sprzedaje produktów, możesz pominąć ten krok.',
        'Jeżeli sprzedaje produkty, dodaj nazwę, kategorię, cenę i stan magazynowy.',
        'Ustaw minimum magazynowe, żeby system mógł ostrzegać o niskim stanie.'
      ]
    },
    {
      id: 'companyNotifications',
      title: '7. Panel firmy — powiadomienia SMS i Email',
      icon: '🏢',
      href: 'company-panel.html',
      lead: 'Tu ustawiasz komunikację automatyczną z klientami.',
      bullets: [
        'Ustaw treść SMS 24h przed wizytą, SMS po dodaniu wizyty, SMS po wizycie i SMS urodzinowy.',
        'Ustaw analogiczne treści Email: przypomnienie, potwierdzenie, podziękowanie i urodziny.',
        'SMS wymaga operatora SMS i kosztów wysyłki; Email działa przez skonfigurowaną domenę.',
        'W treściach używaj zmiennych typu {klient}, {firma}, {data}, {godzina}, {pracownik}.'
      ]
    },
    {
      id: 'companyProgramSettings',
      title: '8. Panel firmy — ustawienia programu',
      icon: '⚙️',
      href: 'company-panel.html',
      lead: 'Te ustawienia sterują zachowaniem całej firmy w systemie.',
      bullets: [
        'Wybierz język, walutę i podstawowe ustawienia firmy.',
        'Włącz „Pokaż pola zgody marketingowej przy dodawaniu/edycji klienta”, jeżeli firma chce zbierać zgody SMS/Email.',
        'Ustaw „Domyślnie zaznacz zgodę SMS jako NIE”, żeby klient musiał świadomie wybrać zgodę.',
        'Ustaw godziny pracy firmy, np. od 08:00 do 20:00.',
        'Ustaw domyślny czas wizyty, np. 30 min, oraz przerwę między wizytami.',
        'Pamiętaj: te ustawienia sterują siatką godzin na Dashboardzie. Przykład: 08:00-20:00, wizyta 30 min, przerwa 5 min → 08:00-08:30, 08:35-09:05, 09:10-09:40.'
      ]
    },
    {
      id: 'retentionPayments',
      title: '9. Retencja danych i metody płatności',
      icon: '💳',
      href: 'company-panel.html',
      lead: 'To są ustawienia księgowo-porządkowe, które warto ustawić przed pierwszą sprzedażą.',
      bullets: [
        'Czas przechowywania danych domyślnie ustaw na „Nigdy”, żeby system niczego automatycznie nie usuwał.',
        'Jeżeli wybierzesz krótszy okres, dane po czasie mogą zostać automatycznie usunięte.',
        'Dodaj metody płatności: gotówka, karta, przelew, blik lub własne.',
        'Przy każdej metodzie ustaw, czy liczy się do obrotu oraz prowizji.'
      ]
    },
    {
      id: 'customers',
      title: '10. Dodaj klientów',
      icon: '👤',
      href: 'customers.html',
      lead: 'Klienci są potrzebni do wizyt, historii, marketingu i raportów.',
      bullets: [
        'Dodaj imię i nazwisko, telefon oraz e-mail, jeżeli firma go posiada.',
        'Uzupełnij ważną informację, jeżeli pracownik powinien coś wiedzieć przed wizytą.',
        'Zaznacz zgody marketingowe tylko wtedy, gdy klient faktycznie je wyraził.'
      ]
    },
    {
      id: 'workSchedule',
      title: '11. Ustal grafik pracy pracowników',
      icon: '🗓️',
      href: 'work-schedule.html',
      lead: 'Dashboard powinien korzystać z realnych godzin pracy pracownika, a nie tylko z godzin pracy firmy.',
      bullets: [
        'Ustaw zakres dat, pracownika i godziny pracy.',
        'Dla pojedynczego dnia możesz zmienić grafik tylko dla tej daty.',
        'Jeżeli pracownik nie ma grafiku w danym dniu, Dashboard pokaże „POZA GRAFIKIEM”.',
        'Najpierw ustaw grafik, dopiero potem dodawaj wizyty na Dashboardzie.'
      ]
    },
    {
      id: 'dashboardAppointments',
      title: '12. Dashboard — dodawanie i obsługa wizyt',
      icon: '📅',
      href: 'dashboard.html',
      lead: 'Dashboard jest miejscem codziennej pracy z grafikiem i wizytami.',
      bullets: [
        'Wybierz dzień i kliknij wolny slot pracownika.',
        'Dodaj klienta, usługę, godzinę, płatność i notatkę.',
        'Po wykonanej usłudze zakończ wizytę, żeby trafiła do sprzedaży i raportów.',
        'Jeżeli klient nie przyjdzie albo termin odpada, odwołaj wizytę z powodem.',
        'Nie edytuj zakończonych i odwołanych wizyt jako normalnych aktywnych wizyt.'
      ]
    },
    {
      id: 'sales',
      title: '13. Sprzedaż',
      icon: '🛒',
      href: 'sales.html',
      lead: 'Sprzedaż pokazuje usługi, produkty, karnety i sprzedaż bez wizyty.',
      bullets: [
        'Zakończone wizyty trafiają do sprzedaży.',
        'Sprzedaż bez wizyty dodawaj osobno, np. gdy klient kupuje produkt bez rezerwacji.',
        'Sprawdzaj filtry dat, pracowników i metod płatności.',
        'Dane sprzedaży są podstawą raportów.'
      ]
    },
    {
      id: 'reports',
      title: '14. Raporty',
      icon: '📊',
      href: 'reports.html',
      lead: 'Raporty analizuj dopiero po ustawieniu podstaw i po wykonaniu realnych wizyt/sprzedaży.',
      bullets: [
        'Raport dzienny pokazuje konkretny dzień.',
        'Raport z okresu pokazuje wybrany zakres dat.',
        'Raport pracowników pokazuje pracę i sprzedaż per pracownik.',
        'Raport klientów pokazuje historię i aktywność klientów.'
      ]
    }
  ];

  function progressText(state) {
    const done = steps.filter(step => state[step.id]).length;
    return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
  }

  function render() {
    const state = loadState();
    const progress = progressText(state);
    const area = getPanelArea();
    const cards = steps.map((step) => {
      const checked = !!state[step.id];
      return `
        <article class="cm-tutorial-step ${checked ? 'is-done' : ''}" data-tutorial-step="${escapeHtml(step.id)}">
          <div class="cm-tutorial-step-top">
            <label class="cm-tutorial-check">
              <input type="checkbox" data-tutorial-check="${escapeHtml(step.id)}" ${checked ? 'checked' : ''}>
              <span>${checked ? 'Gotowe' : 'Do zrobienia'}</span>
            </label>
            ${step.optional ? '<span class="cm-tutorial-badge">Opcjonalne</span>' : ''}
          </div>
          <div class="cm-tutorial-title"><span>${escapeHtml(step.icon)}</span><h3>${escapeHtml(step.title)}</h3></div>
          <p>${escapeHtml(step.lead)}</p>
          <details>
            <summary>Instrukcja krok po kroku</summary>
            <ul>${step.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </details>
          <div class="cm-tutorial-actions">
            <a class="bm-secondary-btn" href="${escapeHtml(step.href)}">Przejdź do modułu</a>
          </div>
        </article>`;
    }).join('');

    area.innerHTML = `
      <section class="cm-tutorial-hero">
        <div>
          <span class="cm-tutorial-kicker">Samouczek</span>
          <h2>Wdrożenie firmy krok po kroku</h2>
          <p>Ta ścieżka prowadzi nową firmę od pustego konta do pierwszych wizyt, sprzedaży i raportów. Kolejność jest ważna: stanowiska → pracownicy → uprawnienia → usługi → ustawienia firmy → klienci → grafik → Dashboard → raporty.</p>
        </div>
        <div class="cm-tutorial-progress-card">
          <strong>${progress.done}/${progress.total}</strong>
          <span>ukończonych kroków</span>
          <div class="cm-tutorial-progress"><i style="width:${progress.pct}%"></i></div>
          <button type="button" class="bm-secondary-btn" id="cmTutorialReset">Resetuj postęp</button>
        </div>
      </section>
      <section class="cm-tutorial-warning">
        <strong>Najważniejsza zasada:</strong> nie zaczynaj od Dashboardu. Najpierw trzeba przygotować stanowiska, pracowników, uprawnienia, usługi, ustawienia firmy, klientów i grafik pracy.
      </section>
      <section class="cm-tutorial-grid">${cards}</section>
    `;

    area.querySelectorAll('[data-tutorial-check]').forEach((input) => {
      input.addEventListener('change', () => {
        const next = loadState();
        next[input.dataset.tutorialCheck] = input.checked;
        saveState(next);
        render();
      });
    });
    area.querySelector('#cmTutorialReset')?.addEventListener('click', () => {
      if (!confirm('Zresetować postęp samouczka?')) return;
      localStorage.removeItem(STORAGE_KEY);
      render();
    });
  }

  function boot() {
    const area = getPanelArea();
    if (!area || !document.querySelector('.bm-panel')) {
      setTimeout(boot, 80);
      return;
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
