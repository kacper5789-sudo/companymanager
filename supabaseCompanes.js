// CompanyManager — FULL OWNER Companies Panel powered by Supabase
// Ten plik zastępuje stary lokalny widok Firmy danymi z Supabase,
// ale zachowuje pełny układ tabeli i dodaje sekcję Przyciski OWNER pod tabelą.

(function () {
  const moneyPlanLabels = {
    "3_months": "3 miesiące — 100 PLN netto",
    "6_months": "6 miesięcy — 175 PLN netto",
    "12_months": "12 miesięcy — 300 PLN netto",
    "24_months": "24 miesiące — 500 PLN netto"
  };

  const statusLabels = {
    pending: "Oczekuje",
    active: "Aktywna",
    rejected: "Odrzucona",
    blocked: "Zablokowana"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString("pl-PL");
    } catch (_) {
      return "—";
    }
  }

  function isCompaniesPage() {
    return document.body?.dataset?.panelPage === "companies" || window.location.pathname.includes("companies.html");
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

  function getPanelArea() {
    return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot");
  }

  function companyOptionLabel(company) {
    const status = company.is_in_trash ? "Kosz" : (statusLabels[company.status] || company.status || "—");
    const plan = moneyPlanLabels[company.package] || company.package || "—";
    return `${company.name || "—"} — ${company.owner_name || "—"} — ${status} — ${plan} — ${formatDate(company.package_expires_at)}`;
  }

  function selectedCompanyId() {
    return document.getElementById("ownerCompanyActionSelect")?.value || "";
  }

  function selectedCompanyName() {
    const select = document.getElementById("ownerCompanyActionSelect");
    return select?.selectedOptions?.[0]?.textContent?.trim() || "wybraną firmę";
  }

  async function requireOwner() {
    if (!window.cmSupabase) {
      return { ok: false, message: "Nie załadowano połączenia z Supabase." };
    }

    const { data, error } = await window.cmSupabase.rpc("get_my_access");
    if (error) return { ok: false, message: error.message };
    if (!data || String(data.role).toUpperCase() !== "OWNER") {
      return { ok: false, message: "Tylko OWNER może otworzyć zakładkę Firmy." };
    }

    localStorage.setItem("cm_access", JSON.stringify(data));
    return { ok: true, access: data };
  }

  async function runRpc(actionName, rpcName, args) {
    if (!confirm(`${actionName}: ${selectedCompanyName()}?`)) return false;

    const { error } = await window.cmSupabase.rpc(rpcName, args || {});
    if (error) {
      alert("Błąd: " + error.message);
      return false;
    }

    alert("Wykonano: " + actionName);
    await renderCompanies();
    return true;
  }

  function bindActions() {
    document.querySelectorAll("[data-company-switch]").forEach((button) => {
      button.addEventListener("click", async () => {
        const companyId = button.getAttribute("data-company-switch");
        if (!companyId) return;

        const { error } = await window.cmSupabase.rpc("owner_switch_company", {
          target_company_id: companyId
        });

        if (error) {
          alert("Błąd: " + error.message);
          return;
        }

        window.location.href = "dashboard.html";
      });
    });

    document.querySelectorAll("[data-registration-approve]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Zatwierdzić tę firmę i utworzyć konto ADMIN?")) return;
        const { error } = await window.cmSupabase.rpc("approve_company_registration", {
          request_id: button.getAttribute("data-registration-approve")
        });
        if (error) return alert("Błąd: " + error.message);
        await renderCompanies();
      });
    });

    document.querySelectorAll("[data-registration-reject]").forEach((button) => {
      button.addEventListener("click", async () => {
        const reason = prompt("Powód odrzucenia:", "") || "";
        if (!confirm("Odrzucić to zgłoszenie rejestracji?")) return;
        const { error } = await window.cmSupabase.rpc("reject_company_registration", {
          request_id: button.getAttribute("data-registration-reject"),
          reject_reason: reason
        });
        if (error) return alert("Błąd: " + error.message);
        await renderCompanies();
      });
    });

    document.getElementById("blockCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const reason = prompt("Powód blokady:", "Nieopłacony pakiet") || "";
      await runRpc("Zablokować firmę", "owner_block_company", { target_company_id: id, reason });
    });

    document.getElementById("unblockCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const date = prompt("Nowa data ważności pakietu YYYY-MM-DD albo puste:", "") || null;
      await runRpc("Odblokować firmę", "owner_unblock_company", { target_company_id: id, new_package_expires_at: date });
    });

    document.getElementById("trashCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const reason = prompt("Powód przeniesienia do kosza:", "") || "";
      await runRpc("Przenieść firmę do kosza", "owner_move_company_to_trash", { target_company_id: id, reason });
    });

    document.getElementById("restoreCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      await runRpc("Przywrócić firmę", "owner_restore_company_from_trash", { target_company_id: id });
    });

    document.getElementById("permanentDeleteCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const confirmation = prompt("Wpisz dokładnie: DELETE PERMANENTLY");
      if (confirmation !== "DELETE PERMANENTLY") return alert("Przerwano.");
      await runRpc("Usunąć permanentnie firmę", "owner_permanently_delete_company", { target_company_id: id, confirmation });
    });

    document.getElementById("extendPackageBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const plan = prompt("Pakiet: 3_months / 6_months / 12_months / 24_months", "12_months");
      const date = prompt("Data ważności YYYY-MM-DD:", "");
      if (!plan || !date) return alert("Brak pakietu albo daty.");
      await runRpc("Przedłużyć pakiet", "owner_extend_company_package", { target_company_id: id, new_package: plan, new_expires_at: date });
    });
  }

  function renderContent(companies, requests) {
    const companyRows = (companies || []).map((company, index) => {
      const activeLabel = company.status === "active" ? ` <span class="cm-company-active-badge">aktywna</span>` : "";
      const status = company.is_in_trash ? "Kosz" : (statusLabels[company.status] || company.status || "—");
      const packageLabel = moneyPlanLabels[company.package] || company.package || "—";
      const expires = company.package_expires_at ? formatDate(company.package_expires_at) : "—";
      const sender = company.message_sender || company.sms_sender || "—";

      return [
        String(index + 1),
        `<button type="button" class="cm-company-switch-btn" data-company-switch="${escapeHtml(company.id)}">${escapeHtml(company.name || "—")}${activeLabel}</button>`,
        escapeHtml(company.owner_name || "—"),
        escapeHtml(sender),
        escapeHtml(packageLabel),
        escapeHtml(expires),
        escapeHtml(status),
        `<input type="radio" name="selectedCompany" value="${escapeHtml(company.id)}" aria-label="Wybierz firmę ${escapeHtml(company.name || "")}">`
      ];
    });

    const requestRows = (requests || []).map((request, index) => {
      const statusRaw = request.status || "pending";
      const status = statusRaw === "pending" ? "Oczekuje" : statusRaw === "active" ? "Zatwierdzone" : statusRaw === "rejected" ? "Odrzucone" : statusRaw;
      const actions = statusRaw === "pending"
        ? `<div class="cm-company-actions"><button type="button" class="cm-approve-short" title="Zatwierdź" aria-label="Zatwierdź" data-registration-approve="${escapeHtml(request.id)}">Z</button><button type="button" class="cm-reject-short" title="Odrzuć" aria-label="Odrzuć" data-registration-reject="${escapeHtml(request.id)}">O</button></div>`
        : `<span class="bm-muted">${escapeHtml(status)}</span>`;

      const address = [request.company_address, request.company_postal_code, request.company_city].filter(Boolean).join(", ") || "—";
      return [
        String(index + 1),
        escapeHtml(status),
        escapeHtml(formatDate(request.created_at)),
        escapeHtml(request.company_name || "—"),
        escapeHtml(request.full_name || "—"),
        escapeHtml(request.email || "—"),
        escapeHtml(request.phone || "—"),
        escapeHtml(address),
        escapeHtml(request.company_phone || "—"),
        escapeHtml(request.company_email || "—"),
        escapeHtml(request.message_sender || request.sms_sender || "—"),
        escapeHtml(moneyPlanLabels[request.package] || request.package || "—"),
        escapeHtml(request.invoice_name || "—"),
        escapeHtml(request.nip_vat || "—"),
        actions
      ];
    });

    const companyOptions = (companies || []).map((company) => (
      `<option value="${escapeHtml(company.id)}">${escapeHtml(companyOptionLabel(company))}</option>`
    )).join("");

    return `
      <section class="bm-page-card cm-companies-page">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Tylko właściciel</span>
            <h2>Firmy</h2>
          </div>
        </div>

        ${table(['Nr','Nazwa Firmy','Właściciel Firmy','Nadawca Wiadomości','Pakiet','Data wygaśnięcia pakietu','Status','Wybierz'], companyRows, 'Brak aktywnych firm w Supabase.')}
        ${pagination(companyRows.length)}

        <div class="bm-page-card cm-owner-actions-card" id="supabaseOwnerCompanyActions">
          <div class="cm-owner-actions-head">
            <div>
              <span class="bm-tag">Panel OWNER</span>
              <h3>Przyciski OWNER</h3>
              <p class="bm-muted">Najpierw wybierz firmę w tabeli albo z listy poniżej, potem wykonaj akcję administracyjną.</p>
            </div>
            <div class="cm-owner-actions-badge">Supabase</div>
          </div>

          <div class="cm-owner-actions-grid">
            <label class="cm-owner-company-select">
              <span>Firma</span>
              <select id="ownerCompanyActionSelect">
                <option value="">Wybierz firmę</option>
                ${companyOptions}
              </select>
            </label>

            <div class="cm-owner-actions-buttons">
              <button type="button" class="bm-btn" id="blockCompanyBtn">Zablokuj firmę</button>
              <button type="button" class="bm-btn" id="unblockCompanyBtn">Odblokuj firmę</button>
              <button type="button" class="bm-btn danger" id="trashCompanyBtn">Usuń do kosza</button>
              <button type="button" class="bm-btn" id="restoreCompanyBtn">Przywróć</button>
              <button type="button" class="bm-btn danger" id="permanentDeleteCompanyBtn">Usuń permanentnie</button>
              <button type="button" class="bm-btn" id="extendPackageBtn">Przedłuż pakiet</button>
            </div>
          </div>

          <div class="cm-owner-actions-note">
            <strong>Bezpieczne zarządzanie firmą:</strong>
            <span>Blokada odcina dostęp, kosz ukrywa firmę, a przedłużenie pakietu przywraca dostęp po płatności. Dane zostają, dopóki nie użyjesz opcji „Usuń permanentnie”.</span>
          </div>
        </div>
      </section>

      <section class="bm-page-card cm-companies-page">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Rejestracja</span>
            <h2>Zgłoszenia firm</h2>
            <p class="bm-muted">Tutaj trafiają formularze rejestracji. OWNER może zatwierdzić albo odrzucić firmę. Po zatwierdzeniu konto osoby rejestrującej otrzymuje rolę ADMIN.</p>
          </div>
        </div>
        ${table(['Nr','Status','Data','Nazwa firmy','Osoba','Email','Telefon','Adres firmy','Telefony firmowe','Email firmowy','Nadawca Wiadomości','Pakiet','Dane do faktury','NIP / VAT EU','Akcje'], requestRows, 'Brak zgłoszeń rejestracji.')}
        ${pagination(requestRows.length)}
      </section>
    `;
  }

  async function renderCompanies() {
    if (!isCompaniesPage()) return;

    const area = getPanelArea();
    if (!area) return;

    area.innerHTML = `
      <section class="bm-page-card cm-companies-page">
        <h2>Firmy</h2>
        <p class="bm-muted">Ładowanie danych z Supabase...</p>
      </section>
    `;

    const auth = await requireOwner();
    if (!auth.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>${escapeHtml(auth.message)}</p></section>`;
      return;
    }

    const [{ data: companies, error: companiesError }, { data: requests, error: requestsError }] = await Promise.all([
      window.cmSupabase.rpc("owner_list_companies"),
      window.cmSupabase.rpc("owner_list_registration_requests")
    ]);

    if (companiesError || requestsError) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd</h2><p>${escapeHtml(companiesError?.message || requestsError?.message)}</p></section>`;
      return;
    }

    area.innerHTML = renderContent(companies || [], requests || []);

    document.querySelectorAll('input[name="selectedCompany"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const select = document.getElementById("ownerCompanyActionSelect");
        if (select) select.value = radio.value;
      });
    });

    document.getElementById("ownerCompanyActionSelect")?.addEventListener("change", (event) => {
      const value = event.target.value;
      document.querySelectorAll('input[name="selectedCompany"]').forEach((radio) => {
        radio.checked = radio.value === value;
      });
    });

    bindActions();
  }

  window.addEventListener("load", () => {
    if (!isCompaniesPage()) return;
    window.setTimeout(renderCompanies, 350);
  });
})();
