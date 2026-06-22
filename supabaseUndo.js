// CompanyManager — Supabase Undo Engine
// 034A: Globalny Cofnij Czas dla modułów przepiętych na Supabase.

(function () {
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

  async function getActorId() {
    const access = getAccess();
    if (access.user_id) return access.user_id;
    if (access.id) return access.id;

    const supabase = getClient();
    if (!supabase?.auth?.getUser) return null;

    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || null;
    } catch (_) {
      return null;
    }
  }

  async function recordUndoAction({ module, actionType, targetTable, targetId, beforeData = null, afterData = null, companyId = null }) {
    const supabase = getClient();
    if (!supabase) return { ok: false, error: "Brak klienta Supabase" };

    const resolvedCompanyId = companyId || await getCompanyId();
    const actorId = await getActorId();
    if (!resolvedCompanyId || !targetTable || !actionType) {
      console.warn("CompanyManager undo skipped:", { resolvedCompanyId, actorId, targetTable, actionType });
      return { ok: false, error: "Brak danych undo" };
    }

    const payload = {
      company_id: resolvedCompanyId,
      actor_id: actorId,
      module: String(module || targetTable),
      action_type: String(actionType),
      target_table: String(targetTable),
      target_id: targetId || afterData?.id || beforeData?.id || null,
      before_data: beforeData || null,
      after_data: afterData || null
    };

    const { error } = await supabase.from("undo_actions").insert(payload);
    if (error) {
      console.warn("CompanyManager undo record error:", error);
      return { ok: false, error };
    }
    showUndoButton();
    return { ok: true };
  }

  async function undoLastAction() {
    const supabase = getClient();
    if (!supabase) return { success: false, message: "Brak połączenia z Supabase" };
    const { data, error } = await supabase.rpc("undo_last_action");
    if (error) {
      console.error("CompanyManager undo error:", error);
      return { success: false, message: error.message || "Błąd cofania" };
    }
    return data || { success: false, message: "Brak odpowiedzi" };
  }

  function showUndoButton() {
    const button = document.querySelector("#undoTimeBtn");
    if (!button) return;
    button.hidden = false;
    button.removeAttribute("hidden");
    button.style.display = "";
  }

  async function refreshUndoButton() {
    const button = document.querySelector("#undoTimeBtn");
    if (!button) return;
    showUndoButton();
  }

  function bindUndoButton() {
    document.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("#undoTimeBtn");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      button.disabled = true;
      const result = await undoLastAction();
      button.disabled = false;
      if (result?.success) {
        window.location.reload();
        return;
      }
      alert(result?.message || "Nie ma czego cofnąć.");
    }, true);
  }

  function startButtonWatcher() {
    refreshUndoButton();
    let tries = 0;
    const timer = setInterval(() => {
      refreshUndoButton();
      tries += 1;
      if (tries > 20) clearInterval(timer);
    }, 500);
  }

  window.cmUndo = {
    record: recordUndoAction,
    undoLastAction,
    showUndoButton,
    refreshUndoButton
  };

  bindUndoButton();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startButtonWatcher);
  } else {
    startButtonWatcher();
  }
})();
