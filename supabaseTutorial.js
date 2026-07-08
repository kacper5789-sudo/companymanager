// CompanyManager — Samouczek wdrożeniowy v304
(function () {
  function isTutorialPage() {
    return document.body?.dataset?.panelPage === 'tutorial' || window.location.pathname.includes('tutorial.html');
  }
  if (!isTutorialPage()) return;

  const STORAGE_KEY = 'cmTutorialChecklistV2';
  const OLD_STORAGE_KEY = 'cmTutorialChecklistV1';
  const COMPLETE_KEY = 'cmTutorialCompleted';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function getPanelArea() {
    return document.querySelector('.bm-panel-area') || document.getElementById('dashboardRoot') || document.body;
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
      if (Object.keys(current).length) return current;
      return JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || '{}') || {};
    } catch (_) { return {}; }
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
        'Jeżeli pracownik nie ma się logować, możesz zablokować logowanie albo ograniczyć logowanie godzinowe.'
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
      id: 'userLogs',
      title: '4. Użytkownicy — dzienniki logowań',
      icon: '🧾',
      href: 'users.html',
      lead: 'Dzienniki logowań pomagają sprawdzić, kto i kiedy próbował wejść do systemu.',
      bullets: [
        'W zakładce Użytkownicy sprawdzisz historię logowań pracowników.',
        'Dziennik pokazuje m.in. datę, login, status, IP i przeglądarkę.',
        'To pomaga wykrywać błędne hasła, próby logowania poza godzinami albo problemy pracownika z dostępem.',
        'Nie myl dzienników logowań z Historią aktywności — to dwa różne miejsca.'
      ]
    },
    {
      id: 'serviceCategories',
      title: '5. Dodaj kategorie usług',
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
      title: '6. Dodaj usługi w kategoriach',
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
      title: '7. Dodaj produkty — opcjonalnie',
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
      id: 'passes',
      title: '8. Karnety — kiedy i po co',
      icon: '🎟️',
      href: 'passes.html',
      lead: 'Karnety są dla firm, które sprzedają pakiety wejść albo pakiety kwotowe do wykorzystania przez klienta.',
      optional: true,
      bullets: [
        'Karnet wejściowy oznacza określoną liczbę wejść, np. 5 masaży albo 10 treningów.',
        'Karnet kwotowy oznacza pulę pieniędzy do wykorzystania na usługi.',
        'Sprzedaż karnetu jest osobną sprzedażą, a późniejsze użycie karnetu nie powinno podwójnie zawyżać raportów.',
        'Jeżeli firma nie używa karnetów, ten moduł można pominąć.'
      ]
    },
    {
      id: 'companyNotifications',
      title: '9. Panel firmy — powiadomienia SMS i Email',
      icon: '🏢',
      href: 'company-panel.html',
      lead: 'Tu ustawiasz komunikację automatyczną z klientami.',
      bullets: [
        'SMS 24h przed wizytą przypomina klientowi o terminie. Wysyłka SMS wymaga operatora SMS i może generować koszt.',
        'Email 24h przed wizytą działa podobnie, ale idzie przez skonfigurowaną domenę e-mail.',
        'Powiadomienie po dodaniu wizyty potwierdza rezerwację klientowi.',
        'Powiadomienie po wizycie może być podziękowaniem albo prośbą o kontakt/opinię.',
        'Wiadomość urodzinowa działa na podstawie daty urodzenia klienta.',
        'W treściach używaj zmiennych typu {klient}, {firma}, {data}, {godzina}, {pracownik}.'
      ]
    },
    {
      id: 'companyProgramSettings',
      title: '10. Panel firmy — ustawienia programu',
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
      title: '11. Retencja danych i metody płatności',
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
      title: '12. Dodaj klientów',
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
      id: 'marketing',
      title: '13. Marketing — kampanie SMS i Email',
      icon: '📢',
      href: 'marketing.html',
      lead: 'Marketing służy do wysyłania kampanii do klientów, a nie do zwykłej obsługi pojedynczej wizyty.',
      optional: true,
      bullets: [
        'Kampanie Email możesz wysyłać do klientów, którzy mają adres e-mail i odpowiednią zgodę.',
        'Kampanie SMS wymagają numeru telefonu, zgody SMS i podłączonego operatora SMS.',
        'Używaj filtrów odbiorców, żeby nie wysyłać wiadomości do całej bazy bez potrzeby.',
        'Raporty kampanii pokazują statusy odbiorców i pomagają sprawdzić skuteczność wysyłki.'
      ]
    },
    {
      id: 'workSchedule',
      title: '14. Ustal grafik pracy pracowników',
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
      id: 'daysOff',
      title: '15. Dni wolne pracowników',
      icon: '🌴',
      href: 'days-off.html',
      lead: 'Dni wolne blokują dostępność pracownika niezależnie od tego, czy ma ustawiony grafik pracy.',
      bullets: [
        'Dodaj dzień wolny dla konkretnego pracownika i konkretnego zakresu dat.',
        'Jeżeli pracownik ma dzień wolny, Dashboard powinien traktować go jako niedostępnego.',
        'Używaj tego do urlopów, L4, nieobecności i dni zamkniętych dla pracownika.',
        'Dni wolne pomagają też utrzymać poprawne raporty pracy.'
      ]
    },
    {
      id: 'dashboardAppointments',
      title: '16. Dashboard — dodawanie i obsługa wizyt',
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
      id: 'undoTime',
      title: '17. Cofnij Czas — co to znaczy',
      icon: '⏪',
      href: 'dashboard.html',
      lead: 'Cofnij Czas to zabezpieczenie, które pozwala wrócić do ostatnich działań, gdy użytkownik popełni błąd.',
      bullets: [
        'Przycisk znajduje się w bocznym panelu.',
        'Służy do cofania wybranych ostatnich operacji, np. przypadkowej zmiany lub usunięcia, jeżeli system zapisał taką akcję.',
        'Nie traktuj tego jako kopii zapasowej całej firmy — to szybka pomoc przy świeżych pomyłkach.',
        'Przy poważnych zmianach i tak warto sprawdzić Historię aktywności.'
      ]
    },
    {
      id: 'sales',
      title: '18. Sprzedaż',
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
      id: 'activity',
      title: '19. Historia aktywności',
      icon: '🕘',
      href: 'activity.html',
      lead: 'Historia aktywności pokazuje ważne operacje wykonane w firmie.',
      bullets: [
        'To miejsce pomaga sprawdzić, kto dodał, edytował albo usunął dane.',
        'Widać tam czytelne opisy zmian, bez potrzeby czytania technicznego JSON-a.',
        'Historia aktywności jest szczególnie przydatna dla ADMINA i OWNERA przy wyjaśnianiu pomyłek.',
        'To nie jest dziennik logowań — logowania sprawdzasz w zakładce Użytkownicy.'
      ]
    },
    {
      id: 'reports',
      title: '20. Raporty',
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
    const total = steps.length;
    const pct = Math.round((done / total) * 100);
    const complete = done === total;
    try { localStorage.setItem(COMPLETE_KEY, complete ? 'true' : 'false'); } catch (_) {}
    return { done, total, pct, complete };
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
      ${progress.complete ? `
        <section class="cm-tutorial-complete">
          <strong>Samouczek ukończony.</strong> Od teraz link do Samouczka nie będzie już pierwszy w górnym menu. Po odświeżeniu lub przejściu do innej zakładki pojawi się na końcu, za wyborem języka.
        </section>` : ''}
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
      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.setItem(COMPLETE_KEY, 'false');
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
