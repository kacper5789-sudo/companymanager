// CompanyManager — Products Module powered by Supabase
// 033A: Produkty Supabase CRUD: lista / dodaj / usuń + magazyn + company_id isolation + permission guard.

(function () {
  function isProductsPage() {
    return document.body?.dataset?.panelPage === "products" || window.location.pathname.includes("products.html");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
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
        document.querySelectorAll(".cm-limit-menu").forEach((item) => { if (item !== menu) item.hidden = true; });
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

  function normalizeRole(role) { return String(role || "").trim().toUpperCase(); }
  function normalizePermissions(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.reduce((acc, item) => { acc[String(item)] = true; return acc; }, {});
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


  function canExportData(ctx) {
    return hasAnyPermission(ctx, [
      "export_data",
      "export danych",
      "export danych z całej platformy",
      "export/import danych"
    ]);
  }

  function canImportData(ctx) {
    return hasAnyPermission(ctx, [
      "import_data",
      "import danych",
      "import danych do całej platformy",
      "export/import danych"
    ]);
  }

  function guardExportImport(ctx, type, selector) {
    const ok = type === "export" ? canExportData(ctx) : canImportData(ctx);
    if (ok) return true;
    const permission = type === "export" ? "export danych z całej platformy" : "import danych do całej platformy";
    setMessage(selector, "Brak uprawnienia: " + permission, false);
    return false;
  }

  function canOpenProducts(ctx) { return hasAnyPermission(ctx, ["open_products", "products_open", "Produkty", "produkty"]); }
  function canAddProducts(ctx) { return hasAnyPermission(ctx, ["products_add", "produkty_add", "produkty (dodawanie, edycja, usuwanie)"]); }
  function canDeleteProducts(ctx) { return hasAnyPermission(ctx, ["products_delete", "produkty_delete", "produkty (dodawanie, edycja, usuwanie)"]); }

  function getPanelArea() { return document.querySelector(".bm-panel-area") || document.getElementById("dashboardRoot"); }

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
    if (!canOpenProducts(ctx)) return { ok: false, message: "Brak uprawnienia do otwierania zakładki Produkty." };
    localStorage.setItem("cm_access", JSON.stringify(access));
    localStorage.setItem("cm_effective_company", JSON.stringify(context));
    return ctx;
  }

  function parseNumber(value, fallback = null) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return fallback;
    const n = Number(text);
    return Number.isFinite(n) ? n : fallback;
  }
  function parseIntValue(value, fallback = 0) {
    const n = parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  }
  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? `${n.toFixed(2)} PLN` : "0,00 PLN";
  }
  function productStockStatus(product) {
    const stock = Number(product.package_stock || 0);
    const low = Number(product.low_package_stock || 0);
    if (!low) return stock > 0 ? "dużo" : "mało";
    return stock <= low ? "mało" : "dużo";
  }
  function productLabel(product) {
    return [product.name, product.category, product.company_name].filter(Boolean).join(" — ");
  }
  function normalizeText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return `<div class="bm-empty-state">${escapeHtml(emptyText || "Brak danych.")}</div>`;
    return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function pagination(count) {
    if (!count) return "";
    return `<div class="cm-pagination-row"><span>Pozycje od 1 do ${count} z ${count} łącznie</span><span class="cm-pagination-controls">&lt; <strong>1 z 1</strong> &gt;</span></div>`;
  }

  function setMessage(selector, text, ok = true) {
    const msg = document.querySelector(selector);
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "#86efac" : "#fca5a5";
    msg.style.display = "block";
  }

  function showOnlyPanel(target, panels) {
    if (window.cmShowOnlyModalPanel) return window.cmShowOnlyModalPanel(target, panels || []);
    panels.forEach((panel) => { if (panel) panel.hidden = panel !== target ? true : !panel.hidden; });
  }

  async function fetchProducts(ctx) {
    const res = await window.cmSupabase
      .from("products")
      .select("id, company_id, name, category, package_stock, low_package_stock, unit_stock, units_per_package, company_name, sale_only, price, last_purchase_price, supplier, description, code, include_commission, include_discount, active, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }

  function rowsFor(products, filter = "all") {
    return products.filter((product) => {
      if (filter === "low") return productStockStatus(product) === "mało";
      if (filter === "high") return productStockStatus(product) === "dużo";
      if (filter === "saleOnly") return product.sale_only === true;
      return true;
    }).map((product) => [
      escapeHtml(product.name || "-"),
      escapeHtml(product.category || "-"),
      escapeHtml(product.package_stock ?? product.unit_stock ?? "0"),
      escapeHtml(productStockStatus(product)),
      escapeHtml(product.company_name || "-"),
      escapeHtml(money(product.price)),
      escapeHtml(product.code || "")
    ]);
  }

  function productPayload(ctx, formData) {
    const category = formData.get("categorySelect") === "__new" ? String(formData.get("newCategory") || "").trim() : String(formData.get("categorySelect") || "").trim();
    const companyName = formData.get("companySelect") === "__new" ? String(formData.get("newCompany") || "").trim() : String(formData.get("companySelect") || "").trim();
    return {
      company_id: ctx.companyId,
      name: String(formData.get("name") || "").trim(),
      category,
      package_stock: parseIntValue(formData.get("packageStock"), 0),
      low_package_stock: parseIntValue(formData.get("lowPackageStock"), 0),
      unit_stock: parseIntValue(formData.get("unitStock"), 0),
      units_per_package: parseIntValue(formData.get("unitsPerPackage"), 0),
      company_name: companyName,
      sale_only: formData.get("saleOnly") === "on",
      price: parseNumber(formData.get("price"), 0),
      last_purchase_price: parseNumber(formData.get("lastPurchasePrice"), 0),
      supplier: String(formData.get("supplier") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      code: String(formData.get("code") || "").trim(),
      include_commission: formData.get("includeCommission") === "on",
      include_discount: formData.get("includeDiscount") === "on",
      active: true,
      updated_at: new Date().toISOString()
    };
  }


  function closeProductsModals() {
    if (window.cmHardCloseAllModalPanels) {
      window.cmHardCloseAllModalPanels();
      return;
    }
    if (window.cmCloseAllModalPanels) {
      window.cmCloseAllModalPanels();
      return;
    }
    document.querySelectorAll(".cm-modal-active, .cm-as-modal").forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove("cm-modal-active", "cm-as-modal");
    });
    document.body?.classList?.remove("cm-modal-open");
  }

  function rerenderProductsAfterSuccess(delay = 450) {
    closeProductsModals();
    setTimeout(() => {
      closeProductsModals();
      renderProducts();
    }, delay);
  }

  function downloadProducts(products) {
    const headers = ["Nazwa", "Kategoria", "Stan L.op.", "Niski stan L.op.", "L. jednostek", "L. jednostek w 1 op.", "Stan magazynowy", "Firma", "Do sprzedaży", "Cena (PLN)", "Ostatnia cena zakupu (PLN)", "Dostawca", "Opis", "Kod produktu", "Wliczaj do prowizji", "Uwzględniaj przy rabacie"];
    const lines = [headers.join("\t"), ...products.map((product) => [
      product.name || "", product.category || "", product.package_stock ?? "", product.low_package_stock ?? "", product.unit_stock ?? "", product.units_per_package ?? "", productStockStatus(product), product.company_name || "", product.sale_only ? "tak" : "nie", product.price ?? "", product.last_purchase_price ?? "", product.supplier || "", product.description || "", product.code || "", product.include_commission ? "tak" : "nie", product.include_discount ? "tak" : "nie"
    ].map((value) => String(value).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"))];
    const blob = new Blob([lines.join("\n")], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "produkty-companymanager.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function renderProducts() {
    if (!isProductsPage()) return;
    const area = getPanelArea();
    if (!area) return;
    area.innerHTML = `<section class="bm-page-card"><h2>Pokaż produkty:</h2><p class="bm-muted">Ładowanie produktów z Supabase...</p></section>`;
    const ctx = await getContext();
    if (!ctx.ok) {
      area.innerHTML = `<section class="bm-page-card"><h2>Brak dostępu</h2><p>${escapeHtml(ctx.message)}</p></section>`;
      return;
    }
    let products = [];
    try {
      products = await fetchProducts(ctx);
    } catch (error) {
      area.innerHTML = `<section class="bm-page-card"><h2>Błąd produktów</h2><pre class="cm-error-details">${escapeHtml(JSON.stringify(error, null, 2))}</pre></section>`;
      return;
    }
    renderContent(ctx, products);
  }

  function renderContent(ctx, products) {
    const area = getPanelArea();
    if (!area) return;
    const filter = new URLSearchParams(window.location.search).get("filter") || "all";
    const allowAdd = canAddProducts(ctx);
    const allowDelete = canDeleteProducts(ctx);
    const allowExport = canExportData(ctx);
    const allowImport = canImportData(ctx);
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];
    const companies = [...new Set(products.map((product) => product.company_name).filter(Boolean))];
    const categoryOptions = categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    const companyOptions = companies.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    const deleteOptions = products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(productLabel(product) || product.name || "Produkt")}</option>`).join("");

    const filterButtons = [["low", "mało na magazynie"], ["high", "dużo na magazynie"], ["saleOnly", "tylko do sprzedaży"]]
      .map(([value, label]) => `<button type="button" class="bm-tab-btn ${filter === value ? "active" : ""}" data-product-filter="${value}">${label}</button>`).join("");

    area.innerHTML = `<section class="bm-page-card products-module">
      <div class="bm-page-head customers-head"><h2>Pokaż produkty:</h2><div class="bm-actions-row">${allowExport ? `<button id="exportProductsBtn" type="button" class="bm-excel-btn" data-required-permission="export danych z całej platformy">Export</button>` : ""}${allowImport ? `<button id="importProductsBtn" type="button" class="bm-excel-btn" data-required-permission="import danych do całej platformy">Import</button><input id="importProductsFile" type="file" accept=".xls,.xlsx,.csv" hidden>` : ""}${allowAdd ? `<button id="showAddProduct" type="button">Dodaj</button>` : ""}${allowDelete ? `<button id="showDeleteProduct" type="button" class="bm-danger-btn">Usuń</button>` : ""}</div></div>
      <div class="bm-tabs">${filterButtons}</div>
      <div class="bm-table-toolbar cm-limit-toolbar">${moduleLimitDropdownHtml("productsLimit")}</div>
      <div class="bm-product-filters">
        <label>Nazwa<input id="productNameSearch" type="search" placeholder="szukaj..."></label>
        <label>Kategoria<input id="productCategorySearch" type="search" placeholder="szukaj..."></label>
        <label>Firma<input id="productCompanySearch" type="search" placeholder="szukaj..."></label>
      </div>
      <div id="productsTableWrap">${table(["Nazwa", "Kategoria", "Stan", "Stan magazynowy", "Firma", "Cena (PLN)", "Kod produktu"], rowsFor(products, filter), "Nie znaleziono żadnych danych")}</div>
      ${pagination(products.length)}
      <p id="productsMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="productDeleteCard" hidden>
      <h2>Usuń produkt</h2>
      <div class="bm-form-row bm-delete-row">
        <select id="deleteProductSelect"><option value="">Wybierz produkt</option>${deleteOptions}</select>
        <button id="deleteProductBtn" type="button" class="bm-danger-btn">Usuń</button>
      </div>
      <p id="productDeleteMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="productFormCard" hidden>
      <h2>Dodaj produkt</h2>
      <form id="productForm" class="bm-form-grid bm-wide-form">
        <label>Nazwa*<input name="name" placeholder="Nazwa" required></label>
        <label>Kategoria<select name="categorySelect" id="productCategorySelect"><option value="">---------</option>${categoryOptions}<option value="__new">dodaj nową kategorię</option></select></label>
        <label id="productNewCategoryLabel" hidden>Nowa kategoria<input name="newCategory" placeholder="Nazwa kategorii"></label>
        <div class="bm-form-row-2"><label>Stan magazynowy — L.op.<input name="packageStock" type="number" min="0" step="1" placeholder="L.op."></label><label>Niski stan (l.op.)<input name="lowPackageStock" type="number" min="0" step="1" placeholder="Niski stan (l.op.)"></label></div>
        <div class="bm-form-row-2"><label>L. jednostek<input name="unitStock" type="number" min="0" step="1" placeholder="L. jednostek"></label><label>L. jednostek w 1 op.<input name="unitsPerPackage" type="number" min="0" step="1" placeholder="L. jednostek w 1 op."></label></div>
        <label>Firma<select name="companySelect" id="productCompanySelect"><option value="">---------</option>${companyOptions}<option value="__new">dodaj nową firmę</option></select></label>
        <label id="productNewCompanyLabel" hidden>Nowa firma<input name="newCompany" placeholder="Nazwa firmy"></label>
        <label class="checkbox-row"><input name="saleOnly" type="checkbox"> do sprzedaży</label>
        <label>Cena (PLN)<input name="price" type="number" min="0" step="0.01"></label>
        <label>Ostatnia cena zakupu (PLN)<input name="lastPurchasePrice" type="number" min="0" step="0.01"></label>
        <label>Dostawca<input name="supplier" placeholder="Dostawca"></label>
        <label class="full">Opis<textarea name="description" placeholder="Opis"></textarea></label>
        <label>Kod produktu<input name="code" placeholder="Kod produktu"></label>
        <label class="checkbox-row"><input name="includeCommission" type="checkbox"> wliczaj do prowizji pracownika</label>
        <label class="checkbox-row"><input name="includeDiscount" type="checkbox"> uwzględniaj przy rabacie</label>
        <button type="submit">Zapisz produkt</button>
      </form>
      <p id="productFormMessage" class="panel-message"></p>
    </section>`;

    bindActions(ctx, products, filter);
  }

  function bindActions(ctx, products, filter) {
    const formCard = document.querySelector("#productFormCard");
    const deleteCard = document.querySelector("#productDeleteCard");
    document.querySelector("#exportProductsBtn")?.addEventListener("click", () => { if (!guardExportImport(ctx, "export", "#productsMessage")) return; downloadProducts(products); });
    document.querySelector("#importProductsBtn")?.addEventListener("click", () => { if (!guardExportImport(ctx, "import", "#productsMessage")) return; setMessage("#productsMessage", "Import produktów do Supabase zostanie podpięty osobnym krokiem. Export działa.", false); });
    document.querySelector("#showAddProduct")?.addEventListener("click", () => showOnlyPanel(formCard, [formCard, deleteCard]));
    document.querySelector("#showDeleteProduct")?.addEventListener("click", () => showOnlyPanel(deleteCard, [formCard, deleteCard]));
    document.querySelectorAll("[data-product-filter]").forEach((btn) => btn.addEventListener("click", () => {
      window.location.href = `products.html?filter=${encodeURIComponent(btn.getAttribute("data-product-filter") || "all")}`;
    }));
    setupModuleLimitDropdowns(document);

    const categorySelect = document.querySelector("#productCategorySelect");
    const categoryNew = document.querySelector("#productNewCategoryLabel");
    categorySelect?.addEventListener("change", () => { if (categoryNew) categoryNew.hidden = categorySelect.value !== "__new"; });
    const companySelect = document.querySelector("#productCompanySelect");
    const companyNew = document.querySelector("#productNewCompanyLabel");
    companySelect?.addEventListener("change", () => { if (companyNew) companyNew.hidden = companySelect.value !== "__new"; });

    const applyFilters = () => {
      const nameQ = normalizeText(document.querySelector("#productNameSearch")?.value || "");
      const categoryQ = normalizeText(document.querySelector("#productCategorySearch")?.value || "");
      const companyQ = normalizeText(document.querySelector("#productCompanySearch")?.value || "");
      const filtered = products.filter((product) => {
        if (filter === "low" && productStockStatus(product) !== "mało") return false;
        if (filter === "high" && productStockStatus(product) !== "dużo") return false;
        if (filter === "saleOnly" && product.sale_only !== true) return false;
        if (nameQ && !normalizeText(product.name || "").includes(nameQ)) return false;
        if (categoryQ && !normalizeText(product.category || "").includes(categoryQ)) return false;
        if (companyQ && !normalizeText(product.company_name || "").includes(companyQ)) return false;
        return true;
      }).map((product) => [
        escapeHtml(product.name || "-"), escapeHtml(product.category || "-"), escapeHtml(product.package_stock ?? product.unit_stock ?? "0"), escapeHtml(productStockStatus(product)), escapeHtml(product.company_name || "-"), escapeHtml(money(product.price)), escapeHtml(product.code || "")
      ]);
      const wrap = document.querySelector("#productsTableWrap");
      if (wrap) wrap.innerHTML = table(["Nazwa", "Kategoria", "Stan", "Stan magazynowy", "Firma", "Cena (PLN)", "Kod produktu"], filtered, "Nie znaleziono żadnych danych");
    };
    ["#productNameSearch", "#productCategorySearch", "#productCompanySearch"].forEach((sel) => document.querySelector(sel)?.addEventListener("input", applyFilters));

    document.querySelector("#productForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "1") return;
      form.dataset.saving = "1";
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      const payload = productPayload(ctx, new FormData(form));
      if (!payload.name) {
        setMessage("#productFormMessage", "Podaj nazwę produktu.", false);
        form.dataset.saving = "0";
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      const { data: insertedProduct, error } = await window.cmSupabase.from("products").insert(payload).select("*").single();
      if (error) {
        setMessage("#productFormMessage", "Błąd zapisu produktu: " + error.message, false);
        form.dataset.saving = "0";
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      await window.cmUndo?.record({ module: "products", actionType: "insert", targetTable: "products", targetId: insertedProduct?.id, afterData: insertedProduct || payload, companyId: ctx.companyId });
      setMessage("#productFormMessage", "Produkt zapisany w Supabase.", true);
      rerenderProductsAfterSuccess(450);
    });

    document.querySelector("#deleteProductBtn")?.addEventListener("click", async () => {
      const productId = document.querySelector("#deleteProductSelect")?.value;
      if (!productId) { setMessage("#productDeleteMessage", "Wybierz produkt do usunięcia.", false); return; }
      const beforeProduct = products.find((item) => String(item.id) === String(productId)) || null;
      const deletePayload = { active: false, updated_at: new Date().toISOString() };
      const { data: updatedProduct, error } = await window.cmSupabase.from("products").update(deletePayload).eq("id", productId).eq("company_id", ctx.companyId).select("*").single();
      if (error) { setMessage("#productDeleteMessage", "Błąd usuwania produktu: " + error.message, false); return; }
      await window.cmUndo?.record({ module: "products", actionType: "update", targetTable: "products", targetId: productId, beforeData: beforeProduct, afterData: updatedProduct || { ...(beforeProduct || {}), ...deletePayload }, companyId: ctx.companyId });
      setMessage("#productDeleteMessage", "Produkt usunięty z listy.", true);
      rerenderProductsAfterSuccess(450);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProducts);
  } else {
    renderProducts();
  }
})();
