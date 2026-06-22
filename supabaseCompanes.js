// CompanyManager — OWNER Companies Supabase Controls
// Ten plik NIE przebudowuje starego widoku Firmy z app.js.
// Zostawia pełną starą tabelę i dokłada pod nią Przyciski OWNER obsługiwane przez Supabase.

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

  function isCompaniesPage() {
    return document.body?.dataset?.panelPage === "companies" || window.location.pathname.includes("companies.html");
  }

  async function requireOwner() {
    if (!window.cmSupabase) return { ok: false, message: "Nie załadowano supabaseClient.js." };

    const { data: access, error } = await window.cmSupabase.rpc("get_my_access");
    if (error) return { ok: false, message: error.message };
    if (!access || String(access.role).toUpperCase() !== "OWNER") {
      return { ok: false, message: "Tylko OWNER może używać przycisków właściciela." };
    }

    localStorage.setItem("cm_access", JSON.stringify(access));
    return { ok: true, access };
  }

  async function loadSupabaseCompanies() {
    const { data, error } = await window.cmSupabase.rpc("owner_list_companies");
    if (error) throw error;
    return data || [];
  }

  function selectedCompanyId() {
    return document.getElementById("ownerCompanyActionSelect")?.value || "";
  }

  function selectedCompanyLabel() {
    const select = document.getElementById("ownerCompanyActionSelect");
    return select?.selectedOptions?.[0]?.textContent?.trim() || "wybraną firmę";
  }

  async function runRpc(actionName, rpcName, args) {
    if (!confirm(`${actionName}: ${selectedCompanyLabel()}?`)) return false;

    const { error } = await window.cmSupabase.rpc(rpcName, args || {});
    if (error) {
      alert("Błąd: " + error.message);
      return false;
    }

    alert("Wykonano: " + actionName);
    await renderOwnerButtons(true);
    return true;
  }

  function buildOptions(companies) {
    return (companies || []).map((c) => {
      const status = c.is_in_trash ? "kosz" : (c.status || "—");
      const expired = c.package_expired ? "pakiet wygasł" : "pakiet OK";
      const plan = moneyPlanLabels[c.package] || c.package || "—";
      const label = `${c.name || "—"} — ${c.owner_name || "—"} — ${status} — ${plan} — ${formatDate(c.package_expires_at)} — ${expired}`;
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function findInsertPlace() {
    const sections = Array.from(document.querySelectorAll(".cm-companies-page"));
    if (sections.length) return sections[0];
    return document.getElementById("dashboardRoot") || document.body;
  }

  async function renderOwnerButtons(keepSelection = false) {
    if (!isCompaniesPage()) return;

    const oldSelected = selectedCompanyId();
    const existing = document.getElementById("supabaseOwnerCompanyActions");
    if (existing) existing.remove();

    const auth = await requireOwner();
    if (!auth.ok) {
      console.warn("CompanyManager Supabase OWNER controls:", auth.message);
      return;
    }

    let companies = [];
    try {
      companies = await loadSupabaseCompanies();
    } catch (error) {
      const target = findInsertPlace();
      const errorBox = document.createElement("section");
      errorBox.className = "bm-page-card cm-companies-page";
      errorBox.id = "supabaseOwnerCompanyActions";
      errorBox.style.marginTop = "20px";
      errorBox.innerHTML = `<h3>Przyciski OWNER</h3><p class="bm-muted">Błąd Supabase: ${escapeHtml(error.message)}</p>`;
      target.insertAdjacentElement("afterend", errorBox);
      return;
    }

    const section = document.createElement("section");
    section.className = "bm-page-card cm-companies-page cm-owner-actions-card";
    section.id = "supabaseOwnerCompanyActions";
    section.innerHTML = `
      <div class="cm-owner-actions-head">
        <div>
          <span class="bm-tag">Panel OWNER</span>
          <h3>Przyciski OWNER</h3>
          <p class="bm-muted">Najpierw wybierz firmę, potem wykonaj akcję administracyjną. Dane firmy zostają w bazie, dopóki nie użyjesz opcji „Usuń permanentnie”.</p>
        </div>
        <div class="cm-owner-actions-badge">Supabase</div>
      </div>

      <div class="cm-owner-actions-grid">
        <label class="cm-owner-company-select">
          <span>Firma</span>
          <select id="ownerCompanyActionSelect">
            <option value="">Wybierz firmę</option>
            ${buildOptions(companies)}
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
        <span>Blokada odcina dostęp, kosz ukrywa firmę, a przedłużenie pakietu przywraca dostęp po płatności. Permanentne usunięcie zostaw jako opcję awaryjną.</span>
      </div>
    `;

    const target = findInsertPlace();
    target.insertAdjacentElement("afterend", section);

    if (keepSelection && oldSelected) {
      const select = document.getElementById("ownerCompanyActionSelect");
      if (select && Array.from(select.options).some((option) => option.value === oldSelected)) {
        select.value = oldSelected;
      }
    }

    bindActions();
  }

  function requireSelectedCompany() {
    const id = selectedCompanyId();
    if (!id) {
      alert("Najpierw wybierz firmę z listy w sekcji Przyciski OWNER.");
      return null;
    }
    return id;
  }

  function bindActions() {
    document.getElementById("blockCompanyBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      const reason = prompt("Powód blokady:", "Nieopłacony pakiet") || "";
      await runRpc("Zablokować firmę", "owner_block_company", { target_company_id: id, reason });
    });

    document.getElementById("unblockCompanyBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      const date = prompt("Nowa data ważności pakietu YYYY-MM-DD albo puste:", "") || null;
      await runRpc("Odblokować firmę", "owner_unblock_company", { target_company_id: id, new_package_expires_at: date });
    });

    document.getElementById("trashCompanyBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      const reason = prompt("Powód przeniesienia do kosza:", "") || "";
      await runRpc("Przenieść firmę do kosza", "owner_move_company_to_trash", { target_company_id: id, reason });
    });

    document.getElementById("restoreCompanyBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      await runRpc("Przywrócić firmę", "owner_restore_company_from_trash", { target_company_id: id });
    });

    document.getElementById("permanentDeleteCompanyBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      const confirmation = prompt("Wpisz dokładnie: DELETE PERMANENTLY");
      if (confirmation !== "DELETE PERMANENTLY") return alert("Przerwano.");
      await runRpc("Usunąć permanentnie firmę", "owner_permanently_delete_company", { target_company_id: id, confirmation });
    });

    document.getElementById("extendPackageBtn")?.addEventListener("click", async () => {
      const id = requireSelectedCompany();
      if (!id) return;
      const plan = prompt("Pakiet: 3_months / 6_months / 12_months / 24_months", "12_months");
      const date = prompt("Data ważności YYYY-MM-DD:", "");
      if (!plan || !date) return alert("Brak pakietu albo daty.");
      await runRpc("Przedłużyć pakiet", "owner_extend_company_package", { target_company_id: id, new_package: plan, new_expires_at: date });
    });
  }

  window.addEventListener("load", () => {
    if (!isCompaniesPage()) return;
    // app.js renderuje pełny stary widok. Czekamy chwilę i dokładamy tylko przyciski OWNER pod tabelą.
    window.setTimeout(() => renderOwnerButtons(false), 400);
  });
})();
