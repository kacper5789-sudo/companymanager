// CompanyManager — 049A Panel firmy Supabase
// company-panel.html: real company data/settings from Supabase.
(function () {
  const PAGE = "companyPanel";

  function isPage() {
    return document.body?.dataset?.panelPage === PAGE || location.pathname.includes("company-panel.html");
  }
  if (!isPage()) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  async function waitForFrame() {
    for (let i = 0; i < 60; i += 1) {
      const area = $(".bm-panel-workspace") || $(".bm-panel-area") || $("#dashboardRoot");
      if (area && !area.textContent.includes("Ładowanie panelu")) return area;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return $("#dashboardRoot");
  }

  async function requireAccess() {
    if (!window.cmSupabase) throw new Error("Brak połączenia z Supabase.");
    const { data, error } = await window.cmSupabase.rpc("get_my_access");
    if (error) throw error;
    if (!data?.allowed) throw new Error("Brak dostępu do panelu firmy.");
    localStorage.setItem("cm_access", JSON.stringify(data));
    return data;
  }

  async function fetchPanel() {
    const { data, error } = await window.cmSupabase.rpc("company_panel_get");
    if (error) throw error;
    return data || {};
  }

  async function savePanel(payload) {
    const { data, error } = await window.cmSupabase.rpc("company_panel_update", { p_payload: payload });
    if (error) throw error;
    return data || {};
  }

  function val(obj, ...keys) {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value) !== "") return value;
    }
    return "";
  }

  function checked(obj, key) {
    return obj?.[key] === true || obj?.[key] === "true" || obj?.[key] === 1;
  }

  function normalizeLanguage(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'en' || raw === 'eng' || raw === 'english') return 'en-gb';
    return raw === 'en-gb' ? 'en-gb' : 'pl';
  }

  function normalizeTimezone(value) {
    const raw = String(value || '').trim();
    const aliases = { 'warsaw/poland':'Europe/Warsaw', 'poland/warsaw':'Europe/Warsaw', 'warszawa':'Europe/Warsaw' };
    return aliases[raw.toLowerCase()] || raw || 'Europe/Warsaw';
  }

  function readExchangeRates(company) {
    let raw = company?.exchange_rates;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = null; } }
    return { PLN: 1, EUR: Number(raw?.EUR || 0.23), USD: Number(raw?.USD || 0.27) };
  }

  function syncGlobalSettings(company) {
    if (!company) return;
    const settings = {
      language: normalizeLanguage(company.language),
      currency: String(company.currency || 'PLN').toUpperCase(),
      timezone: normalizeTimezone(company.timezone),
      exchange_rates: readExchangeRates(company)
    };
    if (window.cmSetCompanySettings) window.cmSetCompanySettings(settings);
    else localStorage.setItem('cm_company_settings', JSON.stringify(settings));
    localStorage.setItem('cmLanguage', settings.language);
  }


  const DEFAULT_PAYMENT_METHODS = [
    { name: "gotówka", turnover: true, commission: true, default: true }
  ];

  function normalizePaymentMethods(company) {
    let raw = company?.payment_methods;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { raw = null; }
    }
    const source = Array.isArray(raw) && raw.length ? raw : DEFAULT_PAYMENT_METHODS;
    const seen = new Set();
    const methods = source.map((item) => {
      const name = String(item?.name || item?.label || "").trim();
      if (!name) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        name,
        turnover: item?.turnover !== false,
        commission: item?.commission !== false,
        default: item?.default === true || key === "gotówka"
      };
    }).filter(Boolean);
    if (!methods.some((m) => m.name.toLowerCase() === "gotówka")) {
      methods.unshift({ name: "gotówka", turnover: true, commission: true, default: true });
    }
    return methods;
  }

  function paymentMethodRow(method, index) {
    const isDefaultCash = String(method?.name || "").trim().toLowerCase() === "gotówka";
    return `<div class="cm-payment-method-row" data-payment-method-row>
      <label class="cm-payment-method-name">Nazwa metody
        <input type="text" data-payment-name value="${escapeHtml(method?.name || "")}" ${isDefaultCash ? "readonly" : ""} placeholder="np. karta, przelew, blik">
      </label>
      <label class="cm-check-line cm-payment-method-check"><input type="checkbox" data-payment-turnover ${method?.turnover !== false ? "checked" : ""}> Obrót</label>
      <label class="cm-check-line cm-payment-method-check"><input type="checkbox" data-payment-commission ${method?.commission !== false ? "checked" : ""}> Prowizje</label>
      <button type="button" class="bm-light-btn cm-payment-method-delete" data-payment-remove ${isDefaultCash ? "disabled title='Metoda domyślna'" : ""}>Usuń</button>
    </div>`;
  }

  function renderPaymentMethodsSettings(company) {
    const methods = normalizePaymentMethods(company);
    return `<fieldset class="cm-notification-box cm-payment-methods-box"><legend>Metody płatności</legend>
      <p class="bm-muted cm-full-field">Domyślna metoda to gotówka. Możesz dodać własne metody i oznaczyć, czy mają liczyć się do obrotu oraz prowizji.</p>
      <div class="cm-payment-methods-head">
        <span>Nazwa</span><span>Obrót</span><span>Prowizje</span><span>Akcja</span>
      </div>
      <div class="cm-payment-methods-list" data-payment-methods-list>
        ${methods.map(paymentMethodRow).join("")}
      </div>
      <div class="cm-form-actions cm-full-field">
        <button type="button" class="bm-primary-btn" data-payment-add>Dodaj metodę</button>
      </div>
    </fieldset>`;
  }



  function dataRetentionValue(company) {
    const raw = company?.data_retention_months;
    if (raw === undefined || raw === null || raw === "" || String(raw).toLowerCase() === "null") return "never";
    return String(raw);
  }

  function renderDataRetentionSettings(company) {
    const options = [
      { value: "6", label: "6 miesięcy" },
      { value: "12", label: "12 miesięcy" },
      { value: "24", label: "24 miesiące" },
      { value: "36", label: "36 miesięcy" },
      { value: "48", label: "48 miesięcy" },
      { value: "60", label: "60 miesięcy" },
      { value: "never", label: "Nigdy" }
    ];
    return `<fieldset class="cm-notification-box cm-data-retention-box"><legend>Czas przechowywania danych</legend>
      <div class="cm-retention-warning cm-full-field">
        <strong>⚠ UWAGA!</strong>
        <span>Dane zostaną automatycznie usunięte po upływie wybranego czasu.</span>
      </div>
      ${selectField("Okres przechowywania danych", "data_retention_months", dataRetentionValue(company), options)}
      <p class="bm-muted cm-full-field">Wartość „Nigdy” oznacza brak automatycznego usuwania danych. To ustawienie jest domyślne dla bezpieczeństwa nowych firm.</p>
    </fieldset>`;
  }

  function field(label, name, value, type = "text", extra = "") {
    return `<label>${escapeHtml(label)}<input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}" ${extra}></label>`;
  }

  function selectField(label, name, value, options) {
    const current = String(value ?? "");
    return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}">${options.map((item) => {
      const selected = String(item.value) === current ? "selected" : "";
      return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
    }).join("")}</select></label>`;
  }

  function textarea(label, name, value, rows = 5) {
    return `<label class="cm-full-field">${escapeHtml(label)}<textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value ?? "")}</textarea></label>`;
  }

  function check(label, name, isChecked) {
    return `<label class="cm-check-line"><input type="checkbox" name="${escapeHtml(name)}" ${isChecked ? "checked" : ""}> ${escapeHtml(label)}</label>`;
  }

  function infoRow(label, value) {
    return `<div class="bm-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`;
  }

  function currentView() {
    const params = new URLSearchParams(location.search || "");
    return params.get("view") || "company-data";
  }

  function nav(view, label, active) {
    return `<a class="bm-light-btn ${active ? "active" : ""}" href="company-panel.html?view=${encodeURIComponent(view)}">${escapeHtml(label)}</a>`;
  }

  function renderSwitcher(view) {
    const items = [
      ["company-data", "Dane firmy"],
      ["notifications", "Powiadomienia"],
      ["program-settings", "Ustawienia programu"],
      ["payments", "Płatności CompanyManager"]
    ];
    return `<div class="cm-customer-report-switcher cm-company-panel-switcher" aria-label="Panel Firmy">
      ${items.map(([id, label]) => nav(id, label, id === view)).join("")}
    </div>`;
  }

  function renderCompanyData(company, profile) {
    return `<section class="bm-page-card bm-company-data-page" id="company-data">
      <div class="bm-page-head"><h2>Dane firmy</h2><p>Dane są zapisywane w Supabase dla aktualnej firmy.</p></div>
      <form class="bm-form-grid cm-company-panel-form" data-company-panel-form="company">
        <fieldset class="cm-notification-box"><legend>Pakiet i osoba do kontaktu</legend>
          ${infoRow("Pakiet", val(company, "package", "selected_plan") || "—")}
          ${infoRow("Data ważności", val(company, "package_expires_at", "expires_at") || "—")}
          ${field("Osoba do kontaktu", "contact_person", val(company, "contact_person") || val(profile, "full_name"))}
          ${field("Nr telefonu", "contact_phone", val(company, "contact_phone") || val(profile, "phone"))}
          ${field("Adres email", "contact_email", val(company, "contact_email") || val(profile, "email"), "email")}
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Dane firmy</legend>
          ${field("Nazwa firmy", "name", val(company, "name"))}
          ${field("Adres", "address", val(company, "address", "company_address"))}
          ${field("Kod pocztowy", "postal_code", val(company, "postal_code", "company_postal_code"))}
          ${field("Miejscowość", "city", val(company, "city", "company_city"))}
          ${field("Telefon firmowy", "company_phone", val(company, "company_phone", "phone", "reception_phone", "contact_phone"))}
          ${field("Email firmowy", "company_email", val(company, "company_email", "email", "reception_email", "contact_email"), "email")}
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Dane do faktury VAT</legend>
          ${field("Pełna nazwa firmy", "billing_name", val(company, "billing_name") || val(company, "name"))}
          ${field("Adres ul.", "billing_address", val(company, "billing_address"))}
          ${field("Kod pocztowy", "billing_postal_code", val(company, "billing_postal_code"))}
          ${field("Miejscowość", "billing_city", val(company, "billing_city"))}
          ${field("NIP / VAT EU", "billing_nip", val(company, "billing_nip", "nip", "tax_id"))}
          ${field("Adres email - wysyłka faktur", "invoice_email", val(company, "invoice_email") || val(profile, "email"), "email")}
        </fieldset>
        <div class="cm-form-actions cm-full-field"><button type="submit" class="bm-primary-btn">Zapisz dane firmy</button></div>
      </form>
    </section>`;
  }

  function notificationBlock(kind, enabledName, enabledLabel, fieldsHtml, isOpen) {
    return `<div class="cm-notification-toggle-block">
      ${check(enabledLabel, enabledName, isOpen)}
      <div class="cm-notification-fields cm-full-field" data-notification-fields-for="${escapeHtml(enabledName)}" ${isOpen ? "" : "hidden"}>${fieldsHtml}</div>
    </div>`;
  }

  function renderNotifications(company) {
    const smsSender = (key) => val(company, key, "sms_sender", "message_sender");
    const emailSender = (key) => val(company, key, "name", "company_email", "email");
    return `<section class="bm-page-card cm-notification-settings-page" id="notifications">
      <div class="bm-page-head"><h2>Ustawienia powiadomień</h2><p>Treść i nadawca pokazują się dopiero po zaznaczeniu danego automatu.</p></div>
      <form class="bm-form-grid cm-company-panel-form" data-company-panel-form="notifications">
        <fieldset class="cm-notification-box"><legend>Powiadomienia automatyczne SMS</legend>
          ${notificationBlock("sms", "visit_sms_24", "powiadamiaj o wizytach przez SMS - 24h przed wizytą",
            `${field("Nadawca SMS", "visit_sms_sender", smsSender("visit_sms_sender"))}${textarea("Treść SMS", "visit_sms_template", val(company, "visit_sms_template"), 5)}`,
            checked(company, "visit_sms_24"))}
          ${notificationBlock("sms", "birthday_sms", "wyślij życzenia urodzinowe przez SMS",
            `${field("Nadawca SMS", "birthday_sms_sender", smsSender("birthday_sms_sender"))}${textarea("Treść SMS z życzeniami", "birthday_sms_template", val(company, "birthday_sms_template"), 5)}`,
            checked(company, "birthday_sms"))}
          ${notificationBlock("sms", "after_add_sms", "wyślij SMS po dodaniu wizyty",
            `${field("Nadawca SMS", "after_add_sms_sender", smsSender("after_add_sms_sender"))}${textarea("Treść SMS po dodaniu wizyty", "after_add_sms_template", val(company, "after_add_sms_template"), 5)}`,
            checked(company, "after_add_sms"))}
          ${notificationBlock("sms", "after_visit_sms", "wyślij SMS po wizycie",
            `${field("Nadawca SMS", "after_visit_sms_sender", smsSender("after_visit_sms_sender"))}${textarea("Treść SMS po wizycie", "after_visit_sms_template", val(company, "after_visit_sms_template"), 5)}`,
            checked(company, "after_visit_sms"))}
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Powiadomienia automatyczne EMAIL</legend>
          <p class="bm-muted cm-full-field">Pole „Nadawca email” jest nazwą widoczną u klienta, np. „PWC Studio”. Techniczny adres wysyłki obsługuje CompanyManager.</p>
          ${notificationBlock("email", "visit_email_24", "powiadamiaj o wizytach przez EMAIL - 24h przed wizytą",
            `${field("Nadawca email", "visit_email_sender", emailSender("visit_email_sender"), "text", "maxlength=50 placeholder='np. Nazwa firmy'")}${field("Temat email", "visit_email_subject", val(company, "visit_email_subject") || "Przypomnienie o wizycie", "text", "maxlength=120")}${textarea("Treść email", "visit_email_template", val(company, "visit_email_template"), 6)}`,
            checked(company, "visit_email_24"))}
          ${notificationBlock("email", "birthday_email", "wyślij życzenia urodzinowe przez EMAIL",
            `${field("Nadawca email", "birthday_email_sender", emailSender("birthday_email_sender"), "text", "maxlength=50 placeholder='np. Nazwa firmy'")}${field("Temat email", "birthday_email_subject", val(company, "birthday_email_subject") || "Wszystkiego najlepszego", "text", "maxlength=120")}${textarea("Treść email z życzeniami", "birthday_email_template", val(company, "birthday_email_template"), 6)}`,
            checked(company, "birthday_email"))}
          ${notificationBlock("email", "after_add_email", "wyślij EMAIL po dodaniu wizyty",
            `${field("Nadawca email", "after_add_email_sender", emailSender("after_add_email_sender"), "text", "maxlength=50 placeholder='np. Nazwa firmy'")}${field("Temat email", "after_add_email_subject", val(company, "after_add_email_subject") || "Potwierdzenie rezerwacji", "text", "maxlength=120")}${textarea("Treść email po dodaniu wizyty", "after_add_email_template", val(company, "after_add_email_template"), 6)}`,
            checked(company, "after_add_email"))}
          ${notificationBlock("email", "after_visit_email", "wyślij EMAIL po wizycie",
            `${field("Nadawca email", "after_visit_email_sender", emailSender("after_visit_email_sender"), "text", "maxlength=50 placeholder='np. Nazwa firmy'")}${field("Temat email", "after_visit_email_subject", val(company, "after_visit_email_subject") || "Dziękujemy za wizytę", "text", "maxlength=120")}${textarea("Treść email po wizycie", "after_visit_email_template", val(company, "after_visit_email_template"), 6)}`,
            checked(company, "after_visit_email"))}
        </fieldset>
        <div class="cm-form-actions cm-full-field"><button type="submit" class="bm-primary-btn">Zapisz powiadomienia</button></div>
      </form>
    </section>`;
  }

  function renderProgramSettings(company) {
    return `<section class="bm-page-card cm-program-settings-page" id="program-settings">
      <div class="bm-page-head"><h2>Ustawienia programu</h2></div>
      <form class="bm-form-grid cm-company-panel-form" data-company-panel-form="program">
        <fieldset class="cm-notification-box cm-general-settings-box"><legend>Ustawienia ogólne</legend>
          <label>Język programu<select name="language" data-general-language><option value="pl" ${normalizeLanguage(val(company,"language")) === "pl" ? "selected" : ""}>Polski</option><option value="en-gb" ${normalizeLanguage(val(company,"language")) === "en-gb" ? "selected" : ""}>English</option></select></label>
          <label>Waluta<select name="currency" data-general-currency><option value="PLN" ${(val(company,"currency") || "PLN") === "PLN" ? "selected" : ""}>PLN</option><option value="EUR" ${val(company,"currency") === "EUR" ? "selected" : ""}>EUR</option><option value="USD" ${val(company,"currency") === "USD" ? "selected" : ""}>USD</option></select></label>
          <label>Strefa czasowa<select name="timezone" data-general-timezone>
            ${[
              ['Europe/Warsaw','Warsaw / Poland'],
              ['Europe/London','London / UK'],
              ['Europe/Berlin','Berlin / Germany'],
              ['Europe/Paris','Paris / France'],
              ['America/New_York','New York / USA'],
              ['America/Chicago','Chicago / USA'],
              ['America/Los_Angeles','Los Angeles / USA']
            ].map(([value,label]) => `<option value="${escapeHtml(value)}" ${normalizeTimezone(val(company,'timezone')) === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select></label>
          <div class="cm-currency-conversion-note cm-full-field">
            <p class="bm-muted">Waluta steruje formatem cen w panelu. Kursy są zapisane przy firmie i przygotowane pod bezpieczne przeliczanie wartości w kolejnym kroku.</p>
            <div class="cm-currency-rate-grid">
              ${field("Kurs PLN → EUR", "exchange_rate_eur", readExchangeRates(company).EUR, "number", "min=0 step=0.0001")}
              ${field("Kurs PLN → USD", "exchange_rate_usd", readExchangeRates(company).USD, "number", "min=0 step=0.0001")}
            </div>
          </div>
        </fieldset>
        <fieldset class="cm-notification-box cm-marketing-consent-box"><legend>Dodaj klienta — zgoda na reklamę</legend>
          ${check("Pokaż pola zgody marketingowej przy dodawaniu/edycji klienta", "client_marketing_consent_enabled", val(company, "client_marketing_consent_enabled") === "" ? true : checked(company, "client_marketing_consent_enabled"))}
          ${check("Domyślnie zaznacz zgodę SMS jako NIE / wymaga świadomego wyboru", "client_marketing_consent_explicit", val(company, "client_marketing_consent_explicit") === "" ? true : checked(company, "client_marketing_consent_explicit"))}
          <p class="bm-muted cm-full-field">Zgody zapisują się przy kliencie jako osobne pola: SMS i Email. Dzięki temu w Marketingu wiadomo, komu można wysłać reklamę.</p>
        </fieldset>
        <fieldset class="cm-notification-box cm-work-hours-box"><legend>Godziny pracy firmy</legend>
          ${field("Godziny pracy od", "working_day_start", val(company, "working_day_start") || "08:00", "time")}
          ${field("Godziny pracy do", "working_day_end", val(company, "working_day_end") || "20:00", "time")}
          ${field("Domyślny czas wizyty (min)", "default_visit_duration_minutes", val(company, "default_visit_duration_minutes") || 30, "number", "min=5 step=5")}
          ${selectField("Przerwa między wizytami", "appointment_break_minutes", val(company, "appointment_break_minutes") || 0, [
            { value: 0, label: "Bez przerwy" },
            { value: 5, label: "5 min" },
            { value: 15, label: "15 min" },
            { value: 30, label: "30 min" },
            { value: 45, label: "45 min" },
            { value: 60, label: "60 min" }
          ])}
          <p class="bm-muted cm-full-field">Te ustawienia sterują siatką godzin na Dashboardzie. Przykład: 08:00-20:00, wizyta 30 min, przerwa 5 min → 08:00-08:30, 08:35-09:05, 09:10-09:40.</p>
        </fieldset>
        ${renderDataRetentionSettings(company)}
        ${renderPaymentMethodsSettings(company)}
        <div class="cm-form-actions cm-full-field"><button type="submit" class="bm-primary-btn">Zapisz ustawienia programu</button></div>
      </form>
    </section>`;
  }

  function renderPayments(company) {
    return `<section class="bm-page-card cm-company-payments-page" id="payments">
      <div class="bm-page-head"><h2>Płatności CompanyManager</h2></div>
      <div class="bm-company-data-grid">
        <article class="bm-company-data-card">
          <h3>Aktualny pakiet</h3>
          ${infoRow("Pakiet", val(company, "package", "selected_plan") || "—")}
          ${infoRow("Status", val(company, "status") || "—")}
          ${infoRow("Data ważności", val(company, "package_expires_at", "expires_at") || "—")}
        </article>
        <article class="bm-company-data-card">
          <h3>Dane do faktury</h3>
          ${infoRow("Nazwa", val(company, "billing_name") || val(company, "name"))}
          ${infoRow("NIP", val(company, "billing_nip", "nip", "tax_id") || "—")}
          ${infoRow("Email faktury", val(company, "invoice_email") || val(company, "company_email") || "—")}
        </article>
      </div>
    </section>`;
  }

  function collectPaymentMethods(form) {
    const rows = $$('[data-payment-method-row]', form);
    if (!rows.length) return null;
    const seen = new Set();
    const methods = rows.map((row) => {
      const name = String(row.querySelector('[data-payment-name]')?.value || '').trim();
      if (!name) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        name,
        turnover: row.querySelector('[data-payment-turnover]')?.checked !== false,
        commission: row.querySelector('[data-payment-commission]')?.checked !== false,
        default: key === 'gotówka'
      };
    }).filter(Boolean);
    if (!methods.some((m) => m.name.toLowerCase() === 'gotówka')) {
      methods.unshift({ name: 'gotówka', turnover: true, commission: true, default: true });
    }
    return methods;
  }

  function formPayload(form) {
    const data = {};
    Array.from(new FormData(form).entries()).forEach(([key, value]) => { data[key] = String(value).trim(); });
    $$('input[type="checkbox"]', form).forEach((input) => { if (input.name) data[input.name] = input.checked; });
    const paymentMethods = collectPaymentMethods(form);
    if (paymentMethods) data.payment_methods = paymentMethods;
    if (data.data_retention_months === "never") data.data_retention_months = "";
    if (data.language) data.language = normalizeLanguage(data.language);
    if (data.timezone) data.timezone = normalizeTimezone(data.timezone);
    if (data.currency) data.currency = String(data.currency).toUpperCase();
    if (data.exchange_rate_eur || data.exchange_rate_usd) {
      data.exchange_rates = {
        PLN: 1,
        EUR: Number(data.exchange_rate_eur || 0.23),
        USD: Number(data.exchange_rate_usd || 0.27)
      };
    }
    return data;
  }

  function bindPaymentMethodButtons(root) {
    const list = $('[data-payment-methods-list]', root);
    if (!list) return;
    const addBtn = $('[data-payment-add]', root);
    addBtn?.addEventListener('click', () => {
      list.insertAdjacentHTML('beforeend', paymentMethodRow({ name: '', turnover: true, commission: true, default: false }, list.children.length));
      const last = list.querySelector('[data-payment-method-row]:last-child [data-payment-name]');
      last?.focus();
    });
    list.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-payment-remove]');
      if (!btn || btn.disabled) return;
      btn.closest('[data-payment-method-row]')?.remove();
    });
  }

  function bindNotificationToggles(root) {
    $$('[data-notification-fields-for]', root).forEach((fields) => {
      const name = fields.getAttribute('data-notification-fields-for');
      const input = root.querySelector(`input[type="checkbox"][name="${name}"]`);
      const sync = () => { fields.hidden = !input?.checked; };
      sync();
      input?.addEventListener('change', sync);
    });
  }

  function bindForms(root, state) {
    bindPaymentMethodButtons(root);
    bindNotificationToggles(root);
    $$('[data-company-panel-form]', root).forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const old = button?.textContent || "Zapisz";
        if (button) { button.disabled = true; button.textContent = "Zapisuję..."; }
        try {
          const payload = formPayload(form);
          await savePanel(payload);
          if (form.getAttribute('data-company-panel-form') === 'program') {
            try {
              await window.cmSupabase?.rpc?.('cm_update_general_settings', {
                p_language: payload.language || null,
                p_currency: payload.currency || null,
                p_timezone: payload.timezone || null,
                p_exchange_rates: payload.exchange_rates || null
              });
            } catch (settingsError) {
              console.warn('Nie zapisano rozszerzonych ustawień ogólnych przez RPC.', settingsError);
            }
            syncGlobalSettings({
              ...(state.data?.company || {}),
              ...payload,
              exchange_rates: payload.exchange_rates || readExchangeRates(state.data?.company || {})
            });
            if (payload.language) {
              localStorage.setItem('cmLanguage', normalizeLanguage(payload.language));
            }
          }
          alert("Zapisano panel firmy.");
          state.data = await fetchPanel();
          syncGlobalSettings(state.data.company || {});
          render(state);
        } catch (error) {
          alert("Błąd zapisu panelu firmy: " + (error?.message || error));
        } finally {
          if (button) { button.disabled = false; button.textContent = old; }
        }
      });
    });
  }

  function render(state) {
    const area = $(".bm-panel-area") || $(".bm-panel-workspace") || $("#dashboardRoot");
    const data = state.data || {};
    const company = data.company || {};
    const profile = data.profile || {};
    syncGlobalSettings(company);
    const view = currentView();
    const body = view === "notifications" ? renderNotifications(company)
      : view === "program-settings" ? renderProgramSettings(company)
      : view === "payments" ? renderPayments(company)
      : renderCompanyData(company, profile);

    area.innerHTML = `<section class="bm-page-card cm-company-panel-page">${renderSwitcher(view)}</section>${body}`;
    bindForms(area, state);
    window.cmCleanupModalState?.();
    window.cmReinitDatepickers?.();
  }

  async function init() {
    try {
      await requireAccess();
      await waitForFrame();
      const state = { data: await fetchPanel() };
      render(state);
    } catch (error) {
      const root = $("#dashboardRoot") || document.body;
      root.innerHTML = `<section class="bm-page-card"><h2>Błąd panelu firmy</h2><p>${escapeHtml(error?.message || error)}</p></section>`;
      console.error("Company panel Supabase error", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
