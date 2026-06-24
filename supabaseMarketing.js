// CompanyManager — 092 Marketing EMAIL/SMS Supabase base
// Marketing zapisuje kampanie i odbiorców do Supabase. Realna wysyłka będzie podpięta w kolejnym kroku przez Edge Function.
(function () {
  const PAGE = "marketing";

  function isPage() {
    return document.body?.dataset?.panelPage === PAGE || location.pathname.includes("marketing.html");
  }
  if (!isPage()) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function formatDateTimePL(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "—");
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function waitForArea() {
    for (let i = 0; i < 80; i += 1) {
      const area = $(".bm-panel-area") || $(".bm-panel-workspace") || $("#dashboardRoot");
      if (area && !area.textContent.includes("Ładowanie panelu")) return area;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return $("#dashboardRoot") || document.body;
  }

  async function rpc(name, args = {}) {
    if (!window.cmSupabase) throw new Error("Brak połączenia z Supabase.");
    const { data, error } = await window.cmSupabase.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function fetchContext() {
    return await rpc("cm_marketing_context");
  }

  async function fetchClients(companyId) {
    const { data, error } = await window.cmSupabase
      .from("clients")
      .select("id, company_id, first_name, last_name, email, phone, gender, marketing_email, marketing_sms, active, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function clientName(client) {
    return [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || client.email || client.phone || "Klient";
  }

  function campaignStatusLabel(status) {
    const s = String(status || "").toLowerCase();
    if (s === "draft") return "Szkic";
    if (s === "test") return "Test";
    if (s === "ready_to_send") return "Gotowe do wysłania";
    if (s === "sent") return "Wysłane";
    if (s === "cancelled") return "Anulowane";
    if (s === "deleted") return "Usunięte";
    return status || "—";
  }

  function channelLabel(channel) {
    return String(channel || "").toLowerCase() === "sms" ? "SMS" : "EMAIL";
  }

  function table(headers, rows, empty = "Brak danych") {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(empty)}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function senderFallback(company) {
    return company?.name || company?.company_name || "CompanyManager";
  }

  function senderOptions(company) {
    const values = [
      senderFallback(company),
      company?.visit_email_sender,
      company?.birthday_email_sender,
      company?.after_add_email_sender,
      company?.after_visit_email_sender,
      company?.message_sender,
      "CompanyManager"
    ].map((v) => String(v || "").trim()).filter(Boolean);
    return Array.from(new Set(values)).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  }

  function recipientFiltersFromForm(form) {
    return {
      allCustomers: form.querySelector('[name="allCustomers"]')?.checked === true,
      selectedCustomers: form.querySelector('[name="selectedCustomers"]')?.checked === true,
      clientIds: Array.from(form.querySelector('[name="customers"]')?.selectedOptions || []).map((o) => o.value).filter(Boolean),
      allWomen: form.querySelector('[name="allWomen"]')?.checked === true,
      allMen: form.querySelector('[name="allMen"]')?.checked === true,
      updatedRange: form.querySelector('[name="updatedRange"]')?.checked === true,
      updatedFrom: form.querySelector('[name="updatedFrom"]')?.value || "",
      updatedTo: form.querySelector('[name="updatedTo"]')?.value || "",
      addedRange: form.querySelector('[name="addedRange"]')?.checked === true,
      addedFrom: form.querySelector('[name="addedFrom"]')?.value || "",
      addedTo: form.querySelector('[name="addedTo"]')?.value || ""
    };
  }

  async function countRecipients(channel, form) {
    const result = await rpc("cm_marketing_recipients", {
      p_channel: channel,
      p_filters: recipientFiltersFromForm(form)
    });
    return Number(result?.count || 0);
  }

  function recipientsHtml(customerOptions, prefix) {
    const now = todayIso();
    return `<fieldset class="full marketing-recipients"><legend>Wyślij do</legend>
      <label class="bm-checkbox-line"><input type="checkbox" name="allCustomers"> wszystkich klientów ze zgodą marketingową</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="selectedCustomers" class="marketing-mode-checkbox" data-panel="${prefix}CustomersPanel"> wybranych klientów</label>
      <div id="${prefix}CustomersPanel" class="marketing-extra-panel" hidden><label>Wybierz klientów<select name="customers" multiple>${customerOptions}</select></label></div>
      <label class="bm-checkbox-line"><input type="checkbox" name="allWomen"> wszystkich kobiet ze zgodą</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="allMen"> wszystkich mężczyzn ze zgodą</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="updatedRange" class="marketing-mode-checkbox" data-exclusive="date" data-panel="${prefix}UpdatedPanel"> data ostatniej aktualizacji klienta</label>
      <div id="${prefix}UpdatedPanel" class="marketing-extra-panel" hidden><div class="bm-form-row-2"><label>Od<input name="updatedFrom" type="date" value="${now}"></label><label>Do<input name="updatedTo" type="date" value="${now}"></label></div></div>
      <label class="bm-checkbox-line"><input type="checkbox" name="addedRange" class="marketing-mode-checkbox" data-exclusive="date" data-panel="${prefix}AddedPanel"> data dodania klienta</label>
      <div id="${prefix}AddedPanel" class="marketing-extra-panel" hidden><div class="bm-form-row-2"><label>Od<input name="addedFrom" type="date" value="${now}"></label><label>Do<input name="addedTo" type="date" value="${now}"></label></div></div>
    </fieldset>`;
  }

  function subjectHint() {
    return `<p class="bm-muted full">Zmienne dostępne później przy automatycznej wysyłce: {klient}, {firma}, {data}, {godzina}, {usługa}, {pracownik}.</p>`;
  }

  function render(area, state) {
    const company = state.company || {};
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const clients = Array.isArray(state.clients) ? state.clients : [];
    const q = normalizeText(new URLSearchParams(location.search).get("q") || "");
    const filtered = campaigns.filter((c) => !q || normalizeText([
      c.subject, c.sender_name, c.body, c.channel, c.status, c.created_at
    ].join(" ")).includes(q));

    const customerOptions = clients.map((c) => {
      const label = `${clientName(c)}${c.email ? " — " + c.email : ""}${c.phone ? " — " + c.phone : ""}`;
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
    }).join("");

    const campaignRows = filtered.map((c) => [
      escapeHtml(c.subject || (String(c.channel).toLowerCase() === "sms" ? "Kampania SMS" : "Kampania Email")),
      escapeHtml(formatDateTimePL(c.created_at)),
      escapeHtml(channelLabel(c.channel)),
      escapeHtml(c.sender_name || "—"),
      escapeHtml(String(c.recipient_count || 0)),
      `<span class="bm-status ${String(c.status).toLowerCase() === "sent" || String(c.status).toLowerCase() === "ready_to_send" ? "active" : "inactive"}">${escapeHtml(campaignStatusLabel(c.status))}</span>`
    ]);

    area.innerHTML = `<section class="bm-page-card marketing-module">
      <div class="bm-page-head customers-head">
        <div><h2>Marketing</h2><p>Podłączone do Supabase. Na tym etapie kampanie są zapisywane i przygotowane do wysyłki; realny provider email/SMS będzie w kolejnym kroku.</p></div>
        <div class="bm-actions-row"><button id="showMarketingSms" type="button">SMS</button><button id="showMarketingEmail" type="button">Email</button><button id="showDeleteCampaign" type="button" class="bm-danger-btn">Usuń</button></div>
      </div>
      <div class="bm-table-toolbar"><label>Szukaj: <input id="marketingSearch" type="search" placeholder="Szukaj kampanii" value="${escapeHtml(new URLSearchParams(location.search).get("q") || "")}"></label></div>
      ${table(["Kampania", "Data", "Kanał", "Nadawca", "Odbiorcy", "Status"], campaignRows, "Brak kampanii marketingowych")}
    </section>

    <section id="marketingSmsCard" class="bm-page-card bm-inner-card" hidden>
      <h2>SMS</h2>
      <form id="marketingSmsForm" class="bm-form-grid bm-wide-form marketing-form">
        <label>Nadawca SMS<input name="smsSender" maxlength="11" placeholder="do 11 znaków" value="${escapeHtml(company.visit_sms_sender || company.message_sender || "")}"></label>
        <label class="full">Treść wiadomości<textarea name="smsContent" id="smsContent" placeholder="Wpisz treść wiadomości"></textarea></label>
        <div class="full marketing-preview"><strong>Podgląd:</strong><p id="smsPreview">Wiadomość pojawi się tutaj.</p></div>
        <label>Liczba znaków<input id="smsCharCount" type="text" value="0" readonly></label>
        <div class="bm-form-row-2 full"><label>Test wiadomości<input name="smsTestPhone" placeholder="+48123123123"></label><button type="button" id="sendSmsTest">Wyślij test</button></div>
        ${recipientsHtml(customerOptions, "sms")}
        <label>Liczba znalezionych telefonów<input id="smsFoundCount" type="text" value="0" readonly></label>
        <div class="bm-form-row-2 full"><button type="button" id="saveSmsCampaign">Zapisz</button><button type="button" id="sendSmsCampaign">Wyślij</button></div>
      </form>
      <p id="smsMarketingMessage" class="panel-message"></p>
    </section>

    <section id="marketingEmailCard" class="bm-page-card bm-inner-card" hidden>
      <h2>Email</h2>
      <form id="marketingEmailForm" class="bm-form-grid bm-wide-form marketing-form">
        <label>Nadawca email<input name="emailSender" list="emailSenderList" maxlength="50" placeholder="np. ${escapeHtml(senderFallback(company))}" value="${escapeHtml(company.visit_email_sender || senderFallback(company))}"><datalist id="emailSenderList">${senderOptions(company)}</datalist></label>
        <label>Temat<input name="emailTitle" id="emailTitle" maxlength="120" placeholder="Wpisz temat wiadomości"></label>
        ${subjectHint()}
        <label class="full">Treść<textarea name="emailContent" id="emailContent" placeholder="Wpisz treść wiadomości"></textarea></label>
        <div class="bm-form-row-2 full"><label>Testuj Email<input name="emailTest" placeholder="test@firma.pl"></label><button type="button" id="sendEmailTest">Wyślij test</button></div>
        ${recipientsHtml(customerOptions, "email")}
        <label>Liczba znalezionych email<input id="emailFoundCount" type="text" value="0" readonly></label>
        <div class="bm-form-row-2 full"><button type="button" id="saveEmailCampaign">Zapisz</button><button type="button" id="sendEmailCampaign">Wyślij</button></div>
      </form>
      <p id="emailMarketingMessage" class="panel-message"></p>
    </section>

    <section id="marketingDeleteCard" class="bm-page-card bm-inner-card" hidden>
      <h2>Usuń kampanię</h2>
      <form id="marketingDeleteForm" class="bm-form-grid bm-wide-form">
        <label class="full">Wybierz kampanię<select name="campaignId">${campaigns.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml([c.subject || channelLabel(c.channel), formatDateTimePL(c.created_at), channelLabel(c.channel), campaignStatusLabel(c.status)].filter(Boolean).join(" — "))}</option>`).join("")}</select></label>
        <div class="bm-form-row-2 full"><button type="button" id="deleteMarketingCampaign" class="bm-danger-btn">Usuń</button></div>
      </form>
      <p id="deleteMarketingMessage" class="panel-message"></p>
    </section>`;

    bind(area, state);
  }

  function showOnlyPanel(target, panels) {
    panels.forEach((panel) => { if (panel) panel.hidden = panel !== target; });
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function message(id, text, ok = true) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#166534" : "#dc2626";
  }

  async function updateCount(prefix) {
    const form = $(`#marketing${prefix === "sms" ? "Sms" : "Email"}Form`);
    if (!form) return;
    const channel = prefix === "sms" ? "sms" : "email";
    const countEl = $(prefix === "sms" ? "#smsFoundCount" : "#emailFoundCount");
    try {
      const count = await countRecipients(channel, form);
      if (countEl) countEl.value = String(count);
    } catch (error) {
      console.warn("Marketing count failed", error);
      if (countEl) countEl.value = "0";
    }
  }

  function bindRecipientForm(prefix) {
    const form = $(`#marketing${prefix === "sms" ? "Sms" : "Email"}Form`);
    if (!form) return;
    form.querySelectorAll("input, select, textarea").forEach((el) => el.addEventListener("change", () => updateCount(prefix)));
    form.querySelectorAll(".marketing-mode-checkbox").forEach((box) => {
      box.addEventListener("change", () => {
        const panel = box.dataset.panel ? document.getElementById(box.dataset.panel) : null;
        if (box.checked && box.dataset.exclusive === "date") {
          form.querySelectorAll('.marketing-mode-checkbox[data-exclusive="date"]').forEach((other) => {
            if (other !== box) {
              other.checked = false;
              const otherPanel = other.dataset.panel ? document.getElementById(other.dataset.panel) : null;
              if (otherPanel) otherPanel.hidden = true;
            }
          });
        }
        if (panel) panel.hidden = !box.checked;
        updateCount(prefix);
      });
    });
    if (prefix === "sms") {
      const smsContent = $("#smsContent");
      const preview = $("#smsPreview");
      const count = $("#smsCharCount");
      smsContent?.addEventListener("input", () => {
        if (preview) preview.textContent = smsContent.value || "Wiadomość pojawi się tutaj.";
        if (count) count.value = String(smsContent.value.length);
      });
    }
    updateCount(prefix);
  }

  async function saveCampaign(prefix, status) {
    const isSms = prefix === "sms";
    const form = $(`#marketing${isSms ? "Sms" : "Email"}Form`);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const body = String(isSms ? data.smsContent || "" : data.emailContent || "").trim();
    const sender = String(isSms ? data.smsSender || "" : data.emailSender || "").trim();
    const subject = String(data.emailTitle || "").trim();
    if (!sender) return message(isSms ? "#smsMarketingMessage" : "#emailMarketingMessage", "Uzupełnij nadawcę.", false);
    if (!body) return message(isSms ? "#smsMarketingMessage" : "#emailMarketingMessage", "Uzupełnij treść wiadomości.", false);
    if (!isSms && !subject) return message("#emailMarketingMessage", "Uzupełnij temat emaila.", false);

    const payload = {
      channel: isSms ? "sms" : "email",
      sender_name: sender,
      subject: isSms ? null : subject,
      body,
      filters: recipientFiltersFromForm(form),
      status,
      test_recipient: isSms ? data.smsTestPhone || "" : data.emailTest || ""
    };

    const msgId = isSms ? "#smsMarketingMessage" : "#emailMarketingMessage";
    try {
      const result = await rpc("cm_marketing_save_campaign", { p_payload: payload });
      if (status === "test") {
        message(msgId, "Test zapisany w Supabase. Realna wysyłka zostanie podpięta w kolejnym kroku.", true);
      } else if (status === "ready_to_send") {
        message(msgId, `Kampania zapisana jako gotowa do wysłania. Odbiorcy: ${result?.recipient_count ?? 0}.`, true);
      } else {
        message(msgId, `Kampania zapisana jako szkic. Odbiorcy: ${result?.recipient_count ?? 0}.`, true);
      }
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      console.error("Marketing save failed", error);
      message(msgId, "Błąd zapisu kampanii: " + (error?.message || error), false);
    }
  }

  async function bind(area, state) {
    const smsCard = $("#marketingSmsCard", area);
    const emailCard = $("#marketingEmailCard", area);
    const deleteCard = $("#marketingDeleteCard", area);
    const panels = [smsCard, emailCard, deleteCard];
    $("#showMarketingSms", area)?.addEventListener("click", () => showOnlyPanel(smsCard, panels));
    $("#showMarketingEmail", area)?.addEventListener("click", () => showOnlyPanel(emailCard, panels));
    $("#showDeleteCampaign", area)?.addEventListener("click", () => showOnlyPanel(deleteCard, panels));
    $("#marketingSearch", area)?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const val = encodeURIComponent(event.target.value || "");
        location.href = val ? `marketing.html?q=${val}` : "marketing.html";
      }
    });

    bindRecipientForm("sms");
    bindRecipientForm("email");

    $("#sendSmsTest", area)?.addEventListener("click", () => saveCampaign("sms", "test"));
    $("#sendEmailTest", area)?.addEventListener("click", () => saveCampaign("email", "test"));
    $("#saveSmsCampaign", area)?.addEventListener("click", () => saveCampaign("sms", "draft"));
    $("#sendSmsCampaign", area)?.addEventListener("click", () => saveCampaign("sms", "ready_to_send"));
    $("#saveEmailCampaign", area)?.addEventListener("click", () => saveCampaign("email", "draft"));
    $("#sendEmailCampaign", area)?.addEventListener("click", () => saveCampaign("email", "ready_to_send"));

    $("#deleteMarketingCampaign", area)?.addEventListener("click", async () => {
      const id = $("#marketingDeleteForm [name='campaignId']", area)?.value;
      if (!id) return message("#deleteMarketingMessage", "Wybierz kampanię.", false);
      try {
        const { error } = await window.cmSupabase
          .from("marketing_campaigns")
          .update({ status: "deleted", active: false, deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        message("#deleteMarketingMessage", "Kampania została usunięta z aktywnej listy.", true);
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        message("#deleteMarketingMessage", "Błąd usuwania kampanii: " + (error?.message || error), false);
      }
    });
  }

  async function init() {
    const area = await waitForArea();
    try {
      if (!window.cmSupabase) throw new Error("Brak klienta Supabase na stronie marketingu.");
      const ctx = await fetchContext();
      const company = ctx?.company || {};
      const clients = await fetchClients(company.id);
      render(area, {
        company,
        profile: ctx?.profile || {},
        campaigns: ctx?.campaigns || [],
        clients
      });
    } catch (error) {
      console.error("Marketing Supabase error", error);
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd marketingu</h2><p>${escapeHtml(error?.message || error)}</p></section>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
