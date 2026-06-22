// CompanyManager — Services Module powered by Supabase
// 030: Usługi Supabase CRUD: kategorie / lista / dodaj / edytuj / usuń + company_id isolation + permission guard.

(function () {
  function isServicesPage() {
    return document.body?.dataset?.panelPage === "services" || window.location.pathname.includes("services.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        acc[String(item)] = true;
        return acc;
      }, {});
    }
    if (typeof raw === "object") return raw;
    try { return normalizePermissions(JSON.parse(raw)); } catch (_) { return {}; }
  }

  function hasAnyPermission(ctx, keys) {
    const role = normalizeRole(ctx?.access?.role || ctx?.context?.role);
    if (role === "OWNER" || role === "ADMIN") return true;
    const permissions = normalizePermissions(ctx?.access?.permissions || ctx?.context?.permissions);
    if (permissions.all === true || permissions.admin === true) return true;
    return keys.some((key) => permissions[key] === true || permissions[key] === "true" || permissions[key] === 1 || permissions[key] === "1");
  }

  function canOpenServices(ctx) {
    return hasAnyPermission(ctx, ["open_services", "services_open", "uslugi", "Usługi"]);
  }
  function canAddServices(ctx) {
    return hasAnyPermission(ctx, ["services_add", "uslugi_add", "usługi (dodawanie, edycja, usuwanie)"]);
  }
  function canEditServices(ctx) {
    return hasAnyPermission(ctx, ["services_edit", "uslugi_edit", "usługi (dodawanie, edycja, usuwanie)"]);
  }
  function canDeleteServices(ctx) {
    return hasAnyPermission(ctx, ["services_delete", "uslugi_delete", "usługi (dodawanie, edycja, usuwanie)"]);
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  async function getContext() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano połączenia z Supabase." };

    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);

    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    if (!context.company_id) return { ok: false, message: "Brak wybranej firmy. OWNER musi najpierw wejść w firmę z zakładki Firmy." };

    const ctx = { ok: true, access, context, companyId: context.company_id };
    if (!canOpenServices(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Usługi." };

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toFixed(2).replace(".", ",");
  }

  function parseMoney(value) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function formatDuration(hours, minutes) {
    return `${Number(hours || 0)} h ${String(Number(minutes || 0)).padStart(2, "0")} min`;
  }

  function formatPriceRange(from, to) {
    const cleanFrom = money(from);
    const cleanTo = money(to);
    if (cleanFrom && cleanTo) return `${cleanFrom}–${cleanTo} PLN`;
    if (cleanFrom) return `od ${cleanFrom} PLN`;
    if (cleanTo) return `do ${cleanTo} PLN`;
    return "";
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText || "Brak danych.")}</div>`;
    return `
      <div class="bm-table-wrap">
        <table class="bm-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function pagination(count) {
    if (!count) return "";
    return `
      <div class="cm-pagination-row">
        <span>Pozycje od 1 do ${count} z ${count} łącznie</span>
        <span class="cm-pagination-controls">&lt; <strong>1 z 1</strong> &gt;</span>
      </div>
    `;
  }

  async function fetchAll(ctx) {
    const [servicesRes, categoriesRes, positionsRes] = await Promise.all([
      window.cmSupabase
        .from("services")
        .select("id, company_id, category_id, name, duration_hours, duration_minutes, price_from, price_to, show_online, prevent_overlap, deposit, position_id, description, code, include_commission, include_discount, active, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false }),
      window.cmSupabase
        .from("service_categories")
        .select("id, company_id, name, created_at, updated_at")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true }),
      window.cmSupabase
        .from("positions")
        .select("id, company_id, name, active, created_at")
        .eq("company_id", ctx.companyId)
        .order("name", { ascending: true })
    ]);

    if (servicesRes.error) throw servicesRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (positionsRes.error) throw positionsRes.error;

    return {
      services: servicesRes.data || [],
      categories: categoriesRes.data || [],
      positions: (positionsRes.data || []).filter((p) => p.active !== false)
    };
  }

  function serviceLabel(service, categories) {
    const category = categories.find((item) => item.id === service.category_id);
    return `${service.name || "Usługa"}${category ? ` — ${category.name}` : ""}`;
  }

  function renderRows(services, categories, positions) {
    return services.map((service) => {
      const category = categories.find((item) => item.id === service.category_id);
      const position = positions.find((item) => item.id === service.position_id);
      return [
        escapeHtml(category?.name || "Bez kategorii"),
        escapeHtml(service.name || "-"),
        escapeHtml(formatDuration(service.duration_hours, service.duration_minutes)),
        escapeHtml(formatPriceRange(service.price_from, service.price_to)),
        escapeHtml(position?.name || "-"),
        escapeHtml(service.code || "")
      ];
    });
  }

  function showOnly(cardToShow) {
    ["#serviceFormCard", "#serviceEditCard", "#serviceDeleteCard", "#serviceCategoryCard"].forEach((selector) => {
      const card = document.querySelector(selector);
      if (!card) return;
      card.hidden = card !== cardToShow ? true : !card.hidden;
    });
  }

  function boolValue(formData, name) {
    return formData.get(name) === "true";
  }

  function servicePayload(ctx, formData) {
    return {
      company_id: ctx.companyId,
      category_id: String(formData.get("categoryId") || "") || null,
      name: String(formData.get("name") || "").trim(),
      duration_hours: Number(formData.get("durationHours") || 0),
      duration_minutes: Number(formData.get("durationMinutes") || 0),
      price_from: parseMoney(formData.get("priceFrom")),
      price_to: parseMoney(formData.get("priceTo")),
      show_online: boolValue(formData, "showOnline"),
      prevent_overlap: boolValue(formData, "preventOverlap"),
      deposit: parseMoney(formData.get("deposit")),
      position_id: String(formData.get("positionId") || "") || null,
      description: String(formData.get("description") || "").trim() || null,
      code: String(formData.get("code") || "").trim() || null,
      include_commission: boolValue(formData, "includeCommission"),
      include_discount: boolValue(formData, "includeDiscount"),
      active: true,
      updated_at: new Date().toISOString()
    };
  }

  function validateServicePayload(payload) {
    if (!payload.category_id || !payload.name || !payload.position_id) return "Uzupełnij kategorię, nazwę i stanowisko pracy.";
    if (Number(payload.duration_hours || 0) <= 0 && Number(payload.duration_minutes || 0) <= 0) return "Czas trwania usługi musi być większy niż 0.";
    return "";
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function serviceFormFields(categories, positions, service = {}) {
    const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category.id)}" ${service.category_id === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
    const positionOptions = positions.map((position) => `<option value="${escapeHtml(position.id)}" ${service.position_id === position.id ? "selected" : ""}>${escapeHtml(position.name)}</option>`).join("");
    return `
      <label>Kategoria
        <select name="categoryId" required>
          <option value="">Wybierz kategorię</option>
          ${categoryOptions}
        </select>
      </label>

      <label>Nazwa
        <input name="name" placeholder="Nazwa usługi" value="${escapeHtml(service.name || "")}" required>
      </label>

      <div class="bm-form-row-2">
        <label>Czas trwania usługi — godziny
          <input name="durationHours" type="number" min="0" step="1" value="${escapeHtml(service.duration_hours ?? 0)}" required>
        </label>
        <label>Czas trwania usługi — minuty
          <input name="durationMinutes" type="number" min="0" max="59" step="1" value="${escapeHtml(service.duration_minutes ?? 0)}" required>
        </label>
      </div>

      <div class="bm-form-row-2">
        <label>Cena (PLN) od
          <input name="priceFrom" type="number" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(service.price_from ?? "")}">
        </label>
        <label>Cena (PLN) do
          <input name="priceTo" type="number" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(service.price_to ?? "")}">
        </label>
      </div>

      <label class="bm-check-row"><input type="checkbox" name="showOnline" value="true" ${service.show_online ? "checked" : ""}> <span>Pokazuj usługę przy rezerwacji online</span></label>
      <label class="bm-check-row"><input type="checkbox" name="preventOverlap" value="true" ${service.prevent_overlap ? "checked" : ""}> <span>Usługa nie może powtarzać się w tym samym czasie</span></label>

      <label>Wysokość zaliczki przy zapisie online (PLN)
        <input name="deposit" type="number" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(service.deposit ?? "")}">
      </label>

      <label>Stanowisko pracy
        <select name="positionId" required>
          <option value="">Wybierz ze stanowisk</option>
          ${positionOptions}
        </select>
      </label>

      <label>Opis
        <textarea name="description" placeholder="Opis usługi">${escapeHtml(service.description || "")}</textarea>
      </label>

      <label>Kod usługi
        <input name="code" placeholder="Kod usługi" value="${escapeHtml(service.code || "")}">
      </label>

      <label class="bm-check-row"><input type="checkbox" name="includeCommission" value="true" ${service.include_commission ? "checked" : ""}> <span>Wliczaj do prowizji pracowników</span></label>
      <label class="bm-check-row"><input type="checkbox" name="includeDiscount" value="true" ${service.include_discount ? "checked" : ""}> <span>Uwzględniaj przy rabacie</span></label>
    `;
  }

  function fillEditForm(form, service) {
    if (!form || !service) return;
    form.categoryId.value = service.category_id || "";
    form.name.value = service.name || "";
    form.durationHours.value = service.duration_hours ?? 0;
    form.durationMinutes.value = service.duration_minutes ?? 0;
    form.priceFrom.value = service.price_from ?? "";
    form.priceTo.value = service.price_to ?? "";
    form.showOnline.checked = !!service.show_online;
    form.preventOverlap.checked = !!service.prevent_overlap;
    form.deposit.value = service.deposit ?? "";
    form.positionId.value = service.position_id || "";
    form.description.value = service.description || "";
    form.code.value = service.code || "";
    form.includeCommission.checked = !!service.include_commission;
    form.includeDiscount.checked = !!service.include_discount;
  }

  async function renderServices() {
    if (!isServicesPage()) return;
    const area = getPanelArea();
    if (!area) return;

    area.innerHTML = `<section class="bm-page-card"><h2>Lista usług</h2><p class="bm-muted">Ładowanie usług z Supabase...</p></section>`;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>${escapeHtml(ctx.message)}</p></section>`;
      return;
    }

    let data;
    try {
      data = await fetchAll(ctx);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd usług</h2><p>${escapeHtml(error.message)}</p></section>`;
      return;
    }

    renderContent(ctx, data.services, data.categories, data.positions);
  }

  function renderContent(ctx, services, categories, positions) {
    const area = getPanelArea();
    if (!area) return;

    const allowAdd = canAddServices(ctx);
    const allowEdit = canEditServices(ctx);
    const allowDelete = canDeleteServices(ctx);
    const serviceOptions = services.map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(serviceLabel(service, categories))}</option>`).join("");
    const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("");
    const categoryList = categories.length
      ? `<div class="bm-status-list">${categories.map((category) => `<p><b>${escapeHtml(category.name)}</b></p>`).join("")}</div>`
      : `<p class="muted">Brak kategorii. Dodaj pierwszą kategorię, żeby przypisać usługę.</p>`;

    area.innerHTML = `
      <section class="bm-page-card services-module">
        <div class="bm-page-head">
          <h2>Lista usług</h2>
          <div class="bm-action-row">
            <button id="exportServicesBtn" type="button" class="bm-excel-btn">Export</button>
            <button id="importServicesBtn" type="button" class="bm-excel-btn">Import</button>
            <input id="importServicesFile" type="file" accept=".xls,.xlsx,.csv,.txt" hidden>
            ${allowAdd ? `<button id="showAddService" type="button">Dodaj</button>` : ""}
            ${allowEdit ? `<button id="showEditService" type="button">Edytuj</button>` : ""}
            ${allowDelete ? `<button id="showDeleteService" type="button" class="bm-danger-btn">Usuń</button>` : ""}
          </div>
        </div>
        <div class="bm-table-toolbar cm-limit-toolbar"><button type="button" class="cm-limit-trigger">50 <span>▾</span></button></div>
        ${table(["Kategoria", "Nazwa", "Czas trwania", "Cena", "Stanowisko pracy", "Kod usługi"], renderRows(services, categories, positions), "Brak usług w Supabase.")}
        ${pagination(services.length)}
        <p id="servicesMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceFormCard" hidden>
        <h2>Dodaj usługę</h2>
        <form id="serviceForm" class="bm-form-grid bm-wide-form">
          ${serviceFormFields(categories, positions)}
          <button type="button" id="showServiceCategoryManager" class="bm-secondary-btn">Dodaj nową kategorię</button>
          <button type="submit">Zapisz usługę</button>
        </form>
        <p id="serviceMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceEditCard" hidden>
        <h2>Edytuj usługę</h2>
        <form id="serviceEditSelectForm" class="bm-form-grid">
          <label class="full">Wybierz usługę<select name="serviceId" required><option value="">Wybierz...</option>${serviceOptions}</select></label>
        </form>
        <form id="serviceEditForm" class="bm-form-grid bm-wide-form" hidden>
          ${serviceFormFields(categories, positions)}
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="serviceEditMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceDeleteCard" hidden>
        <h2>Usuń usługę lub kategorię</h2>
        <div class="bm-form-grid bm-wide-form">
          <label>Wybierz usługę do usunięcia
            <select id="deleteServiceSelect">
              <option value="">Wybierz usługę</option>
              ${serviceOptions}
            </select>
          </label>
          <button type="button" id="deleteServiceBtn" class="bm-danger-btn">Usuń usługę</button>

          <label>Wybierz kategorię do usunięcia
            <select id="deleteServiceCategorySelect">
              <option value="">Wybierz kategorię</option>
              ${categoryOptions}
            </select>
          </label>
          <p class="muted">Usunięcie kategorii usuwa również usługi przypisane do tej kategorii.</p>
          <button type="button" id="deleteServiceCategoryBtn" class="bm-danger-btn">Usuń kategorię</button>
        </div>
        <p id="serviceDeleteMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceCategoryCard" hidden>
        <h2>Kategorie usług</h2>
        ${categoryList}
        <form id="serviceCategoryForm" class="bm-form-grid">
          <label>Nazwa kategorii
            <input name="name" placeholder="Nazwa kategorii" required>
          </label>
          <button type="submit">Zapisz kategorię</button>
        </form>
        <p id="serviceCategoryMessage" class="panel-message"></p>
      </section>
    `;

    bindActions(ctx, services, categories, positions);
  }

  function downloadServices(services, categories, positions) {
    const headers = ["Kategoria", "Nazwa", "Czas godziny", "Czas minuty", "Cena od (PLN)", "Cena do (PLN)", "Zaliczka (PLN)", "Stanowisko pracy", "Opis", "Kod usługi", "Rezerwacja online", "Blokada nakładania", "Wliczaj do prowizji", "Uwzględniaj przy rabacie"];
    const lines = [headers.join("\t"), ...services.map((service) => {
      const category = categories.find((item) => item.id === service.category_id);
      const position = positions.find((item) => item.id === service.position_id);
      return [
        category?.name || "", service.name || "", service.duration_hours || "0", service.duration_minutes || "0", service.price_from || "", service.price_to || "", service.deposit || "", position?.name || "", service.description || "", service.code || "", service.show_online ? "tak" : "nie", service.prevent_overlap ? "tak" : "nie", service.include_commission ? "tak" : "nie", service.include_discount ? "tak" : "nie"
      ].map((value) => String(value).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t");
    })];
    const blob = new Blob([lines.join("\n")], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "uslugi-companymanager.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindActions(ctx, services, categories, positions) {
    const serviceFormCard = document.querySelector("#serviceFormCard");
    const serviceEditCard = document.querySelector("#serviceEditCard");
    const serviceDeleteCard = document.querySelector("#serviceDeleteCard");
    const categoryCard = document.querySelector("#serviceCategoryCard");
    const servicesById = Object.fromEntries(services.map((service) => [service.id, service]));
    let selectedEditServiceId = "";

    document.querySelector("#exportServicesBtn")?.addEventListener("click", () => downloadServices(services, categories, positions));
    document.querySelector("#importServicesBtn")?.addEventListener("click", () => setMessage("#servicesMessage", "Import usług do Supabase zostanie podpięty osobnym krokiem. Export działa.", false));

    document.querySelector("#showAddService")?.addEventListener("click", () => showOnly(serviceFormCard));
    document.querySelector("#showEditService")?.addEventListener("click", () => showOnly(serviceEditCard));
    document.querySelector("#showDeleteService")?.addEventListener("click", () => showOnly(serviceDeleteCard));
    document.querySelector("#showServiceCategoryManager")?.addEventListener("click", () => showOnly(categoryCard));

    document.querySelector("#serviceCategoryForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = String(new FormData(form).get("name") || "").trim();
      if (!name) { setMessage("#serviceCategoryMessage", "Wpisz nazwę kategorii.", false); return; }
      const exists = categories.some((category) => String(category.name || "").trim().toLowerCase() === name.toLowerCase());
      if (exists) { setMessage("#serviceCategoryMessage", "Taka kategoria już istnieje.", false); return; }
      const { error } = await window.cmSupabase.from("service_categories").insert({ company_id: ctx.companyId, name, updated_at: new Date().toISOString() });
      if (error) { setMessage("#serviceCategoryMessage", "Błąd zapisu kategorii: " + error.message, false); return; }
      setMessage("#serviceCategoryMessage", "Kategoria zapisana w Supabase.", true);
      setTimeout(renderServices, 450);
    });

    document.querySelector("#serviceForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = servicePayload(ctx, formData);
      const validation = validateServicePayload(payload);
      if (validation) { setMessage("#serviceMessage", validation, false); return; }
      const { error } = await window.cmSupabase.from("services").insert(payload);
      if (error) { setMessage("#serviceMessage", "Błąd zapisu usługi: " + error.message, false); return; }
      setMessage("#serviceMessage", "Usługa zapisana w Supabase.", true);
      setTimeout(renderServices, 450);
    });

    document.querySelector("#serviceEditSelectForm select")?.addEventListener("change", (event) => {
      selectedEditServiceId = event.currentTarget.value;
      const service = servicesById[selectedEditServiceId];
      const form = document.querySelector("#serviceEditForm");
      if (!form || !service) {
        if (form) form.hidden = true;
        return;
      }
      fillEditForm(form, service);
      form.hidden = false;
    });

    document.querySelector("#serviceEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedEditServiceId) { setMessage("#serviceEditMessage", "Wybierz usługę do edycji.", false); return; }
      const payload = servicePayload(ctx, new FormData(event.currentTarget));
      const validation = validateServicePayload(payload);
      if (validation) { setMessage("#serviceEditMessage", validation, false); return; }
      delete payload.company_id;
      const { error } = await window.cmSupabase.from("services").update(payload).eq("id", selectedEditServiceId).eq("company_id", ctx.companyId);
      if (error) { setMessage("#serviceEditMessage", "Błąd edycji usługi: " + error.message, false); return; }
      setMessage("#serviceEditMessage", "Usługa zaktualizowana w Supabase.", true);
      setTimeout(renderServices, 450);
    });

    document.querySelector("#deleteServiceBtn")?.addEventListener("click", async () => {
      const serviceId = document.querySelector("#deleteServiceSelect")?.value;
      if (!serviceId) { setMessage("#serviceDeleteMessage", "Wybierz usługę do usunięcia.", false); return; }
      const { error } = await window.cmSupabase.from("services").delete().eq("id", serviceId).eq("company_id", ctx.companyId);
      if (error) { setMessage("#serviceDeleteMessage", "Błąd usuwania usługi: " + error.message, false); return; }
      setMessage("#serviceDeleteMessage", "Usługa usunięta z Supabase.", true);
      setTimeout(renderServices, 450);
    });

    document.querySelector("#deleteServiceCategoryBtn")?.addEventListener("click", async () => {
      const categoryId = document.querySelector("#deleteServiceCategorySelect")?.value;
      if (!categoryId) { setMessage("#serviceDeleteMessage", "Wybierz kategorię do usunięcia.", false); return; }
      const { error: servicesError } = await window.cmSupabase.from("services").delete().eq("category_id", categoryId).eq("company_id", ctx.companyId);
      if (servicesError) { setMessage("#serviceDeleteMessage", "Błąd usuwania usług z kategorii: " + servicesError.message, false); return; }
      const { error } = await window.cmSupabase.from("service_categories").delete().eq("id", categoryId).eq("company_id", ctx.companyId);
      if (error) { setMessage("#serviceDeleteMessage", "Błąd usuwania kategorii: " + error.message, false); return; }
      setMessage("#serviceDeleteMessage", "Kategoria i przypisane usługi zostały usunięte z Supabase.", true);
      setTimeout(renderServices, 450);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderServices);
  } else {
    renderServices();
  }
})();
