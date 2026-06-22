// CompanyManager — Clients Module powered by Supabase
// 029B: zakładka Klienci czyta/dodaje/usuwa dane z public.clients zamiast localStorage.

(function () {
  function isCustomersPage() {
    return document.body?.dataset?.panelPage === "customers" || window.location.pathname.includes("customers.html");
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

  function plDate(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString("pl-PL");
    } catch (_) {
      return "";
    }
  }

  function boolToTakNie(value) {
    return value ? "tak" : "nie";
  }

  function takNieToBool(value) {
    return String(value || "").trim().toLowerCase() === "tak";
  }

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  async function getContext() {
    if (!window.cmSupabase) {
      return { ok: false, message: "Nie załadowano połączenia z Supabase." };
    }

    const [{ data: access, error: accessError }, { data: context, error: contextError }] = await Promise.all([
      window.cmSupabase.rpc("get_my_access"),
      window.cmSupabase.rpc("get_effective_company_context")
    ]);

    if (accessError) return { ok: false, message: accessError.message };
    if (contextError) return { ok: false, message: contextError.message };
    if (!access || access.allowed !== true) return { ok: false, message: access?.reason || "Brak dostępu." };
    if (!context || context.allowed !== true) return { ok: false, message: context?.reason || "Brak kontekstu firmy." };
    if (!context.company_id) {
      return {
        ok: false,
        message: "Brak wybranej firmy. OWNER musi najpierw wejść w firmę z zakładki Firmy."
      };
    }

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return { ok: true, access, context, companyId: context.company_id };
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

  function clientName(client) {
    const joined = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    return joined || client.full_name || "-";
  }

  function getCustomerRows(customers) {
    return customers.map((client) => [
      escapeHtml(clientName(client)),
      escapeHtml(client.gender || ""),
      escapeHtml(client.phone || ""),
      escapeHtml(client.email || ""),
      escapeHtml(plDate(client.updated_at)),
      escapeHtml(plDate(client.last_visit_at)),
      escapeHtml(client.notes || ""),
      `<span class="bm-status ${client.active === false ? "inactive" : "active"}">${client.active === false ? "nieaktywny" : "aktywny"}</span>`
    ]);
  }

  async function fetchCustomers(companyId) {
    return window.cmSupabase
      .from("clients")
      .select("id, company_id, first_name, last_name, full_name, gender, phone, email, birth_date, address, city, postal_code, notes, source, marketing_sms, marketing_email, active, tags, total_visits, total_spent, last_visit_at, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
  }

  async function renderCustomers() {
    if (!isCustomersPage()) return;

    const area = getPanelArea();
    if (!area) return;

    area.innerHTML = `
      <section class="bm-page-card customers-module">
        <h2>Lista klientów</h2>
        <p class="bm-muted">Ładowanie klientów z Supabase...</p>
      </section>
    `;

    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>${escapeHtml(ctx.message)}</p></section>`;
      return;
    }

    const { data: customers, error } = await fetchCustomers(ctx.companyId);
    if (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd klientów</h2><p>${escapeHtml(error.message)}</p></section>`;
      return;
    }

    renderContent(ctx, customers || []);
  }

  function renderContent(ctx, customers) {
    const area = getPanelArea();
    if (!area) return;

    const genderOptions = ["kobieta", "mężczyzna"];
    const statusOptions = ["aktywny", "nieaktywny"];
    const yesNoOptions = ["tak", "nie"];

    area.innerHTML = `
      <section class="bm-page-card customers-module">
        <div class="bm-page-head customers-head">
          <h2>Lista klientów</h2>
          <div class="bm-actions-row">
            <button id="exportCustomersBtn" type="button" class="bm-excel-btn">Export</button>
            <button id="importCustomersBtn" type="button" class="bm-excel-btn">Import</button>
            <input id="importCustomersFile" type="file" accept=".xls,.xlsx,.csv" hidden>
            <button id="showAddCustomer" type="button">Dodaj</button>
            <button id="showDeleteCustomer" type="button" class="bm-danger-btn">Usuń</button>
          </div>
        </div>

        <div class="bm-table-toolbar">
          <label>Szukaj: <input id="customersSearch" type="search" placeholder="Szukaj klienta"></label>
        </div>

        <div id="customersTableWrap">
          ${table(["Imie Nazwisko", "Płeć", "Telefon", "Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(customers), "Brak klientów w Supabase.")}
          ${pagination(customers.length)}
        </div>
        <p id="customersMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="customerFormCard" hidden>
        <h2>Dodaj klienta</h2>
        <form id="customerForm" class="bm-form-grid">
          <label>Imie<input name="firstName" placeholder="Imie" required></label>
          <label>Nazwisko<input name="lastName" placeholder="Nazwisko" required></label>
          <label>Płeć<select name="gender" required>${genderOptions.map((g) => `<option value="${g}">${g}</option>`).join("")}</select></label>
          <label>Telefon<input name="phone" placeholder="Telefon" required></label>
          <label>Email<input name="email" type="email" placeholder="email@firma.pl"></label>
          <label>Adres<input name="address" placeholder="Adres"></label>
          <label>Kod pocztowy<input name="postalCode" placeholder="XX-XXX"></label>
          <label>Miejscowość<input name="city" placeholder="Miejscowość"></label>
          <label>Status<select name="status">${statusOptions.map((status) => `<option value="${status}">${status}</option>`).join("")}</select></label>
          <label>Skąd klient wie o firmie<input name="source" placeholder="np. Google, Facebook, polecenie"></label>
          <label>Zgoda na reklamę — SMS<select name="marketingSms">${yesNoOptions.map((v) => `<option value="${v}">${v}</option>`).join("")}</select></label>
          <label>Zgoda na reklamę — Email<select name="marketingEmail">${yesNoOptions.map((v) => `<option value="${v}">${v}</option>`).join("")}</select></label>
          <label>Dzień, miesiąc i rok urodzin<input name="birthDate" type="date"></label>
          <label class="full">Ważna informacja<textarea name="importantInfo" placeholder="Ważna informacja"></textarea></label>
          <button type="submit">Zapisz klienta</button>
        </form>
        <p id="customerFormMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="customerDeleteCard" hidden>
        <h2>Usuń klienta</h2>
        <form id="customerDeleteForm" class="bm-form-grid">
          <label>Imie<input name="firstName" placeholder="Imie"></label>
          <label>Nazwisko<input name="lastName" placeholder="Nazwisko"></label>
          <label>Płeć<select name="gender"><option value="">Nie bierz pod uwagę</option>${genderOptions.map((g) => `<option value="${g}">${g}</option>`).join("")}</select></label>
          <label>Telefon<input name="phone" placeholder="Telefon"></label>
          <label>Email<input name="email" type="email" placeholder="email@firma.pl"></label>
          <button type="submit" class="bm-danger-btn">Usuń</button>
        </form>
        <p id="customerDeleteMessage" class="panel-message"></p>
      </section>
    `;

    bindActions(ctx, customers);
  }

  function filterCustomers(customers) {
    const search = String(document.querySelector("#customersSearch")?.value || "").toLowerCase().trim();
    if (!search) return customers;

    return customers.filter((client) => {
      const text = [
        client.first_name,
        client.last_name,
        client.full_name,
        client.gender,
        client.phone,
        client.email,
        client.city,
        client.address,
        client.postal_code,
        client.notes,
        client.active === false ? "nieaktywny" : "aktywny"
      ].join(" ").toLowerCase();
      return text.includes(search);
    });
  }

  function rerenderTable(customers) {
    const filtered = filterCustomers(customers);
    const wrap = document.querySelector("#customersTableWrap");
    if (!wrap) return;
    wrap.innerHTML = `
      ${table(["Imie Nazwisko", "Płeć", "Telefon", "Email", "Aktualizacja", "Ostatnia wizyta", "Ważna informacja", "Status"], getCustomerRows(filtered), "Brak klientów w Supabase.")}
      ${pagination(filtered.length)}
    `;
  }

  function bindActions(ctx, customers) {
    const customerFormCard = document.querySelector("#customerFormCard");
    const customerDeleteCard = document.querySelector("#customerDeleteCard");

    document.querySelector("#showAddCustomer")?.addEventListener("click", () => {
      if (customerDeleteCard) customerDeleteCard.hidden = true;
      if (customerFormCard) customerFormCard.hidden = !customerFormCard.hidden;
    });

    document.querySelector("#showDeleteCustomer")?.addEventListener("click", () => {
      if (customerFormCard) customerFormCard.hidden = true;
      if (customerDeleteCard) customerDeleteCard.hidden = !customerDeleteCard.hidden;
    });

    document.querySelector("#customersSearch")?.addEventListener("input", () => rerenderTable(customers));

    document.querySelector("#customerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const msg = document.querySelector("#customerFormMessage");

      const firstName = String(data.firstName || "").trim();
      const lastName = String(data.lastName || "").trim();
      const phone = String(data.phone || "").trim();

      if (!firstName || !lastName || !phone) {
        if (msg) {
          msg.textContent = "Uzupełnij wymagane dane klienta.";
          msg.style.color = "#fca5a5";
          msg.style.display = "block";
        }
        return;
      }

      const payload = {
        company_id: ctx.companyId,
        first_name: firstName,
        last_name: lastName,
        gender: String(data.gender || "").trim(),
        phone,
        email: String(data.email || "").trim() || null,
        address: String(data.address || "").trim() || null,
        postal_code: String(data.postalCode || "").trim() || null,
        city: String(data.city || "").trim() || null,
        source: String(data.source || "").trim() || null,
        birth_date: String(data.birthDate || "").trim() || null,
        notes: String(data.importantInfo || "").trim() || null,
        marketing_sms: takNieToBool(data.marketingSms),
        marketing_email: takNieToBool(data.marketingEmail),
        active: String(data.status || "aktywny") !== "nieaktywny"
      };

      const { error } = await window.cmSupabase.from("clients").insert(payload);
      if (error) {
        if (msg) {
          msg.textContent = "Błąd zapisu: " + error.message;
          msg.style.color = "#fca5a5";
          msg.style.display = "block";
        }
        return;
      }

      if (msg) {
        msg.textContent = "Klient zapisany w Supabase.";
        msg.style.color = "#86efac";
        msg.style.display = "block";
      }
      form.reset();
      await renderCustomers();
    });

    document.querySelector("#customerDeleteForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector("#customerDeleteMessage");

      const criteria = {
        first_name: String(data.firstName || "").trim(),
        last_name: String(data.lastName || "").trim(),
        gender: String(data.gender || "").trim(),
        phone: String(data.phone || "").trim(),
        email: String(data.email || "").trim()
      };

      if (!criteria.first_name && !criteria.last_name && !criteria.gender && !criteria.phone && !criteria.email) {
        if (msg) {
          msg.textContent = "Podaj przynajmniej jedną daną klienta do usunięcia.";
          msg.style.color = "#fca5a5";
          msg.style.display = "block";
        }
        return;
      }

      let query = window.cmSupabase.from("clients").delete().eq("company_id", ctx.companyId);
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) query = query.eq(key, value);
      });

      if (!confirm("Usunąć klientów pasujących do podanych danych?")) return;

      const { error } = await query;
      if (error) {
        if (msg) {
          msg.textContent = "Błąd usuwania: " + error.message;
          msg.style.color = "#fca5a5";
          msg.style.display = "block";
        }
        return;
      }

      if (msg) {
        msg.textContent = "Usunięto pasujących klientów z Supabase.";
        msg.style.color = "#86efac";
        msg.style.display = "block";
      }
      await renderCustomers();
    });

    document.querySelector("#exportCustomersBtn")?.addEventListener("click", () => {
      const headers = ["Imie", "Nazwisko", "Płeć", "Telefon", "Email", "Adres", "Kod pocztowy", "Miejscowość", "Urodziny", "Ważna informacja", "Marketing SMS", "Marketing Email", "Status"];
      const rows = customers.map((client) => [
        client.first_name || "",
        client.last_name || "",
        client.gender || "",
        client.phone || "",
        client.email || "",
        client.address || "",
        client.postal_code || "",
        client.city || "",
        client.birth_date || "",
        client.notes || "",
        boolToTakNie(client.marketing_sms),
        boolToTakNie(client.marketing_email),
        client.active === false ? "nieaktywny" : "aktywny"
      ]);
      const lines = [headers, ...rows].map((row) => row.map((value) => String(value).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"));
      const blob = new Blob([lines.join("\n")], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "klienci-companymanager-supabase.xls";
      link.click();
      URL.revokeObjectURL(url);
    });

    document.querySelector("#importCustomersBtn")?.addEventListener("click", () => {
      document.querySelector("#importCustomersFile")?.click();
    });

    document.querySelector("#importCustomersFile")?.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      const msg = document.querySelector("#customersMessage");
      if (file && msg) {
        msg.textContent = `Wybrano plik do importu: ${file.name}. Import danych z pliku podepniemy po stabilizacji modułu klientów.`;
        msg.style.color = "#86efac";
        msg.style.display = "block";
      }
    });
  }

  window.addEventListener("load", () => {
    if (!isCustomersPage()) return;
    window.setTimeout(renderCustomers, 450);
  });
})();
