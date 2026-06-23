// CompanyManager — Global Undo / Cofnij Czas
// 052C: 1 ostatni ruch globalnie po stronie Supabase.

(function () {
  const BUTTON_ID = "undoTimeBtn";
  const HIDDEN_CLASS = "cm-undo-hidden";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function getClient() {
    return window.cmSupabase || null;
  }

  function getAccess() {
    return readJson("cm_access") || {};
  }

  async function getCompanyId() {
    const access = getAccess();
    if (access.company_id) return access.company_id;
    const supabase = getClient();
    if (!supabase) return null;
    try {
      const { data } = await supabase.rpc("my_company_id");
      return data || null;
    } catch (_) {
      return null;
    }
  }

  function getUndoButton() {
    return document.querySelector(`#${BUTTON_ID}`);
  }

  function hideUndoButton() {
    const button = getUndoButton();
    if (!button) return;
    button.hidden = true;
    button.setAttribute("hidden", "hidden");
    button.classList.add(HIDDEN_CLASS);
    button.style.display = "none";
  }

  function showUndoButton() {
    const button = getUndoButton();
    if (!button) return;
    button.hidden = false;
    button.removeAttribute("hidden");
    button.classList.remove(HIDDEN_CLASS);
    button.style.display = "";
  }

  async function hasUndoAction() {
    const supabase = getClient();
    if (!supabase) return false;
    const companyId = await getCompanyId();
    if (!companyId) return false;

    try {
      const { data, error } = await supabase
        .from("undo_actions")
        .select("id")
        .eq("company_id", companyId)
        .is("undone_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("CompanyManager undo status error:", error);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.warn("CompanyManager undo status failed:", error);
      return false;
    }
  }

  async function refreshUndoButton() {
    const button = getUndoButton();
    if (!button) return;
    const available = await hasUndoAction();
    if (available) showUndoButton();
    else hideUndoButton();
  }

  // Frontend modules may still call cmUndo.record(). From 052C real logging is done by DB triggers,
  // so this function only refreshes the button and never duplicates undo rows.
  async function recordUndoAction() {
    setTimeout(refreshUndoButton, 250);
    return { ok: true, source: "db-trigger" };
  }

  async function undoLastAction() {
    const supabase = getClient();
    if (!supabase) return { success: false, message: "Brak połączenia z Supabase" };
    try {
      const { data, error } = await supabase.rpc("undo_last_action");
      if (error) {
        console.error("CompanyManager undo error:", error);
        return { success: false, message: error.message || "Błąd cofania" };
      }
      return data || { success: false, message: "Brak odpowiedzi" };
    } catch (error) {
      console.error("CompanyManager undo failed:", error);
      return { success: false, message: error?.message || "Błąd cofania" };
    }
  }

  function bindUndoButton() {
    document.addEventListener("click", async (event) => {
      const button = event.target?.closest?.(`#${BUTTON_ID}`);
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      if (button.disabled) return;
      button.disabled = true;
      button.classList.add("is-loading");
      const result = await undoLastAction();
      button.disabled = false;
      button.classList.remove("is-loading");

      if (result?.success) {
        hideUndoButton();
        window.dispatchEvent(new CustomEvent("cm:undo:done", { detail: result }));
        window.location.reload();
        return;
      }

      await refreshUndoButton();
      alert(result?.message || "Nie ma czego cofnąć.");
    }, true);
  }

  function watchDomForButton() {
    const observer = new MutationObserver(() => refreshUndoButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  }

  function start() {
    hideUndoButton();
    refreshUndoButton();
    let tries = 0;
    const timer = setInterval(() => {
      refreshUndoButton();
      tries += 1;
      if (tries > 12) clearInterval(timer);
    }, 750);
    watchDomForButton();
  }

  window.cmUndo = {
    record: recordUndoAction,
    undoLastAction,
    showUndoButton,
    hideUndoButton,
    refreshUndoButton
  };

  bindUndoButton();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
