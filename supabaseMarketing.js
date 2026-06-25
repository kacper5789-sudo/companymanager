// CompanyManager — 098 Marketing EMAIL/SMS Supabase + real SMS
// Marketing zapisuje kampanie i odbiorców do Supabase oraz odpala Edge Functions: EMAIL przez Resend, SMS przez SMSPLANET.
(function () {
  const PAGE = "marketing";

  function isPage() {
    return document.body?.dataset?.panelPage === PAGE || location.pathname.includes("marketing.html");
  }
  if (!isPage()) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  let currentClients = [];
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


  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, key) => ({ ...acc, [String(key)]: true }), {});
    if (typeof raw === "object") return raw;
    try { return normalizePermissions(JSON.parse(raw)); } catch (_) { return {}; }
  }

  function currentAccess() {
    try { return JSON.parse(localStorage.getItem("cm_access") || "null") || {}; } catch (_) { return {}; }
  }

  function hasPermission(key) {
    const access = currentAccess();
    const role = String(access.role || "").toUpperCase();
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(access.permissions || {});
    return permissions.all === true || permissions.admin === true || permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1";
  }

  function ensureMarketingPermission(channel) {
    const key = channel === "sms" ? "marketing_sms" : "marketing_email";
    if (hasPermission(key)) return true;
    message(channel === "sms" ? "#smsMarketingMessage" : "#emailMarketingMessage", `Brak uprawnienia: ${key}`, false);
    return false;
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

  function isChecked(form, name) {
    return form.querySelector(`[name="${name}"]`)?.checked === true;
  }

  function localRecipientCount(channel, form) {
    const filters = recipientFiltersFromForm(form);
    const wanted = currentClients.filter((client) => {
      if (client.active === false) return false;
      if (channel === "email") {
        if (!client.marketing_email || !String(client.email || "").trim()) return false;
      } else {
        if (!client.marketing_sms || !String(client.phone || "").trim()) return false;
      }

      const anyFilter = filters.allCustomers || filters.selectedCustomers || filters.allWomen || filters.allMen || filters.updatedRange || filters.addedRange;
      if (!anyFilter) return true;
      if (filters.allCustomers) return true;
      if (filters.selectedCustomers && filters.clientIds.includes(client.id)) return true;

      const gender = normalizeText(client.gender || "");
      if (filters.allWomen && ["kobieta", "female", "woman"].includes(gender)) return true;
      if (filters.allMen && ["mezczyzna", "mezczyzna", "mężczyzna", "male", "man"].includes(gender)) return true;

      const inRange = (value, from, to) => {
        const d = String(value || "").slice(0, 10);
        if (!d) return false;
        return (!from || d >= from) && (!to || d <= to);
      };
      if (filters.updatedRange && inRange(client.updated_at, filters.updatedFrom, filters.updatedTo)) return true;
      if (filters.addedRange && inRange(client.created_at, filters.addedFrom, filters.addedTo)) return true;
      return false;
    });
    return wanted.length;
  }

  async function countRecipients(channel, form) {
    try {
      const result = await rpc("cm_marketing_recipients", {
        p_channel: channel,
        p_filters: recipientFiltersFromForm(form)
      });
      return Number(result?.count || 0);
    } catch (error) {
      console.warn("cm_marketing_recipients RPC failed, using local count", error);
      return localRecipientCount(channel, form);
    }
  }

  function recipientsHtml(customerOptions, prefix) {
    const now = todayIso();
    return `<fieldset class="full marketing-recipients"><legend>Wyślij do</legend>
      <label class="bm-checkbox-line"><input type="checkbox" name="allCustomers" checked> wszystkich klientów ze zgodą marketingową</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="selectedGroups" disabled> wybranych grup klientów <span class="bm-muted">— grupy klientów podepniemy w kolejnym etapie</span></label>
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
        <div><h2>Marketing</h2><p>Email/SMS podłączone do Supabase. Kampanie zostają w historii i nie są usuwane, żeby statystyki oraz rozliczenia SMS/Email były spójne.</p></div>
        <div class="bm-actions-row">${hasPermission("marketing_sms") ? `<button id="showMarketingSms" type="button" class="bm-light-btn">SMS</button>` : ""}${hasPermission("marketing_email") ? `<button id="showMarketingEmail" type="button" class="bm-light-btn">Email</button>` : ""}</div>
      </div>
      <div class="bm-table-toolbar"><label>Szukaj: <input id="marketingSearch" type="search" placeholder="Szukaj kampanii" value="${escapeHtml(new URLSearchParams(location.search).get("q") || "")}"></label></div>
      ${table(["Kampania", "Data", "Kanał", "Nadawca", "Odbiorcy", "Status"], campaignRows, "Brak kampanii marketingowych")}
    </section>

    <section id="marketingSmsCard" class="bm-page-card bm-inner-card cm-marketing-flyout" hidden ${!hasPermission("marketing_sms") ? `style="display:none"` : ""}>
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

    <section id="marketingEmailCard" class="bm-page-card bm-inner-card cm-marketing-flyout" hidden ${!hasPermission("marketing_email") ? `style="display:none"` : ""}>
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
    </section>`;

    bind(area, state);
  }

  function showOnlyPanel(target, panels) {
    panels.forEach((panel) => { if (panel) panel.hidden = panel !== target; });
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    const allCustomers = form.querySelector('[name="allCustomers"]');
    allCustomers?.addEventListener("change", () => {
      if (allCustomers.checked) {
        form.querySelectorAll('.marketing-mode-checkbox, [name="allWomen"], [name="allMen"]').forEach((other) => {
          other.checked = false;
          const otherPanel = other.dataset?.panel ? document.getElementById(other.dataset.panel) : null;
          if (otherPanel) otherPanel.hidden = true;
        });
      }
      updateCount(prefix);
    });

    form.querySelectorAll('[name="allWomen"], [name="allMen"]').forEach((box) => {
      box.addEventListener("change", () => {
        if (box.checked && allCustomers) allCustomers.checked = false;
        updateCount(prefix);
      });
    });

    form.querySelectorAll(".marketing-mode-checkbox").forEach((box) => {
      box.addEventListener("change", () => {
        const panel = box.dataset.panel ? document.getElementById(box.dataset.panel) : null;
        if (box.checked && allCustomers) allCustomers.checked = false;
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

  async function invokeMarketingSend(channel, campaignId, mode = "campaign") {
    if (!window.cmSupabase?.functions?.invoke) {
      throw new Error("Brak obsługi Edge Functions w kliencie Supabase.");
    }
    const fnName = channel === "sms" ? "send-marketing-sms" : "send-marketing-email";
    const { data, error } = await window.cmSupabase.functions.invoke(fnName, {
      body: { campaign_id: campaignId, mode }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function saveCampaign(prefix, status) {
    const isSms = prefix === "sms";
    if (!ensureMarketingPermission(isSms ? "sms" : "email")) return;
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
      const campaignId = result?.campaign_id;

      if (status === "test") {
        if (!campaignId) throw new Error("Brak ID kampanii testowej.");
        message(msgId, isSms ? "Wysyłam testowy SMS..." : "Wysyłam testowy email przez Resend...", true);
        const sendResult = await invokeMarketingSend(isSms ? "sms" : "email", campaignId, "test");
        message(msgId, `${isSms ? "Test SMS" : "Test email"} wysłany. Wysłano: ${sendResult?.sent ?? 0}, błędy: ${sendResult?.failed ?? 0}, pominięto: ${sendResult?.skipped ?? 0}.`, (sendResult?.failed ?? 0) === 0);
        setTimeout(() => location.reload(), 1400);
        return;
      }

      if (status === "ready_to_send") {
        if (!campaignId) throw new Error("Brak ID kampanii.");
        message(msgId, `Kampania zapisana. Rozpoczynam wysyłkę do ${result?.recipient_count ?? 0} odbiorców...`, true);
        const sendResult = await invokeMarketingSend(isSms ? "sms" : "email", campaignId, "campaign");
        message(msgId, `Wysyłka zakończona. Wysłano: ${sendResult?.sent ?? 0}, błędy: ${sendResult?.failed ?? 0}, pominięto: ${sendResult?.skipped ?? 0}.`, (sendResult?.failed ?? 0) === 0);
        setTimeout(() => location.reload(), 1600);
        return;
      }

      message(msgId, `Kampania zapisana jako szkic. Odbiorcy: ${result?.recipient_count ?? 0}.`, true);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      console.error("Marketing save/send failed", error);
      message(msgId, "Błąd kampanii: " + (error?.message || error), false);
    }
  }

  async function bind(area, state) {
    const smsCard = $("#marketingSmsCard", area);
    const emailCard = $("#marketingEmailCard", area);
    const panels = [smsCard, emailCard];
    $("#showMarketingSms", area)?.addEventListener("click", () => showOnlyPanel(smsCard, panels));
    $("#showMarketingEmail", area)?.addEventListener("click", () => showOnlyPanel(emailCard, panels));
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
  }

  async function init() {
    const area = await waitForArea();
    try {
      if (!window.cmSupabase) throw new Error("Brak klienta Supabase na stronie marketingu.");
      const ctx = await fetchContext();
      const company = ctx?.company || {};
      const clients = await fetchClients(company.id);
      currentClients = clients || [];
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


// CompanyManager — 096 Email/SMS reports from Supabase
(function () {
  const page = document.body?.dataset?.panelPage || "";
  const isEmail = page === "emailReports" || location.pathname.includes("email.html");
  const isSms = page === "smsReports" || location.pathname.includes("sms.html");
  if (!isEmail && !isSms) return;

  const channel = isSms ? "sms" : "email";
  const title = isSms ? "SMS" : "Email";
  const $ = (sel, root = document) => root.querySelector(sel);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
  }

  function formatDateTimePL(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function monthKey(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "brak-daty";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(key) {
    if (key === "brak-daty") return "Brak daty";
    const months = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
    const [y, m] = String(key).split("-");
    return `${months[Number(m) - 1] || m} ${y}`;
  }

  function statusLabel(value) {
    const s = String(value || "").toLowerCase();
    if (s === "sent") return "Wysłano";
    if (s === "test") return "Test";
    if (s === "draft") return "Szkic";
    if (s === "ready_to_send" || s === "ready") return "Gotowe";
    if (s === "failed") return "Błąd";
    if (s === "cancelled") return "Anulowane";
    if (s === "deleted") return "Usunięte";
    return value || "—";
  }

  function table(headers, rows, empty = "Brak danych") {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(empty)}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  async function waitForArea() {
    for (let i = 0; i < 80; i += 1) {
      const area = $(".bm-panel-area") || $(".bm-panel-workspace") || $("#dashboardRoot");
      if (area && !area.textContent.includes("Ładowanie panelu")) return area;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return $("#dashboardRoot") || document.body;
  }

  async function fetchReport() {
    if (!window.cmSupabase) throw new Error("Brak połączenia z Supabase.");
    const { data, error } = await window.cmSupabase.rpc("cm_marketing_report", { p_channel: channel });
    if (error) throw error;
    return data || { campaigns: [], summary: {} };
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function render(area, report) {
    const campaigns = Array.isArray(report.campaigns) ? report.campaigns : [];
    const summary = report.summary || {};

    const groups = new Map();
    campaigns.forEach((c) => {
      const key = monthKey(c.sent_at || c.created_at || c.updated_at);
      if (!groups.has(key)) groups.set(key, { key, label: monthLabel(key), campaigns: 0, recipients: 0, sent: 0, failed: 0, skipped: 0, pending: 0 });
      const g = groups.get(key);
      g.campaigns += 1;
      g.recipients += Number(c.total_recipients || c.recipient_count || 0);
      g.sent += Number(c.sent_count || 0);
      g.failed += Number(c.failed_count || 0);
      g.skipped += Number(c.skipped_count || 0);
      g.pending += Number(c.pending_count || 0);
    });

    const monthRows = Array.from(groups.values()).sort((a, b) => String(b.key).localeCompare(String(a.key))).map((g) => [
      escapeHtml(g.label),
      String(g.campaigns),
      String(g.recipients),
      String(g.sent),
      String(g.failed),
      String(g.pending),
      `<button type="button" class="bm-light-btn cm-marketing-report-month" data-month="${escapeHtml(g.key)}">Pobierz raport</button>`
    ]);

    const campaignRows = campaigns.map((c) => [
      escapeHtml(c.subject || c.body || "Kampania"),
      escapeHtml(formatDateTimePL(c.sent_at || c.created_at)),
      escapeHtml(c.sender_name || "—"),
      String(c.total_recipients || c.recipient_count || 0),
      String(c.sent_count || 0),
      String(c.failed_count || 0),
      escapeHtml(statusLabel(c.status))
    ]);

    area.innerHTML = `<section class="bm-page-card cm-${channel}-report-card">
      <div class="bm-page-head"><div><h2>${escapeHtml(title)}</h2><p>${channel === "email" ? "Raport kampanii email pobierany z Supabase i Resend." : "Raport kampanii SMS pobierany z Supabase i Edge Function send-marketing-sms."}</p></div></div>
      <div class="cm-period-kpis">
        <div><span>Kampanie</span><b>${Number(summary.campaigns || campaigns.length)}</b></div>
        <div><span>Odbiorcy</span><b>${Number(summary.recipients || 0)}</b></div>
        <div><span>Wysłano</span><b>${Number(summary.sent || 0)}</b></div>
        <div><span>Błędy</span><b>${Number(summary.failed || 0)}</b></div>
      </div>
      <div class="bm-table-toolbar"><button type="button" class="bm-green-btn" id="marketingReportExportAll">Export - CSV</button></div>
      <h3>Podsumowanie miesięczne</h3>
      ${table(["Miesiąc", "Kampanie", "Odbiorcy", "Wysłano", "Błędy", "Oczekuje", "Raport"], monthRows, `Brak kampanii ${title}`)}
      <h3>Historia kampanii</h3>
      ${table(["Kampania", "Data", "Nadawca", "Odbiorcy", "Wysłano", "Błędy", "Status"], campaignRows, `Brak kampanii ${title}`)}
    </section>`;

    $("#marketingReportExportAll", area)?.addEventListener("click", () => {
      downloadCsv(`raport-${channel}-wszystko.csv`, [
        ["Kampania", "Data", "Nadawca", "Odbiorcy", "Wysłano", "Błędy", "Pominięte", "Oczekuje", "Status"],
        ...campaigns.map((c) => [c.subject || c.body || "Kampania", formatDateTimePL(c.sent_at || c.created_at), c.sender_name || "", c.total_recipients || c.recipient_count || 0, c.sent_count || 0, c.failed_count || 0, c.skipped_count || 0, c.pending_count || 0, statusLabel(c.status)])
      ]);
    });

    area.querySelectorAll(".cm-marketing-report-month").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.month;
        const rows = campaigns.filter((c) => monthKey(c.sent_at || c.created_at || c.updated_at) === key);
        downloadCsv(`raport-${channel}-${key}.csv`, [
          ["Kampania", "Data", "Nadawca", "Odbiorcy", "Wysłano", "Błędy", "Pominięte", "Oczekuje", "Status"],
          ...rows.map((c) => [c.subject || c.body || "Kampania", formatDateTimePL(c.sent_at || c.created_at), c.sender_name || "", c.total_recipients || c.recipient_count || 0, c.sent_count || 0, c.failed_count || 0, c.skipped_count || 0, c.pending_count || 0, statusLabel(c.status)])
        ]);
      });
    });
  }

  async function init() {
    const area = await waitForArea();
    try {
      const report = await fetchReport();
      render(area, report);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd raportu ${escapeHtml(title)}</h2><p>${escapeHtml(error?.message || error)}</p><p class="bm-muted">Odpal SQL: supabase/migrations/172_marketing_email_sms_reports_supabase.sql</p></section>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
