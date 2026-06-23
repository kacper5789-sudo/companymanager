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

  function renderNotifications(company) {
    return `<section class="bm-page-card cm-notification-settings-page" id="notifications">
      <div class="bm-page-head"><h2>Ustawienia powiadomień</h2></div>
      <form class="bm-form-grid cm-company-panel-form" data-company-panel-form="notifications">
        <fieldset class="cm-notification-box"><legend>Powiadomienia automatyczne SMS</legend>
          ${check("powiadamiaj o wizytach przez SMS - 24h przed wizytą", "visit_sms_24", checked(company, "visit_sms_24"))}
          ${field("Nadawca SMS", "visit_sms_sender", val(company, "visit_sms_sender", "sms_sender", "message_sender"))}
          ${textarea("Treść SMS", "visit_sms_template", val(company, "visit_sms_template"), 5)}
          ${check("wyślij życzenia urodzinowe przez SMS", "birthday_sms", checked(company, "birthday_sms"))}
          ${field("Nadawca SMS", "birthday_sms_sender", val(company, "birthday_sms_sender", "sms_sender", "message_sender"))}
          ${textarea("Treść SMS z życzeniami", "birthday_sms_template", val(company, "birthday_sms_template"), 5)}
          ${check("wyślij SMS po dodaniu wizyty", "after_add_sms", checked(company, "after_add_sms"))}
          ${field("Nadawca SMS", "after_add_sms_sender", val(company, "after_add_sms_sender", "sms_sender", "message_sender"))}
          ${textarea("Treść SMS po dodaniu wizyty", "after_add_sms_template", val(company, "after_add_sms_template"), 5)}
          ${check("wyślij SMS po wizycie", "after_visit_sms", checked(company, "after_visit_sms"))}
          ${field("Nadawca SMS", "after_visit_sms_sender", val(company, "after_visit_sms_sender", "sms_sender", "message_sender"))}
          ${textarea("Treść SMS po wizycie", "after_visit_sms_template", val(company, "after_visit_sms_template"), 5)}
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Powiadomienia automatyczne EMAIL</legend>
          ${check("powiadamiaj o wizytach przez EMAIL - 24h przed wizytą", "visit_email_24", checked(company, "visit_email_24"))}
          ${field("Nadawca email", "visit_email_sender", val(company, "visit_email_sender", "company_email", "email"))}
          ${textarea("Treść email", "visit_email_template", val(company, "visit_email_template"), 6)}
          ${check("wyślij życzenia urodzinowe przez EMAIL", "birthday_email", checked(company, "birthday_email"))}
          ${field("Nadawca email", "birthday_email_sender", val(company, "birthday_email_sender", "company_email", "email"))}
          ${textarea("Treść email z życzeniami", "birthday_email_template", val(company, "birthday_email_template"), 6)}
          ${check("wyślij EMAIL po dodaniu wizyty", "after_add_email", checked(company, "after_add_email"))}
          ${field("Nadawca email", "after_add_email_sender", val(company, "after_add_email_sender", "company_email", "email"))}
          ${textarea("Treść email po dodaniu wizyty", "after_add_email_template", val(company, "after_add_email_template"), 6)}
          ${check("wyślij EMAIL po wizycie", "after_visit_email", checked(company, "after_visit_email"))}
          ${field("Nadawca email", "after_visit_email_sender", val(company, "after_visit_email_sender", "company_email", "email"))}
          ${textarea("Treść email po wizycie", "after_visit_email_template", val(company, "after_visit_email_template"), 6)}
        </fieldset>
        <div class="cm-form-actions cm-full-field"><button type="submit" class="bm-primary-btn">Zapisz powiadomienia</button></div>
      </form>
    </section>`;
  }

  function renderProgramSettings(company) {
    return `<section class="bm-page-card cm-program-settings-page" id="program-settings">
      <div class="bm-page-head"><h2>Ustawienia programu</h2></div>
      <form class="bm-form-grid cm-company-panel-form" data-company-panel-form="program">
        <fieldset class="cm-notification-box"><legend>Ustawienia ogólne</legend>
          <label>Język programu<select name="language"><option value="pl" ${val(company,"language") === "pl" ? "selected" : ""}>Polski</option><option value="en" ${val(company,"language") === "en" ? "selected" : ""}>English</option></select></label>
          <label>Waluta<select name="currency"><option value="PLN" ${val(company,"currency") === "PLN" ? "selected" : ""}>PLN</option><option value="EUR" ${val(company,"currency") === "EUR" ? "selected" : ""}>EUR</option><option value="USD" ${val(company,"currency") === "USD" ? "selected" : ""}>USD</option></select></label>
          ${field("Strefa czasowa", "timezone", val(company, "timezone") || "Europe/Warsaw")}
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Dodaj klienta — zgoda na reklamę</legend>
          ${check("Pokaż pola zgody marketingowej przy dodawaniu/edycji klienta", "client_marketing_consent_enabled", val(company, "client_marketing_consent_enabled") === "" ? true : checked(company, "client_marketing_consent_enabled"))}
          ${check("Domyślnie zaznacz zgodę SMS jako NIE / wymaga świadomego wyboru", "client_marketing_consent_explicit", val(company, "client_marketing_consent_explicit") === "" ? true : checked(company, "client_marketing_consent_explicit"))}
          <p class="bm-muted cm-full-field">Zgody zapisują się przy kliencie jako osobne pola: SMS i Email. Dzięki temu w Marketingu wiadomo, komu można wysłać reklamę.</p>
        </fieldset>
        <fieldset class="cm-notification-box"><legend>Godziny pracy firmy</legend>
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

  function formPayload(form) {
    const data = {};
    Array.from(new FormData(form).entries()).forEach(([key, value]) => { data[key] = String(value).trim(); });
    $$('input[type="checkbox"]', form).forEach((input) => { data[input.name] = input.checked; });
    return data;
  }

  function bindForms(root, state) {
    $$("[data-company-panel-form]", root).forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const old = button?.textContent || "Zapisz";
        if (button) { button.disabled = true; button.textContent = "Zapisuję..."; }
        try {
          await savePanel(formPayload(form));
          alert("Zapisano panel firmy.");
          state.data = await fetchPanel();
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
