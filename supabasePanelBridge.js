// CompanyManager — Supabase Panel Bridge
// Most zgodności: Supabase Auth + obecny app.js oparty o localStorage.
// Tworzy minimalny lokalny kontekst użytkownika/firmy, żeby panel nie odsyłał po loginie.

(function () {
  const LEGACY_SESSION_KEY = "companymanager_session_v1";
  const DB_KEY = "companymanager_database_v9_sender_company_table";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeRole(role) {
    const upper = String(role || "").toUpperCase();
    if (upper === "OWNER") return "owner";
    if (upper === "ADMIN") return "admin";
    return "employee";
  }

  function userIdFromAccess(access) {
    const role = String(access?.role || "").toUpperCase();
    if (role === "OWNER") return "owner_kacper";
    return access?.user_id || access?.id || access?.email || "supabase_user";
  }

  function companyIdFromAccess(access) {
    const role = String(access?.role || "").toUpperCase();
    if (role === "OWNER") return "company_main";
    return access?.company_id || "";
  }

  function ensureLocalDbContext(access) {
    const role = normalizeRole(access?.role);
    const userId = userIdFromAccess(access);
    const companyId = companyIdFromAccess(access);
    const email = access?.email || userId;
    const fullName = access?.full_name || access?.fullName || email;
    const companyName = access?.company_name || access?.companyName || "Firma";

    const db = readJson(DB_KEY) || {
      version: "supabase-bridge",
      createdAt: new Date().toISOString(),
      users: [],
      companies: []
    };

    db.users = Array.isArray(db.users) ? db.users : [];
    db.companies = Array.isArray(db.companies) ? db.companies : [];

    if (companyId && !db.companies.some((company) => company.id === companyId)) {
      db.companies.push({
        id: companyId,
        name: role === "owner" ? "CompanyManager" : companyName,
        ownerName: fullName,
        ownerEmail: email,
        ownerPhone: "",
        address: "",
        postalCode: "",
        city: "",
        contactPhones: "",
        contactEmail: email,
        receptionistPhone: "",
        receptionistEmail: email,
        invoiceName: role === "owner" ? "CompanyManager" : companyName,
        invoiceAddress: "",
        invoicePostalCode: "",
        invoiceCity: "",
        vatId: "",
        invoiceEmail: email,
        plan: "",
        planValidUntil: access?.package_expires_at || "",
        smsSender: role === "owner" ? "CompanyManager" : companyName,
        messageSender: role === "owner" ? "CompanyManager" : companyName,
        notificationSettings: {},
        dataRetention: "nie usuwaj",
        source: "supabase"
      });
    }

    const existingUserIndex = db.users.findIndex((user) => user.id === userId || String(user.email || "").toLowerCase() === String(email || "").toLowerCase());
    const userRecord = {
      id: userId,
      login: email,
      email,
      password: "",
      fullName,
      phone: access?.phone || "",
      role,
      companyId,
      positionId: "",
      position: role === "owner" ? "OWNER CompanyManager" : role === "admin" ? "ADMIN firmy" : "Pracownik",
      loginBlocked: false,
      loginHoursOnly: false,
      permissions: role === "employee" ? Object.keys(access?.permissions || {}).filter((key) => access.permissions[key]).map((key) => `open:${key}`) : [],
      createdAt: new Date().toISOString(),
      source: "supabase"
    };

    if (existingUserIndex >= 0) {
      db.users[existingUserIndex] = { ...db.users[existingUserIndex], ...userRecord };
    } else {
      db.users.push(userRecord);
    }

    writeJson(DB_KEY, db);

    const session = {
      userId,
      companyId,
      activeCompanyId: companyId,
      role,
      loginAt: new Date().toISOString(),
      source: "supabase"
    };
    writeJson(LEGACY_SESSION_KEY, session);
  }

  window.cmEnsureLegacySupabaseContext = ensureLocalDbContext;

  const access = readJson("cm_access");
  if (access && access.allowed === true) {
    ensureLocalDbContext(access);
  }
})();
