// CompanyManager — 042C Safe Performance Layer
// Bezpieczne przyspieszenia: cache wyłącznie dla odczytowych RPC kontekstu i lekkie helpery UI.
(function () {
  if (window.__cmPerformanceLayerLoaded) return;
  window.__cmPerformanceLayerLoaded = true;

  const READ_RPC_TTL_MS = 25000;
  const rpcCache = new Map();
  const readOnlyRpc = new Set([
    "get_my_access",
    "get_effective_company_context",
    "company_team_members",
    "company_users_for_dropdown"
  ]);

  function stableJson(value) {
    if (!value || typeof value !== "object") return String(value || "");
    try {
      return JSON.stringify(Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {}));
    } catch (_) {
      return JSON.stringify(value);
    }
  }

  function installSupabaseRpcCache() {
    const client = window.cmSupabase;
    if (!client || client.__cmRpcCacheInstalled || typeof client.rpc !== "function") return;

    const rawRpc = client.rpc.bind(client);
    client.rpc = function cmCachedRpc(functionName, args, options) {
      if (!readOnlyRpc.has(functionName)) {
        if (functionName && !String(functionName).startsWith("get_") && !String(functionName).startsWith("company_")) {
          rpcCache.clear();
        }
        return rawRpc(functionName, args, options);
      }

      const key = `${functionName}:${stableJson(args || {})}`;
      const cached = rpcCache.get(key);
      const now = Date.now();
      if (cached && now - cached.createdAt < READ_RPC_TTL_MS) {
        return cached.promise;
      }

      const promise = Promise.resolve(rawRpc(functionName, args, options)).then((result) => {
        if (result && result.error) rpcCache.delete(key);
        return result;
      }).catch((error) => {
        rpcCache.delete(key);
        throw error;
      });

      rpcCache.set(key, { createdAt: now, promise });
      return promise;
    };

    client.__cmRpcCacheInstalled = true;
  }

  function optimizeStaticDom() {
    document.querySelectorAll("img:not([loading])").forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";
    });
  }

  window.cmClearReadCache = function cmClearReadCache() {
    rpcCache.clear();
  };

  window.cmNextFrame = window.cmNextFrame || function cmNextFrame(callback) {
    return window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16);
  };

  installSupabaseRpcCache();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", optimizeStaticDom, { once: true });
  } else {
    optimizeStaticDom();
  }
})();
