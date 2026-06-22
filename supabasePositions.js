// CompanyManager — Positions Module powered by Supabase
// 031A: Stanowiska pracy Supabase CRUD: lista / dodaj / edytuj / usuń + company_id isolation + permission guard.

(function () {
  function isPositionsPage() {
    return document.body?.dataset?.panelPage === "positions" || window.location.pathname.includes("positions.html");
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

  const CM_MODULE_PAGE_LIMIT_KEY = "companyManagerGlobalPageLimit";

  function getModulePageLimit(fallback = "50") {
    try {
      const saved = localStorage.getItem(CM_MODULE_PAGE_LIMIT_KEY);
      if (["50", "100", "200"].includes(String(saved))) return String(saved);
    } catch (_) {}
    const normalized = String(fallback || "50");
    return ["50", "100", "200"].includes(normalized) ? normalized : "50";
  }

  function setModulePageLimit(value) {
    const normalized = String(value || "50");
    if (!["50", "100", "200"].includes(normalized)) return;
    try { localStorage.setItem(CM_MODULE_PAGE_LIMIT_KEY, normalized); } catch (_) {}
    document.querySelectorAll("[data-limit-dropdown]").forEach((root) => {
      const input = root.querySelector('input[type="hidden"]');
      const toggle = root.querySelector("[data-limit-toggle]");
      if (input) input.value = normalized;
      if (toggle) toggle.textContent = `${normalized} ▾`;
    });
  }

  function moduleLimitDropdownHtml(id, selected = "50") {
    const value = getModulePageLimit(selected);
    return `
      <div class="cm-limit-dropdown" data-limit-dropdown>
        <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(value)}">
        <button type="button" class="cm-limit-toggle" data-limit-toggle>${escapeHtml(value)} ▾</button>
        <div class="cm-limit-menu" hidden>
          <button type="button" data-limit-value="50">50 pozycji na stronę</button>
          <button type="button" data-limit-value="100">100 pozycji na stronę</button>
          <button type="button" data-limit-value="200">200 pozycji na stronę</button>
        </div>
      </div>`;
  }

  function setupModuleLimitDropdowns(root = document) {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll("[data-limit-dropdown]").forEach((dropdown) => {
      if (dropdown.dataset.cmLimitReady === "1") return;
      dropdown.dataset.cmLimitReady = "1";
      const toggle = dropdown.querySelector("[data-limit-toggle]");
      const menu = dropdown.querySelector(".cm-limit-menu");
      toggle?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll(".cm-limit-menu").forEach((item) => {
          if (item !== menu) item.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
      });
      dropdown.querySelectorAll("[data-limit-value]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setModulePageLimit(button.getAttribute("data-limit-value") || "50");
          if (menu) menu.hidden = true;
        });
      });
    });
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".cm-limit-menu").forEach((menu) => { menu.hidden = true; });
  });


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

  function canOpenPositions(ctx) {
    return hasAnyPermission(ctx, ["open_positions", "positions_open", "stanowiska", "Stanowiska pracy"]);
  }

  function canAddPositions(ctx) {
    return hasAnyPermission(ctx, ["positions_add", "stanowiska_add", "stanowiska pracy (dodawanie, edycja, usuwanie)"]);
  }

  function canEditPositions(ctx) {
    return hasAnyPermission(ctx, ["positions_edit", "stanowiska_edit", "stanowiska pracy (dodawanie, edycja, usuwanie)"]);
  }

  function canDeletePositions(ctx) {
    return hasAnyPermission(ctx, ["positions_delete", "stanowiska_delete", "stanowiska pracy (dodawanie, edycja, usuwanie)"]);
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
    if (!canOpenPositions(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Stanowiska pracy." };

    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
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

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function showOnly(cardToShow) {
    ["#positionFormCard", "#positionDeleteCard"].forEach((selector) => {
      const card = document.querySelector(selector);
      if (!card) return;
      card.hidden = card !== cardToShow ? true : !card.hidden;
    });
  }

  async function fetchPositions(ctx) {
    const { data, error } = await window.cmSupabase
      .from("positions")
      .select("id, company_id, name, description, active, capacity, color, order_index, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .order("order_index", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function positionRows(positions, canEdit) {
    return positions.map((position) => [
      escapeHtml(position.name || "-"),
      escapeHtml(position.description || ""),
      `<span class="bm-status ${position.active === false ? "inactive" : "active"}">${position.active === false ? "NIE" : "TAK"}</span>`,
      canEdit ? `<button type="button" class="bm-inline-action edit-position-btn" data-id="${escapeHtml(position.id)}">Edytuj</button>` : "-"
    ]);
  }

  function positionOptions(positions) {
    if (!positions.length) return '<option value="">Brak stanowisk do usunięcia</option>';
    return positions.map((position) => `<option value="${escapeHtml(position.id)}">${escapeHtml(position.name || "-")} — ${position.active === false ? "NIE" : "TAK"}</option>`).join("");
  }

  function renderContent(ctx, positions) {
    const area = getPanelArea();
    if (!area) return;
    const allowAdd = canAddPositions(ctx);
    const allowEdit = canEditPositions(ctx);
    const allowDelete = canDeletePositions(ctx);
    const rows = positionRows(positions, allowEdit);

    area.innerHTML = `
      <section class="bm-page-card">
        <div class="bm-page-head">
          <h2>Stanowiska pracy</h2>
          <div class="bm-action-row">
            <button id="showAddPosition" type="button" ${allowAdd ? "" : "disabled"}>Dodaj</button>
            <button id="showDeletePosition" type="button" class="bm-danger-btn" ${allowDelete ? "" : "disabled"}>Usuń</button>
          </div>
        </div>
        <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("positionsLimit")}</div>
        ${table(["Nazwa", "Opis", "Aktywne", "Akcje"], rows, "Brak stanowisk pracy w Supabase.")}
        ${pagination(positions.length)}
      </section>

      <section class="bm-page-card" id="positionFormCard" hidden>
        <h2 id="positionFormTitle">Dodaj stanowisko pracy</h2>
        <form id="positionForm" class="bm-form-grid">
          <input type="hidden" name="positionId" id="positionId">
          <label>Nazwa<input name="name" id="positionName" placeholder="Nazwa stanowiska" required></label>
          <label>Opis<textarea name="description" id="positionDescription" placeholder="Opis stanowiska" required></textarea></label>
          <label>Aktywne<select name="active" id="positionActive"><option value="true">TAK</option><option value="false">NIE</option></select></label>
          <button type="submit" id="positionSubmit">Zapisz</button>
        </form>
        <p id="positionMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="positionDeleteCard" hidden>
        <h2>Usuń stanowisko pracy</h2>
        <div class="bm-form-grid">
          <label>Wybierz stanowisko<select id="deletePositionSelect">${positionOptions(positions)}</select></label>
          <button type="button" id="confirmDeletePosition" class="bm-danger-btn" ${positions.length && allowDelete ? "" : "disabled"}>Usuń</button>
        </div>
        <p id="deletePositionMessage" class="panel-message"></p>
      </section>
    `;

    bindActions(ctx, positions);
  }

  function openForm(position = null) {
    const card = document.querySelector("#positionFormCard");
    const form = document.querySelector("#positionForm");
    if (!card || !form) return;
    form.reset();
    setMessage("#positionMessage", "", true);
    document.querySelector("#positionId").value = position?.id || "";
    document.querySelector("#positionName").value = position?.name || "";
    document.querySelector("#positionDescription").value = position?.description || "";
    document.querySelector("#positionActive").value = position?.active === false ? "false" : "true";
    document.querySelector("#positionFormTitle").textContent = position ? "Edytuj stanowisko pracy" : "Dodaj stanowisko pracy";
    document.querySelector("#positionSubmit").textContent = position ? "Zapisz zmiany" : "Zapisz";
    showOnly(card);
  }

  function payload(ctx, formData) {
    return {
      company_id: ctx.companyId,
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      active: String(formData.get("active") || "true") === "true",
      updated_at: new Date().toISOString()
    };
  }

  function bindActions(ctx, positions) {
    const byId = Object.fromEntries(positions.map((position) => [position.id, position]));

    document.querySelector("#showAddPosition")?.addEventListener("click", () => openForm(null));
    document.querySelector("#showDeletePosition")?.addEventListener("click", () => showOnly(document.querySelector("#positionDeleteCard")));

    document.querySelectorAll(".edit-position-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const position = byId[btn.dataset.id];
        if (position) openForm(position);
      });
    });

    document.querySelector("#positionForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const id = String(formData.get("positionId") || "").trim();
      const data = payload(ctx, formData);
      if (!data.name || !data.description) {
        setMessage("#positionMessage", "Uzupełnij nazwę i opis stanowiska.", false);
        return;
      }
      if (id) {
        delete data.company_id;
        const { error } = await window.cmSupabase
          .from("positions")
          .update(data)
          .eq("id", id)
          .eq("company_id", ctx.companyId);
        if (error) {
          setMessage("#positionMessage", "Błąd edycji stanowiska: " + error.message, false);
          return;
        }
        setMessage("#positionMessage", "Stanowisko zaktualizowane w Supabase.", true);
      } else {
        const { error } = await window.cmSupabase.from("positions").insert(data);
        if (error) {
          setMessage("#positionMessage", "Błąd zapisu stanowiska: " + error.message, false);
          return;
        }
        setMessage("#positionMessage", "Stanowisko zapisane w Supabase.", true);
      }
      setTimeout(renderPositions, 450);
    });

    document.querySelector("#confirmDeletePosition")?.addEventListener("click", async () => {
      const id = document.querySelector("#deletePositionSelect")?.value;
      if (!id) {
        setMessage("#deletePositionMessage", "Wybierz stanowisko do usunięcia.", false);
        return;
      }
      const { error } = await window.cmSupabase
        .from("positions")
        .delete()
        .eq("id", id)
        .eq("company_id", ctx.companyId);
      if (error) {
        setMessage("#deletePositionMessage", "Błąd usuwania stanowiska: " + error.message, false);
        return;
      }
      setMessage("#deletePositionMessage", "Stanowisko usunięte z Supabase.", true);
      setTimeout(renderPositions, 450);
    });
  }

  async function renderPositions() {
    if (!isPositionsPage()) return;
    const area = getPanelArea();
    if (area) area.innerHTML = `<section class="bm-page-card"><h2>Stanowiska pracy</h2><p>Ładowanie stanowisk z Supabase...</p></section>`;
    try {
      const ctx = await getContext();
      if (!ctx.ok) throw new Error(ctx.message);
      const positions = await fetchPositions(ctx);
      renderContent(ctx, positions);
    } catch (error) {
      if (area) {
        area.innerHTML = `<section class="bm-page-card"><h2>Błąd stanowisk pracy</h2><p>${escapeHtml(error.message || error)}</p></section>`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPositions);
  } else {
    renderPositions();
  }
})();
