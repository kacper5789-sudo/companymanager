// CompanyManager — OWNER Companies Panel Supabase

(function () {
  const moneyPlanLabels = {
    "3_months": "3 miesiące",
    "6_months": "6 miesięcy",
    "12_months": "12 miesięcy",
    "24_months": "24 miesiące"
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
    try { return new Date(value).toLocaleDateString("pl-PL"); } catch (_) { return "—"; }
  }

  function selectedCompanyId() {
    return document.querySelector('input[name="selectedCompany"]:checked')?.value || null;
  }

  async function requireOwner(root) {
    const { data: access, error } = await window.cmSupabase.rpc("get_my_access");
    if (error) {
      root.innerHTML = `<section class="bm-page-card"><h2>Błąd dostępu</h2><p>${escapeHtml(error.message)}</p></section>`;
      return null;
    }
    if (!access || String(access.role).toUpperCase() !== "OWNER") {
      root.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>Tylko OWNER może otworzyć tę zakładkę.</p></section>`;
      return null;
    }
    localStorage.setItem("cm_access", JSON.stringify(access));
    return access;
  }

  async function runRpc(actionName, rpcName, args) {
    if (!confirm(actionName + "?")) return false;

    const { error } = await window.cmSupabase.rpc(rpcName, args || {});
    if (error) {
      alert("Błąd: " + error.message);
      return false;
    }
    return true;
  }

  async function loadCompanies() {
    const root = document.getElementById("dashboardRoot");
    if (!root) return;

    root.innerHTML = `<div class="doc-card"><h1>Firmy</h1><p>Ładowanie danych z Supabase...</p></div>`;

    if (!window.cmSupabase) {
      root.innerHTML = `<section class="bm-page-card"><h2>Brak połączenia</h2><p>Nie załadowano supabaseClient.js.</p></section>`;
      return;
    }

    const access = await requireOwner(root);
    if (!access) return;

    const [{ data: companies, error: companiesError }, { data: requests, error: requestsError }] = await Promise.all([
      window.cmSupabase.rpc("owner_list_companies"),
      window.cmSupabase..rpc("owner_list_registration_requests")
    ]);

    if (companiesError || requestsError) {
      root.innerHTML = `<section class="bm-page-card"><h2>Błąd</h2><p>${escapeHtml(companiesError?.message || requestsError?.message)}</p></section>`;
      return;
    }

    const companyRows = (companies || []).map((c, index) => {
      const statusLabel = c.is_in_trash ? "Kosz" : c.status;
      const expired = c.package_expired ? "Wygasł" : "OK";
      return `
        <tr data-company-id="${escapeHtml(c.id)}">
          <td>${index + 1}</td>
          <td><button type="button" class="cm-company-switch-btn" data-switch="${escapeHtml(c.id)}">${escapeHtml(c.name || "—")}</button></td>
          <td>${escapeHtml(c.owner_name || "—")}</td>
          <td>${escapeHtml(c.company_email || "—")}</td>
          <td>${escapeHtml(moneyPlanLabels[c.package] || c.package || "—")}</td>
          <td>${escapeHtml(formatDate(c.package_expires_at))}</td>
          <td>${escapeHtml(expired)}</td>
          <td>${escapeHtml(statusLabel || "—")}</td>
          <td><input type="radio" name="selectedCompany" value="${escapeHtml(c.id)}"></td>
        </tr>`;
    }).join("");

    const requestRows = (requests || []).map((r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(r.status || "—")}</td>
        <td>${escapeHtml(formatDate(r.created_at))}</td>
        <td>${escapeHtml(r.company_name || "—")}</td>
        <td>${escapeHtml(r.full_name || "—")}</td>
        <td>${escapeHtml(r.email || "—")}</td>
        <td>${escapeHtml(moneyPlanLabels[r.package] || r.package || "—")}</td>
        <td>
          ${r.status === "pending" ? `
            <button type="button" class="bm-btn" data-approve="${escapeHtml(r.id)}">Zatwierdź</button>
            <button type="button" class="bm-btn danger" data-reject="${escapeHtml(r.id)}">Odrzuć</button>
          ` : "—"}
        </td>
      </tr>`).join("");

    root.innerHTML = `
      <section class="bm-page-card cm-companies-page">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Tylko właściciel</span>
            <h2>Firmy</h2>
            <p class="bm-muted">Lista firm pobierana bezpośrednio z Supabase.</p>
          </div>
        </div>

        <table class="bm-table">
          <thead>
            <tr>
              <th>Nr</th>
              <th>Nazwa Firmy</th>
              <th>Właściciel Firmy</th>
              <th>Email</th>
              <th>Pakiet</th>
              <th>Data wygaśnięcia</th>
              <th>Pakiet</th>
              <th>Status</th>
              <th>Wybierz</th>
            </tr>
          </thead>
          <tbody>${companyRows || `<tr><td colspan="9">Brak firm w Supabase.</td></tr>`}</tbody>
        </table>

        <div class="bm-page-card" style="margin-top:20px;">
          <h3>Przyciski OWNER</h3>
          <p class="bm-muted">Najpierw zaznacz firmę w tabeli, potem wybierz akcję.</p>
          <div class="bm-actions" style="display:flex; flex-wrap:wrap; gap:10px;">
            <button type="button" class="bm-btn" id="blockCompanyBtn">Zablokuj firmę</button>
            <button type="button" class="bm-btn" id="unblockCompanyBtn">Odblokuj firmę</button>
            <button type="button" class="bm-btn danger" id="trashCompanyBtn">Usuń do kosza</button>
            <button type="button" class="bm-btn" id="restoreCompanyBtn">Przywróć</button>
            <button type="button" class="bm-btn danger" id="permanentDeleteCompanyBtn">Usuń permanentnie</button>
            <button type="button" class="bm-btn" id="extendPackageBtn">Przedłuż pakiet</button>
          </div>
        </div>
      </section>

      <section class="bm-page-card cm-companies-page">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Rejestracja</span>
            <h2>Zgłoszenia firm</h2>
            <p class="bm-muted">Tutaj trafiają formularze rejestracji. OWNER może zatwierdzić albo odrzucić firmę.</p>
          </div>
        </div>
        <table class="bm-table">
          <thead>
            <tr>
              <th>Nr</th>
              <th>Status</th>
              <th>Data</th>
              <th>Firma</th>
              <th>Osoba</th>
              <th>Email</th>
              <th>Pakiet</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>${requestRows || `<tr><td colspan="8">Brak zgłoszeń rejestracji.</td></tr>`}</tbody>
        </table>
      </section>`;

    bindActions();
  }

  function bindActions() {
    document.querySelectorAll("[data-switch]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const companyId = btn.dataset.switch;
        const { error } = await window.cmSupabase.rpc("owner_switch_company", { target_company_id: companyId });
        if (error) return alert("Błąd: " + error.message);
        window.location.href = "dashboard.html";
      });
    });

    document.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await runRpc("Zatwierdzić firmę", "approve_company_registration", { request_id: btn.dataset.approve });
        if (ok) await loadCompanies();
      });
    });

    document.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const reason = prompt("Powód odrzucenia:", "") || "";
        const ok = await runRpc("Odrzucić zgłoszenie", "reject_company_registration", { request_id: btn.dataset.reject, reject_reason: reason });
        if (ok) await loadCompanies();
      });
    });

    document.getElementById("blockCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const reason = prompt("Powód blokady:", "Nieopłacony pakiet") || "";
      const ok = await runRpc("Zablokować firmę", "owner_block_company", { target_company_id: id, reason });
      if (ok) await loadCompanies();
    });

    document.getElementById("unblockCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const date = prompt("Nowa data ważności pakietu YYYY-MM-DD albo puste:", "") || null;
      const ok = await runRpc("Odblokować firmę", "owner_unblock_company", { target_company_id: id, new_package_expires_at: date });
      if (ok) await loadCompanies();
    });

    document.getElementById("trashCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const reason = prompt("Powód przeniesienia do kosza:", "") || "";
      const ok = await runRpc("Przenieść firmę do kosza", "owner_move_company_to_trash", { target_company_id: id, reason });
      if (ok) await loadCompanies();
    });

    document.getElementById("restoreCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const ok = await runRpc("Przywrócić firmę", "owner_restore_company_from_trash", { target_company_id: id });
      if (ok) await loadCompanies();
    });

    document.getElementById("permanentDeleteCompanyBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const confirmation = prompt("Wpisz dokładnie: DELETE PERMANENTLY");
      if (confirmation !== "DELETE PERMANENTLY") return alert("Przerwano.");
      const ok = await runRpc("Usunąć permanentnie firmę", "owner_permanently_delete_company", { target_company_id: id, confirmation });
      if (ok) await loadCompanies();
    });

    document.getElementById("extendPackageBtn")?.addEventListener("click", async () => {
      const id = selectedCompanyId();
      if (!id) return alert("Najpierw wybierz firmę.");
      const plan = prompt("Pakiet: 3_months / 6_months / 12_months / 24_months", "12_months");
      const date = prompt("Data ważności YYYY-MM-DD:", "");
      if (!plan || !date) return alert("Brak pakietu albo daty.");
      const ok = await runRpc("Przedłużyć pakiet", "owner_extend_company_package", { target_company_id: id, new_package: plan, new_expires_at: date });
      if (ok) await loadCompanies();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const isCompaniesPage = document.body?.dataset?.panelPage === "companies" || window.location.pathname.includes("companies.html");
    if (!isCompaniesPage) return;

    // app.js renderuje jeszcze stary localStorage. Czekamy chwilę i nadpisujemy widok danymi z Supabase.
    window.setTimeout(loadCompanies, 250);
  });
})();
