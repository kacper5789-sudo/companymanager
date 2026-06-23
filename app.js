
/* CompanyManager v0.4 — lokalna baza demo + role OWNER / ADMIN / EMPLOYEE
   UWAGA: to front-endowy prototyp na localStorage. Produkcyjnie: Supabase/PostgreSQL + hashowanie haseł + prawdziwe sesje. */

document.addEventListener('DOMContentLoaded', () => {
  const DB_KEY = 'companymanager_database_v9_sender_company_table';
  const LEGACY_KEYS = ['companymanager_database_v6_owner_start','companymanager_database_v1'];
  const SESSION_KEY = 'companymanager_session_v1';
  const UNDO_KEY = 'companymanager_last_action_v1';

  const planLabels = {
    '3m': '3 miesiące — 100 PLN netto',
    '6m': '6 miesięcy — 175 PLN netto',
    '12m': '12 miesięcy — 300 PLN netto',
    '24m': '24 miesiące — 500 PLN netto'
  };

  const roleLabels = {
    owner: 'OWNER',
    admin: 'ADMIN',
    employee: 'EMPLOYEE'
  };

  const roleDescriptions = {
    owner: 'Pełny dostęp: firma, użytkownicy, abonament, raporty i ustawienia.',
    admin: 'Zarządzanie operacyjne: klienci, rezerwacje, pracownicy i raporty bez abonamentu.',
    employee: 'Dostęp pracowniczy: własny grafik, przypisani klienci i zadania.'
  };

  const currentIsoDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  };
  const parseIsoDate = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const isoDatePlusMonths = (months = 1) => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const currentDisplayDate = () => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  };

  const createSeedDatabase = () => ({
    "version": "2.0-sender-company-table",
    "createdAt": new Date().toISOString(),
    "users": [
      {
        "id": "owner_kacper",
        "login": "Kacper5789@gmail.com",
        "email": "Kacper5789@gmail.com",
        "password": "MindDivineOperator369",
        "fullName": "Kacper Piskorz",
        "phone": "+48 789 389 126",
        "role": "owner",
        "companyId": "company_main",
        "positionId": "",
        "loginBlocked": false,
        "loginHoursOnly": false,
        "createdAt": new Date().toISOString()
      }
    ],
    "companies": [
      {
        "id": "company_main",
        "name": "CompanyManager",
        "ownerName": "Kacper Piskorz",
        "ownerEmail": "Kacper5789@gmail.com",
        "ownerPhone": "+48 789 389 126",
        "address": "",
        "postalCode": "",
        "city": "",
        "contactPhones": "",
        "contactEmail": "",
        "receptionistPhone": "",
        "receptionistEmail": "",
        "invoiceName": "",
        "invoiceAddress": "",
        "invoicePostalCode": "",
        "invoiceCity": "",
        "vatId": "",
        "invoiceEmail": "",
        "plan": "",
        "planValidUntil": "",
        "employeesRaw": "",
        "smsSender": "CompanyManager",
        "messageSender": "CompanyManager",
        "notificationSettings": {
          "visitSmsSender": "CompanyManager",
          "birthdaySmsSender": "CompanyManager",
          "afterAddSmsSender": "CompanyManager",
          "afterVisitSmsSender": "CompanyManager",
          "visitEmailSender": "CompanyManager",
          "birthdayEmailSender": "CompanyManager",
          "afterAddEmailSender": "CompanyManager",
          "afterVisitEmailSender": "CompanyManager"
        },
        "selectedPlan": "",
        "selectedPlanLabel": "",
        "createdAt": new Date().toISOString()
      }
    ],
    "customers": [],
    "customerGroups": [],
    "positions": [],
    "daysOff": [],
    "services": [],
    "serviceCategories": [],
    "visits": [],
    "reservations": [],
    "products": [],
    "walkinSales": [],
    "sales": [],
    "passes": [],
    "marketingCampaigns": [],
    "payments": [],
    "employeeAdvances": [],
    "dashboardVisits": [],
    "dashboardWorkerState": {},
    "loginJournal": [],
    "notificationOutbox": [],
    "notificationDeliveryLog": [],
    "registrations": []
  });

  const normalizeDb = (db) => {
    const seed = createSeedDatabase();
    db.version = '2.0-sender-company-table';
    db.users = Array.isArray(db.users) ? db.users : [];
    db.companies = Array.isArray(db.companies) ? db.companies : [];
    // Produkcyjny start: usuń stare/demo firmy i konta testowe, ale nie kasuj właściciela platformy ani zatwierdzonych firm.
    db.users = db.users.filter(user => {
      const text = [user.id, user.login, user.email, user.fullName, user.role].join(' ');
      return !/(admin@demo\.pl|pracownik@demo\.pl|Admin Demo|Pracownik Demo|employee123|company_demo)/i.test(text);
    });
    db.companies = db.companies.filter(company => {
      const text = [company.id, company.name, company.ownerName, company.ownerEmail].join(' ');
      return !/(company_demo|CompanyManager Demo|Admin Demo|Pracownik Demo)/i.test(text);
    });
    db.customers = Array.isArray(db.customers) ? db.customers : seed.customers;
    db.reservations = Array.isArray(db.reservations) ? db.reservations : seed.reservations;
    db.positions = Array.isArray(db.positions) ? db.positions : seed.positions;
    db.daysOff = Array.isArray(db.daysOff) ? db.daysOff : seed.daysOff;
    db.customerGroups = Array.isArray(db.customerGroups) ? db.customerGroups : seed.customerGroups;
    db.serviceCategories = Array.isArray(db.serviceCategories) ? db.serviceCategories : seed.serviceCategories;
    db.services = Array.isArray(db.services) ? db.services : seed.services;
    db.visits = Array.isArray(db.visits) ? db.visits : seed.visits;
    db.products = Array.isArray(db.products) ? db.products : seed.products;
    db.walkinSales = Array.isArray(db.walkinSales) ? db.walkinSales : seed.walkinSales;
    db.marketingCampaigns = Array.isArray(db.marketingCampaigns) ? db.marketingCampaigns : seed.marketingCampaigns;
    db.marketingCampaigns = db.marketingCampaigns.map(c => {
      const text = [c.name, c.description, c.customerGroup, c.channel].join(' ');
      if (/Hair House|Mezoterapia|Iłża|Nowość/i.test(text)) {
        return { ...c, name:'Kampania testowa', sentAt:currentIsoDate()+'T12:00:00', channel:'SMS', description:'Przykładowa wiadomość marketingowa wysłana do klientów.', customerCount:25, status:'aktywna', customerGroup:'Wszyscy klienci' };
      }
      return c;
    });
    db.passes = Array.isArray(db.passes) ? db.passes : seed.passes;
    db.registrations = Array.isArray(db.registrations) ? db.registrations : [];
    db.employeeAdvances = Array.isArray(db.employeeAdvances) ? db.employeeAdvances : [];

    seed.users.forEach(seedUser => {
      const indexById = db.users.findIndex(u => u.id === seedUser.id);
      if (indexById >= 0) {
        // Konta demo mają być zawsze odświeżane, żeby stare localStorage nie psuło logowania.
        db.users[indexById] = { ...db.users[indexById], ...seedUser };
      } else if (!db.users.some(u => u.login === seedUser.login || u.email === seedUser.email)) {
        db.users.push(seedUser);
      }
    });
    seed.companies.forEach(seedCompany => {
      if (!db.companies.some(c => c.id === seedCompany.id)) db.companies.push(seedCompany);
    });
    seed.positions.forEach(seedPosition => {
      if (!db.positions.some(p => p.id === seedPosition.id)) db.positions.push(seedPosition);
    });
    seed.daysOff.forEach(seedDayOff => {
      if (!db.daysOff.some(d => d.id === seedDayOff.id)) db.daysOff.push(seedDayOff);
    });
    seed.passes.forEach(seedPass => {
      if (!db.passes.some(pass => pass.id === seedPass.id)) db.passes.push(seedPass);
    });
    seed.customerGroups.forEach(seedGroup => {
      if (!db.customerGroups.some(g => g.id === seedGroup.id)) db.customerGroups.push(seedGroup);
    });
    seed.serviceCategories.forEach(seedCategory => {
      if (!db.serviceCategories.some(c => c.id === seedCategory.id)) db.serviceCategories.push(seedCategory);
    });
    seed.services.forEach(seedService => {
      if (!db.services.some(service => service.id === seedService.id)) db.services.push(seedService);
    });
    seed.visits.forEach(seedVisit => {
      if (!db.visits.some(visit => visit.id === seedVisit.id)) db.visits.push(seedVisit);
    });
    seed.products.forEach(seedProduct => {
      if (!db.products.some(product => product.id === seedProduct.id)) db.products.push(seedProduct);
    });

    db.users = db.users.map(user => ({
      ...user,
      role: (user.role || 'employee').toLowerCase(),
      login: user.login || user.email,
      companyId: user.companyId || 'company_demo',
      positionId: user.positionId || ''
    }));
    const validUserIds = new Set(db.users.map(user => user.id));
    const keepValidEmployeeRef = (employeeId) => !employeeId || validUserIds.has(employeeId);
    db.dashboardVisits = Array.isArray(db.dashboardVisits)
      ? db.dashboardVisits.filter(visit => keepValidEmployeeRef(visit.employeeId))
      : [];
    db.dashboardWorkerState = (db.dashboardWorkerState && typeof db.dashboardWorkerState === 'object') ? db.dashboardWorkerState : {};
    Object.keys(db.dashboardWorkerState).forEach(dateKey => {
      db.dashboardWorkerState[dateKey] = Array.isArray(db.dashboardWorkerState[dateKey])
        ? db.dashboardWorkerState[dateKey].filter(userId => validUserIds.has(userId))
        : [];
    });
    db.daysOff = (db.daysOff || []).filter(item => keepValidEmployeeRef(item.employeeId));
    db.visits = (db.visits || []).filter(visit => keepValidEmployeeRef(visit.employeeId));
    db.walkinSales = (db.walkinSales || []).filter(sale => keepValidEmployeeRef(sale.employeeId));
    db.reservations = (db.reservations || []).filter(reservation => keepValidEmployeeRef(reservation.employeeId));
    db.positions = db.positions.map(position => ({ ...position, active: position.active !== false }));
    db.serviceCategories = (db.serviceCategories || []).map(category => ({ ...category, companyId: category.companyId || 'company_demo', name: category.name || 'Bez kategorii' }));
    db.services = (db.services || []).map(service => ({
      ...service,
      companyId: service.companyId || 'company_demo',
      categoryId: service.categoryId || '',
      name: service.name || '',
      durationHours: Number(service.durationHours || 0),
      durationMinutes: Number(service.durationMinutes || 0),
      priceFrom: service.priceFrom ?? '',
      priceTo: service.priceTo ?? '',
      showOnline: service.showOnline === true,
      preventOverlap: service.preventOverlap === true,
      deposit: service.deposit ?? '',
      positionId: service.positionId || '',
      description: service.description || '',
      code: service.code || '',
      includeCommission: service.includeCommission === true,
      includeDiscount: service.includeDiscount === true
    }));
    db.visits = (db.visits || []).map(visit => ({
      ...visit,
      companyId: visit.companyId || 'company_demo',
      date: visit.date || currentIsoDate(),
      time: visit.time || '10:00',
      customerId: visit.customerId || '',
      employeeId: visit.employeeId || '',
      serviceId: visit.serviceId || '',
      status: visit.status || 'zaplanowane',
      deleted: visit.deleted === true
    }));
    db.products = (db.products || []).map(product => ({
      ...product,
      companyId: product.companyId || 'company_demo',
      name: product.name || '',
      category: product.category || '',
      packageStock: product.packageStock ?? product.stock ?? '',
      lowPackageStock: product.lowPackageStock ?? '',
      unitStock: product.unitStock ?? '',
      unitsPerPackage: product.unitsPerPackage ?? '',
      companyName: product.companyName || product.company || '',
      saleOnly: product.saleOnly === true,
      price: product.price ?? '',
      lastPurchasePrice: product.lastPurchasePrice ?? '',
      supplier: product.supplier || '',
      description: product.description || '',
      code: product.code || '',
      includeCommission: product.includeCommission === true,
      includeDiscount: product.includeDiscount === true
    }));
    db.walkinSales = (db.walkinSales || []).map(sale => ({
      ...sale,
      companyId: sale.companyId || 'company_demo',
      date: sale.date || currentIsoDate(),
      time: sale.time || '06:00',
      employeeId: sale.employeeId || '',
      customerId: sale.customerId || '',
      productId: sale.productId || '',
      productCustom: sale.productCustom || '',
      serviceId: sale.serviceId || '',
      serviceCustom: sale.serviceCustom || '',
      amount: sale.amount ?? '0.00',
      paymentMethod: sale.paymentMethod || 'gotówka',
      description: sale.description || ''
    }));
    db.marketingCampaigns = (db.marketingCampaigns || []).map(campaign => ({
      ...campaign,
      companyId: campaign.companyId || 'company_demo',
      name: campaign.name || 'Kampania',
      sentAt: campaign.sentAt || new Date().toISOString(),
      channel: campaign.channel || 'SMS',
      description: campaign.description || '',
      customerCount: Number(campaign.customerCount || 0),
      status: campaign.status || 'aktywna',
      customerGroup: campaign.customerGroup || ''
    }));
    db.daysOff = db.daysOff.map(item => ({ ...item, type: item.type || 'dzień wolny', start: item.start || currentIsoDate(), end: item.end || item.start || currentIsoDate(), description: item.description || '' }));
    db.customers = (db.customers || []).map(customer => {
      const fullName = String(customer.name || '').trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      return {
        ...customer,
        firstName: customer.firstName || parts[0] || '',
        lastName: customer.lastName || parts.slice(1).join(' ') || '',
        phone: customer.phone || '',
        email: customer.email || '',
        updatedAt: customer.updatedAt || currentDisplayDate(),
        lastVisit: customer.lastVisit || currentDisplayDate(),
        importantInfo: customer.importantInfo || '',
        gender: customer.gender || '',
        status: ['aktywny','nieaktywny'].includes(String(customer.status || '').toLowerCase()) ? String(customer.status).toLowerCase() : 'aktywny',
        source: customer.source || '',
        specialFeatures: customer.specialFeatures || '',
        cardNumber: customer.cardNumber || '',
        referrer: customer.referrer || '',
        visitSms: customer.visitSms || 'tak',
        visitEmail: customer.visitEmail || 'tak',
        marketingSms: customer.marketingSms || 'nie',
        marketingEmail: customer.marketingEmail || 'nie',
        serviceDiscount: customer.serviceDiscount || '',
        productDiscount: customer.productDiscount || '',
        group: customer.group || '',
        birthDate: customer.birthDate || '',
        nameDay: customer.nameDay || ''
      };
    });
    seed.customers.forEach(seedCustomer => {
      if (!db.customers.some(c => c.id === seedCustomer.id)) db.customers.push(seedCustomer);
    });
    db.loginJournal = Array.isArray(db.loginJournal) ? db.loginJournal.filter(entry => {
      const login = Array.isArray(entry) ? entry[2] : entry?.login;
      const browser = Array.isArray(entry) ? entry[4] : entry?.browser;
      const ip = Array.isArray(entry) ? entry[1] : entry?.ip;
      const text = [login, browser, ip].join(' ');
      return !/(admin@demo\.pl|pracownik@demo\.pl|Mozilla\/5\.0 test browser|10\.0\.)/i.test(text);
    }) : [];
    db.notificationOutbox = Array.isArray(db.notificationOutbox) ? db.notificationOutbox : [];
    db.notificationDeliveryLog = Array.isArray(db.notificationDeliveryLog) ? db.notificationDeliveryLog : [];
    return db;
  };

  const loadDatabase = () => {
    try {
      let raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        for (const key of LEGACY_KEYS) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }
      if (!raw) {
        const seed = createSeedDatabase();
        localStorage.setItem(DB_KEY, JSON.stringify(seed));
        return seed;
      }
      const db = applyDataRetention(normalizeDb(JSON.parse(raw)));
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return db;
    } catch (error) {
      const seed = createSeedDatabase();
      localStorage.setItem(DB_KEY, JSON.stringify(seed));
      return seed;
    }
  };

  const saveDatabase = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));

  const DATA_RETENTION_MONTHS = {
    '3 miesiące': 3,
    '6 miesięcy': 6,
    '12 miesięcy': 12,
    '24 miesiące': 24,
    '36 miesięcy': 36
  };
  const parseRetentionDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const pl = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (pl) {
      const year = Number(pl[3].length === 2 ? `20${pl[3]}` : pl[3]);
      return new Date(year, Number(pl[2]) - 1, Number(pl[1]));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };
  const getRetentionItemDate = (item = {}) => parseRetentionDate(
    item.date || item.reportDate || item.day || item.createdAt || item.updatedAt || item.from || item.to || item.periodFrom || item.periodTo
  );
  const monthsAgoDate = (months) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  };
  const applyDataRetention = (db = {}) => {
    if (!db || !Array.isArray(db.companies)) return db;
    const companyCutoffs = new Map();
    db.companies.forEach(company => {
      const option = String(company?.programSettings?.dataRetention || 'nie usuwaj').trim();
      const months = DATA_RETENTION_MONTHS[option];
      if (months) companyCutoffs.set(company.id, monthsAgoDate(months));
    });
    if (!companyCutoffs.size) return db;
    const shouldKeep = (item = {}) => {
      const cutoff = companyCutoffs.get(item.companyId);
      if (!cutoff) return true;
      const itemDate = getRetentionItemDate(item);
      return !itemDate || itemDate >= cutoff;
    };
    const retentionArrays = [
      'visits',
      'dashboardVisits',
      'reservations',
      'walkinSales',
      'cashStates',
      'cashReports',
      'cashEntries',
      'dailyReports',
      'periodReports',
      'generatedReports',
      'reportsArchive'
    ];
    retentionArrays.forEach(key => {
      if (Array.isArray(db[key])) db[key] = db[key].filter(shouldKeep);
    });
    if (db.dashboardWorkerState && typeof db.dashboardWorkerState === 'object') {
      Object.keys(db.dashboardWorkerState).forEach(dateKey => {
        const date = parseRetentionDate(dateKey);
        if (!date) return;
        const removeForEveryCompany = Array.from(companyCutoffs.values()).every(cutoff => date < cutoff);
        if (removeForEveryCompany) delete db.dashboardWorkerState[dateKey];
      });
    }
    db.lastRetentionCleanupAt = new Date().toISOString();
    return db;
  };

  const BIRTHDAY_SEND_HOUR = 9;
  const formatIsoDateLocal = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const birthdayMonthDay = (value) => {
    const raw = String(value || '').trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[2]}-${iso[3]}`;
    const dot = raw.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-]\d{2,4})?$/);
    if (dot) return `${String(dot[2]).padStart(2,'0')}-${String(dot[1]).padStart(2,'0')}`;
    return '';
  };
  const customerDisplayName = (customer = {}) => String(customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Klient').trim();
  const renderNotificationTemplate = (template, customer = {}, company = {}) => {
    const name = customerDisplayName(customer);
    const firstName = String(customer.firstName || name.split(/\s+/)[0] || '').trim();
    const lastName = String(customer.lastName || name.split(/\s+/).slice(1).join(' ') || '').trim();
    const companyName = getCompanyDisplayName(company);
    const fallback = `Wszystkiego najlepszego z okazji urodzin, ${firstName || name}!`;
    return String(template || fallback)
      .replace(/\{imie\}/gi, firstName)
      .replace(/\{imię\}/gi, firstName)
      .replace(/\{nazwisko\}/gi, lastName)
      .replace(/\{klient\}/gi, name)
      .replace(/\{firma\}/gi, companyName)
      .replace(/\{data\}/gi, currentDisplayDate());
  };
  const wasBirthdayNotificationSent = (db, companyId, customerId, channel, dayKey) => {
    const key = `birthday:${companyId}:${customerId}:${channel}:${dayKey}`;
    return (db.notificationDeliveryLog || []).some(item => item.key === key) || (db.notificationOutbox || []).some(item => item.dedupeKey === key);
  };
  const enqueueBirthdayNotification = (db, company, customer, channel, settings, dayKey, now = new Date()) => {
    const isSms = channel === 'SMS';
    const recipient = isSms ? String(customer.phone || '').trim() : String(customer.email || '').trim();
    if (!recipient) return false;
    const key = `birthday:${company.id}:${customer.id}:${channel}:${dayKey}`;
    if (wasBirthdayNotificationSent(db, company.id, customer.id, channel, dayKey)) return false;
    const sender = isSms ? String(settings.birthdaySmsSender || '').trim() : String(settings.birthdayEmailSender || '').trim();
    const template = isSms ? settings.birthdaySmsTemplate : settings.birthdayEmailTemplate;
    const message = renderNotificationTemplate(template, customer, company);
    db.notificationOutbox = Array.isArray(db.notificationOutbox) ? db.notificationOutbox : [];
    db.notificationDeliveryLog = Array.isArray(db.notificationDeliveryLog) ? db.notificationDeliveryLog : [];
    const record = {
      id: createId('notification'),
      dedupeKey: key,
      companyId: company.id,
      customerId: customer.id,
      customerName: customerDisplayName(customer),
      type: 'birthday',
      channel,
      recipient,
      sender,
      message,
      scheduledFor: `${dayKey}T09:00:00`,
      sentAt: now.toISOString(),
      status: 'wysłane'
    };
    db.notificationOutbox.unshift(record);
    db.notificationDeliveryLog.unshift({ key, sentAt: record.sentAt, companyId: company.id, customerId: customer.id, channel, type: 'birthday' });
    db.notificationOutbox = db.notificationOutbox.slice(0, 1000);
    db.notificationDeliveryLog = db.notificationDeliveryLog.slice(0, 3000);
    return true;
  };
  const processBirthdayNotifications = (db, company, options = {}) => {
    if (!db || !company) return 0;
    const now = options.now || new Date();
    if (!options.force && now.getHours() < BIRTHDAY_SEND_HOUR) return 0;
    const settings = company.notificationSettings || {};
    if (!settings.birthdaySms && !settings.birthdayEmail) return 0;
    const dayKey = formatIsoDateLocal(now);
    const todayMonthDay = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const customers = (db.customers || []).filter(customer => customer.companyId === company.id && birthdayMonthDay(customer.birthDate) === todayMonthDay);
    let created = 0;
    customers.forEach(customer => {
      if (settings.birthdaySms) created += enqueueBirthdayNotification(db, company, customer, 'SMS', settings, dayKey, now) ? 1 : 0;
      if (settings.birthdayEmail) created += enqueueBirthdayNotification(db, company, customer, 'EMAIL', settings, dayKey, now) ? 1 : 0;
    });
    if (created) saveDatabase(db);
    return created;
  };
  const scheduleBirthdayNotificationProcessor = (companyId) => {
    const run = () => {
      const db = loadDatabase();
      const company = (db.companies || []).find(item => item.id === companyId);
      if (company) processBirthdayNotifications(db, company);
    };
    run();
    window.clearInterval(window.__cmBirthdayNotificationTimer);
    window.__cmBirthdayNotificationTimer = window.setInterval(run, 60 * 1000);
  };

  const notificationCustomerRecipient = (customer = {}, channel = 'SMS') => {
    if (channel === 'SMS') return String(customer.phone || customer.phoneNumber || '').trim();
    return String(customer.email || '').trim();
  };
  const visitNotificationTime = (visit = {}, db = {}, extraMinutes = 0) => {
    const [year, month, day] = String(visit.date || '').split('-').map(Number);
    const [hours, minutes] = String(visit.time || '00:00').split(':').map(Number);
    if (!year || !month || !day) return new Date();
    const date = new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
    const service = (db.services || []).find(item => item.id === visit.serviceId);
    const durationMinutes = (Number(service?.durationHours || 0) * 60) + Number(service?.durationMinutes || 0);
    date.setMinutes(date.getMinutes() + (durationMinutes || 0) + Number(extraMinutes || 0));
    return date;
  };
  const renderVisitNotificationTemplate = (template, visit = {}, customer = {}, company = {}, db = {}) => {
    const name = customerDisplayName(customer);
    const service = (db.services || []).find(item => item.id === visit.serviceId);
    const employee = (db.users || []).find(item => item.id === visit.employeeId);
    const dateText = visit.date ? formatPolishDate(visit.date) : '';
    const timeText = String(visit.time || '').trim();
    const fallback = `Przypominamy o wizycie ${dateText}${timeText ? ' o ' + timeText : ''}.`;
    return String(template || fallback)
      .replace(/\{imie\}/gi, String(customer.firstName || name.split(/\s+/)[0] || '').trim())
      .replace(/\{imię\}/gi, String(customer.firstName || name.split(/\s+/)[0] || '').trim())
      .replace(/\{nazwisko\}/gi, String(customer.lastName || name.split(/\s+/).slice(1).join(' ') || '').trim())
      .replace(/\{klient\}/gi, name)
      .replace(/\{firma\}/gi, getCompanyDisplayName(company))
      .replace(/\{data\}/gi, dateText)
      .replace(/\{godzina\}/gi, timeText)
      .replace(/\{usluga\}/gi, String(service?.name || ''))
      .replace(/\{usługa\}/gi, String(service?.name || ''))
      .replace(/\{pracownik\}/gi, String(employee?.fullName || employee?.email || ''));
  };
  const enqueueVisitNotification = (db, company, visit, channel, type, settings = {}, options = {}) => {
    if (!db || !company || !visit) return false;
    const customer = (db.customers || []).find(item => item.id === visit.customerId && item.companyId === company.id);
    if (!customer) return false;
    const recipient = notificationCustomerRecipient(customer, channel);
    if (!recipient) return false;
    const key = `${type}:${company.id}:${visit.id}:${channel}`;
    db.notificationOutbox = Array.isArray(db.notificationOutbox) ? db.notificationOutbox : [];
    db.notificationDeliveryLog = Array.isArray(db.notificationDeliveryLog) ? db.notificationDeliveryLog : [];
    if ((db.notificationOutbox || []).some(item => item.dedupeKey === key) || (db.notificationDeliveryLog || []).some(item => item.key === key)) return false;
    const isSms = channel === 'SMS';
    const senderKey = type === 'visit-after-add'
      ? (isSms ? 'afterAddSmsSender' : 'afterAddEmailSender')
      : (isSms ? 'afterVisitSmsSender' : 'afterVisitEmailSender');
    const templateKey = type === 'visit-after-add'
      ? (isSms ? 'afterAddSmsTemplate' : 'afterAddEmailTemplate')
      : (isSms ? 'afterVisitSmsTemplate' : 'afterVisitEmailTemplate');
    const scheduledDate = options.scheduledFor instanceof Date ? options.scheduledFor : new Date();
    const now = new Date();
    const dueNow = scheduledDate.getTime() <= now.getTime();
    const record = {
      id: createId('notification'),
      dedupeKey: key,
      companyId: company.id,
      visitId: visit.id,
      customerId: customer.id,
      customerName: customerDisplayName(customer),
      type,
      channel,
      recipient,
      sender: String(settings[senderKey] || '').trim(),
      message: renderVisitNotificationTemplate(settings[templateKey], visit, customer, company, db),
      scheduledFor: scheduledDate.toISOString(),
      sentAt: dueNow ? now.toISOString() : '',
      status: dueNow ? 'wysłane' : 'zaplanowane'
    };
    db.notificationOutbox.unshift(record);
    if (dueNow) db.notificationDeliveryLog.unshift({ key, sentAt: record.sentAt, companyId: company.id, customerId: customer.id, visitId: visit.id, channel, type });
    db.notificationOutbox = db.notificationOutbox.slice(0, 1000);
    db.notificationDeliveryLog = db.notificationDeliveryLog.slice(0, 3000);
    return true;
  };
  const enqueueAfterAddVisitNotifications = (db, company, visit) => {
    const settings = company?.notificationSettings || {};
    let created = 0;
    if (settings.afterAddSms) created += enqueueVisitNotification(db, company, visit, 'SMS', 'visit-after-add', settings) ? 1 : 0;
    if (settings.afterAddEmail) created += enqueueVisitNotification(db, company, visit, 'EMAIL', 'visit-after-add', settings) ? 1 : 0;
    return created;
  };
  const enqueueAfterVisitNotifications = (db, company, visit) => {
    const settings = company?.notificationSettings || {};
    let created = 0;
    const scheduledFor = visitNotificationTime(visit, db, 60);
    if (settings.afterVisitSms) created += enqueueVisitNotification(db, company, visit, 'SMS', 'visit-after-complete', settings, { scheduledFor }) ? 1 : 0;
    if (settings.afterVisitEmail) created += enqueueVisitNotification(db, company, visit, 'EMAIL', 'visit-after-complete', settings, { scheduledFor }) ? 1 : 0;
    return created;
  };
  const processAutomatedVisitNotifications = (db, company) => {
    if (!db || !company) return 0;
    const settings = company.notificationSettings || {};
    const visits = (db.visits || []).filter(visit => visit.companyId === company.id && visit.deleted !== true);
    let created = 0;
    visits.forEach(visit => {
      if (['zakończone','zakończona','zakończony'].includes(String(visit.status || '').toLowerCase())) created += enqueueAfterVisitNotifications(db, company, visit);
    });
    const now = new Date();
    let sent = 0;
    db.notificationOutbox = (db.notificationOutbox || []).map(item => {
      if (item.companyId === company.id && item.status === 'zaplanowane' && new Date(item.scheduledFor).getTime() <= now.getTime()) {
        const sentAt = now.toISOString();
        db.notificationDeliveryLog = Array.isArray(db.notificationDeliveryLog) ? db.notificationDeliveryLog : [];
        if (!(db.notificationDeliveryLog || []).some(log => log.key === item.dedupeKey)) {
          db.notificationDeliveryLog.unshift({ key: item.dedupeKey, sentAt, companyId: item.companyId, customerId: item.customerId, visitId: item.visitId, channel: item.channel, type: item.type });
        }
        sent += 1;
        return { ...item, status: 'wysłane', sentAt };
      }
      return item;
    });
    if (created || sent) saveDatabase(db);
    return created + sent;
  };
  const scheduleNotificationProcessors = (companyId) => {
    scheduleBirthdayNotificationProcessor(companyId);
    const run = () => {
      const db = loadDatabase();
      const company = (db.companies || []).find(item => item.id === companyId);
      if (company) processAutomatedVisitNotifications(db, company);
    };
    run();
    window.clearInterval(window.__cmVisitNotificationTimer);
    window.__cmVisitNotificationTimer = window.setInterval(run, 60 * 1000);
  };

  const createId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const saveLastAction = (action) => localStorage.setItem(UNDO_KEY, JSON.stringify({ ...action, createdAt: new Date().toISOString() }));
  const loadLastAction = () => { try { return JSON.parse(localStorage.getItem(UNDO_KEY) || 'null'); } catch { return null; } };
  const clearLastAction = () => localStorage.removeItem(UNDO_KEY);
  const cloneData = (value) => JSON.parse(JSON.stringify(value));
  const saveUndoSnapshot = (label, db) => saveLastAction({ type: 'database-snapshot', label, database: cloneData(db) });
  const hasUndoSnapshot = () => { const action = loadLastAction(); return action && action.type === 'database-snapshot' && action.database; };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

  const setSession = (user) => localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, companyId: user.companyId, activeCompanyId: user.companyId, role: user.role, loginAt: new Date().toISOString() }));
  const getSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
  const setOwnerActiveCompany = (companyId) => {
    const session = getSession();
    if (!session) return false;
    session.companyId = companyId;
    session.activeCompanyId = companyId;
    session.switchedAt = new Date().toISOString();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  };
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const clearFieldError = (field) => {
    const wrapper = field.closest('.field, .consent-row, .price-option') || field.parentElement;
    field.classList.remove('is-invalid');
    if (wrapper) wrapper.classList.remove('is-invalid');
    const existing = wrapper?.querySelector('.field-error');
    if (existing) existing.remove();
  };

  const setFieldError = (field, message) => {
    const wrapper = field.closest('.field, .consent-row, .price-option') || field.parentElement;
    field.classList.add('is-invalid');
    if (wrapper) {
      wrapper.classList.add('is-invalid');
      let error = wrapper.querySelector('.field-error');
      if (!error) { error = document.createElement('p'); error.className = 'field-error'; wrapper.appendChild(error); }
      error.textContent = message;
    }
  };

  const isValidPhone = (value) => /^\+48\d{9}$/.test(value.trim()) || /^\+48 \d{3} \d{3} \d{3}$/.test(value.trim());
  const isValidPolishPostalFormat = (value) => /^\d{2}-\d{3}$/.test(value.trim());
  const normalizeText = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ');

  const getPostalPlacesPL = async (postalCode) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`https://api.zippopotam.us/pl/${encodeURIComponent(postalCode.trim())}`, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (response.status === 404) return { ok: false, reason: 'not-found', places: [] };
      if (!response.ok) return { ok: false, reason: 'api-error', places: [] };
      const data = await response.json();
      return { ok: true, places: Array.isArray(data.places) ? data.places.map(p => p['place name']).filter(Boolean) : [] };
    } catch { return { ok: false, reason: 'network-error', places: [] }; }
    finally { clearTimeout(timeout); }
  };

  const validatePostalCityPairPL = async (postalField, cityField) => {
    if (!postalField || !cityField) return true;
    const postalCode = postalField.value.trim();
    const city = cityField.value.trim();
    if (!postalCode || !city) return true;
    if (!isValidPolishPostalFormat(postalCode)) { setFieldError(postalField, 'Podaj kod pocztowy w formacie XX-XXX.'); return false; }
    const result = await getPostalPlacesPL(postalCode);
    if (!result.ok) { setFieldError(postalField, result.reason === 'not-found' ? 'Nie znaleziono takiego kodu pocztowego w Polsce.' : 'Nie udało się sprawdzić kodu pocztowego. Spróbuj ponownie.'); return false; }
    const normalizedCity = normalizeText(city);
    const normalizedPlaces = result.places.map(normalizeText);
    if (!normalizedPlaces.includes(normalizedCity)) { setFieldError(cityField, `Kod pocztowy ${postalCode} nie zgadza się z miejscowością. Dla tego kodu wykryto: ${result.places.join(', ') || 'inna miejscowość'}.`); return false; }
    return true;
  };

  const registerForm = document.querySelector('#registerForm');
  const loginForm = document.querySelector('#loginForm');
  const dashboardRoot = document.querySelector('#dashboardRoot');

  const validateRegisterForm = async () => {
    let firstInvalid = null;
    const error = document.querySelector('#formError');
    const success = document.querySelector('#formSuccess');
    const pricingError = document.querySelector('#pricingError');
    if (error) { error.textContent = ''; error.style.display = 'none'; }
    if (success) { success.textContent = ''; success.style.display = 'none'; }
    if (pricingError) { pricingError.textContent = ''; pricingError.style.display = 'none'; }
    registerForm.querySelectorAll('input, textarea, select').forEach(clearFieldError);
    document.querySelectorAll('.price-option').forEach(option => option.classList.remove('is-invalid'));

    Array.from(registerForm.querySelectorAll('[required]')).filter(field => field.type !== 'radio').forEach(field => {
      const label = field.dataset.label || field.closest('.field')?.querySelector('label')?.textContent?.replace('*', '').trim() || 'Pole';
      if (field.type === 'checkbox') {
        if (!field.checked) { setFieldError(field, 'To pole jest wymagane.'); if (!firstInvalid) firstInvalid = field; }
      } else if (!field.value.trim()) { setFieldError(field, `Uzupełnij pole: ${label}.`); if (!firstInvalid) firstInvalid = field; }
    });

    const email = registerForm.querySelector('#email');
    if (email?.value.trim() && !email.checkValidity()) { setFieldError(email, 'Podaj poprawny adres email.'); if (!firstInvalid) firstInvalid = email; }
    const receptionEmail = registerForm.querySelector('#receptionEmail');
    if (receptionEmail?.value.trim() && !receptionEmail.checkValidity()) { setFieldError(receptionEmail, 'Podaj poprawny email firmowy albo zostaw pole puste.'); if (!firstInvalid) firstInvalid = receptionEmail; }
    const phone = registerForm.querySelector('#phone');
    if (phone?.value.trim() && !isValidPhone(phone.value)) { setFieldError(phone, 'Zły format. Akceptujemy tylko formaty: +48321321321 albo +48 321 321 312.'); if (!firstInvalid) firstInvalid = phone; }
    const receptionPhones = registerForm.querySelector('#receptionPhones');
    if (receptionPhones?.value.trim() && !isValidPhone(receptionPhones.value)) { setFieldError(receptionPhones, 'Zły format. Akceptujemy tylko formaty: +48321321321 albo +48 321 321 312.'); if (!firstInvalid) firstInvalid = receptionPhones; }

    const passField = registerForm.querySelector('#password');
    const confirmField = registerForm.querySelector('#confirmPassword');
    const pass = passField?.value || ''; const confirm = confirmField?.value || '';
    if (pass && pass.length < 8) { setFieldError(passField, 'Hasło musi mieć minimum 8 znaków.'); if (!firstInvalid) firstInvalid = passField; }
    if (pass && confirm && pass !== confirm) { setFieldError(passField, 'Hasła nie są takie same.'); setFieldError(confirmField, 'Hasła nie są takie same.'); if (!firstInvalid) firstInvalid = confirmField; }

    const postalCode = registerForm.querySelector('#postalCode'); const city = registerForm.querySelector('#city');
    const billingPostal = registerForm.querySelector('#billingPostal'); const billingCity = registerForm.querySelector('#billingCity');
    if (postalCode?.value.trim() && !isValidPolishPostalFormat(postalCode.value)) { setFieldError(postalCode, 'Podaj kod pocztowy w formacie XX-XXX.'); if (!firstInvalid) firstInvalid = postalCode; }
    if (billingPostal?.value.trim() && !isValidPolishPostalFormat(billingPostal.value)) { setFieldError(billingPostal, 'Podaj kod pocztowy w formacie XX-XXX.'); if (!firstInvalid) firstInvalid = billingPostal; }
    if (postalCode?.value.trim() && city?.value.trim() && isValidPolishPostalFormat(postalCode.value)) { const ok = await validatePostalCityPairPL(postalCode, city); if (!ok && !firstInvalid) firstInvalid = postalCode; }
    if (billingPostal?.value.trim() && billingCity?.value.trim() && isValidPolishPostalFormat(billingPostal.value)) { const ok = await validatePostalCityPairPL(billingPostal, billingCity); if (!ok && !firstInvalid) firstInvalid = billingPostal; }

    const selectedPlan = registerForm.querySelector('input[name="pricingPlan"]:checked');
    if (!selectedPlan) { if (pricingError) { pricingError.textContent = 'Wybierz pakiet cenowy.'; pricingError.style.display = 'block'; } document.querySelectorAll('.price-option').forEach(option => option.classList.add('is-invalid')); if (!firstInvalid) firstInvalid = registerForm.querySelector('input[name="pricingPlan"]'); }

    if (firstInvalid) { if (error) { error.textContent = selectedPlan ? 'Uzupełnij brakujące lub błędne pola formularza.' : 'Wybierz pakiet cenowy i uzupełnij brakujące pola formularza.'; error.style.display = 'block'; } (firstInvalid.closest('.section') || firstInvalid).scrollIntoView({ behavior:'smooth', block:'center' }); return false; }
    return true;
  };

  const collectRegistrationData = () => {
    const selectedPlan = registerForm.querySelector('input[name="pricingPlan"]:checked')?.value || '';
    return {
      owner: { email: registerForm.email.value.trim(), password: registerForm.password.value, fullName: registerForm.ownerName.value.trim(), phone: registerForm.phone.value.trim() },
      company: { name: registerForm.companyName.value.trim(), address: registerForm.companyAddress.value.trim(), postalCode: registerForm.postalCode.value.trim(), city: registerForm.city.value.trim(), receptionPhones: registerForm.receptionPhones.value.trim(), receptionEmail: registerForm.receptionEmail.value.trim(), employeesRaw: '', smsSender: registerForm.smsSender.value.trim(), messageSender: registerForm.smsSender.value.trim(), selectedPlan, selectedPlanLabel: planLabels[selectedPlan] || selectedPlan, billing: { name: registerForm.billingName.value.trim(), address: registerForm.billingAddress.value.trim(), postalCode: registerForm.billingPostal.value.trim(), city: registerForm.billingCity.value.trim(), nip: registerForm.nip.value.trim() } },
      consents: { terms: registerForm.acceptTerms.checked, rodo: registerForm.acceptRodo.checked, privacy: registerForm.acceptPrivacy.checked }
    };
  };

  if (registerForm) {
    loadDatabase(); registerForm.setAttribute('novalidate', 'novalidate');
    registerForm.addEventListener('input', e => { if (e.target.matches('input, textarea, select')) clearFieldError(e.target); });
    registerForm.addEventListener('change', e => { if (e.target.matches('input, textarea, select')) clearFieldError(e.target); if (e.target.name === 'pricingPlan') { const pricingError = document.querySelector('#pricingError'); document.querySelectorAll('.price-option').forEach(o => o.classList.remove('is-invalid')); if (pricingError) { pricingError.textContent=''; pricingError.style.display='none'; } } });
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = registerForm.querySelector('button[type="submit"]'); const error = document.querySelector('#formError'); const success = document.querySelector('#formSuccess');
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Sprawdzam dane...'; }
      const isValid = await validateRegisterForm();
      if (!isValid) { if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Utwórz konto firmy'; } return; }
      const db = loadDatabase(); const data = collectRegistrationData(); const normalizedEmail = data.owner.email.toLowerCase();
      const hasActiveUser = db.users.some(user => user.email?.toLowerCase() === normalizedEmail || user.login?.toLowerCase() === normalizedEmail);
      const hasPendingRegistration = (db.registrations || []).some(reg => String(reg.owner?.email || '').toLowerCase() === normalizedEmail && reg.status === 'pending');
      if (hasActiveUser || hasPendingRegistration) { setFieldError(registerForm.email, 'Konto z takim adresem email już istnieje lub oczekuje na zatwierdzenie przez właściciela.'); if (error) { error.textContent='Konto z takim adresem email już istnieje lub oczekuje na zatwierdzenie przez właściciela.'; error.style.display='block'; } if (submitButton) { submitButton.disabled=false; submitButton.textContent='Utwórz konto firmy'; } return; }
      const createdAt = new Date().toISOString();
      const registration = {
        id: createId('registration'),
        status: 'pending',
        owner: { ...data.owner, email: normalizedEmail },
        company: data.company,
        consents: data.consents,
        createdAt,
        reviewedAt: '',
        reviewedBy: ''
      };
      db.registrations = Array.isArray(db.registrations) ? db.registrations : [];
      db.registrations.push(registration);
      saveDatabase(db);
      registerForm.reset();
      if (success) { success.textContent = 'Zgłoszenie rejestracji zostało wysłane do właściciela platformy. Po zatwierdzeniu firma otrzyma dostęp do panelu.'; success.style.display = 'block'; }
      if (submitButton) { submitButton.disabled=false; submitButton.textContent='Utwórz konto firmy'; }
      setTimeout(() => { window.location.href = 'login.html'; }, 1600);
    });
  }


  const isLoginTimeAllowed = (from, to, now = new Date()) => {
    const parseMinutes = (value, fallback) => {
      const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return fallback;
      const hours = Math.max(0, Math.min(23, Number(match[1])));
      const minutes = Math.max(0, Math.min(59, Number(match[2])));
      return hours * 60 + minutes;
    };
    const start = parseMinutes(from, 0);
    const end = parseMinutes(to, 24 * 60 - 1);
    const current = now.getHours() * 60 + now.getMinutes();
    if (start === end) return true;
    if (start < end) return current >= start && current <= end;
    return current >= start || current <= end;
  };

  const shouldEnforceLoginRules = (user) => String(user?.role || '').toLowerCase() !== 'owner';

  const formatLoginJournalDate = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const detectBrowserInfo = () => navigator.userAgent || 'nieustalona przeglądarka';

  const detectClientIp = async () => {
    const fallback = 'nieustalone';
    try {
      const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (!response.ok) return fallback;
      const data = await response.json();
      return data?.ip || fallback;
    } catch {
      return fallback;
    }
  };

  const appendLoginJournalEntry = async (db, { user = null, login = '', status = 'ok' } = {}) => {
    const companyId = user?.companyId || db.users.find(item => item.login?.toLowerCase() === String(login).toLowerCase() || item.email?.toLowerCase() === String(login).toLowerCase())?.companyId || 'unknown';
    const entry = {
      id: createId('login'),
      companyId,
      date: formatLoginJournalDate(),
      ip: await detectClientIp(),
      login: login || user?.login || user?.email || '-',
      status,
      browser: detectBrowserInfo()
    };
    db.loginJournal = Array.isArray(db.loginJournal) ? db.loginJournal : [];
    db.loginJournal.unshift(entry);
    db.loginJournal = db.loginJournal.slice(0, 500);
    saveDatabase(db);
  };

  if (loginForm) {
    loadDatabase(); loginForm.setAttribute('novalidate', 'novalidate');
    loginForm.addEventListener('input', e => { if (e.target.matches('input')) clearFieldError(e.target); const error = document.querySelector('#loginError'); if (error) { error.textContent=''; error.style.display='none'; } });
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const loginField = loginForm.querySelector('#login') || loginForm.querySelector('#email');
      const passwordField = loginForm.querySelector('#password');
      let error = document.querySelector('#loginError');
      if (!error) { error = document.createElement('p'); error.id='loginError'; error.className='error'; loginForm.appendChild(error); }
      const loginValue = loginField.value.trim().toLowerCase(); const passwordValue = passwordField.value;
      if (!loginValue) { setFieldError(loginField, 'Podaj login albo adres email.'); return; }
      if (!passwordValue) { setFieldError(passwordField, 'Podaj hasło.'); return; }
      const db = loadDatabase();
      const user = db.users.find(item => {
        const loginMatches = item.login?.toLowerCase() === loginValue || item.email?.toLowerCase() === loginValue;
        const legacyAdminMatches = item.id === 'user_admin' && loginValue === 'manager@demo.pl' && passwordValue === 'admin123';
        return (loginMatches && item.password === passwordValue) || legacyAdminMatches;
      });
      if (!user) { await appendLoginJournalEntry(db, { login: loginValue, status: 'błąd' }); error.textContent = 'Nieprawidłowy login lub hasło.'; error.style.display = 'block'; setFieldError(loginField, 'Sprawdź login.'); setFieldError(passwordField, 'Sprawdź hasło.'); return; }
      if (shouldEnforceLoginRules(user) && Boolean(user.loginBlocked)) {
        error.textContent = 'Logowanie do tego konta jest zablokowane.';
        error.style.display = 'block';
        setFieldError(loginField, 'Konto zablokowane.');
        await appendLoginJournalEntry(db, { user, login: loginValue, status: 'zablokowane' });
        return;
      }
      if (shouldEnforceLoginRules(user) && Boolean(user.loginHoursOnly) && !isLoginTimeAllowed(user.loginFrom || '04:00', user.loginTo || '22:00')) {
        const from = user.loginFrom || '04:00';
        const to = user.loginTo || '22:00';
        error.textContent = `Logowanie dozwolone tylko w godzinach od ${from} do ${to}.`;
        error.style.display = 'block';
        setFieldError(loginField, 'Poza dozwolonymi godzinami logowania.');
        await appendLoginJournalEntry(db, { user, login: loginValue, status: 'poza godzinami' });
        return;
      }
      await appendLoginJournalEntry(db, { user, login: loginValue, status: 'ok' });
      setSession(user); window.location.href = 'panel/dashboard.html';
    });
  }


  const getSupabaseAccessSnapshot = () => {
    try { return JSON.parse(localStorage.getItem('cm_access') || 'null'); } catch { return null; }
  };

  const normalizeSupabasePermissions = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  };

  const supabaseOpenPermissionMap = {
    open_company_manager: ['dashboard','companyPanel','calendar','settings'],
    open_positions: ['positions'],
    open_team: ['employees','users'],
    open_days_off: ['daysOff'],
    open_clients: ['customers'],
    open_services: ['services'],
    open_products: ['products'],
    open_appointments: ['visits'],
    open_sales_without_visit: ['walkins'],
    open_marketing: ['marketing'],
    open_passes: ['passes'],
    open_owner_page: ['owner'],
    open_sales: ['sales'],
    open_stats: ['reports'],
    open_customer_reports: ['customersReports'],
    open_daily_report: ['dailyReport'],
    open_period_report: ['periodReport'],
    open_employees: ['employeesReports'],
    open_work_schedule: ['workSchedule'],
    open_sms: ['smsReports'],
    open_email: ['emailReports']
  };

  const supabaseActionPermissionMap = {
    positions_add: ['stanowiska pracy — dodawanie', 'stanowiska pracy (dodawanie, edycja, usuwanie)'],
    positions_edit: ['stanowiska pracy — edycja', 'stanowiska pracy (dodawanie, edycja, usuwanie)'],
    positions_delete: ['stanowiska pracy — usuwanie', 'stanowiska pracy (dodawanie, edycja, usuwanie)'],
    users_add: ['użytkownicy — dodawanie', 'Zespół - użytkownicy (dodawanie, edycja, usuwanie)', 'Użytkownicy (dodawanie, edycja, usuwanie)'],
    users_edit: ['użytkownicy — edycja', 'Zespół - użytkownicy (dodawanie, edycja, usuwanie)', 'Użytkownicy (dodawanie, edycja, usuwanie)'],
    users_delete: ['użytkownicy — usuwanie/blokada', 'Zespół - użytkownicy (dodawanie, edycja, usuwanie)', 'Użytkownicy (dodawanie, edycja, usuwanie)'],
    days_off_add: ['dni wolne (dodawanie)'],
    days_off_edit: ['dni wolne (usuwanie, edycja)', 'dni wolne(dodawanie,edycja,usuwanie)'],
    days_off_delete: ['dni wolne (usuwanie, edycja)', 'dni wolne(dodawanie,edycja,usuwanie)'],
    clients_add: ['klienci — dodawanie', 'klienci (dodawanie, edycja, usuwanie)'],
    clients_edit: ['klienci — edycja', 'klienci (dodawanie, edycja, usuwanie)'],
    clients_delete: ['klienci — usuwanie', 'klienci (dodawanie, edycja, usuwanie)'],
    clients_history: ['klienci — historia', 'klienci - historia (przeglądanie historii klientów)', 'klienci - historia (przeglądanie historii klientów - tabeli poniżej)'],
    services_add: ['usługi (dodawanie, edycja, usuwanie)'],
    services_edit: ['usługi (dodawanie, edycja, usuwanie)'],
    services_delete: ['usługi (dodawanie, edycja, usuwanie)'],
    products_add: ['produkty (dodawanie, edycja, usuwanie)'],
    products_edit: ['produkty (dodawanie, edycja, usuwanie)'],
    products_delete: ['produkty (dodawanie, edycja, usuwanie)'],
    warehouse_manage: ['produkty (magazyn)'],
    appointments_add: ['wizyty (dodawanie, edycja, zakończenie, usuwanie)'],
    appointments_edit: ['wizyty (dodawanie, edycja, zakończenie, usuwanie)', 'wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)'],
    appointments_finish: ['wizyty (dodawanie, edycja, zakończenie, usuwanie)'],
    appointments_delete: ['wizyty (dodawanie, edycja, zakończenie, usuwanie)', 'wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)'],
    appointments_unfinished_history: ['wizyty (niezakończone) - dostęp do historii'],
    appointments_unfinished_manage: ['wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)'],
    appointments_history: ['wizyty - historia (przeglądanie historii wizyt)', 'wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)'],
    sales_without_visit_add: ['sprzedaż bez wizyt (dodawanie, edycja, usuwanie)'],
    sales_without_visit_edit: ['sprzedaż bez wizyt (dodawanie, edycja, usuwanie)'],
    sales_without_visit_delete: ['sprzedaż bez wizyt (dodawanie, edycja, usuwanie)'],
    sales_without_visit_history: ['sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)'],
    marketing_sms: ['marketing (wysyłka reklamy sms/email)', 'marketing (wysyłka reklamy sms/email/usuń)'],
    marketing_email: ['marketing (wysyłka reklamy sms/email)', 'marketing (wysyłka reklamy sms/email/usuń)'],
    marketing_delete: ['marketing (wysyłka reklamy sms/email/usuń)'],
    passes_add: ['karnety (dodawanie, edycja, usuwanie)'],
    passes_edit: ['karnety (dodawanie, edycja, usuwanie)'],
    passes_delete: ['karnety (dodawanie, edycja, usuwanie)'],
    daily_report_today: ['raport dzienny dzisiejszy (przeglądanie)'],
    daily_report_other_days: ['raport dzienny wczorajszy, jutrzejszy (przeglądanie)'],
    work_schedule_add: ['grafik pracy (dodawanie)', 'grafik pracy (dodawanie,edycja,usuwanie)'],
    work_schedule_edit: ['grafik pracy (edycja, usuwanie)', 'grafik pracy (dodawanie,edycja,usuwanie)'],
    work_schedule_delete: ['grafik pracy (edycja, usuwanie)', 'grafik pracy (dodawanie,edycja,usuwanie)'],
    reports_access: ['dostęp do raportów'],
    export_data: ['export danych z całej platformy', 'export/import danych'],
    import_data: ['import danych do całej platformy', 'export/import danych']
  };

  const isPermissionOn = (permissions, key) => permissions?.[key] === true || permissions?.[key] === 'true' || permissions?.[key] === 1 || permissions?.[key] === '1';

  const supabasePermissionsToLegacy = (rawPermissions) => {
    const permissions = normalizeSupabasePermissions(rawPermissions);
    const legacy = new Set();
    Object.entries(supabaseOpenPermissionMap).forEach(([key, pages]) => {
      if (isPermissionOn(permissions, key)) pages.forEach(page => legacy.add(`open:${page}`));
    });
    Object.entries(supabaseActionPermissionMap).forEach(([key, labels]) => {
      if (isPermissionOn(permissions, key)) labels.forEach(label => legacy.add(label));
    });
    return Array.from(legacy);
  };

  const buildSupabasePanelUser = (session, access) => {
    if (!session || session.source !== 'supabase' || !access || access.allowed !== true) return null;
    const role = String(access.role || session.role || 'EMPLOYEE').toLowerCase();
    const companyId = access.company_id || session.activeCompanyId || session.companyId || '';
    const supabasePermissions = normalizeSupabasePermissions(access.permissions || {});
    const legacyPermissions = Array.isArray(access.legacy_permissions)
      ? access.legacy_permissions
      : supabasePermissionsToLegacy(supabasePermissions);
    return {
      id: access.user_id || session.userId || access.email || 'supabase_user',
      login: access.email || session.userId || 'supabase_user',
      email: access.email || '',
      fullName: access.full_name || access.name || access.email || 'Użytkownik',
      phone: access.phone || '',
      role: role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'employee',
      companyId,
      positionId: access.position_id || '',
      permissions: legacyPermissions,
      supabasePermissions,
      source: 'supabase'
    };
  };

  const buildSupabasePanelCompany = (db, session, access, user) => {
    const companyId = user?.companyId || access?.company_id || session?.activeCompanyId || session?.companyId || '';
    if (!companyId) return null;
    const existing = (db.companies || []).find(item => item.id === companyId);
    if (existing) return existing;
    return {
      id: companyId,
      name: access?.company_name || access?.companyName || 'Firma',
      ownerName: access?.full_name || user?.fullName || '',
      ownerEmail: access?.email || user?.email || '',
      plan: access?.package || '',
      planValidUntil: access?.package_expires_at || '',
      source: 'supabase'
    };
  };

  const getCurrentContext = () => {
    const db = loadDatabase(); const session = getSession();
    if (!session) return { db, session:null, user:null, company:null };
    let user = db.users.find(item => item.id === session.userId);
    let requestedCompanyId = session.activeCompanyId || session.companyId || user?.companyId;
    let company = db.companies.find(item => item.id === requestedCompanyId) || db.companies.find(item => item.id === user?.companyId);

    if ((!user || !company) && session.source === 'supabase') {
      const access = getSupabaseAccessSnapshot();
      const supabaseUser = buildSupabasePanelUser(session, access);
      if (supabaseUser) {
        user = user || supabaseUser;
        company = company || buildSupabasePanelCompany(db, session, access, user);
      }
    }

    return { db, session, user, company };
  };

  const pageLabels = {
    dashboard: 'Dashboard', calendar: 'Kalendarz', positions: 'Stanowiska pracy', employees: 'Zespół', users: 'Użytkownicy', workSchedule: 'Grafik pracy',
    daysOff: 'Dni wolne pracowników', customers: 'Klienci', services: 'Usługi', visits: 'Wizyty',
    reports: 'Wykres/Statystyka', customersReports: 'Klienci - raporty', dailyReport: 'Raport dzienny', periodReport: 'Raport z okresu', employeesReports: 'Pracownicy - raporty', smsReports: 'SMS', emailReports: 'Email', walkins: 'Sprzedaż bez wizyty', products: 'Produkty', marketing: 'Marketing',
    passes: 'Karnety', sales: 'Sprzedaż', companyPanel: 'Panel Firmy', owner: 'Właściciel strony', companies: 'Firmy', settings: 'Ustawienia'
  };

  const allPanelPages = ['dashboard','calendar','positions','employees','users','workSchedule','daysOff','customers','services','visits','reports','customersReports','dailyReport','periodReport','employeesReports','smsReports','emailReports','products','walkins','marketing','passes','sales','companyPanel','owner','companies','settings'];
  const legacyEmployeePages = ['dashboard','calendar','visits','customers'];
  const hasOpenPermission = (user, page) => Array.isArray(user?.permissions) && user.permissions.includes(`open:${page}`);
  const reportPermissionPages = ['reports','customersReports','dailyReport','periodReport','employeesReports','smsReports','emailReports','sales'];
  const permissionAliases = {
    'Użytkownicy (dodawanie, edycja, usuwanie)': ['Zespół - użytkownicy (dodawanie, edycja, usuwanie)'],
    'dni wolne(dodawanie,edycja,usuwanie)': ['dni wolne (dodawanie)', 'dni wolne (usuwanie, edycja)'],
    'grafik pracy (dodawanie,edycja,usuwanie)': ['grafik pracy (dodawanie)', 'grafik pracy (edycja, usuwanie)'],
    'klienci — historia': ['klienci - historia (przeglądanie historii klientów)', 'klienci - historia (przeglądanie historii klientów - tabeli poniżej)'],
    'klienci - historia (przeglądanie historii klientów)': ['klienci - historia (przeglądanie historii klientów - tabeli poniżej)', 'klienci — historia'],
    'wizyty - historia (przeglądanie historii wizyt)': ['wizyty (niezakończone) - dostęp do historii', 'wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)'],
    'wizyty zakończone wczorajsze i wcześniejsze (dodawanie, edycja, usuwanie)': ['wizyty (dodawanie, edycja, zakończenie, usuwanie)'],
    'sprzedaż bez wizyt wczorajsza i wcześniejsza (dodawanie, edycja, usuwanie)': ['sprzedaż bez wizyt (dodawanie, edycja, usuwanie)'],
    'marketing (wysyłka reklamy sms/email)': ['marketing (wysyłka reklamy sms/email/usuń)'],
    'export/import danych': ['export danych z całej platformy', 'import danych do całej platformy'],
    'raport dzienny wczorajszy, jutrzejszy (przeglądanie)': ['raport dzienny wczorajszy, jutrzejszy (przeglądanie)']
  };

  const hasSystemPermission = (user, permissionLabel) => {
    const role = user?.role || 'employee';
    if (role === 'owner' || role === 'admin') return true;
    const supabasePermissions = normalizeSupabasePermissions(user?.supabasePermissions || {});
    const mappedLabels = Object.entries(supabaseActionPermissionMap)
      .filter(([key]) => isPermissionOn(supabasePermissions, key))
      .flatMap(([, labels]) => labels);
    if (mappedLabels.includes(permissionLabel)) return true;
    if (!Array.isArray(user?.permissions)) return false;
    if (user.permissions.includes(permissionLabel)) return true;
    const aliases = permissionAliases[permissionLabel] || [];
    if (aliases.some(alias => user.permissions.includes(alias))) return true;
    return Object.entries(permissionAliases).some(([legacy, current]) => current.includes(permissionLabel) && user.permissions.includes(legacy));
  };

  const permissionBlockedHtml = (permissionLabel) => `<div class="bm-empty-state cm-permission-notice">Brak uprawnienia: ${escapeHtml(permissionLabel)}</div>`;
  const isOwnerOrAdminUser = (user) => ['owner','admin'].includes(String(user?.role || '').toLowerCase());
  const canAccessPage = (subject, page) => {
    const role = typeof subject === 'string' ? subject : (subject?.role || 'employee');
    if (!allPanelPages.includes(page)) return false;
    if (page === 'companies') return role === 'owner';
    if (role === 'owner' || role === 'admin') return true;
    if (typeof subject !== 'string' && Array.isArray(subject?.permissions)) {
      if (!hasOpenPermission(subject, page)) return false;
      const viewParam = new URLSearchParams(window.location.search || '').get('view') || '';
      const isWorkScheduleView = page === 'workSchedule';
      if (page === 'dailyReport' && !hasSystemPermission(subject, 'raport dzienny dzisiejszy (przeglądanie)') && !hasSystemPermission(subject, 'raport dzienny wczorajszy, jutrzejszy (przeglądanie)')) return false;
      if (reportPermissionPages.includes(page) && page !== 'dailyReport' && !isWorkScheduleView && !hasSystemPermission(subject, 'dostęp do raportów')) return false;
      return true;
    }
    if (role === 'admin') return true;
    return legacyEmployeePages.includes(page);
  };

  const cmPermissionRules = [
    ['stanowiska pracy (dodawanie, edycja, usuwanie)', ['#showAddPosition','#showDeletePosition','#confirmDeletePosition','.edit-position-btn']],
    ['Zespół - użytkownicy (dodawanie, edycja, usuwanie)', ['#showAddAdminUserBtn','#showEditAdminUserBtn','#showDeleteAdminUserBtn']],
    ['dni wolne (dodawanie)', ['#showAddDaysOff']],
    ['dni wolne (usuwanie, edycja)', ['#showEditDaysOff','#showDeleteDaysOff','#deleteDaysOffBtn']],
    ['klienci — dodawanie', ['#showAddCustomer','#customerForm button[type="submit"]']],
    ['klienci — edycja', ['#showEditCustomer','#customerEditForm button[type="submit"]']],
    ['klienci — usuwanie', ['#showDeleteCustomer','#customerDeleteForm button[type="submit"]']],
    ['klienci (dodawanie, edycja, usuwanie)', ['#showAddCustomer','#showEditCustomer','#showDeleteCustomer','#customerForm button[type="submit"]','#customerEditForm button[type="submit"]','#customerDeleteForm button[type="submit"]']],
    ['klienci - historia (przeglądanie historii klientów - tabeli poniżej)', ['[data-customer-history]','#showCustomerHistory','.customer-history-btn','a[href*="customer-history"]']],
    ['usługi (dodawanie, edycja, usuwanie)', ['#showAddService','#showDeleteService','#deleteServiceBtn','#deleteServiceCategoryBtn','#showServiceCategoryManager']],
    ['produkty (dodawanie, edycja, usuwanie)', ['#showAddProduct','#showDeleteProduct','#deleteProductBtn','#productForm button[type="submit"]']],
    ['produkty (magazyn)', ['[data-product-filter="low"]','[data-product-filter="high"]','[data-product-filter="saleOnly"]','input[name="packageStock"]','input[name="lowPackageStock"]','input[name="unitStock"]','input[name="unitsPerPackage"]']],
    ['wizyty (dodawanie, edycja, zakończenie, usuwanie)', []],
    ['wizyty (niezakończone) - dostęp do historii', ['[data-visit-history="unfinished"]','#showUnfinishedVisitHistory','.visit-unfinished-history-btn']],
    ['wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)', ['#dashEditVisitBtn','#dashCancelVisitBtn']],
    ['wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)', ['[data-visit-history="all"]','#showVisitHistory','.visit-history-btn','a[href*="history"]']],
    ['sprzedaż bez wizyt (dodawanie, edycja, usuwanie)', ['#showAddWalkin','#showDeleteWalkin','#walkinForm button[type="submit"]','#walkinDeleteForm button[type="submit"]']],
    ['sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)', ['[data-walkin-history]','#showWalkinHistory','.walkin-history-btn']],
    ['marketing (wysyłka reklamy sms/email/usuń)', ['#showMarketingSms','#showMarketingEmail','#showDeleteCampaign','#sendSmsTest','#sendEmailTest','#saveSmsCampaign','#sendSmsCampaign','#saveEmailCampaign','#sendEmailCampaign','#deleteMarketingCampaign']],
    ['karnety (dodawanie, edycja, usuwanie)', ['#showAddPass','#showDeletePass']],
    ['grafik pracy (dodawanie)', ['#showAddWorkScheduleBtn']],
    ['grafik pracy (edycja, usuwanie)', ['#showEditWorkScheduleBtn','#showDeleteWorkScheduleBtn']]
  ];

  const disableElementsForPermission = (permissionLabel, selectors, panelUser) => {
    if (hasSystemPermission(panelUser, permissionLabel)) return;
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.setAttribute('disabled', 'disabled');
        element.classList.add('cm-permission-disabled');
        element.title = 'Brak uprawnienia: ' + permissionLabel;
      });
    });
  };

  const enforceCurrentUserPermissions = (panelUser, page) => {
    if (!panelUser || panelUser.role === 'owner' || panelUser.role === 'admin') return;
    cmPermissionRules.forEach(([permissionLabel, selectors]) => disableElementsForPermission(permissionLabel, selectors, panelUser));
    if (!hasSystemPermission(panelUser, 'produkty (magazyn)')) {
      document.querySelectorAll('[data-product-filter="low"], [data-product-filter="high"], [data-product-filter="saleOnly"]').forEach(element => {
        element.hidden = true;
        element.style.display = 'none';
      });
    }
    if (!hasSystemPermission(panelUser, 'export danych z całej platformy')) {
      document.querySelectorAll('[data-report-export], [data-chart-export], .cm-sales-export-btn, .cm-report-export-btn, #exportCustomersBtn, #exportServicesBtn, #exportProductsBtn').forEach(element => {
        element.setAttribute('disabled', 'disabled');
        element.classList.add('cm-permission-disabled');
        element.title = 'Brak uprawnienia: export danych z całej platformy';
      });
    }
    if (!hasSystemPermission(panelUser, 'import danych do całej platformy')) {
      document.querySelectorAll('#importCustomersBtn, #importServicesBtn, #importProductsBtn, [data-import-btn]').forEach(element => {
        element.setAttribute('disabled', 'disabled');
        element.classList.add('cm-permission-disabled');
        element.title = 'Brak uprawnienia: import danych do całej platformy';
      });
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('#importCustomersBtn,#importServicesBtn,#importProductsBtn,[data-import-btn]');
    if (!target) return;
    const currentUser = getCurrentContext().user;
    if (currentUser && !['owner','admin'].includes(currentUser.role) && !hasSystemPermission(currentUser, 'import danych do całej platformy')) {
      event.preventDefault(); event.stopPropagation();
      alert('Brak uprawnienia: import danych do całej platformy');
    }
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-required-permission]');
    if (!target) return;
    const required = target.getAttribute('data-required-permission');
    const currentUser = getCurrentContext().user;
    if (required && currentUser && !['owner','admin'].includes(currentUser.role) && !hasSystemPermission(currentUser, required)) {
      event.preventDefault();
      event.stopPropagation();
      alert('Brak uprawnienia: ' + required);
    }
  }, true);

  document.addEventListener('click', (event) => {
    const disabled = event.target?.closest?.('.cm-permission-disabled,[disabled]');
    if (!disabled) return;
    const title = disabled.getAttribute('title') || 'Brak uprawnienia do tej akcji.';
    event.preventDefault();
    event.stopPropagation();
    if (title) alert(title);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-report-export], [data-chart-export], .cm-sales-export-btn, .cm-report-export-btn, #exportCustomersBtn, #exportServicesBtn, #exportProductsBtn');
    if (!target) return;
    const currentUser = getCurrentContext().user;
    if (currentUser && !['owner','admin'].includes(currentUser.role) && !hasSystemPermission(currentUser, 'export danych z całej platformy')) {
      event.preventDefault(); event.stopPropagation();
      alert('Brak uprawnienia: export danych z całej platformy');
    }
  }, true);

  const panelMenu = (panelUser, page) => {
    const items = [
      ['positions.html','positions','Stanowiska pracy'],
      ['employees.html','employees','Zespół'],
      ['days-off.html','daysOff','Dni wolne pracowników'],
      ['customers.html','customers','Klienci'],
      ['services.html','services','Usługi'],
      ['products.html','products','Produkty'],
      ['visits.html','visits','Wizyty'],
      ['walkins.html','walkins','Sprzedaż bez wizyty'],
      ['marketing.html','marketing','Marketing'],
      ['passes.html','passes','Karnety'],
      ['sales.html','sales','Sprzedaż']
    ].filter(item => canAccessPage(panelUser, item[1]));
    const links = items.map(([href,id,label]) => `<a href="${href}" class="${page===id?'active':''}">${label}</a>`).join('');
    return links;
  };

  const monthNamesPL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const monthNamesPLGenitive = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  const CM_TODAY = (() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); })();
  let cmCalendarDate = new Date(CM_TODAY.getFullYear(), CM_TODAY.getMonth(), 1);
  let cmYearStart = CM_TODAY.getFullYear();

  const formatDisplayDate = (date) => `${date.getDate()} ${monthNamesPLGenitive[date.getMonth()]} ${date.getFullYear()}`;
  const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sameDay = (a,b) => normalizeDate(a).getTime() === normalizeDate(b).getTime();

  const buildMonthCalendarHtml = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    let day = 1 - offset;
    let rows = '';
    for (let r = 0; r < 6; r++) {
      let cells = '';
      for (let c = 0; c < 7; c++, day++) {
        if (day < 1 || day > days) cells += '<td class="muted"></td>';
        else {
          const d = new Date(year, month, day);
          const isToday = sameDay(d, CM_TODAY);
          cells += `<td><button type="button" class="bm-date-btn ${isToday ? 'today' : ''}" data-day="${day}">${day}</button></td>`;
        }
      }
      rows += `<tr>${cells}</tr>`;
    }
    return `
      <div class="bm-month-head">
        <button type="button" id="cmPrevMonth" aria-label="Poprzedni miesiąc">‹</button>
        <strong id="cmYearToggle" title="Pokaż lata">${monthNamesPL[month]} ${year}</strong>
        <button type="button" id="cmNextMonth" aria-label="Następny miesiąc">›</button>
      </div>
      <table><thead><tr><th>Pn</th><th>Wt</th><th>Śr</th><th>Cz</th><th>Pt</th><th>So</th><th>N</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  const buildYearPickerHtml = () => {
    const minYear = new Date().getFullYear();
    const maxYear = new Date().getFullYear() + 20;
    cmYearStart = Math.max(minYear, Math.min(cmYearStart, maxYear - 11));
    let cells = '';
    for (let i = 0; i < 12; i++) {
      const y = cmYearStart + i;
      const disabled = y < minYear || y > maxYear;
      cells += `<button type="button" class="bm-year-btn ${y === cmCalendarDate.getFullYear() ? 'active' : ''}" data-year="${y}" ${disabled ? 'disabled' : ''}>${y}</button>`;
    }
    return `
      <div class="bm-month-head">
        <button type="button" id="cmPrevYears" aria-label="Poprzednie lata">‹</button>
        <strong>${cmYearStart}–${Math.min(cmYearStart + 11, maxYear)}</strong>
        <button type="button" id="cmNextYears" aria-label="Następne lata">›</button>
      </div>
      <div class="bm-year-grid">${cells}</div>`;
  };

  const renderMiniCalendar = () => {
    const month = document.querySelector('#monthCalendar');
    if (!month) return;
    month.dataset.mode = month.dataset.mode || 'month';
    month.innerHTML = month.dataset.mode === 'years' ? buildYearPickerHtml() : buildMonthCalendarHtml(cmCalendarDate);
  };

  const wireMiniCalendar = () => {
    const toggle = document.querySelector('#calendarToggle');
    const month = document.querySelector('#monthCalendar');
    if (!toggle || !month) return;
    renderMiniCalendar();
    const clock = document.querySelector('#liveClock');
    const updateClock = () => { if (clock) { const now = new Date(); clock.textContent = now.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); } };
    updateClock();
    if (!window.__cmClockStarted) { window.__cmClockStarted = true; setInterval(updateClock, 1000); }
    toggle.addEventListener('click', () => { month.hidden = !month.hidden; if (!month.hidden) renderMiniCalendar(); });
    month.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === 'cmPrevMonth') { cmCalendarDate.setMonth(cmCalendarDate.getMonth() - 1); renderMiniCalendar(); }
      if (target.id === 'cmNextMonth') { cmCalendarDate.setMonth(cmCalendarDate.getMonth() + 1); renderMiniCalendar(); }
      if (target.id === 'cmYearToggle') { month.dataset.mode = 'years'; cmYearStart = cmCalendarDate.getFullYear(); renderMiniCalendar(); }
      if (target.id === 'cmPrevYears') { cmYearStart -= 12; renderMiniCalendar(); }
      if (target.id === 'cmNextYears') { cmYearStart += 12; renderMiniCalendar(); }
      if (target.classList.contains('bm-year-btn')) { const y = Number(target.dataset.year); if (!Number.isNaN(y)) { cmCalendarDate = new Date(y, cmCalendarDate.getMonth(), 1); month.dataset.mode = 'month'; renderMiniCalendar(); } }
      if (target.classList.contains('bm-date-btn')) {
        const selected = Number(target.dataset.day);
        if (!Number.isNaN(selected)) {
          const d = new Date(cmCalendarDate.getFullYear(), cmCalendarDate.getMonth(), selected);
          toggle.querySelector('strong').textContent = formatDisplayDate(d);
          month.hidden = true;
        }
      }
    });
  };



  const cmTranslations = {
    'en-gb': {
      'Wybierz język':'Choose language',
      'CompanyManager — panel główny':'CompanyManager — dashboard',
      'Dashboard':'Dashboard',
      'Panel firmy':'Company panel',
      'Panel Firmy':'Company panel',
      'Firmy':'Companies',
      'Tylko właściciel':'Owner only',
      'Stanowiska pracy':'Job positions',
      'Zespół':'Team',
      'Dni wolne pracowników':'Employee days off',
      'Klienci':'Customers',
      'Usługi':'Services',
      'Produkty':'Products',
      'Wizyty':'Appointments',
      'Sprzedaż bez wizyty':'Sale without appointment',
      'Marketing':'Marketing',
      'Karnety':'Passes',
      'Właściciel strony':'Website owner',
      'Sprzedaż':'Sales',
      'Wykres/Statystyka':'Chart/Statistics',
      'Raport dzienny':'Daily report',
      'Raport z okresu':'Period report',
      'Raport z okresu I':'Period report I',
      'Pracownicy':'Employees',
      'Grafik pracy':'Work schedule',
      'SMS':'SMS',
      'Email':'Email',
      'Użytkownicy':'Users',
      'Wyloguj się':'Log out',
      'Cofnij Czas':'Undo time',
      'Dane firmy':'Company details',
      'Ustawienia powiadomień':'Notification settings',
      'Ustawienia programu':'Program settings',
      'Płatności':'Payments',
      'Płatności CompanyManager':'CompanyManager payments',
      'Godziny pracy Firmy':'Company working hours',
      'Godziny pracy salonu':'Business working hours',
      'Od':'From',
      'Do':'To',
      'do':'to',
      'Zapisy online - przerwa między wizytami*':'Online booking - break between appointments*',
      'bez przerwy':'no break',
      'Dodaj klienta':'Add customer',
      'wartości standardowe':'standard values',
      'Zgoda na reklamę':'Marketing consent',
      'Czas przechowywania danych':'Data retention period',
      'UWAGA: dane zostaną automatycznie usunięte po upływie określonego czasu!':'WARNING: data will be automatically deleted after the specified period!',
      'UWAGA: dane zostaną automatycznie usunięte dla określonego czasu!':'WARNING: data will be automatically deleted after the specified period!',
      'Wizyty, sprzedaż bez wizyty, stan kasy, raporty*':'Appointments, sales without appointment, cash balance, reports*',
      'nie usuwaj':'do not delete',
      '3 miesiące':'3 months',
      '6 miesięcy':'6 months',
      '12 miesięcy':'12 months',
      '24 miesiące':'24 months',
      '36 miesięcy':'36 months',
      'Metody płatności':'Payment methods',
      'Metoda':'Method',
      'Obrót':'Turnover',
      'Prowizja':'Commission',
      'Akcja':'Action',
      'gotówka':'cash',
      'obrót':'turnover',
      'prowizja':'commission',
      'domyślna':'default',
      'dodaj':'add',
      'Dodaj':'Add',
      'Edytuj':'Edit',
      'Usuń':'Delete',
      'Anuluj':'Cancel',
      'Zatwierdź':'Confirm',
      'Zapisz':'Save',
      'Zapisano.':'Saved.',
      'Szukaj:':'Search:',
      'Szukaj':'Search',
      'Pokaż':'Show',
      'Export':'Export',
      'Eksport':'Export',
      'Import':'Import',
      'Pozycje od':'Items from',
      'z':'of',
      'łącznie':'in total',
      'Łącznie':'In total',
      'Strona':'Page',
      'Nr':'No.',
      'Nazwa Firmy':'Company name',
      'Właściciel Firmy':'Company owner',
      'Pakiet':'Package',
      'Data wygaśnięcia pakietu':'Package expiry date',
      'aktywna':'active',
      'Nazwa':'Name',
      'Nazwa firmy':'Company name',
      'Właściciel':'Owner',
      'Imię i nazwisko':'Full name',
      'Login':'Login',
      'Numer telefonu':'Phone number',
      'Telefon':'Phone',
      'Adres email':'Email address',
      'Hasło':'Password',
      'Potwierdzenie hasła':'Confirm password',
      'Stanowisko pracy':'Job position',
      'Wybierz stanowisko pracy':'Select job position',
      'Rola':'Role',
      'Logowanie dozwolone':'Login allowed',
      'Funkcje logowania':'Login functions',
      'zablokuj logowanie':'block login',
      'Logowanie tylko w godzinach':'Login only during hours',
      'od':'from',
      'Uprawnienia':'Permissions',
      'Możliwość Otwierania zakładek:':'Ability to open tabs:',
      'Funkcje w systemie:':'System functions:',
      'Dziennik logowania':'Login log',
      'Data':'Date',
      'IP':'IP',
      'Status':'Status',
      'Przeglądarka internetowa':'Web browser',
      'ok':'ok',
      'błąd':'error',
      'zablokowane':'blocked',
      'poza godzinami':'outside hours',
      'Dodaj użytkownika':'Add user',
      'Usuń pracownika':'Delete employee',
      'Dodaj pracownika':'Add employee',
      'Opis stanowiska':'Position description',
      'Powiadomienia automatyczne SMS':'Automatic SMS notifications',
      'Powiadomienia automatyczne EMAIL':'Automatic email notifications',
      'powiadamiaj o wizytach przez SMS - 24h przed wizytą':'notify about appointments by SMS - 24h before appointment',
      'wyślij życzenia urodzinowe przez SMS - godz. 9:00 w dniu urodzin':'send birthday wishes by SMS - 9:00 on birthday',
      'wyślij SMS po dodaniu wizyty':'send SMS after adding appointment',
      'wyślij SMS po wizycie - 1h po zakończeniu wizyty':'send SMS after appointment - 1h after completion',
      'powiadamiaj o wizytach przez EMAIL - 24h przed wizytą':'notify about appointments by email - 24h before appointment',
      'wyślij życzenia urodzinowe przez EMAIL - godz. 9:00 w dniu urodzin':'send birthday wishes by email - 9:00 on birthday',
      'wyślij EMAIL po dodaniu wizyty':'send email after adding appointment',
      'wyślij EMAIL po wizycie - 1h po zakończeniu wizyty':'send email after appointment - 1h after completion',
      'Nadawca SMS':'SMS sender',
      'Nadawca Wiadomości':'Message sender',
      'Nadawca Wiadomosci':'Message sender',
      'Treść SMS':'SMS content',
      'Nadawca email':'Email sender',
      'Treść email':'Email content',
      'Dane do przelewu':'Bank transfer details',
      'Odbiorca':'Recipient',
      'Bank':'Bank',
      'Numer konta':'Account number',
      'W tytule proszę podać numery faktur.':'Please include invoice numbers in the transfer title.',
      'Lista ostatnich faktur':'Recent invoices',
      'Termin płatności':'Payment due date',
      'Faktura':'Invoice',
      'Treść':'Description',
      'Wartość (PLN)':'Value (PLN)',
      'Pobierz':'Download',
      'Płatność':'Payment',
      'Dokumenty związane z serwisem CompanyManager':'Documents related to CompanyManager',
      'Regulamin':'Terms and conditions',
      'Cennik':'Price list',
      'Polityka Prywatności':'Privacy policy',
      'Informacja o przetwarzaniu danych osobowych':'Information on personal data processing',
      'Pokaż':'Show',
      'Pakiet i osoba do kontaktu':'Package and contact person',
      'Data ważności':'Valid until',
      'Osoba do kontaktu':'Contact person',
      'Nr telefonu':'Phone number',
      'Adres email powiadomienia':'Notification email address',
      'Adres':'Address',
      'Kod pocztowy':'Postcode',
      'Miejscowość':'Town/City',
      'Telefon firmowy':'Company phone',
      'Email firmowy':'Company email',
      'Dane do faktury VAT':'VAT invoice details',
      'Pełna nazwa firmy':'Full company name',
      'Adres ul.':'Street address',
      'NIP / VAT EU':'Tax/VAT EU number',
      'Adres email - wysyłka faktur':'Invoice delivery email',
      'Planowane wizyty według klientów':'Planned appointments by customer',
      'Planowane wizyty według kategorii usług':'Planned appointments by service category',
      'Zakończone wizyty':'Completed appointments',
      'Godziny pracy pracowników':'Employee working hours',
      'Obsługa klientów według pracowników':'Customer service by employee',
      'Wypłacone zaliczki':'Paid advances',
      'bieżący miesiąc':'current month',
      'bieżący tydzień':'current week',
      'dziś':'today',
      'wczoraj':'yesterday',
      'poprzedni tydzień':'previous week',
      'ostatnie 7 dni':'last 7 days',
      'ostatnie 14 dni':'last 14 days',
      'poprzedni miesiąc':'previous month',
      'ostatnie 30 dni':'last 30 days',
      'ostatnie 90 dni':'last 90 days',
      'bieżący rok':'current year',
      'poprzedni rok':'previous year',
      'ostatnie 365 dni':'last 365 days',
      'własny zakres':'custom range',
      'Pracownik':'Employee',
      'Klient':'Customer',
      'Kategoria usługi':'Service category',
      'Nazwa usługi':'Service name',
      'Wartość':'Value',
      'Kategoria produktu':'Product category',
      'Nazwa produktu':'Product name',
      'Liczba':'Count',
      'Wartość PLN':'Value PLN',
      'Typ płatności':'Payment type',
      'Procent':'Percentage',
      'Nie znaleziono żadnych danych':'No data found',
      'Brak dostępu':'No access',
      'brak dostępu':'no access',
      'Data sprzedaży':'Sale date',
      'Liczba usług':'Number of services',
      'Wartość usług':'Services value',
      'Liczba produktów':'Number of products',
      'Wartość produktów':'Products value',
      'Liczba szt.':'Number of items',
      'Wartość płatności':'Payment value',
      'Liczba płatności':'Number of payments',
      'Data urodzenia':'Date of birth',
      'Płeć':'Gender',
      'Aktualizacja':'Updated',
      'Ostatnia wizyta':'Last appointment',
      'Ważna informacja':'Important information',
      'aktywny':'active',
      'kobieta':'female',
      'mężczyzna':'male',
      'niezakończone':'unfinished',
      'zakończone':'completed',
      'zaplanowane':'planned',
      'odwołane':'cancelled',
      'usunięte':'deleted',
      'Pokaż wizyty:':'Show appointments:',
      'Godzina':'Time',
      'Usługa':'Service',
      'Produkt/usługa':'Product/service',
      'Kwota':'Amount',
      'Poniedziałek':'Monday',
      'Wtorek':'Tuesday',
      'Środa':'Wednesday',
      'Czwartek':'Thursday',
      'Piątek':'Friday',
      'Sobota':'Saturday',
      'Niedziela':'Sunday',
      'poniedziałek':'Monday',
      'wtorek':'Tuesday',
      'środa':'Wednesday',
      'czwartek':'Thursday',
      'piątek':'Friday',
      'sobota':'Saturday',
      'niedziela':'Sunday',
      'Dodaj grafik':'Add schedule',
      'Nazwa*':'Name*',
      'Godziny pracy':'Working hours',
      'Wybierz grafik do edycji':'Select schedule to edit',
      'Wybierz grafik do usunięcia':'Select schedule to delete',
      'Brak zapisanych grafików.':'No saved schedules.',
      'Dodaj metodę płatności':'Add payment method',
      'np. przelew':'e.g. bank transfer',
      'Np. +48321321321':'e.g. +48321321321',
      'Created by':'Created by'
    }
  };

  // v194: extended GB dictionary for full-interface translation coverage.
  Object.assign(cmTranslations['en-gb'], {
    'Liczba:':'Count:',
    'Liczba usług:':'Number of services:',
    'Wartość usług:':'Services value:',
    'Liczba produktów:':'Number of products:',
    'Wartość produktów:':'Products value:',
    'Liczba szt.:':'Number of items:',
    'Wartość:':'Value:',
    'Liczba płatności:':'Number of payments:',
    'Wartość płatności:':'Payments value:',
    'L. godzin':'Hours total',
    'Ilość':'Quantity',
    'L.szt.':'Qty',
    'Szt.':'Qty',
    'Cena':'Price',
    'Razem':'Total',
    'Suma':'Total',
    'Opis':'Description',
    'Notatka':'Note',
    'Brak':'None',
    '(brak)':'(none)',
    'brak':'none',
    'brak danych':'no data',
    'wybierz':'select',
    'Wybrano':'Selected',
    'Wybrano:':'Selected:',
    'Kategorie usług':'Service categories',
    'Kategorie produktów':'Product categories',
    'Pracownicy':'Employees',
    'Produkty według nazw':'Products by name',
    'Produkty według kategorii':'Products by category',
    'Produkty według pracowników':'Products by employee',
    'Usługi według nazw':'Services by name',
    'Usługi według kategorii':'Services by category',
    'Usługi według pracowników':'Services by employee',
    'Karnety według pracowników':'Passes by employee',
    'Płatności według typów':'Payments by type',
    'Sprzedaż usług':'Service sales',
    'Sprzedaż usług według nazw':'Service sales by name',
    'Sprzedaż usług według kategorii':'Service sales by category',
    'Sprzedaż usług według pracowników':'Service sales by employee',
    'Sprzedaż produktów':'Product sales',
    'Sprzedaż produktów według nazw':'Product sales by name',
    'Sprzedaż produktów według kategorii':'Product sales by category',
    'Sprzedaż produktów według pracowników':'Product sales by employee',
    'Sprzedaż - karnety':'Pass sales',
    'Sprzedaż - karnety według pracowników':'Pass sales by employee',
    'Płatności według typów':'Payments by type',
    'Sprzedane produkty w tym dniu':'Products sold on this day',
    'Stan kasy':'Cash register balance',
    'Raporty':'Reports',
    'Raport':'Report',
    'Dzisiaj':'Today',
    'Jutro':'Tomorrow',
    'Jutrzejszy':'Tomorrow',
    'Wczorajszy':'Yesterday',
    'Raport dzienny dzisiejszy':'Today’s daily report',
    'Raport dzienny wczorajszy, jutrzejszy':'Yesterday’s and tomorrow’s daily report',
    'Planowane wizyty':'Planned appointments',
    'Wizyta':'Appointment',
    'Dodaj wizytę':'Add appointment',
    'Edytuj wizytę':'Edit appointment',
    'Usuń wizytę':'Delete appointment',
    'Zakończ wizytę':'Complete appointment',
    'Odwołaj wizytę':'Cancel appointment',
    'Historia wizyt':'Appointment history',
    'Historia klientów':'Customer history',
    'Historia sprzedaży':'Sales history',
    'Sprzedaż bez wizyt':'Sales without appointments',
    'Dodaj sprzedaż':'Add sale',
    'Usuń sprzedaż':'Delete sale',
    'Edytuj sprzedaż':'Edit sale',
    'Po wizycie':'After appointment',
    'Po dodaniu wizyty':'After adding appointment',
    'Urodziny':'Birthday',
    'Życzenia urodzinowe':'Birthday wishes',
    'Powiadomienia':'Notifications',
    'Ustawienia':'Settings',
    'Godziny':'Hours',
    'Godzina rozpoczęcia':'Start time',
    'Godzina zakończenia':'End time',
    'Dni wolne':'Days off',
    'Dodaj dzień wolny':'Add day off',
    'Usuń dzień wolny':'Delete day off',
    'Edytuj dzień wolny':'Edit day off',
    'Data od':'Date from',
    'Data do':'Date to',
    'Zakres dat':'Date range',
    'Bieżący miesiąc':'Current month',
    'Nazwa produktu':'Product name',
    'Nazwa kategorii':'Category name',
    'Kategoria':'Category',
    'Stan magazynu':'Stock level',
    'Magazyn':'Stock',
    'Dostawy':'Deliveries',
    'Mało na magazynie':'Low stock',
    'Dużo na magazynie':'High stock',
    'Tylko do sprzedaży':'Sale only',
    'Dodaj produkt':'Add product',
    'Edytuj produkt':'Edit product',
    'Usuń produkt':'Delete product',
    'Dodaj usługę':'Add service',
    'Edytuj usługę':'Edit service',
    'Usuń usługę':'Delete service',
    'Dodaj karnet':'Add pass',
    'Edytuj karnet':'Edit pass',
    'Usuń karnet':'Delete pass',
    'Dodaj stanowisko':'Add position',
    'Edytuj stanowisko':'Edit position',
    'Usuń stanowisko':'Delete position',
    'Pełny dostęp':'Full access',
    'Zarządzanie operacyjne':'Operational management',
    'Dostęp pracowniczy':'Employee access',
    'Podgląd':'Preview',
    'Tytuł':'Title',
    'Temat':'Subject',
    'Nadawca':'Sender',
    'Odbiorca':'Recipient',
    'Treść wiadomości':'Message content',
    'Wyślij':'Send',
    'wysłane':'sent',
    'zakończona':'completed',
    'zakończony':'completed',
    'odwołana':'cancelled',
    'dzień wolny':'day off',
    'Adres email*':'Email address*',
    'Hasło*':'Password*',
    'Potwierdzenie hasła*':'Confirm password*',
    'Imię i nazwisko*':'Full name*',
    'Nr telefonu*':'Phone number*',
    'Nazwa*':'Name*',
    'Pełna nazwa firmy*':'Full company name*',
    'NIP / VAT EU':'Tax/VAT EU number',
    'Kod pocztowy*':'Postcode*',
    'Miejscowość*':'Town/City*',
    'Adres*':'Address*',
    'Zablokuj logowanie':'Block login',
    'Login tylko w godzinach':'Login only during hours',
    'Funkcje w systemie':'System functions',
    'Możliwość Otwierania zakładek':'Ability to open tabs',
    'stanowiska pracy (dodawanie, edycja, usuwanie)':'job positions (add, edit, delete)',
    'Zespół - użytkownicy (dodawanie, edycja, usuwanie)':'Team - users (add, edit, delete)',
    'dni wolne (dodawanie)':'days off (add)',
    'dni wolne (usuwanie, edycja)':'days off (delete, edit)',
    'klienci (dodawanie, edycja, usuwanie)':'customers (add, edit, delete)',
    'klienci - historia (przeglądanie historii klientów - tabeli poniżej)':'customers - history (view customer history - table below)',
    'usługi (dodawanie, edycja, usuwanie)':'services (add, edit, delete)',
    'produkty (dodawanie, edycja, usuwanie)':'products (add, edit, delete)',
    'produkty (magazyn)':'products (stock)',
    'wizyty (dodawanie, edycja, zakończenie, usuwanie)':'appointments (add, edit, complete, delete)',
    'wizyty (niezakończone) - dostęp do historii':'appointments (unfinished) - history access',
    'wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)':'unfinished appointments (add, edit, delete / cancel)',
    'wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)':'appointments (completed, planned, cancelled, deleted) - history access (table below)',
    'sprzedaż bez wizyt (dodawanie, edycja, usuwanie)':'sales without appointments (add, edit, delete)',
    'sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)':'sales without appointments (history access - table below)',
    'marketing (wysyłka reklamy sms/email/usuń)':'marketing (send SMS/email advertising/delete)',
    'karnety (dodawanie, edycja, usuwanie)':'passes (add, edit, delete)',
    'raport dzienny dzisiejszy (przeglądanie)':'today’s daily report (view)',
    'raport dzienny wczorajszy, jutrzejszy (przeglądanie)':'yesterday’s/tomorrow’s daily report (view)',
    'grafik pracy (dodawanie)':'work schedule (add)',
    'grafik pracy (edycja, usuwanie)':'work schedule (edit, delete)',
    'dostęp do raportów':'access to reports',
    'export danych z całej platformy':'export data from entire platform',
    'import danych do całej platformy':'import data to entire platform',
    'brak dostępu do historii klientów':'no access to customer history',
    'Brak dostępu do historii klientów':'No access to customer history',
    'Brak dostępu do historii wizyt':'No access to appointment history',
    'Brak dostępu do historii sprzedaży':'No access to sales history',
    'Nie masz uprawnień do wykonania tej akcji.':'You do not have permission to perform this action.',
    'Nie masz uprawnień do dodawania.':'You do not have permission to add.',
    'Nie masz uprawnień do edycji.':'You do not have permission to edit.',
    'Nie masz uprawnień do usuwania.':'You do not have permission to delete.',
    'Nie masz uprawnień do eksportu danych.':'You do not have permission to export data.',
    'Nie masz uprawnień do importu danych.':'You do not have permission to import data.'
  });


  // v195: additional GB translations reported from live screens (tables, reports, statuses, filters).
  Object.assign(cmTranslations['en-gb'], {
    'Aktywne':'Active',
    'Akcje':'Actions',
    'Stanowisko':'Position',
    'Imie Nazwisko':'Full name',
    'Imię Nazwisko':'Full name',
    'Lista klientów':'Customer list',
    'Kod usługi':'Service code',
    'Kod produktu':'Product code',
    'Firma':'Company',
    'Szukaj...':'Search...',
    'Stan':'Status',
    'Stan magazynowy':'Stock level',
    'Kampania':'Campaign',
    'Date i godzina wysłania':'Send date and time',
    'Data i godzina wysłania':'Send date and time',
    'OPIS':'DESCRIPTION',
    'Opis':'Description',
    'L. klientów':'No. of customers',
    'Grupa Customerów':'Customer group',
    'Grupa klientów':'Customer group',
    'pokaż wszystkie':'show all',
    'aktualne':'current',
    'zrealizowane':'completed',
    'po terminie':'overdue',
    '50 pozycji na stronę':'50 items per page',
    '100 pozycji na stronę':'100 items per page',
    '200 pozycji na stronę':'200 items per page',
    'Ważności do':'Valid until',
    'Ważny do':'Valid until',
    'Kto kupił':'Purchased by',
    'Pozostała kwota (PLN)':'Remaining amount (PLN)',
    'Zapisało się klientów':'Customers signed up',
    'Wykres':'Chart',
    'Grupuj według':'Group by',
    'L. wizyt':'No. of appointments',
    'L. usług':'No. of services',
    'Powody odwołania wizyt':'Appointment cancellation reasons',
    'Finanse':'Finance',
    'łączny turnover w wybranym dniu':'total turnover on selected day',
    'łączny obrót w wybranym dniu':'total turnover on selected day',
    'karta kredytowa':'credit card',
    'karnet':'pass',
    'pakiet':'package',
    'płatności gotówką':'cash payments',
    'Sprzedane karnety':'Passes sold',
    'Liczba zaplanowanych wizyt':'Number of planned appointments',
    'Liczba zakończonych wizyt':'Number of completed appointments',
    'Liczba odwołanych wizyt':'Number of cancelled appointments',
    'Count zaplanowanych wizyt':'Number of planned appointments',
    'Count completedch wizyt':'Number of completed appointments',
    'Count odwołanych wizyt':'Number of cancelled appointments',
    '- wszyscy -':'- all -',
    'wszyscy':'all',
    'Products liczba':'Products count',
    'Products wartość':'Products value',
    'Produkty liczba':'Products count',
    'Produkty wartość':'Products value',
    'Passes liczba':'Passes count',
    'Passes wartość':'Passes value',
    'Karnety liczba':'Passes count',
    'Karnety wartość':'Passes value',
    'urlop':'holiday',
    'szkolenie':'training',
    'zwolnienie lekarskie':'sick leave',
    'SUMA':'TOTAL',
    'Miesiąc':'Month',
    'Count wysłanych SMS':'Number of SMS sent',
    'Liczba wysłanych SMS':'Number of SMS sent',
    'Value (PLN)':'Value (PLN)',
    'wartość':'value',
    'liczba':'count',
    'Wartość':'Value',
    'Liczba':'Count',
    'zakończonych':'completed',
    'zaplanowanych':'planned',
    'odwołanych':'cancelled',
    'wysłanych':'sent',
    'Wysłane':'Sent',
    'Wysyłka':'Sending',
    'Wysłano':'Sent',
    'Nie wysłano':'Not sent',
    'Pozostało':'Remaining',
    'Ważność':'Validity',
    'Kategoria usług':'Service category',
    'Kategorie':'Categories',
    'Przeglądanie':'Viewing',
    'Tabela':'Table',
    'Poniżej':'Below',
    'Data ważności':'Expiry date',
    'Data wygaśnięcia':'Expiry date',
    'Stanowisko pracy':'Job position',
    'Stanowiska':'Positions',
    'Lista':'List',
    'Konto':'Account',
    'Firma / klient':'Company / customer',
    'Nazwa kampanii':'Campaign name',
    'Data wysłania':'Send date',
    'Godzina wysłania':'Send time',
    'Grupa':'Group',
    'Klientów':'Customers',
    'Klienci':'Customers',
    'Customerów':'Customers',
    'pozycji na stronę':'items per page'
  });

  Object.assign(cmTranslations['en-gb'], {
    'Logowanie — CompanyManager':'Login — CompanyManager',
    'Rejestracja — CompanyManager':'Registration — CompanyManager',
    'Regulamin — CompanyManager':'Terms and conditions — CompanyManager',
    'Polityka prywatności — CompanyManager':'Privacy policy — CompanyManager',
    'Informacja o przetwarzaniu danych — CompanyManager':'Personal data processing information — CompanyManager',
    'Logowanie':'Login',
    'Rejestracja':'Registration',
    'Polityka Prywatności':'Privacy Policy',
    'RODO':'GDPR',
    'Cennik CompanyManager':'CompanyManager pricing',
    'Cennik CompanyManager — wybierz pakiet*':'CompanyManager pricing — select a package*',
    '100 PLN netto':'100 PLN net',
    '175 PLN netto':'175 PLN net',
    '300 PLN netto':'300 PLN net',
    '500 PLN netto':'500 PLN net',
    '0,10 PLN netto / szt.':'0.10 PLN net / item',
    '0,40 PLN netto / szt.':'0.40 PLN net / item',
    'SMS Polska:':'SMS Poland:',
    'SMS zagranica:':'International SMS:',
    'Do cen należy doliczyć 23% VAT.':'23% VAT must be added to the prices.',
    'Zaloguj się':'Log in',
    'Wejdź do panelu CompanyManager i zarządzaj firmą z poziomu przeglądarki.':'Access the CompanyManager panel and manage your company from a browser.',
    'Login lub adres email':'Login or email address',
    'Hasło':'Password',
    'Logowanie poprawne. Przenoszę do panelu firmy.':'Login successful. Redirecting to the company panel.',
    'Nie pamiętasz hasła?':'Forgot your password?',
    'Utwórz firmę':'Create a company',
    'System dla firm':'System for companies',
    'Zarejestruj firmę w CompanyManager.':'Register your company in CompanyManager.',
    'Jedno miejsce do zarządzania klientami, pracownikami, rezerwacjami, powiadomieniami i organizacją firmy.':'One place to manage customers, employees, bookings, notifications and company organization.',
    'Dla firm usługowych, lokalnych, handlowych, edukacyjnych, automotive i wszystkich firm które pragną zarządzać swoją firmą szybko, przejrzyście i wygodnie.':'For service, local, retail, educational, automotive companies and every business that wants to manage its company quickly, clearly and conveniently.',
    'Panel właściciela firmy, administratorów i pracowników.':'Panel for the company owner, administrators and employees.',
    'Aplikacja przeglądarkowa dostępna online po zalogowaniu.':'Browser application available online after logging in.',
    'klienci':'customers',
    'powiadomienia':'notifications',
    'firmy':'companies',
    'Utwórz konto właściciela i dodaj podstawowe dane firmy.':'Create the owner account and add basic company details.',
    'Użytkownik / właściciel firmy':'User / company owner',
    'Adres email*':'Email address*',
    'Nr telefonu*':'Phone number*',
    'Hasło*':'Password*',
    'Potwierdzenie hasła*':'Confirm password*',
    'Imię i nazwisko*':'Full name*',
    'Dane adresowe firmy':'Company address details',
    'Nazwa firmy*':'Company name*',
    'Adres*':'Address*',
    'Kod pocztowy*':'Postcode*',
    'Format: XX-XXX':'Format: XX-XXX',
    'Miejscowość*':'City/Town*',
    'Telefony kontaktowe*':'Contact phone numbers*',
    'Email firmowy':'Company email',
    'Pracownicy*':'Employees*',
    'Wpisz pracowników firmy. Później możesz zarządzać nimi w panelu.':'Enter company employees. You can manage them later in the panel.',
    'Nadawca SMS*':'SMS sender*',
    'Nadawca Wiadomości*':'Message sender*',
    'Nadawca Wiadomosci*':'Message sender*',
    'Uzupełniając pole „Nadawca SMS” oświadczasz, że posiadasz prawo do używania wskazanego oznaczenia jako nadawcy wiadomości SMS generowanych na zlecenie firmy.':'By completing the “SMS sender” field, you confirm that you have the right to use the specified name as the sender of SMS messages generated on behalf of the company.',
    'Dane do faktury':'Invoice details',
    'Pełna nazwa firmy*':'Full company name*',
    'NIP / VAT EU':'Tax ID / VAT EU',
    'Wybierz jeden pakiet abonamentowy. Bez wyboru pakietu rejestracja nie przejdzie dalej.':'Select one subscription package. Registration cannot continue without selecting a package.',
    'Regulamin i dokumenty':'Terms and documents',
    'Oświadczam, że zapoznałem/am się z':'I confirm that I have read the',
    'Regulaminem':'Terms and conditions',
    'i akceptuję jego treść*':'and accept its content*',
    'Informacją o przetwarzaniu danych osobowych':'Information on personal data processing',
    'Polityką Prywatności':'Privacy Policy',
    'Utwórz konto firmy':'Create company account',
    'Masz już konto?':'Already have an account?',
    'Np. Imię i nazwisko — stanowisko / rola':'E.g. full name — position / role',
    'Adres firmy':'Company address',
    'Kod pocztowy firmy':'Company postcode',
    'Miejscowość firmy':'Company city/town',
    'Telefony kontaktowe':'Contact phone numbers',
    'Adres do faktury':'Invoice address',
    'Kod pocztowy do faktury':'Invoice postcode',
    'Miejscowość do faktury':'Invoice city/town',
    'Pakiet cenowy':'Pricing package',
    'Regulamin korzystania z serwisu CompanyManager':'Terms of use for the CompanyManager service',
    'Regulamin świadczenia usług drogą elektroniczną. Wersja robocza v0.2.1.':'Terms for providing electronic services. Draft version v0.2.1.',
    '§1 Postanowienia ogólne':'§1 General provisions',
    'Niniejszy regulamin określa zasady korzystania z internetowego serwisu CompanyManager, dostępnego w formie aplikacji przeglądarkowej. Operatorem serwisu jest [NAZWA OPERATORA] z siedzibą pod adresem [ADRES], NIP [NIP], REGON [REGON], adres e-mail: [EMAIL].':'These terms define the rules for using the CompanyManager online service, available as a browser application. The service operator is [OPERATOR NAME], with its registered office at [ADDRESS], Tax ID [NIP], REGON [REGON], email address: [EMAIL].',
    'Serwis CompanyManager umożliwia firmom zarządzanie wybranymi procesami organizacyjnymi, w szczególności klientami, pracownikami, rezerwacjami, usługami, powiadomieniami, raportami i danymi firmowymi.':'The CompanyManager service enables companies to manage selected organizational processes, especially customers, employees, bookings, services, notifications, reports and company data.',
    '§2 Definicje':'§2 Definitions',
    'Serwis — aplikacja internetowa CompanyManager.':'Service — the CompanyManager web application.',
    'Operator — podmiot świadczący usługę drogą elektroniczną w ramach Serwisu.':'Operator — the entity providing electronic services within the Service.',
    'Użytkownik — przedsiębiorca, firma, organizacja lub osoba działająca w imieniu firmy korzystającej z Serwisu.':'User — an entrepreneur, company, organization or person acting on behalf of a company using the Service.',
    'Firma — podmiot gospodarczy, organizacja lub osoba prowadząca działalność, która wykorzystuje Serwis do zarządzania procesami biznesowymi.':'Company — a business entity, organization or person conducting activity that uses the Service to manage business processes.',
    'Konto — indywidualny dostęp do Serwisu zabezpieczony loginem i hasłem.':'Account — individual access to the Service protected by a login and password.',
    'Cennik — aktualny wykaz opłat za korzystanie z Serwisu oraz usług dodatkowych.':'Price list — the current list of fees for using the Service and additional services.',
    '§3 Rejestracja i konto':'§3 Registration and account',
    'Przed rozpoczęciem korzystania z Serwisu Użytkownik wypełnia formularz rejestracyjny, podając dane właściciela lub osoby reprezentującej firmę, dane adresowe firmy, dane do faktury oraz ustawienia powiadomień. Podane dane powinny być zgodne ze stanem faktycznym i prawnym.':'Before using the Service, the User completes the registration form, providing the details of the owner or person representing the company, company address details, invoice details and notification settings. The data provided should reflect the factual and legal situation.',
    'Loginem Użytkownika jest adres e-mail. Użytkownik zobowiązuje się do zachowania poufności hasła i nieudostępniania go osobom nieuprawnionym.':'The User login is the email address. The User undertakes to keep the password confidential and not disclose it to unauthorized persons.',
    'Hasło powinno spełniać aktualne wymagania bezpieczeństwa określone przez Operatora. Operator może wymagać zmiany hasła, jeżeli jest to uzasadnione względami bezpieczeństwa.':'The password should meet the current security requirements specified by the Operator. The Operator may require a password change if justified by security reasons.',
    'Użytkownik jest zobowiązany do aktualizowania danych konta i danych firmy w przypadku ich zmiany.':'The User is obliged to update account and company data if they change.',
    '§4 Usługi świadczone w Serwisie':'§4 Services provided within the Service',
    'Serwis może obejmować w szczególności tworzenie baz klientów, pracowników, usług, produktów i rezerwacji, wyszukiwanie danych według filtrów, prowadzenie historii kontaktów, wysyłkę SMS i e-mail, tworzenie raportów, grafików pracy oraz obsługę powiadomień o terminach.':'The Service may include, in particular, creating databases of customers, employees, services, products and bookings, searching data by filters, maintaining contact history, sending SMS and email, creating reports, work schedules and handling appointment notifications.',
    'Zakres funkcjonalności Serwisu może być rozwijany, zmieniany lub rozszerzany przez Operatora, w szczególności o nowe moduły, raporty, integracje, powiadomienia, płatności lub inne narzędzia wspierające zarządzanie firmą.':'The functionality of the Service may be developed, changed or expanded by the Operator, in particular with new modules, reports, integrations, notifications, payments or other tools supporting company management.',
    '§5 Zasady korzystania':'§5 Rules of use',
    'Serwis działa online i wymaga dostępu do Internetu oraz aktualnej przeglądarki internetowej.':'The Service operates online and requires Internet access and an up-to-date web browser.',
    'Użytkownik nie może wykorzystywać Serwisu w sposób naruszający przepisy prawa, prawa osób trzecich, bezpieczeństwo danych lub dobre imię Operatora.':'The User may not use the Service in a manner that violates the law, third-party rights, data security or the good name of the Operator.',
    'Użytkownik ponosi odpowiedzialność za treści wiadomości SMS i e-mail wysyłanych za pomocą Serwisu oraz za posiadanie wymaganych podstaw prawnych, zgód lub uprawnień do kontaktu z odbiorcami.':'The User is responsible for the content of SMS and email messages sent through the Service and for having the required legal basis, consents or permissions to contact recipients.',
    'Użytkownik nie może podejmować działań prowadzących do przeciążania Serwisu, obchodzenia zabezpieczeń, uzyskiwania nieuprawnionego dostępu do danych lub zakłócania pracy systemu.':'The User may not take actions that lead to overloading the Service, bypassing security, obtaining unauthorized access to data or disrupting system operation.',
    '§6 Płatności':'§6 Payments',
    'Korzystanie z Serwisu jest płatne zgodnie z aktualnym Cennikiem. Ceny mogą obejmować dostęp do Serwisu na wybrany okres oraz usługi dodatkowe, w szczególności wysyłkę SMS.':'Use of the Service is paid according to the current Price List. Prices may include access to the Service for a selected period and additional services, especially SMS sending.',
    'Po zakończeniu okresu testowego lub po upływie opłaconego okresu dostęp do wybranych funkcji może zostać ograniczony do czasu uregulowania płatności.':'After the trial period or after the paid period expires, access to selected functions may be limited until payment is settled.',
    'Brak opłaty w wymaganym terminie może skutkować ograniczeniem, zawieszeniem lub zakończeniem świadczenia usług.':'Failure to pay by the required deadline may result in limitation, suspension or termination of services.',
    'Opłaty za niewykorzystany okres abonamentu nie podlegają zwrotowi, chyba że przepisy prawa stanowią inaczej albo Operator postanowi inaczej w indywidualnym przypadku.':'Fees for an unused subscription period are non-refundable unless the law provides otherwise or the Operator decides otherwise in an individual case.',
    '§7 Dostępność, bezpieczeństwo i kopie danych':'§7 Availability, security and data backups',
    'Operator podejmuje działania mające na celu zapewnienie prawidłowego i bezpiecznego działania Serwisu.':'The Operator takes actions to ensure proper and secure operation of the Service.',
    'Operator zastrzega możliwość czasowej niedostępności Serwisu wynikającej z prac technicznych, aktualizacji, awarii, działań dostawców zewnętrznych lub zdarzeń niezależnych od Operatora.':'The Operator reserves the right for temporary unavailability of the Service due to technical work, updates, failures, actions of external providers or events beyond the Operator’s control.',
    'Operator wykonuje działania mające na celu ochronę danych, jednak Użytkownik przyjmuje do wiadomości, że powinien przechowywać kopie najważniejszych informacji poza Serwisem, jeżeli są one istotne dla prowadzenia jego działalności.':'The Operator takes actions to protect data; however, the User acknowledges that they should keep copies of the most important information outside the Service if it is important for their business operations.',
    '§8 Reklamacje':'§8 Complaints',
    'Reklamacje dotyczące działania Serwisu można zgłaszać elektronicznie na adres [EMAIL]. Reklamacja powinna zawierać opis problemu, dane konta oraz adres e-mail do kontaktu.':'Complaints regarding the operation of the Service may be submitted electronically to [EMAIL]. A complaint should include a description of the problem, account details and a contact email address.',
    'Operator rozpatruje reklamację w terminie 14 dni od otrzymania prawidłowego zgłoszenia. Jeżeli reklamacja wymaga uzupełnienia, termin może biec od dnia otrzymania kompletnych informacji.':'The Operator reviews complaints within 14 days of receiving a valid submission. If the complaint requires supplementation, the period may run from the day complete information is received.',
    '§9 Ochrona danych':'§9 Data protection',
    'Operator przetwarza dane osobowe zgodnie z obowiązującymi przepisami prawa oraz dokumentami: Informacja o przetwarzaniu danych osobowych i Polityka Prywatności.':'The Operator processes personal data in accordance with applicable law and the documents: Information on personal data processing and Privacy Policy.',
    'Dane wprowadzone przez Użytkownika do Serwisu pozostają danymi Użytkownika.':'Data entered by the User into the Service remains the User’s data.',
    'W zakresie danych osobowych klientów, pracowników lub innych osób wprowadzanych przez Użytkownika do Serwisu, Użytkownik pozostaje administratorem tych danych, a Operator działa jako podmiot przetwarzający dane na zlecenie Użytkownika.':'With regard to personal data of customers, employees or other persons entered by the User into the Service, the User remains the controller of that data and the Operator acts as a processor on behalf of the User.',
    'Szczegółowe zasady powierzenia przetwarzania danych osobowych mogą zostać określone w odrębnej umowie powierzenia lub załączniku do Regulaminu.':'Detailed rules for entrusting personal data processing may be defined in a separate data processing agreement or appendix to the Terms.',
    '§10 Rezygnacja i usunięcie konta':'§10 Resignation and account deletion',
    'Użytkownik może zrezygnować z korzystania z Serwisu, kontaktując się z Operatorem na adres [EMAIL] lub korzystając z funkcji dostępnych w Serwisie, jeżeli zostaną udostępnione.':'The User may resign from using the Service by contacting the Operator at [EMAIL] or using functions available in the Service, if provided.',
    'Po zakończeniu świadczenia usług dane mogą zostać usunięte po upływie okresu określonego przez Operatora, z uwzględnieniem obowiązków wynikających z przepisów prawa, rozliczeń, bezpieczeństwa oraz dochodzenia lub obrony roszczeń.':'After the services end, data may be deleted after the period specified by the Operator, taking into account legal obligations, settlements, security and pursuing or defending claims.',
    '§11 Odpowiedzialność':'§11 Liability',
    'Operator podejmuje działania w celu zapewnienia prawidłowego działania Serwisu, jednak nie odpowiada za szkody wynikające z nieprawidłowego korzystania z Serwisu, awarii sprzętu lub oprogramowania Użytkownika, działania siły wyższej, działań dostawców zewnętrznych albo ujawnienia hasła osobom trzecim przez Użytkownika.':'The Operator takes actions to ensure proper operation of the Service, but is not liable for damages resulting from improper use of the Service, failures of the User’s hardware or software, force majeure, actions of external providers or disclosure of the password to third parties by the User.',
    'Operator nie odpowiada za treści, dane i komunikaty wprowadzane lub wysyłane przez Użytkownika za pomocą Serwisu.':'The Operator is not responsible for content, data and messages entered or sent by the User through the Service.',
    '§12 Postanowienia końcowe':'§12 Final provisions',
    'Operator może zmieniać Regulamin, informując Użytkowników o istotnych zmianach drogą elektroniczną lub w Serwisie.':'The Operator may change the Terms by informing Users about significant changes electronically or in the Service.',
    'W sprawach nieuregulowanych zastosowanie mają przepisy prawa polskiego.':'Polish law applies to matters not regulated herein.',
    'Wróć do rejestracji':'Back to registration',
    'Polityka Prywatności CompanyManager':'CompanyManager Privacy Policy',
    'Wersja robocza v0.2.1.':'Draft version v0.2.1.',
    '[NAZWA OPERATORA] szanuje prawo do prywatności użytkowników i stosuje środki techniczne oraz organizacyjne mające chronić dane osobowe przetwarzane w ramach serwisu CompanyManager.':'[OPERATOR NAME] respects users’ right to privacy and applies technical and organizational measures to protect personal data processed within the CompanyManager service.',
    'Administrator danych':'Data controller',
    'Administratorem danych osobowych użytkowników Serwisu jest [NAZWA OPERATORA], [ADRES], NIP [NIP], REGON [REGON]. Kontakt z Operatorem jest możliwy pod adresem: [EMAIL].':'The controller of Service users’ personal data is [OPERATOR NAME], [ADDRESS], Tax ID [NIP], REGON [REGON]. Contact with the Operator is possible at: [EMAIL].',
    'Zakres danych':'Scope of data',
    'W ramach Serwisu możemy przetwarzać dane takie jak: imię i nazwisko, adres e-mail, numer telefonu, dane firmy, dane adresowe, NIP/VAT EU, dane pracowników, klientów, usług, rezerwacji, powiadomień i rozliczeń.':'Within the Service, we may process data such as: full name, email address, phone number, company data, address data, Tax ID/VAT EU, employee, customer, service, booking, notification and settlement data.',
    'Cele przetwarzania':'Purposes of processing',
    'Dane są przetwarzane w celu utworzenia i obsługi konta, realizacji usług, komunikacji, rozliczeń, zapewnienia bezpieczeństwa, obsługi zgłoszeń, reklamacji oraz rozwoju Serwisu.':'Data is processed to create and maintain the account, provide services, communicate, settle payments, ensure security, handle requests and complaints, and develop the Service.',
    'Dane klientów i pracowników wprowadzane przez Użytkownika':'Customer and employee data entered by the User',
    'W zakresie danych klientów, pracowników lub innych osób wprowadzanych przez Użytkownika do Serwisu, Użytkownik pozostaje administratorem tych danych, a Operator może działać jako podmiot przetwarzający dane na zlecenie Użytkownika.':'With regard to data of customers, employees or other persons entered by the User into the Service, the User remains the controller of that data and the Operator may act as a processor on behalf of the User.',
    'Marketing':'Marketing',
    'Za zgodą Użytkownika lub na podstawie prawnie uzasadnionego interesu możemy przesyłać informacje dotyczące usług CompanyManager. Komunikacja marketingowa drogą elektroniczną odbywa się wyłącznie zgodnie z obowiązującymi przepisami. Zgodę można wycofać w każdym czasie.':'With the User’s consent or based on a legitimate interest, we may send information about CompanyManager services. Electronic marketing communication is carried out only in accordance with applicable regulations. Consent may be withdrawn at any time.',
    'Prawa Użytkownika':'User rights',
    'Użytkownik ma prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu oraz skargi do Prezesa Urzędu Ochrony Danych Osobowych.':'The User has the right to access data, rectify it, delete it, restrict processing, data portability, object and lodge a complaint with the President of the Personal Data Protection Office.',
    'Odbiorcy danych':'Data recipients',
    'Dane mogą być udostępniane podmiotom świadczącym usługi na rzecz Operatora, w szczególności dostawcom usług IT, hostingu, księgowości, płatności, poczty e-mail i SMS, a także podmiotom uprawnionym na podstawie przepisów prawa.':'Data may be shared with entities providing services to the Operator, in particular IT, hosting, accounting, payment, email and SMS service providers, as well as entities authorized under the law.',
    'Przekazywanie danych poza EOG':'Data transfers outside the EEA',
    'Co do zasady dane nie są przekazywane poza Europejski Obszar Gospodarczy, chyba że jest to konieczne do działania Serwisu i odbywa się z zastosowaniem odpowiednich zabezpieczeń prawnych.':'As a rule, data is not transferred outside the European Economic Area unless it is necessary for the operation of the Service and takes place with appropriate legal safeguards.',
    'Pliki cookies':'Cookies',
    'Serwis wykorzystuje pliki cookies niezbędne do działania aplikacji, utrzymania sesji logowania, bezpieczeństwa oraz zapamiętania ustawień. Serwis może wykorzystywać cookies sesyjne oraz stałe.':'The Service uses cookies necessary for application operation, maintaining the login session, security and remembering settings. The Service may use session and persistent cookies.',
    'Użytkownik może zarządzać cookies w ustawieniach przeglądarki, jednak ich ograniczenie może wpłynąć na działanie Serwisu, w szczególności na możliwość logowania i korzystania z panelu.':'The User may manage cookies in browser settings, but limiting them may affect the operation of the Service, especially the ability to log in and use the panel.',
    'Bezpieczeństwo':'Security',
    'Dane są traktowane jako poufne i zabezpieczane przed dostępem osób nieuprawnionych. Dostęp do konta jest chroniony loginem i hasłem. Użytkownik powinien chronić hasło i nie udostępniać go osobom trzecim.':'Data is treated as confidential and protected against unauthorized access. Account access is protected by a login and password. The User should protect the password and not share it with third parties.',
    'Okres przechowywania danych':'Data retention period',
    'Dane są przechowywane przez okres korzystania z Serwisu, a po zakończeniu współpracy przez okres wymagany przepisami prawa, konieczny do rozliczeń, obsługi reklamacji, bezpieczeństwa oraz dochodzenia lub obrony roszczeń.':'Data is stored for the period of using the Service and, after cooperation ends, for the period required by law and necessary for settlements, complaint handling, security and pursuing or defending claims.',
    'Zmiany polityki':'Policy changes',
    'Polityka Prywatności może być aktualizowana. O istotnych zmianach Użytkownicy będą informowani w Serwisie lub drogą elektroniczną.':'The Privacy Policy may be updated. Users will be informed about significant changes in the Service or electronically.',
    'Informacja o przetwarzaniu danych osobowych':'Information on personal data processing',
    'CompanyManager — wersja robocza v0.2.1.':'CompanyManager — draft version v0.2.1.',
    'Administratorem danych osobowych użytkowników serwisu CompanyManager jest [NAZWA OPERATORA], [ADRES], NIP [NIP], REGON [REGON]. Kontakt: [EMAIL].':'The controller of personal data of CompanyManager service users is [OPERATOR NAME], [ADDRESS], Tax ID [NIP], REGON [REGON]. Contact: [EMAIL].',
    'Podstawą przetwarzania danych jest zawarcie i realizacja umowy o świadczenie usług drogą elektroniczną oraz działania podejmowane przed jej zawarciem.':'The basis for data processing is the conclusion and performance of an electronic services agreement and actions taken before its conclusion.',
    'Dane osobowe są przetwarzane w celu rejestracji konta, obsługi Serwisu, kontaktu z Użytkownikiem, rozliczeń, obsługi reklamacji oraz zapewnienia bezpieczeństwa.':'Personal data is processed for account registration, Service operation, contact with the User, settlements, complaint handling and ensuring security.',
    'Dane mogą być przetwarzane również w celu marketingu bezpośredniego własnych usług, jeżeli pozwalają na to przepisy prawa lub Użytkownik wyraził odpowiednią zgodę. Komunikacja marketingowa drogą elektroniczną odbywa się wyłącznie zgodnie z obowiązującymi przepisami.':'Data may also be processed for direct marketing of own services if permitted by law or if the User has given appropriate consent. Electronic marketing communication is carried out only in accordance with applicable regulations.',
    'Podanie danych jest dobrowolne, ale niezbędne do utworzenia konta i korzystania z Serwisu.':'Providing data is voluntary but necessary to create an account and use the Service.',
    'Dane będą przechowywane przez okres korzystania z Serwisu, a po zakończeniu współpracy przez okres wymagany przepisami prawa lub niezbędny do dochodzenia roszczeń, obsługi rozliczeń i zapewnienia bezpieczeństwa.':'Data will be stored for the period of using the Service and, after cooperation ends, for the period required by law or necessary to pursue claims, handle settlements and ensure security.',
    'Użytkownik ma prawo dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz wniesienia sprzeciwu.':'The User has the right to access data, rectify it, delete it, restrict processing, data portability and object.',
    'Dane mogą być powierzane podmiotom obsługującym Serwis, w szczególności dostawcom hostingu, usług IT, księgowości, płatności, poczty e-mail i SMS.':'Data may be entrusted to entities supporting the Service, especially hosting, IT, accounting, payment, email and SMS providers.',
    'W zakresie danych klientów, pracowników i innych osób wprowadzanych przez Użytkownika do Serwisu, Użytkownik pozostaje administratorem tych danych, a Operator może działać jako podmiot przetwarzający na zlecenie Użytkownika.':'With regard to data of customers, employees and other persons entered by the User into the Service, the User remains the controller of that data and the Operator may act as a processor on behalf of the User.',
    'Co do zasady dane nie są przekazywane poza Europejski Obszar Gospodarczy, chyba że jest to konieczne i odbywa się z zastosowaniem odpowiednich zabezpieczeń prawnych.':'As a rule, data is not transferred outside the European Economic Area unless it is necessary and takes place with appropriate legal safeguards.',
    'Dane mogą być przetwarzane w sposób zautomatyzowany, ale nie będą profilowane w sposób wywołujący skutki prawne wobec Użytkownika.':'Data may be processed automatically, but it will not be profiled in a way that produces legal effects for the User.',
    'Użytkownik ma prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, jeżeli uzna, że przetwarzanie danych narusza przepisy o ochronie danych osobowych.':'The User has the right to lodge a complaint with the President of the Personal Data Protection Office if they believe that data processing violates personal data protection regulations.'
  });


  const CM_LANGUAGE_LABELS = { pl:'PL', 'en-gb':'ENG' };
  const CM_LANGUAGE_NAMES = { pl:'Polska', 'en-gb':'Anglia' };
  const CM_LANGUAGE_ORDER = ['pl', 'en-gb'];
  const normalizeCmLanguage = (lang) => CM_LANGUAGE_LABELS[String(lang || '').toLowerCase()] ? String(lang || '').toLowerCase() : 'pl';
  const getCmAccessLanguage = () => {
    try {
      const access = JSON.parse(localStorage.getItem('cm_access') || 'null');
      return normalizeCmLanguage(access?.language || access?.profile_language || access?.company_language || access?.settings?.language || '');
    } catch (_) { return 'pl'; }
  };
  const getStoredCmLanguage = () => normalizeCmLanguage(localStorage.getItem('cmLanguage') || getCmAccessLanguage() || 'pl');
  const cmTranslationEntryCache = new WeakMap();

  const getCmTranslationEntries = (dict) => {
    if (!dict) return [];
    if (!cmTranslationEntryCache.has(dict)) {
      cmTranslationEntryCache.set(dict, Object.entries(dict).sort((a,b) => b[0].length - a[0].length));
    }
    return cmTranslationEntryCache.get(dict);
  };

  const cmTranslateText = (text, dict) => {
    if (!text || !dict) return text;
    const leading = text.match(/^\s*/)?.[0] || '';
    const trailing = text.match(/\s*$/)?.[0] || '';
    const raw = text.trim();
    if (!raw) return text;
    const compact = raw.replace(/\s+/g, ' ');
    let translated = dict[raw] || dict[compact];
    if (!translated) {
      translated = compact;
      let changed = false;
      for (const [pl, en] of getCmTranslationEntries(dict)) {
        if (pl.length < 4) continue;
        if (translated.includes(pl)) {
          translated = translated.split(pl).join(en);
          changed = true;
        }
      }
      if (!changed) return text;
    }
    return leading + translated + trailing;
  };

  const applyPlatformLanguage = (lang = getStoredCmLanguage(), root = document.body) => {
    if (!root) return;
    const normalizedLang = CM_LANGUAGE_LABELS[lang] ? lang : 'pl';
    document.documentElement.lang = normalizedLang === 'pl' ? 'pl' : 'en-GB';
    if (window.cmLanguageObserver) {
      window.cmLanguageObserver.disconnect();
      window.cmLanguageObserver = null;
    }
    if (normalizedLang === 'pl') return;
    const dict = cmTranslations[normalizedLang] || cmTranslations['en-gb'];
    if (!dict) return;
    if (document.title) document.title = cmTranslateText(document.title, dict);
    const skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName) || parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = cmTranslateText(node.nodeValue, dict); });
    root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      el.setAttribute('placeholder', cmTranslateText(el.getAttribute('placeholder'), dict));
    });
    root.querySelectorAll('[title]').forEach(el => {
      el.setAttribute('title', cmTranslateText(el.getAttribute('title'), dict));
    });
    root.querySelectorAll('[aria-label]').forEach(el => {
      el.setAttribute('aria-label', cmTranslateText(el.getAttribute('aria-label'), dict));
    });
    root.querySelectorAll('option').forEach(option => {
      option.textContent = cmTranslateText(option.textContent, dict).trim();
    });
    root.querySelectorAll('input[type=button][value], input[type=submit][value], button[value]').forEach(el => {
      el.value = cmTranslateText(el.value, dict).trim();
    });
  };

  const schedulePlatformLanguage = (lang = getStoredCmLanguage(), root = document.body) => {
    if (lang === 'pl') { applyPlatformLanguage(lang, root); return; }
    const run = () => applyPlatformLanguage(lang, root);
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 300 });
    else window.requestAnimationFrame(run);
  };

  const renderPanelFrame = ({ db, user, company }, page, contentHtml, title='Dashboard', subtitle='Panel firmy') => {
    const role = user.role || 'employee';
    const languageSelector = `
      <div class="cm-language-picker cm-language-picker-side" data-language-picker>
        <button class="cm-language-current" type="button" aria-label="Wybierz język" aria-expanded="false">PL</button>
        <div class="cm-language-menu" hidden></div>
      </div>`;
    dashboardRoot.innerHTML = `
      <div class="bm-panel bm-top-layout">
        <header class="bm-horizontal-menu" aria-label="Menu panelu CompanyManager">
          <a class="bm-horizontal-brand bm-logo-home ${page==='dashboard'?'active':''}" href="dashboard.html" aria-label="CompanyManager — panel główny"><img src="../assets/favicon.png" alt="CM"></a>
          <nav class="bm-nav bm-nav-top">${panelMenu(user, page)}</nav>
          ${String(user.role || '').toLowerCase() === 'owner' ? `<a class="bm-owner-top-companies ${page==='companies'?'active':''}" href="companies.html">Firmy</a>` : ''}
        </header>

        <main class="bm-main bm-main-top">
          <div class="bm-panel-workspace">
            <aside class="bm-left-info-panel" aria-label="Informacje panelu">
              <section class="bm-identity-block">
                <div class="bm-mini-calendar bm-calendar-center" id="miniCalendar">
                  <button class="bm-today" id="calendarToggle" type="button"><strong>${formatDisplayDate(CM_TODAY)}</strong></button>
                  <span class="bm-live-clock" id="liveClock">--:--:--</span>
                  <div class="bm-month" id="monthCalendar" hidden></div>
                </div>

                <div class="bm-user-stack">
                  <strong>${escapeHtml(user.fullName || user.login)}</strong>
                  <div class="bm-admin-dropdown">
                    <button id="adminDropdownToggle" class="bm-admin-dropdown-toggle" type="button" aria-expanded="false" aria-controls="adminDropdownMenu">${escapeHtml(roleLabels[role] || role)} <span>▾</span></button>
                    <div id="adminDropdownMenu" class="bm-admin-dropdown-menu" hidden>
                      <a href="company-panel.html">Panel Firmy</a>
                      <a href="users.html">Użytkownicy</a>
                      ${canAccessPage(user, 'workSchedule') ? `<a href="work-schedule.html">Grafik pracy</a>` : ''}
                      <button id="panelLogoutBtn" class="bm-admin-dropdown-logout" type="button">Wyloguj się</button>
                    </div>
                  </div>
                  <button id="undoTimeBtn" class="bm-undo-time-btn" type="button">Cofnij Czas</button>
                  <a class="bm-owner-link ${page==='owner'?'active':''}" href="owner.html">Właściciel strony</a>
                  ${canAccessPage(user, 'reports') ? `<a class="bm-owner-link bm-stats-link ${page==='reports'?'active':''}" href="reports.html">Wykres/Statystyka</a>` : ''}
                  ${canAccessPage(user, 'customersReports') ? `<a class="bm-owner-link bm-customers-reports-link ${page==='customersReports'?'active':''}" href="customersraports.html">Klienci - raporty</a>` : ''}
                  ${canAccessPage(user, 'dailyReport') ? `<a class="bm-owner-link bm-daily-link ${page==='dailyReport'?'active':''}" href="daily-report.html">Raport dzienny</a>` : ''}
                  ${canAccessPage(user, 'periodReport') ? `<a class="bm-owner-link bm-period-link ${page==='periodReport'?'active':''}" href="period-report.html">Raport z okresu</a>` : ''}
                  ${canAccessPage(user, 'employeesReports') ? `<a class="bm-owner-link bm-employees-reports-link ${page==='employeesReports'?'active':''}" href="employeesraports.html">Pracownicy - raporty</a>` : ''}
                  ${canAccessPage(user, 'smsReports') ? `<a class="bm-owner-link bm-sms-reports-link ${page==='smsReports'?'active':''}" href="sms.html">SMS</a>` : ''}
                  ${canAccessPage(user, 'emailReports') ? `<a class="bm-owner-link bm-email-reports-link ${page==='emailReports'?'active':''}" href="email.html">Email</a>` : ''}
                  ${languageSelector}
                </div>
              </section>
            </aside>

            <section class="bm-panel-area">
              ${(title || subtitle) ? `<section class="bm-current-section"><div>${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></section>` : ''}

              ${contentHtml}
            </section>
          </div>
        </main>
      </div>`;
    const langPicker = document.querySelector('[data-language-picker]');
    const langToggle = langPicker?.querySelector('.cm-language-current');
    const langMenu = langPicker?.querySelector('.cm-language-menu');
    const langLabels = CM_LANGUAGE_LABELS;
    const langNames = CM_LANGUAGE_NAMES;
    const langOrder = CM_LANGUAGE_ORDER;
    let savedLang = getStoredCmLanguage();
    const renderLanguageMenu = () => {
      if (!langToggle || !langMenu) return;
      langToggle.textContent = langLabels[savedLang] || 'PL';
      langMenu.innerHTML = langOrder
        .filter(lang => lang !== savedLang)
        .map(lang => `<button type="button" data-lang="${lang}" aria-label="${langNames[lang]}">${langLabels[lang]}</button>`)
        .join('');
    };
    const persistCmLanguage = async (lang) => {
      const normalized = normalizeCmLanguage(lang);
      localStorage.setItem('cmLanguage', normalized);
      try {
        if (window.cmSupabase?.rpc) {
          await window.cmSupabase.rpc('cm_set_language', { p_language: normalized });
          const accessRaw = localStorage.getItem('cm_access');
          if (accessRaw) {
            const access = JSON.parse(accessRaw);
            access.language = normalized;
            access.profile_language = normalized;
            access.company_language = normalized;
            localStorage.setItem('cm_access', JSON.stringify(access));
          }
        }
      } catch (error) {
        console.warn('Nie zapisano języka w Supabase, zostaje localStorage.', error);
      }
      return normalized;
    };
    const syncCmLanguageFromSupabase = async () => {
      try {
        if (!window.cmSupabase?.rpc) return;
        const { data, error } = await window.cmSupabase.rpc('cm_get_language');
        if (error || !data) return;
        const remoteLang = normalizeCmLanguage(data.language || data.profile_language || data.company_language);
        if (remoteLang && remoteLang !== savedLang) {
          savedLang = remoteLang;
          localStorage.setItem('cmLanguage', savedLang);
          renderLanguageMenu();
          schedulePlatformLanguage(savedLang);
        }
      } catch (error) {
        console.warn('Nie pobrano języka z Supabase.', error);
      }
    };
    renderLanguageMenu();
    schedulePlatformLanguage(savedLang);
    syncCmLanguageFromSupabase();
    if (langPicker && langToggle && langMenu) {
      langToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        renderLanguageMenu();
        const nextOpen = langMenu.hidden;
        langMenu.hidden = !nextOpen;
        langToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      });
      langMenu.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-lang]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const lang = btn.getAttribute('data-lang') || 'pl';
        if (!langLabels[lang]) return;
        savedLang = normalizeCmLanguage(lang);
        localStorage.setItem('cmLanguage', savedLang);
        renderLanguageMenu();
        langMenu.hidden = true;
        langToggle.setAttribute('aria-expanded', 'false');
        persistCmLanguage(savedLang).finally(() => window.location.reload());
      });
      document.addEventListener('click', (event) => {
        if (!langMenu.hidden && !langPicker.contains(event.target)) {
          langMenu.hidden = true;
          langToggle.setAttribute('aria-expanded', 'false');
        }
      }, { once:false });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !langMenu.hidden) {
          langMenu.hidden = true;
          langToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const adminToggle = document.querySelector('#adminDropdownToggle');
    const adminMenu = document.querySelector('#adminDropdownMenu');
    if (adminToggle && adminMenu) {
      adminToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextOpen = adminMenu.hidden;
        adminMenu.hidden = !nextOpen;
        adminToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      });
      document.addEventListener('click', (event) => {
        if (!adminMenu.hidden && !adminMenu.contains(event.target) && !adminToggle.contains(event.target)) {
          adminMenu.hidden = true;
          adminToggle.setAttribute('aria-expanded', 'false');
        }
      }, { once:false });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !adminMenu.hidden) {
          adminMenu.hidden = true;
          adminToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
    const logout = document.querySelector('#panelLogoutBtn');
    if (logout) logout.addEventListener('click', () => { clearSession(); window.location.href = '../login.html'; });
    const undoTime = document.querySelector('#undoTimeBtn');
    if (undoTime) undoTime.addEventListener('click', () => {
      const action = loadLastAction();
      if (!action || action.type !== 'database-snapshot' || !action.database) return;
      saveDatabase(action.database);
      clearLastAction();
      window.location.reload();
    });
    wireMiniCalendar();
    cleanupLegacyPagination(document.querySelector('.bm-panel-area') || document);
    setupGlobalTablePagination(document.querySelector('.bm-panel-area') || document);
    enforceCurrentUserPermissions(user, page);
  };

  const adminIntro = (ctx) => `<section class="bm-page-card bm-admin-hero">
    <div><span class="bm-tag">System firmy</span><h2>${escapeHtml(ctx.company.name)}</h2><p>Panel administracyjny do obsługi klientów, wizyt, sprzedaży, pracowników, marketingu i raportów.</p></div>
    <div class="bm-admin-actions"><button>Nowa wizyta</button><button>Dodaj klienta</button><button>Sprzedaż</button></div>
  </section>`;

  const table = (headers, rows) => `<div class="bm-table-wrap"><table class="bm-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const normalizeCompanyBilling = (company = {}) => {
    const raw = company.billing && typeof company.billing === 'object' ? company.billing : {};
    return {
      name: raw.name || company.invoiceName || company.billingName || '',
      address: raw.address || company.invoiceAddress || company.billingAddress || '',
      postalCode: raw.postalCode || company.invoicePostalCode || company.billingPostalCode || '',
      city: raw.city || company.invoiceCity || company.billingCity || '',
      nip: raw.nip || company.vatId || company.nip || '',
      email: raw.email || company.invoiceEmail || company.receptionEmail || company.contactEmail || company.ownerEmail || ''
    };
  };

  const csvCell = (value) => `"${String(value || '').replace(/"/g, '""')}"`;

  const exportVisibleReportTables = (filenameBase, rootSelector = '.bm-panel-area') => {
    if (!hasSystemPermission(getCurrentContext().user, 'export danych z całej platformy')) { alert('Brak uprawnienia: export danych z całej platformy'); return; }
    const root = document.querySelector(rootSelector) || document.querySelector('.bm-panel-area') || document.body;
    const tables = [...root.querySelectorAll('table')].filter(tableEl => {
      const rect = tableEl.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && tableEl.offsetParent !== null;
    });
    const lines = [];
    const title = root.querySelector('h2, h3, strong')?.textContent?.trim();
    if (title) lines.push(csvCell(title));
    if (!tables.length) {
      const textRows = [...root.querySelectorAll('.cm-period-kpis div, .cm-finance-grid div, .cm-cancel-reasons div, .cm-schedule-month-row')].map(el => String(el.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
      if (textRows.length) {
        lines.push('');
        textRows.forEach(row => lines.push(csvCell(row)));
      } else {
        lines.push(csvCell('Brak danych do eksportu'));
      }
    } else {
      tables.forEach((tableEl, index) => {
        if (index > 0) lines.push('');
        const nearbyTitle = tableEl.closest('section, article, div')?.querySelector('h2, h3')?.textContent?.trim();
        if (nearbyTitle) lines.push(csvCell(nearbyTitle));
        [...tableEl.querySelectorAll('tr')].forEach(tr => {
          const cells = [...tr.querySelectorAll('th,td')].map(cell => csvCell(String(cell.textContent || '').trim().replace(/\s+/g, ' ')));
          if (cells.length) lines.push(cells.join(';'));
        });
      });
    }
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}-${currentIsoDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCurrentReportChartPng = () => {
    if (!hasSystemPermission(getCurrentContext().user, 'export danych z całej platformy')) { alert('Brak uprawnienia: export danych z całej platformy'); return; }
    const tableRows = [...document.querySelectorAll('#reportTable table tbody tr')].map(tr => {
      const cells = [...tr.querySelectorAll('td')].map(td => String(td.textContent || '').trim());
      return {
        label: cells[1] || '',
        signups: Number(String(cells[2] || '0').replace(',', '.')) || 0,
        visits: Number(String(cells[3] || '0').replace(',', '.')) || 0
      };
    }).filter(row => row.label);
    const rows = tableRows.length ? tableRows : [...document.querySelectorAll('#reportChart .cm-report-day')].map(day => {
      const label = day.querySelector('small')?.textContent?.trim() || '';
      const title = day.getAttribute('title') || '';
      const nums = [...title.matchAll(/(\d+)/g)].map(match => Number(match[1]));
      return { label, signups: nums[0] || 0, visits: nums[1] || 0 };
    }).filter(row => row.label);
    const canvas = document.createElement('canvas');
    const width = 1600;
    const height = 900;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e5edf7';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText('Wykres / Statystyka', 60, 70);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(`Eksport: ${currentIsoDate()}`, 60, 104);
    const plotX = 90;
    const plotY = 150;
    const plotW = width - 150;
    const plotH = height - 260;
    ctx.strokeStyle = 'rgba(148,163,184,.28)';
    ctx.lineWidth = 1;
    const maxValue = Math.max(10, ...rows.flatMap(row => [row.signups, row.visits]));
    for (let i = 0; i <= 5; i++) {
      const y = plotY + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
      const value = Math.round(maxValue - (maxValue / 5) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(String(value), 36, y + 5);
    }
    if (!rows.length) {
      ctx.fillStyle = '#e5edf7';
      ctx.font = '28px Arial, sans-serif';
      ctx.fillText('Brak danych do eksportu', plotX + 40, plotY + 80);
    } else {
      const groupW = plotW / rows.length;
      const barW = Math.max(8, Math.min(22, groupW * 0.28));
      rows.forEach((row, index) => {
        const center = plotX + groupW * index + groupW / 2;
        const signH = (row.signups / maxValue) * plotH;
        const visitH = (row.visits / maxValue) * plotH;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(center - barW - 2, plotY + plotH - signH, barW, signH);
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(center + 2, plotY + plotH - visitH, barW, visitH);
        ctx.save();
        ctx.translate(center - 4, plotY + plotH + 24);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '13px Arial, sans-serif';
        ctx.fillText(row.label.slice(0, 22), 0, 0);
        ctx.restore();
      });
    }
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(width - 420, 58, 18, 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('Zapisało się klientów', width - 392, 74);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(width - 210, 58, 18, 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Liczba klientów', width - 182, 74);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wykres-${currentIsoDate()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const addChartPngExportButton = (headSelector) => {
    if (!hasSystemPermission(getCurrentContext().user, 'export danych z całej platformy')) return;
    const head = document.querySelector(headSelector);
    if (!head || head.querySelector('[data-chart-export="true"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-chart-export-btn cm-report-export-btn';
    btn.dataset.chartExport = 'true';
    btn.textContent = 'Export';
    btn.addEventListener('click', exportCurrentReportChartPng);
    head.appendChild(btn);
  };

  const addReportExportButton = (headSelector, filenameBase, rootSelector = '.bm-panel-area') => {
    if (!hasSystemPermission(getCurrentContext().user, 'export danych z całej platformy')) return;
    const head = document.querySelector(headSelector);
    if (!head || head.querySelector('[data-report-export="true"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-sales-export-btn cm-report-export-btn cm-report-export-green';
    btn.dataset.reportExport = 'true';
    btn.textContent = 'Export';
    btn.addEventListener('click', () => exportVisibleReportTables(filenameBase, rootSelector));
    head.appendChild(btn);
  };

  const ensureModalCancelButton = (panel) => {
    if (!panel || panel.querySelector('[data-modal-cancel="true"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bm-light-btn cm-modal-cancel-btn';
    btn.dataset.modalCancel = 'true';
    btn.textContent = 'Anuluj';
    btn.addEventListener('click', () => closeModalPanel(panel));
    panel.appendChild(btn);
  };

  const showOnlyPanel = (targetPanel, panels = [], scroll = true) => {
    panels.filter(Boolean).forEach(panel => {
      panel.hidden = panel !== targetPanel;
      panel.classList.remove('cm-modal-active');
    });
    if (targetPanel) {
      targetPanel.hidden = false;
      ensureModalCancelButton(targetPanel);
      targetPanel.classList.add('cm-modal-active');
    }
    updateGlobalModalState();
  };

  // Modal działa tylko dla formularzy świadomie otwartych guzikiem.
  // Poprzednia wersja próbowała wykrywać wszystkie widoczne formularze i obserwowała klasy,
  // co mogło uruchamiać pętlę MutationObserver oraz blokować stronę ciemnym overlayem.
  const getModalCandidates = () => [...document.querySelectorAll('.cm-as-modal, .cm-modal-active')];
  const updateGlobalModalState = () => {
    let overlay = document.querySelector('#cmGlobalFormOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cmGlobalFormOverlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    const candidates = getModalCandidates();
    const openPanels = candidates.filter(panel => panel.classList.contains('cm-modal-active') && !panel.hidden);
    candidates.forEach(panel => panel.classList.toggle('cm-as-modal', openPanels.includes(panel)));
    document.body.classList.toggle('cm-modal-open', openPanels.length > 0);
  };

  const closeModalPanel = (panel) => {
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('cm-modal-active', 'cm-as-modal');
    updateGlobalModalState();
  };

  const closeActiveModalPanel = () => {
    const active = document.querySelector('.cm-modal-active:not([hidden]), .cm-as-modal:not([hidden])');
    if (active) closeModalPanel(active);
  };

  const setupGlobalModalObserver = () => {
    if (window.__cmGlobalModalObserverStarted) return;
    window.__cmGlobalModalObserverStarted = true;
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.cm-modal-active:not([hidden])').forEach(ensureModalCancelButton);
      updateGlobalModalState();
    });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['hidden','style'] });
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('.bm-nested-modal')) return;
      if (target.id === 'cmGlobalFormOverlay') { closeActiveModalPanel(); return; }
      if (target.matches('[data-modal-cancel="true"]') || (/anuluj/i.test(target.textContent || '') && target.closest('.cm-as-modal'))) {
        const panel = target.closest('.cm-as-modal, .cm-modal-active');
        if (panel) { closeModalPanel(panel); event.preventDefault(); }
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeActiveModalPanel();
    });
    updateGlobalModalState();
  };


  const CM_GLOBAL_PAGE_LIMIT_KEY = 'companyManagerGlobalPageLimit';
  const getGlobalPageLimit = (fallback = '50') => {
    try {
      const saved = localStorage.getItem(CM_GLOBAL_PAGE_LIMIT_KEY);
      if (['50','100','200'].includes(String(saved))) return String(saved);
    } catch (_) {}
    const normalized = String(fallback || '50');
    return ['50','100','200'].includes(normalized) ? normalized : '50';
  };
  const setGlobalPageLimit = (value) => {
    const normalized = String(value || '50');
    if (!['50','100','200'].includes(normalized)) return;
    try { localStorage.setItem(CM_GLOBAL_PAGE_LIMIT_KEY, normalized); } catch (_) {}
    document.querySelectorAll('[data-limit-dropdown]').forEach(root => {
      const input = root.querySelector('input[type="hidden"]');
      const toggle = root.querySelector('[data-limit-toggle]');
      if (input) input.value = normalized;
      if (toggle) toggle.textContent = `${normalized} ▾`;
    });
    document.querySelectorAll('select[data-global-page-limit], select[id$="PageSize"], select[id*="Limit"], select[id*="limit"]').forEach(select => {
      if ([...select.options].some(option => option.value === normalized)) select.value = normalized;
    });
  };



  const setupGlobalLimitDropdownDelegation = () => {
    if (window.__cmGlobalLimitDropdownDelegationReady) return;
    window.__cmGlobalLimitDropdownDelegationReady = true;

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const toggle = target.closest('[data-limit-toggle]');
      const option = target.closest('[data-limit-value]');
      const clickedInsideDropdown = target.closest('[data-limit-dropdown]');

      if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

        const root = toggle.closest('[data-limit-dropdown]');
        const menu = root?.querySelector('.cm-limit-menu');
        document.querySelectorAll('.cm-limit-menu').forEach((item) => {
          if (item !== menu) item.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
        return;
      }

      if (option) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

        const root = option.closest('[data-limit-dropdown]');
        const input = root?.querySelector('input[type="hidden"]');
        const value = option.getAttribute('data-limit-value') || input?.value || '50';
        if (input) input.value = value;
        setGlobalPageLimit(value);
        const menu = root?.querySelector('.cm-limit-menu');
        if (menu) menu.hidden = true;

        // Moduły Supabase renderują listy dynamicznie z limitu zapisanego w localStorage.
        // Krótki reload odświeża tabelę bez ręcznego dopisywania osobnej logiki dla każdego modułu.
        window.setTimeout(() => window.location.reload(), 80);
        return;
      }

      if (!clickedInsideDropdown) {
        document.querySelectorAll('.cm-limit-menu').forEach((menu) => { menu.hidden = true; });
      }
    }, true);
  };

  setupGlobalLimitDropdownDelegation();

  const pageSizeDropdown = (id, value = '50') => limitDropdownHtml(id, value);

  const renderDashboard = (ctx) => {
    const { db, company } = ctx;
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const services = (db.services || []).filter(s => s.companyId === company.id);
    const products = (db.products || []).filter(p => p.companyId === company.id);
    const dbEmployees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    // Dashboard korzysta wyłącznie z pracowników zapisanych w bazie firmy.
    // Usunięto ręcznie dopisane osoby testowe, żeby grafik nie pokazywał kolumn bez realnego użytkownika.
    const employees = dbEmployees;
    const employeeIds = new Set(employees.map(employee => employee.id));
    const todayIso = currentIsoDate();
    const allDashboardVisits = (db.dashboardVisits || []).filter(v => v.companyId === company.id && employeeIds.has(v.employeeId));
    const dashVisits = allDashboardVisits.filter(v => v.status !== 'odwołana' && v.status !== 'odwołane' && v.cancelled !== true);
    const isoFromDateObj = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const timeSlots = [];
    for (let hour = 6; hour <= 20; hour++) {
      timeSlots.push(`${String(hour).padStart(2,'0')}:00`);
      if (hour < 20) timeSlots.push(`${String(hour).padStart(2,'0')}:30`);
    }
    const minutesFromTime = (value) => {
      const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      return Number(match[1]) * 60 + Number(match[2]);
    };
    const normalizeTimeValue = (value) => {
      const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      if (!match) return '';
      return `${String(Number(match[1])).padStart(2,'0')}:${match[2]}`;
    };
    const findVisitInSlot = (employee, time, dateIso, offset) => {
      const slotMin = minutesFromTime(time);
      if (slotMin == null) return null;
      const real = dashVisits.find(v => {
        if (v.date !== dateIso || v.employeeId !== employee.id) return false;
        const startMin = minutesFromTime(v.start);
        const endMin = minutesFromTime(v.end);
        if (startMin == null || endMin == null) return false;
        return slotMin >= startMin && slotMin < endMin;
      });
      if (real) return { type:'real', item:real, isStart:normalizeTimeValue(real.start) === normalizeTimeValue(time) };
      return null;
    };
    const buildSlotTooltip = (visit, employee) => {
      if (!visit) return 'Wolny termin';
      if (visit.type === 'real') {
        const real = visit.item || {};
        const customer = customers.find(c => c.id === real.customerId) || {};
        const serviceLabel = real.serviceName ? `Usługa: ${real.serviceName}` : '';
        const productLabel = real.productName ? `Produkt: ${real.productName}` : '';
        const priceItems = [productLabel, serviceLabel].filter(Boolean).join(' + ') || 'Brak pozycji';
        const total = real.total ? `${real.total} PLN` : '0.00 PLN';
        return [
          `Klient: ${real.clientName || customerName(customer || {}) || 'Brak klienta'}`,
          `Telefon: ${customer.phone || real.clientPhone || 'Brak numeru'}`,
          `Cena: ${priceItems} = ${total}`,
          `Pracownik: ${real.employeeName || employee.fullName || 'Pracownik'}`,
          `Opis: ${real.note || 'Brak opisu'}`
        ].join('\n');
      }
      return 'Wolny termin';
    };
    const getScheduleCell = (employee, time, dateIso, offset) => {
      const visit = findVisitInSlot(employee, time, dateIso, offset);
      if (visit?.type === 'real') {
        const real = visit.item;
        const label = `${escapeHtml(real.start)} - ${escapeHtml(real.end)}<br>${escapeHtml(real.clientName)}: ${escapeHtml(real.serviceName || real.productName || 'Wizyta')}`;
        return { busy:true, text: visit.isStart ? label : `<span class="bm-continuation">ZAJĘTE do ${escapeHtml(real.end)}</span>`, tooltip: buildSlotTooltip(visit, employee) };
      }
      return { busy:false, text:'FREE', tooltip:'Wolny termin' };
    };
    const getEmployeeLabel = (employee) => escapeHtml(employee.fullName || employee.email || employee.login || 'Pracownik');
    const customerOptions = customers.map(customer => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customerName(customer))}</option>`).join('');
    const employeeOptions = employees.map(employee => `<option value="${escapeHtml(employee.id)}">${getEmployeeLabel(employee)}</option>`).join('');
    const serviceOptions = services.map(service => `<option value="${escapeHtml(service.id)}" data-price="${escapeHtml(service.priceFrom || service.priceTo || '0')}">${escapeHtml(service.name)}${service.priceFrom ? ` — ${escapeHtml(service.priceFrom)} PLN` : ''}</option>`).join('');
    const productOptions = products.map(product => `<option value="${escapeHtml(product.id)}" data-price="${escapeHtml(product.price || '0')}">${escapeHtml(product.name)}${product.price ? ` — ${escapeHtml(product.price)} PLN` : ''}</option>`).join('');
    const dashboardVisitOptions = dashVisits.map(visit => {
      const label = [formatIsoDatePL(visit.date) || visit.date, visit.start || '', visit.end || '', visit.clientName || '-', visit.employeeName || '-', visit.serviceName || visit.productName || 'Wizyta'].filter(Boolean).join(' — ');
      return `<option value="${escapeHtml(visit.id)}">${escapeHtml(label)}</option>`;
    }).join('');
    const timeOptions = [];
    for (let hour = 0; hour < 24; hour++) for (let min = 0; min < 60; min += 5) timeOptions.push(`${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`);
    const timeSelectOptions = timeOptions.map(t => `<option value="${t}">${t}</option>`).join('');
    const selectedDate = new Date();
    const dayHeader = `${selectedDate.toLocaleDateString('pl-PL', { weekday:'long' }).replace(/^./, c => c.toUpperCase())}, ${selectedDate.getDate()} ${monthNamesPL[selectedDate.getMonth()]}, ${selectedDate.getFullYear()}`;
    const dateBar = `<section class="bm-schedule-datebar">
      <button type="button" id="dashPrevDay" aria-label="Poprzedni dzień">‹</button>
      <strong id="dashRelativeLabel">dzisiaj</strong>
      <button type="button" id="dashNextDay" aria-label="Następny dzień">›</button>
      <span id="dashFullDate">${escapeHtml(dayHeader)}</span>
      <span class="bm-dashboard-actions"><button type="button" id="dashEditVisitBtn" class="bm-light-btn">Edytuj</button><button type="button" id="dashCancelVisitBtn" class="bm-danger-btn">Odwołaj wizytę</button><button type="button" id="dashEmployeeCount" class="bm-worker-count">(${employees.length})</button></span>
    </section>`;
    const workerChecks = employees.map(employee => `<label data-worker-label="${escapeHtml(employee.id)}"><input type="checkbox" class="dash-worker-toggle" value="${escapeHtml(employee.id)}"> ${getEmployeeLabel(employee)}</label>`).join('');
    const scheduleRows = timeSlots.map(time => {
      const cells = employees.map(employee => {
        const cell = getScheduleCell(employee, time, todayIso, 0);
        return `<td class="bm-schedule-slot ${cell.busy ? 'busy' : 'free'}" data-employee-id="${escapeHtml(employee.id)}" data-employee-name="${getEmployeeLabel(employee)}" data-time="${escapeHtml(time)}" data-slot-tooltip="${escapeHtml(cell.tooltip || '')}"><span>${cell.text}</span></td>`;
      }).join('');
      return `<tr><th class="bm-time-col">${escapeHtml(time)}</th>${cells}</tr>`;
    }).join('');
    const employeeCount = Math.max(employees.length, 1);
    const scheduleWidth = `${82 + (employeeCount * 180)}px`;
    const scheduleColgroup = `<colgroup><col class="bm-time-colgroup">${employees.map(() => '<col class="bm-worker-colgroup">').join('')}</colgroup>`;
    const scheduleHead = `<thead><tr><th class="bm-time-head">Godzina</th>${employees.map(employee => `<th data-employee-head="${escapeHtml(employee.id)}">${getEmployeeLabel(employee)}</th>`).join('')}</tr></thead>`;
    const content = `<section class="bm-dashboard-schedule">
      ${dateBar}
      <div class="bm-workers-popover" id="dashWorkersPopover" hidden><h3>Pracownicy</h3><label><input type="checkbox" id="dashToggleAllWorkers" checked> zaznacz wszystkich</label>${workerChecks}</div>
      <div class="bm-schedule-table-wrap"><table class="bm-schedule-table" style="width:${scheduleWidth};min-width:${scheduleWidth};">${scheduleColgroup}${scheduleHead}<tbody>${scheduleRows}</tbody></table></div>
      <div class="bm-schedule-tooltip" id="dashSlotTooltip" hidden></div>
    </section>
    <section class="bm-page-card bm-appointment-form" id="dashboardAppointmentForm" hidden>
      <div class="bm-page-head"><h2>Dodaj wpis do grafiku</h2></div>
      <form id="dashboardAppointmentAddForm" class="bm-form-grid">
        <label>Data<input type="date" name="date" value="${escapeHtml(todayIso)}"></label>
        <label>Od<select name="start">${timeSelectOptions}</select></label>
        <label>Do<select name="end">${timeSelectOptions}</select></label>
        <label>Czas trwania<input name="duration" value="5 min" readonly></label>
        <label>Klient<div class="bm-inline-field"><select name="customerId"><option value="">Wybierz klienta</option>${customerOptions}</select><button type="button" id="dashShowQuickCustomer">Dodaj</button></div></label>
        <label>Pracownik<select name="employeeId">${employeeOptions}</select></label>
        <label>Usługi<select name="serviceId"><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
        <label>Zakup produktów<select name="productId"><option value="">Wybierz produkt</option>${productOptions}</select></label>
        <label>Razem do zapłaty<input name="total" value="0.00" readonly></label>
        <label>Płatność<select name="payment"><option>gotówka</option><option>karta kredytowa</option><option>karnet</option><option>pakiet</option><option>gratis</option></select></label>
        <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
        <button type="submit">Dodaj</button>
      </form>
      <form id="dashboardQuickCustomerForm" class="bm-form-grid bm-nested-form bm-nested-modal" hidden>
        <h3 class="bm-full">Dodaj klienta</h3>
        <label>Imię i nazwisko*<input name="fullName" placeholder="Imię i nazwisko" required></label>
        <label>Nr telefonu<input name="phone" placeholder="+48321321321"></label>
        <label>Adres email<input name="email" placeholder="Adres email"></label>
        <label class="bm-full">Opis<textarea name="description" placeholder="Opis"></textarea></label>
        <button type="submit">Zatwierdź</button><button type="button" id="dashCancelQuickCustomer" class="bm-light-btn">Anuluj</button>
      </form>
      <p id="dashboardAppointmentMessage" class="panel-message"></p>
    </section>
    <section class="bm-page-card bm-appointment-form" id="dashboardEditVisitPanel" hidden>
      <div class="bm-page-head"><h2>Edytuj wizytę</h2></div>
      <form id="dashboardEditVisitForm" class="bm-form-grid">
        <label class="bm-full">Wybierz wizytę<select name="visitId" id="dashEditVisitSelect" required><option value="">Wybierz wizytę</option>${dashboardVisitOptions}</select></label>
        <label>Data<input type="date" name="date" value="${escapeHtml(todayIso)}"></label>
        <label>Od<select name="start">${timeSelectOptions}</select></label>
        <label>Do<select name="end">${timeSelectOptions}</select></label>
        <label>Klient<select name="customerId"><option value="">Wybierz klienta</option>${customerOptions}</select></label>
        <label>Pracownik<select name="employeeId">${employeeOptions}</select></label>
        <label>Usługi<select name="serviceId"><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
        <label>Zakup produktów<select name="productId"><option value="">Wybierz produkt</option>${productOptions}</select></label>
        <label>Razem do zapłaty<input name="total" value="0.00"></label>
        <label>Płatność<select name="payment"><option>gotówka</option><option>karta kredytowa</option><option>karnet</option><option>pakiet</option><option>gratis</option></select></label>
        <label class="bm-full">Opis<textarea name="note" placeholder="Notatka"></textarea></label>
        <button type="submit">Zapisz zmiany</button>
      </form>
      <p id="dashboardEditVisitMessage" class="panel-message"></p>
    </section>
    <section class="bm-page-card bm-appointment-form" id="dashboardCancelVisitPanel" hidden>
      <div class="bm-page-head"><h2>Odwołaj wizytę</h2></div>
      <form id="dashboardCancelVisitForm" class="bm-form-grid">
        <label class="bm-full">Wybierz wizytę<select name="visitId" required><option value="">Wybierz wizytę</option>${dashboardVisitOptions}</select></label>
        <label class="bm-full">Powód<textarea name="reason" placeholder="Powód" required></textarea></label>
        <button type="submit" class="bm-danger-btn">Odwołaj wizytę</button>
      </form>
      <p id="dashboardCancelVisitMessage" class="panel-message"></p>
    </section>`;
    renderPanelFrame(ctx, 'dashboard', content, '', '');
    const formCard = document.querySelector('#dashboardAppointmentForm');
    const form = document.querySelector('#dashboardAppointmentAddForm');
    const editVisitPanel = document.querySelector('#dashboardEditVisitPanel');
    const cancelVisitPanel = document.querySelector('#dashboardCancelVisitPanel');
    const editVisitForm = document.querySelector('#dashboardEditVisitForm');
    const cancelVisitForm = document.querySelector('#dashboardCancelVisitForm');
    const workersPopover = document.querySelector('#dashWorkersPopover');
    const workerState = (db.dashboardWorkerState && typeof db.dashboardWorkerState === 'object') ? db.dashboardWorkerState : {};
    const dayOffEmployeeIds = (iso) => new Set((db.daysOff || [])
      .filter(item => item.companyId === company.id && item.start <= iso && item.end >= iso)
      .map(item => item.employeeId));
    const getActiveWorkerIdsForDate = (iso) => {
      const allIds = employees.map(employee => employee.id);
      const offIds = dayOffEmployeeIds(iso);
      const saved = Array.isArray(workerState[iso]) ? workerState[iso] : null;
      const base = saved || allIds;
      return base.filter(id => allIds.includes(id) && !offIds.has(id));
    };
    const saveActiveWorkerIdsForDate = (iso, ids) => {
      const currentDb = loadDatabase();
      currentDb.dashboardWorkerState = currentDb.dashboardWorkerState || {};
      const offIds = dayOffEmployeeIds(iso);
      currentDb.dashboardWorkerState[iso] = ids.filter(id => !offIds.has(id));
      workerState[iso] = currentDb.dashboardWorkerState[iso];
      saveDatabase(currentDb);
    };
    const activeIsoDate = () => { const date = new Date(); date.setDate(date.getDate() + dayOffset); return isoFromDateObj(date); };
    const applyWorkerStateForDate = (iso) => {
      const active = getActiveWorkerIdsForDate(iso);
      const offIds = dayOffEmployeeIds(iso);
      document.querySelectorAll('.dash-worker-toggle').forEach(input => {
        input.checked = active.includes(input.value);
        input.disabled = offIds.has(input.value);
        input.closest('label')?.classList.toggle('worker-day-off', offIds.has(input.value));
      });
      updateEmployeeCount(false);
    };
    const updateEmployeeCount = (persist = true) => {
      const active = [...document.querySelectorAll('.dash-worker-toggle')].filter(input => input.checked && !input.disabled).map(input => input.value);
      document.querySelector('#dashEmployeeCount').textContent = `(${active.length})`;
      document.querySelectorAll('[data-employee-id]').forEach(cell => cell.classList.toggle('inactive-worker', !active.includes(cell.dataset.employeeId)));
      document.querySelectorAll('[data-employee-head]').forEach(head => head.classList.toggle('inactive-worker', !active.includes(head.dataset.employeeHead)));
      const enabledChecks = [...document.querySelectorAll('.dash-worker-toggle')].filter(input => !input.disabled);
      const allToggle = document.querySelector('#dashToggleAllWorkers');
      if (allToggle) {
        allToggle.checked = enabledChecks.length > 0 && active.length === enabledChecks.length;
        allToggle.indeterminate = active.length > 0 && active.length < enabledChecks.length;
      }
      if (persist) saveActiveWorkerIdsForDate(activeIsoDate(), active);
    };
    document.querySelector('#dashEmployeeCount')?.addEventListener('click', () => { workersPopover.hidden = !workersPopover.hidden; });
    document.querySelector('#dashEditVisitBtn')?.addEventListener('click', () => {
      if (editVisitPanel) { editVisitPanel.hidden = false; editVisitPanel.classList.add('cm-modal-active'); updateGlobalModalState(); }
    });
    document.querySelector('#dashCancelVisitBtn')?.addEventListener('click', () => {
      if (cancelVisitPanel) { cancelVisitPanel.hidden = false; cancelVisitPanel.classList.add('cm-modal-active'); updateGlobalModalState(); }
    });
    document.querySelectorAll('.dash-worker-toggle').forEach(input => input.addEventListener('change', () => updateEmployeeCount(true)));
    document.querySelector('#dashToggleAllWorkers')?.addEventListener('change', event => {
      document.querySelectorAll('.dash-worker-toggle').forEach(input => { if (!input.disabled) input.checked = event.target.checked; });
      updateEmployeeCount(true);
    });
    let dayOffset = 0;
    const refreshScheduleCells = () => {
      const date = new Date(); date.setDate(date.getDate() + dayOffset);
      const iso = isoFromDateObj(date);
      document.querySelectorAll('.bm-schedule-slot').forEach(cell => {
        const employee = employees.find(emp => emp.id === cell.dataset.employeeId);
        if (!employee) return;
        const slot = getScheduleCell(employee, cell.dataset.time || '06:00', iso, dayOffset);
        cell.classList.toggle('busy', slot.busy);
        cell.classList.toggle('free', !slot.busy);
        cell.dataset.slotTooltip = slot.tooltip || '';
        const span = cell.querySelector('span');
        if (span) span.innerHTML = slot.text;
      });
      if (form?.date) form.date.value = iso;
    };
    const updateDashDate = () => {
      const date = new Date(); date.setDate(date.getDate() + dayOffset);
      const iso = isoFromDateObj(date);
      const rel = dayOffset === 0 ? 'dzisiaj' : dayOffset === 1 ? 'jutro' : dayOffset === -1 ? 'wczoraj' : date.toLocaleDateString('pl-PL', { weekday:'long' });
      document.querySelector('#dashRelativeLabel').textContent = rel;
      document.querySelector('#dashFullDate').textContent = `${date.toLocaleDateString('pl-PL', { weekday:'long' }).replace(/^./, c => c.toUpperCase())}, ${date.getDate()} ${monthNamesPL[date.getMonth()]}, ${date.getFullYear()}`;
      refreshScheduleCells();
      applyWorkerStateForDate(iso);
    };
    document.querySelector('#dashPrevDay')?.addEventListener('click', () => { dayOffset -= 1; updateDashDate(); });
    document.querySelector('#dashNextDay')?.addEventListener('click', () => { dayOffset += 1; updateDashDate(); });
    const setDurationAndTotal = () => {
      if (!form) return;
      const start = form.start.value.split(':').map(Number); const end = form.end.value.split(':').map(Number);
      let diff = ((end[0] * 60 + end[1]) - (start[0] * 60 + start[1]));
      if (diff < 0) diff += 24 * 60;
      form.duration.value = `${diff} min`;
      const serviceOpt = form.serviceId.selectedOptions[0];
      const productOpt = form.productId.selectedOptions[0];
      const total = (Number(String(serviceOpt?.dataset.price || '0').replace(',','.')) || 0) + (Number(String(productOpt?.dataset.price || '0').replace(',','.')) || 0);
      form.total.value = total.toFixed(2);
    };
    const slotTooltip = document.querySelector('#dashSlotTooltip');
    const positionSlotTooltip = (event) => {
      if (!slotTooltip || slotTooltip.hidden) return;
      const pad = 14;
      const rect = slotTooltip.getBoundingClientRect();
      let left = event.clientX + 16;
      let top = event.clientY + 16;
      if (left + rect.width + pad > window.innerWidth) left = event.clientX - rect.width - 16;
      if (top + rect.height + pad > window.innerHeight) top = event.clientY - rect.height - 16;
      slotTooltip.style.left = `${Math.max(pad, left)}px`;
      slotTooltip.style.top = `${Math.max(pad, top)}px`;
    };
    document.querySelectorAll('.bm-schedule-slot').forEach(cell => {
      cell.addEventListener('mouseenter', event => {
        if (!slotTooltip) return;
        slotTooltip.textContent = cell.dataset.slotTooltip || 'Wolny termin';
        slotTooltip.hidden = false;
        positionSlotTooltip(event);
      });
      cell.addEventListener('mousemove', positionSlotTooltip);
      cell.addEventListener('mouseleave', () => { if (slotTooltip) slotTooltip.hidden = true; });
    });
    document.querySelectorAll('.bm-schedule-slot').forEach(cell => cell.addEventListener('click', () => {
      if (slotTooltip) slotTooltip.hidden = true;
      if (cell.classList.contains('inactive-worker')) return;
      formCard.hidden = false;
      formCard.classList.add('cm-modal-active');
      const start = cell.dataset.time || '06:00';
      const [h,m] = start.split(':').map(Number);
      const endDate = new Date(2000, 0, 1, h, m + 5);
      const end = `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`;
      const activeDate = new Date(); activeDate.setDate(activeDate.getDate() + dayOffset);
      form.date.value = isoFromDateObj(activeDate);
      form.start.value = start; form.end.value = end; form.employeeId.value = cell.dataset.employeeId || '';
      setDurationAndTotal();
      updateGlobalModalState();
    }));
    form?.start?.addEventListener('change', setDurationAndTotal);
    form?.end?.addEventListener('change', setDurationAndTotal);
    form?.serviceId?.addEventListener('change', setDurationAndTotal);
    form?.productId?.addEventListener('change', setDurationAndTotal);
    document.querySelector('#dashEditVisitSelect')?.addEventListener('change', (event) => {
      const selected = allDashboardVisits.find(v => v.id === event.target.value);
      if (!selected || !editVisitForm) return;
      editVisitForm.date.value = selected.date || todayIso;
      editVisitForm.start.value = normalizeTimeValue(selected.start || '06:00');
      editVisitForm.end.value = normalizeTimeValue(selected.end || '06:05');
      editVisitForm.customerId.value = selected.customerId || '';
      editVisitForm.employeeId.value = selected.employeeId || '';
      editVisitForm.serviceId.value = selected.serviceId || '';
      editVisitForm.productId.value = selected.productId || '';
      editVisitForm.total.value = selected.total || '0.00';
      editVisitForm.payment.value = selected.payment || 'gotówka';
      editVisitForm.note.value = selected.note || '';
    });
    editVisitForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(editVisitForm);
      const currentDb = loadDatabase();
      const index = (currentDb.dashboardVisits || []).findIndex(v => v.id === data.get('visitId') && v.companyId === company.id);
      const msg = document.querySelector('#dashboardEditVisitMessage');
      if (index < 0) { if (msg) { msg.textContent = 'Wybierz wizytę do edycji.'; msg.style.color = '#fca5a5'; } return; }
      const customer = (currentDb.customers || []).find(c => c.id === data.get('customerId'));
      const employee = employees.find(e => e.id === data.get('employeeId'));
      const service = (currentDb.services || []).find(srv => srv.id === data.get('serviceId'));
      const product = (currentDb.products || []).find(prod => prod.id === data.get('productId'));
      saveUndoSnapshot('Edycja wizyty z dashboardu', currentDb);
      currentDb.dashboardVisits[index] = { ...currentDb.dashboardVisits[index], date:String(data.get('date') || todayIso), start:normalizeTimeValue(String(data.get('start') || '06:00')), end:normalizeTimeValue(String(data.get('end') || '06:05')), customerId:String(data.get('customerId') || ''), clientName:customerName(customer || {}), employeeId:String(data.get('employeeId') || ''), employeeName:employee?.fullName || '', serviceId:String(data.get('serviceId') || ''), serviceName:service?.name || '', productId:String(data.get('productId') || ''), productName:product?.name || '', total:String(data.get('total') || '0.00'), payment:String(data.get('payment') || 'gotówka'), note:String(data.get('note') || ''), updatedAt:new Date().toISOString() };
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Wizyta zaktualizowana.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    cancelVisitForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(cancelVisitForm);
      const reason = String(data.get('reason') || '').trim();
      const currentDb = loadDatabase();
      const index = (currentDb.dashboardVisits || []).findIndex(v => v.id === data.get('visitId') && v.companyId === company.id);
      const msg = document.querySelector('#dashboardCancelVisitMessage');
      if (index < 0) { if (msg) { msg.textContent = 'Wybierz wizytę do odwołania.'; msg.style.color = '#fca5a5'; } return; }
      if (!reason) { if (msg) { msg.textContent = 'Wpisz powód odwołania.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Odwołanie wizyty z dashboardu', currentDb);
      currentDb.dashboardVisits[index] = { ...currentDb.dashboardVisits[index], status:'odwołana', cancelled:true, cancelReason:reason, cancelledAt:new Date().toISOString() };
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Wizyta odwołana.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    const quickForm = document.querySelector('#dashboardQuickCustomerForm');
    document.querySelector('#dashCancelAppointment')?.addEventListener('click', () => { if (quickForm) quickForm.hidden = true; closeModalPanel(formCard); });
    document.querySelector('#dashShowQuickCustomer')?.addEventListener('click', (event) => { event.preventDefault(); if (quickForm) { quickForm.hidden = false; quickForm.classList.add('bm-nested-modal'); } updateGlobalModalState(); });
    document.querySelector('#dashCancelQuickCustomer')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); if (quickForm) quickForm.hidden = true; updateGlobalModalState(); });
    quickForm?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(quickForm);
      const full = String(data.get('fullName') || '').trim();
      if (!full) return;
      const currentDb = loadDatabase();
      const [firstName, ...lastParts] = full.split(/\s+/);
      const customer = { id:createId('customer'), companyId:company.id, firstName:firstName || full, lastName:lastParts.join(' '), gender:'', phone:String(data.get('phone') || '').trim(), email:String(data.get('email') || '').trim(), updatedAt:currentDisplayDate(), lastVisit:'', importantInfo:String(data.get('description') || '').trim(), status:'aktywny' };
      saveUndoSnapshot('Dodanie klienta z grafiku', currentDb);
      currentDb.customers = currentDb.customers || [];
      currentDb.customers.push(customer);
      saveDatabase(currentDb);
      const select = form?.customerId;
      if (select) {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customerName(customer);
        select.appendChild(option);
        select.value = customer.id;
      }
      quickForm.hidden = true;
      quickForm.reset();
      updateGlobalModalState();
    });
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const currentDb = loadDatabase();
      const customer = (currentDb.customers || []).find(c => c.id === data.get('customerId'));
      const employee = employees.find(e => e.id === data.get('employeeId'));
      const service = (currentDb.services || []).find(s => s.id === data.get('serviceId'));
      const product = (currentDb.products || []).find(p => p.id === data.get('productId'));
      saveUndoSnapshot('Dodanie / nadpisanie wpisu do grafiku', currentDb);
      currentDb.dashboardVisits = currentDb.dashboardVisits || [];
      const newDate = String(data.get('date'));
      const newEmployeeId = String(data.get('employeeId'));
      const newStart = normalizeTimeValue(String(data.get('start')));
      const newEnd = normalizeTimeValue(String(data.get('end')));
      const newStartMin = minutesFromTime(newStart);
      const newEndMin = minutesFromTime(newEnd);
      const newVisit = { id:createId('dash_visit'), companyId:company.id, date:newDate, start:newStart, end:newEnd, customerId:String(data.get('customerId') || ''), clientName:customerName(customer || {}), employeeId:newEmployeeId, employeeName:employee?.fullName || '', serviceId:String(data.get('serviceId') || ''), serviceName:service?.name || '', productId:String(data.get('productId') || ''), productName:product?.name || '', total:String(data.get('total') || '0.00'), payment:String(data.get('payment') || 'gotówka'), note:String(data.get('note') || ''), status:'zaplanowane', cancelled:false, cancelReason:'', createdAt:new Date().toISOString() };
      const clippedVisits = [];
      currentDb.dashboardVisits.forEach(existing => {
        if (existing.companyId !== company.id || existing.date !== newDate || existing.employeeId !== newEmployeeId) { clippedVisits.push(existing); return; }
        const oldStart = normalizeTimeValue(existing.start);
        const oldEnd = normalizeTimeValue(existing.end);
        const oldStartMin = minutesFromTime(oldStart);
        const oldEndMin = minutesFromTime(oldEnd);
        const overlaps = oldStartMin != null && oldEndMin != null && newStartMin != null && newEndMin != null && oldStartMin < newEndMin && oldEndMin > newStartMin;
        if (!overlaps) { clippedVisits.push(existing); return; }
        if (oldStartMin < newStartMin) clippedVisits.push({ ...existing, id:createId('dash_visit'), start:oldStart, end:newStart });
        if (oldEndMin > newEndMin) clippedVisits.push({ ...existing, id:createId('dash_visit'), start:newEnd, end:oldEnd });
      });
      clippedVisits.push(newVisit);
      currentDb.dashboardVisits = clippedVisits.sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.employeeName||'').localeCompare(String(b.employeeName||'')) || String(a.start).localeCompare(String(b.start)));
      saveDatabase(currentDb);
      window.location.reload();
    });
    applyWorkerStateForDate(todayIso);
  };

  const getCompanyPositions = (db, companyId) => (db.positions || []).filter(position => position.companyId === companyId);
  const getActivePositions = (db, companyId) => getCompanyPositions(db, companyId).filter(position => position.active !== false);
  const getPositionById = (db, id) => (db.positions || []).find(position => position.id === id);
  const getUserPosition = (db, user) => getPositionById(db, user.positionId) || null;
  const roleAccessText = (role) => role === 'admin' ? 'Zarządzanie operacyjne: klienci, wizyty, zespół i raporty.' : 'Dostęp pracowniczy: własny grafik, przypisani klienci i zadania.';
  const phoneHintBlock = '<small class="bm-form-hint">Np. +48321321321</small>';

  const userTabPermissionsList = [
    ['dashboard', 'CompanyManager'],
    ['positions', 'Stanowiska pracy'],
    ['employees', 'Zespół'],
    ['daysOff', 'Dni wolne pracowników'],
    ['customers', 'Klienci'],
    ['services', 'Usługi'],
    ['products', 'Produkty'],
    ['visits', 'Wizyty'],
    ['walkins', 'Sprzedaż bez wizyty'],
    ['marketing', 'Marketing'],
    ['passes', 'Karnety'],
    ['owner', 'Właściciel strony'],
    ['sales', 'Sprzedaż'],
    ['reports', 'Wykres/Statystyka'],
    ['customersReports', 'Klienci - raporty'],
    ['dailyReport', 'Raport dzienny'],
    ['periodReport', 'Raport z okresu'],
    ['employeesReports', 'Pracownicy - raporty'],
    ['workSchedule', 'Grafik pracy'],
    ['smsReports', 'SMS'],
    ['emailReports', 'Email']
  ];

  const userPermissionsList = [
    'stanowiska pracy (dodawanie, edycja, usuwanie)',
    'Zespół - użytkownicy (dodawanie, edycja, usuwanie)',
    'dni wolne (dodawanie)',
    'dni wolne (usuwanie, edycja)',
    'klienci (dodawanie, edycja, usuwanie)',
    'klienci - historia (przeglądanie historii klientów - tabeli poniżej)',
    'usługi (dodawanie, edycja, usuwanie)',
    'produkty (dodawanie, edycja, usuwanie)',
    'produkty (magazyn)',
    'wizyty (dodawanie, edycja, zakończenie, usuwanie)',
    'wizyty (niezakończone) - dostęp do historii',
    'wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)',
    'wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)',
    'sprzedaż bez wizyt (dodawanie, edycja, usuwanie)',
    'sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)',
    'marketing (wysyłka reklamy sms/email/usuń)',
    'karnety (dodawanie, edycja, usuwanie)',
    'raport dzienny dzisiejszy (przeglądanie)',
    'raport dzienny wczorajszy, jutrzejszy (przeglądanie)',
    'grafik pracy (dodawanie)',
    'grafik pracy (edycja, usuwanie)',
    'dostęp do raportów',
    'export danych z całej platformy',
    'import danych do całej platformy'
  ];

  const defaultLoginJournal = () => [];

  const renderUsers = (ctx) => {
    const { db, user, company } = ctx;
    const companyUsers = db.users.filter(u => u.companyId === company.id && u.role !== 'owner');
    const canManageUsers = ['owner','admin'].includes(user.role);
    const positionsById = Object.fromEntries((db.positions || []).filter(position => position.companyId === company.id).map(position => [position.id, position]));
    const activePositions = (typeof getActivePositions === 'function' ? getActivePositions(db, company.id) : (db.positions || []).filter(position => position.companyId === company.id && position.active !== false));
    const positionOptions = activePositions.length
      ? `<option value="">Wybierz stanowisko pracy</option>${activePositions.map(position => `<option value="${escapeHtml(position.id)}">${escapeHtml(position.name || 'Stanowisko pracy')}</option>`).join('')}`
      : `<option value="">Brak aktywnych stanowisk pracy</option>`;
    const rows = companyUsers.map((u, index) => {
      const position = positionsById[u.positionId] || {};
      return [
        escapeHtml(u.email || u.login || '-'),
        escapeHtml(u.fullName || '-'),
        escapeHtml(String(u.phone || '').replace(/\D/g, '') || ''),
        escapeHtml(position.name || u.position || '-'),
        escapeHtml(position.description || u.positionDescription || u.description || '-'),
        escapeHtml(String(u.role || '-').toUpperCase()),
        escapeHtml(u.loginAllowedText || (index === 1 ? 'tylko w godz. od 4:00 do 22:00' : ''))
      ];
    });
    const loginRows = (db.loginJournal || defaultLoginJournal()).map(row => {
      if (Array.isArray(row)) return row.map(escapeHtml);
      return [row.date, row.ip, row.login, row.status, row.browser].map(escapeHtml);
    });
    const tabPermissionChecks = userTabPermissionsList.map(([pageId, label]) => `<label class="cm-permission-check"><input type="checkbox" name="permissions" value="open:${escapeHtml(pageId)}"> <span>${escapeHtml(label)}</span></label>`).join('');
    const actionPermissionChecks = userPermissionsList.map((label) => `<label class="cm-permission-check"><input type="checkbox" name="permissions" value="${escapeHtml(label)}"> <span>${escapeHtml(label)}</span></label>`).join('');
    const permissionChecks = `<div class="cm-permission-section-title">Możliwość Otwierania zakładek:</div><div class="cm-permissions-grid cm-tab-permissions-grid">${tabPermissionChecks}</div><div class="cm-permission-section-title">Funkcje w systemie:</div><div class="cm-permissions-grid">${actionPermissionChecks}</div>`;
    const userOptions = companyUsers.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName || item.email || item.login || 'Użytkownik')}</option>`).join('');

    const content = `<section class="bm-page-card cm-users-admin-page">
      <div class="bm-page-head cm-users-head"><h2>Użytkownicy</h2>${canManageUsers ? `<div class="bm-actions-row"><button id="showAddAdminUserBtn" type="button">Dodaj użytkownika</button><button id="showEditAdminUserBtn" type="button">Edytuj</button><button id="showDeleteAdminUserBtn" type="button" class="bm-danger-btn">Usuń pracownika</button></div>` : ''}</div>
      <div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('usersLimit', '50')}</div>
      <div class="bm-table-wrap cm-users-table-wrap"><table class="bm-table cm-users-table"><thead><tr><th>Login</th><th>Imię i nazwisko</th><th>Numer telefonu</th><th>Stanowisko</th><th>Opis stanowiska</th><th>Rola</th><th>Logowanie dozwolone</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="bm-muted cm-table-count">Pozycje od 1 do ${companyUsers.length} z ${companyUsers.length} łącznie</p>
    </section>

    <section class="bm-page-card cm-login-journal-card">
      <div class="bm-page-head"><h2>Dziennik logowania</h2></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('loginJournalLimit', '50')}</div>
      ${table(['Data','IP','Login','Status','Przeglądarka internetowa'], loginRows)}
    </section>

    <section id="addAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Dodaj użytkownika</h2>
      <form id="addAdminUserForm" class="bm-form-grid cm-admin-user-form">
        <label>Adres email<input name="email" type="email" placeholder="Adres email" required></label>
        <label>Imię i nazwisko<input name="fullName" placeholder="Imię i nazwisko" required></label>
        <label>Nr telefonu<input name="phone" type="tel" placeholder="Nr telefonu" required></label>
        <p class="bm-muted cm-phone-hint">Np. +48321321321</p>
        <label>Hasło<input name="password" type="password" placeholder="Hasło" required></label>
        <label>Potwierdzenie hasła<input name="passwordConfirm" type="password" placeholder="Potwierdzenie hasła" required></label>
        <label>Stanowisko pracy<select name="positionId">${positionOptions}</select></label>
        <label>Rola<select name="role"><option value="employee">EMPLOYEE</option><option value="admin">ADMIN</option></select></label>

        <fieldset class="cm-login-rules">
          <legend>Funkcje logowania</legend>
          <label class="cm-check-line"><input type="checkbox" name="blockedLogin"> zablokuj logowanie</label>
          <label class="cm-check-line"><input type="checkbox" name="hoursOnly" id="hoursOnlyCheck"> Logowanie tylko w godzinach</label>
          <div class="cm-hours-row">
            <label>od<input name="loginFrom" type="time" value="04:00"></label>
            <label>do<input name="loginTo" type="time" value="22:00"></label>
          </div>
        </fieldset>

        <fieldset class="cm-permissions-box">
          <legend>Uprawnienia</legend>
          ${permissionChecks}
        </fieldset>

        <button type="submit">Dodaj użytkownika</button>
      </form>
      <p id="addAdminUserMessage" class="panel-message"></p>
    </section>

    ${canManageUsers ? `<section id="editAdminUserPanel" class="bm-page-card bm-collapsible-panel cm-admin-user-modal" hidden>
      <h2>Edytuj użytkownika</h2>
      ${companyUsers.length ? `<form id="editAdminUserForm" class="bm-form-grid cm-admin-user-form">
        <label class="cm-full-field">Wybierz użytkownika<select name="userId" id="editAdminUserSelect" required>${userOptions}</select></label>
        <label>Adres email<input name="email" type="email" placeholder="Adres email" required></label>
        <label>Imię i nazwisko<input name="fullName" placeholder="Imię i nazwisko" required></label>
        <label>Nr telefonu<input name="phone" type="tel" placeholder="Nr telefonu" required></label>
        <p class="bm-muted cm-phone-hint">Np. +48321321321</p>
        <label>Hasło<input name="password" type="password" placeholder="Hasło"></label>
        <label>Potwierdzenie hasła<input name="passwordConfirm" type="password" placeholder="Potwierdzenie hasła"></label>
        <label>Stanowisko pracy<select name="positionId">${positionOptions}</select></label>
        <label>Rola<select name="role"><option value="employee">EMPLOYEE</option><option value="admin">ADMIN</option></select></label>

        <fieldset class="cm-login-rules">
          <legend>Funkcje logowania</legend>
          <label class="cm-check-line"><input type="checkbox" name="blockedLogin"> zablokuj logowanie</label>
          <label class="cm-check-line"><input type="checkbox" name="hoursOnly"> Logowanie tylko w godzinach</label>
          <div class="cm-hours-row">
            <label>od<input name="loginFrom" type="time" value="04:00"></label>
            <label>do<input name="loginTo" type="time" value="22:00"></label>
          </div>
        </fieldset>

        <fieldset class="cm-permissions-box">
          <legend>Uprawnienia</legend>
          ${permissionChecks}
        </fieldset>

        <button type="submit">Zatwierdź</button>
      </form><p id="editAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak użytkowników do edycji.</p>`}
    </section>` : ''}

    ${canManageUsers ? `<section id="deleteAdminUserPanel" class="bm-page-card bm-collapsible-panel" hidden>
      <h2>Usuń pracownika</h2>
      ${companyUsers.length ? `<form id="deleteAdminUserForm" class="bm-form-grid"><label class="full">Wybierz pracownika<select name="employeeId" required>${userOptions}</select></label><button type="submit" class="bm-danger-btn">Usuń pracownika</button></form><p id="deleteAdminUserMessage" class="panel-message"></p>` : `<p class="bm-muted">Brak pracowników do usunięcia.</p>`}
    </section>` : ''}`;

    renderPanelFrame(ctx, 'users', content, '', '');
    setupLimitDropdown('#usersLimit', null);
    setupLimitDropdown('#loginJournalLimit', null);

    const showAddBtn = document.querySelector('#showAddAdminUserBtn');
    const showEditBtn = document.querySelector('#showEditAdminUserBtn');
    const showDeleteBtn = document.querySelector('#showDeleteAdminUserBtn');
    const addPanel = document.querySelector('#addAdminUserPanel');
    const editPanel = document.querySelector('#editAdminUserPanel');
    const deletePanel = document.querySelector('#deleteAdminUserPanel');
    const userPanels = [addPanel, editPanel, deletePanel].filter(Boolean);
    if (showAddBtn && addPanel) showAddBtn.addEventListener('click', () => showOnlyPanel(addPanel, userPanels));
    if (showEditBtn && editPanel) showEditBtn.addEventListener('click', () => showOnlyPanel(editPanel, userPanels));
    if (showDeleteBtn && deletePanel) showDeleteBtn.addEventListener('click', () => showOnlyPanel(deletePanel, userPanels));

    const form = document.querySelector('#addAdminUserForm');
    if (form) form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const msg = document.querySelector('#addAdminUserMessage');
      const email = String(data.email || '').trim().toLowerCase();
      const phone = String(data.phone || '').trim();
      if (!/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ''))) { msg.textContent = 'Podaj numer telefonu w formacie np. +48321321321.'; msg.style.color = '#fca5a5'; return; }
      if (String(data.password || '') !== String(data.passwordConfirm || '')) { msg.textContent = 'Hasła nie są takie same.'; msg.style.color = '#fca5a5'; return; }
      const currentDb = loadDatabase();
      if (currentDb.users.some(u => String(u.email || u.login || '').toLowerCase() === email)) { msg.textContent = 'Konto z takim e-mailem już istnieje.'; msg.style.color = '#fca5a5'; return; }
      const selectedPermissions = [...form.querySelectorAll('input[name="permissions"]:checked')].map(input => input.value);
      const hoursOnly = Boolean(form.querySelector('[name="hoursOnly"]')?.checked);
      const blockedLogin = Boolean(form.querySelector('[name="blockedLogin"]')?.checked);
      const loginAllowedText = blockedLogin ? 'zablokowane' : (hoursOnly ? `tylko w godz. od ${data.loginFrom || '04:00'} do ${data.loginTo || '22:00'}` : '');
      saveUndoSnapshot('Dodanie użytkownika', currentDb);
      currentDb.users.push({
        id: createId('user'),
        login: email,
        email,
        password: String(data.password || ''),
        fullName: String(data.fullName || '').trim(),
        phone,
        role: data.role || 'employee',
        companyId: company.id,
        positionId: String(data.positionId || ''),
        loginBlocked: blockedLogin,
        loginHoursOnly: hoursOnly,
        loginFrom: data.loginFrom || '',
        loginTo: data.loginTo || '',
        loginAllowedText,
        permissions: selectedPermissions,
        createdAt: new Date().toISOString()
      });
      saveDatabase(currentDb);
      msg.textContent = 'Użytkownik dodany do lokalnej bazy demo.';
      msg.style.color = '#86efac';
      setTimeout(() => window.location.reload(), 650);
    });

    const editForm = document.querySelector('#editAdminUserForm');
    const editSelect = document.querySelector('#editAdminUserSelect');
    const editableUsersSnapshot = companyUsers.map(item => ({
      id: item.id,
      login: item.login || item.email || '',
      email: item.email || item.login || '',
      password: item.password || '',
      fullName: item.fullName || '',
      phone: String(item.phone || ''),
      role: item.role || 'employee',
      positionId: item.positionId || '',
      loginBlocked: Boolean(item.loginBlocked),
      loginHoursOnly: Boolean(item.loginHoursOnly),
      loginFrom: item.loginFrom || '04:00',
      loginTo: item.loginTo || '22:00',
      permissions: Array.isArray(item.permissions) ? item.permissions : [],
    }));
    const fillEditAdminUserForm = () => {
      if (!editForm || !editSelect) return;
      const selected = editableUsersSnapshot.find(item => item.id === editSelect.value) || editableUsersSnapshot[0];
      if (!selected) return;
      editForm.elements.email.value = selected.email;
      editForm.elements.password.value = selected.password;
      editForm.elements.passwordConfirm.value = selected.password;
      editForm.elements.fullName.value = selected.fullName;
      editForm.elements.phone.value = selected.phone;
      editForm.elements.role.value = selected.role;
      if (editForm.elements.positionId) editForm.elements.positionId.value = selected.positionId || '';
      editForm.elements.blockedLogin.checked = selected.loginBlocked;
      editForm.elements.hoursOnly.checked = selected.loginHoursOnly;
      editForm.elements.loginFrom.value = selected.loginFrom;
      editForm.elements.loginTo.value = selected.loginTo;
      const selectedPermissions = new Set(selected.permissions || []);
      editForm.querySelectorAll('input[name="permissions"]').forEach(input => { input.checked = selectedPermissions.has(input.value); });
    };
    editSelect?.addEventListener('change', fillEditAdminUserForm);
    fillEditAdminUserForm();
    editForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(editForm).entries());
      const msg = document.querySelector('#editAdminUserMessage');
      const userId = String(data.userId || '');
      const email = String(data.email || '').trim().toLowerCase();
      const phone = String(data.phone || '').trim();
      if (!/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ''))) { if (msg) { msg.textContent = 'Podaj numer telefonu w formacie np. +48321321321.'; msg.style.color = '#fca5a5'; } return; }
      if (String(data.password || '') !== String(data.passwordConfirm || '')) { if (msg) { msg.textContent = 'Hasła nie są takie same.'; msg.style.color = '#fca5a5'; } return; }
      const currentDb = loadDatabase();
      const index = (currentDb.users || []).findIndex(item => item.id === userId && item.companyId === company.id && item.role !== 'owner');
      if (index < 0) { if (msg) { msg.textContent = 'Nie znaleziono użytkownika do edycji.'; msg.style.color = '#fca5a5'; } return; }
      if ((currentDb.users || []).some((item, itemIndex) => itemIndex !== index && String(item.email || item.login || '').toLowerCase() === email)) { if (msg) { msg.textContent = 'Konto z takim e-mailem już istnieje.'; msg.style.color = '#fca5a5'; } return; }
      const selectedPermissions = [...editForm.querySelectorAll('input[name="permissions"]:checked')].map(input => input.value);
      const hoursOnly = Boolean(editForm.querySelector('[name="hoursOnly"]')?.checked);
      const blockedLogin = Boolean(editForm.querySelector('[name="blockedLogin"]')?.checked);
      const loginAllowedText = blockedLogin ? 'zablokowane' : (hoursOnly ? `tylko w godz. od ${data.loginFrom || '04:00'} do ${data.loginTo || '22:00'}` : '');
      saveUndoSnapshot('Edycja użytkownika', currentDb);
      currentDb.users[index] = {
        ...currentDb.users[index],
        login: email,
        email,
        password: String(data.password || currentDb.users[index].password || ''),
        fullName: String(data.fullName || '').trim(),
        phone,
        role: data.role || 'employee',
        positionId: String(data.positionId || ''),
        loginBlocked: blockedLogin,
        loginHoursOnly: hoursOnly,
        loginFrom: data.loginFrom || '',
        loginTo: data.loginTo || '',
        loginAllowedText,
        permissions: selectedPermissions,
        updatedAt: new Date().toISOString()
      };
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Użytkownik zaktualizowany.'; msg.style.color = '#86efac'; }
      setTimeout(() => window.location.reload(), 650);
    });

    document.querySelector('#deleteAdminUserForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const currentDb = loadDatabase();
      const target = (currentDb.users || []).find(u => u.id === data.employeeId);
      const msg = document.querySelector('#deleteAdminUserMessage');
      if (!target || target.role === 'owner') { if (msg) { msg.textContent = 'Nie można usunąć tego użytkownika.'; msg.style.color = '#fca5a5'; } return; }
      if (user.role === 'admin' && target.role === 'admin') { if (msg) { msg.textContent = 'ADMIN może usuwać tylko EMPLOYEE.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie pracownika', currentDb);
      currentDb.users = (currentDb.users || []).filter(u => u.id !== target.id);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Pracownik usunięty.'; msg.style.color = '#86efac'; }
      setTimeout(() => window.location.reload(), 650);
    });
  };


  const renderEmployees = (ctx) => {
    const { db, company } = ctx;
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const positions = (db.positions || []).filter(p => p.companyId === company.id);
    const positionById = Object.fromEntries(positions.map(p => [p.id, p]));
    const rows = employees.map(employee => {
      const position = positionById[employee.positionId] || {};
      return [
        escapeHtml(employee.fullName || '—'),
        escapeHtml(employee.phone || '—'),
        escapeHtml(position.name || employee.position || '—'),
        escapeHtml(position.description || employee.positionDescription || '—'),
        escapeHtml((employee.role || 'employee').toUpperCase())
      ];
    });
    const content = `<section class="bm-page-card cm-employees-page">
      <div class="bm-page-head cm-users-head"><h2>Zespół</h2></div>
      <div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('employeesLimit', '50')}</div>
      <div class="bm-table-wrap"><table class="bm-table"><thead><tr><th>Imię i nazwisko</th><th>Numer telefonu</th><th>Stanowisko</th><th>Opis stanowiska</th><th>Rola</th></tr></thead><tbody>${rows.length ? rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="5" class="bm-muted">Brak pracowników w zespole.</td></tr>`}</tbody></table></div>
    </section>`;
    renderPanelFrame(ctx, 'employees', content, '', '');
    setupLimitDropdown('#employeesLimit', null);
  };

  const renderCalendar = (ctx) => {
    const content = `<section class="bm-page-card"><h2>Kalendarz wizyt — ${formatDisplayDate(CM_TODAY)}</h2><div class="bm-day-columns"><div><b>08:00</b><span>Wolny termin</span></div><div class="busy"><b>10:00</b><span>Jan Kowalski — Konsultacja</span></div><div class="busy"><b>13:30</b><span>Firma Testowa — Spotkanie</span></div><div><b>16:00</b><span>Nowa rezerwacja</span></div></div></section>`;
    renderPanelFrame(ctx, 'calendar', content, 'Kalendarz', 'Terminy, wizyty i grafiki pracy.');
  };


  const limitDropdownHtml = (id, selected) => {
    const value = getGlobalPageLimit(selected);
    return `
    <div class="cm-limit-dropdown" data-limit-dropdown>
      <input type="hidden" id="${id}" value="${value}">
      <button type="button" class="cm-limit-toggle" data-limit-toggle>${value} ▾</button>
      <div class="cm-limit-menu" hidden>
        <button type="button" data-limit-value="50">50 pozycji na stronę</button>
        <button type="button" data-limit-value="100">100 pozycji na stronę</button>
        <button type="button" data-limit-value="200">200 pozycji na stronę</button>
      </div>
    </div>`;
  };

  const setupLimitDropdown = (inputSelector, onChange) => {
    const input = document.querySelector(inputSelector);
    const root = input?.closest('[data-limit-dropdown]');
    if (!input || !root) return;
    const toggle = root.querySelector('[data-limit-toggle]');
    const menu = root.querySelector('.cm-limit-menu');
    toggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.cm-limit-menu').forEach(item => { if (item !== menu) item.hidden = true; });
      if (menu) menu.hidden = !menu.hidden;
    });
    root.querySelectorAll('[data-limit-value]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const value = btn.getAttribute('data-limit-value') || input.value;
        input.value = value;
        setGlobalPageLimit(value);
        if (toggle) toggle.textContent = `${value} ▾`;
        if (menu) menu.hidden = true;
        if (typeof onChange === 'function') onChange();
      });
    });
    document.addEventListener('click', () => { if (menu) menu.hidden = true; });
  };


  const findNearestPageLimit = (container) => {
    const card = container?.closest('section, .bm-page-card, .cm-customer-report-card, .customers-module, .sales-module') || document;
    const hiddenLimit = card.querySelector('input[id$="Limit"], input[id*="Limit"], input[type="hidden"][value="50"], input[type="hidden"][value="100"], input[type="hidden"][value="200"]');
    const selectLimit = card.querySelector('select[id$="PageSize"], select[id*="Limit"], select[id*="limit"]');
    const raw = hiddenLimit?.value || selectLimit?.value || getGlobalPageLimit('50');
    const limit = Number(raw);
    return Number.isFinite(limit) && limit > 0 ? limit : 50;
  };


  const cleanupLegacyPagination = (root = document) => {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll('.cm-sales-pager').forEach(node => node.remove());
    scope.querySelectorAll('p.bm-muted, p.cm-table-count, .cm-table-count, p.cm-table-footer, .cm-table-footer').forEach(node => {
      const text = normalizeText(node.textContent || '');
      if (/^pozycje od /.test(text) || /^pozycji \d+ z \d+/.test(text) || /^pozycji 0 z 0/.test(text)) node.remove();
    });
    scope.querySelectorAll('span, div, p').forEach(node => {
      if (node.closest('.cm-table-pagination')) return;
      const text = normalizeText(node.textContent || '');
      if (/^strona\s*\d+\s*z\s*\d+$/.test(text)) node.remove();
    });
  };

  const setupGlobalTablePagination = (root = document) => {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll('.bm-table-wrap').forEach((wrap, wrapIndex) => {
      const tableEl = wrap.querySelector('table.bm-table');
      if (!tableEl || tableEl.dataset.paginationReady === '1') return;
      const tbody = tableEl.querySelector('tbody');
      if (!tbody) return;
      const allRows = [...tbody.querySelectorAll('tr')];
      if (!allRows.length) return;
      const isSummaryOnly = allRows.length === 1 && normalizeText(allRows[0].textContent || '').includes('suma');
      if (isSummaryOnly) return;
      tableEl.dataset.paginationReady = '1';

      let currentPage = 1;
      const controls = document.createElement('div');
      controls.className = 'cm-table-pagination';
      controls.innerHTML = `
        <div class="cm-table-pagination-info"></div>
        <div class="cm-table-pagination-controls">
          <button type="button" class="bm-light-btn cm-page-prev" aria-label="Poprzednia strona">&lt;</button>
          <span><b class="cm-page-current">1</b> z <b class="cm-page-total">1</b></span>
          <button type="button" class="bm-light-btn cm-page-next" aria-label="Następna strona">&gt;</button>
        </div>`;
      wrap.insertAdjacentElement('afterend', controls);

      const renderPage = () => {
        const limit = findNearestPageLimit(wrap);
        const totalRows = allRows.length;
        const totalPages = Math.max(1, Math.ceil(totalRows / limit));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);
        const start = (currentPage - 1) * limit;
        const end = Math.min(start + limit, totalRows);
        allRows.forEach((row, index) => { row.hidden = index < start || index >= end; });
        const info = controls.querySelector('.cm-table-pagination-info');
        const current = controls.querySelector('.cm-page-current');
        const total = controls.querySelector('.cm-page-total');
        const prev = controls.querySelector('.cm-page-prev');
        const next = controls.querySelector('.cm-page-next');
        if (info) info.textContent = totalRows ? `Pozycje od ${start + 1} do ${end} z ${totalRows} łącznie` : 'Pozycji 0 z 0 dostępnych';
        if (current) current.textContent = String(currentPage);
        if (total) total.textContent = String(totalPages);
        if (prev) prev.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;
        controls.hidden = totalPages <= 1;
      };

      controls.querySelector('.cm-page-prev')?.addEventListener('click', () => { currentPage -= 1; renderPage(); });
      controls.querySelector('.cm-page-next')?.addEventListener('click', () => { currentPage += 1; renderPage(); });
      document.addEventListener('change', (event) => {
        const target = event.target;
        if (target && (target.matches('select[id*="Limit"], select[id$="PageSize"], select[data-global-page-limit]') || target.matches('input[id*="Limit"]'))) {
          if (['50','100','200'].includes(String(target.value))) setGlobalPageLimit(target.value);
          currentPage = 1;
          renderPage();
        }
      });
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.closest('[data-limit-value]')) {
          currentPage = 1;
          setTimeout(renderPage, 0);
        }
      });
      renderPage();
    });
  };

  const renderCustomers = (ctx) => {
    const { db, company, user } = ctx;
    const statusOptions = ['aktywny','nieaktywny'];
    const genderOptions = ['kobieta','mężczyzna'];
    const yesNoOptions = ['tak','nie'];
    const getCustomerGroups = () => (loadDatabase().customerGroups || []).filter(g => g.companyId === company.id);
    const getCustomerTableRows = (items) => items.map(c => [
      escapeHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim() || '-'),
      escapeHtml(c.gender || ''),
      escapeHtml(c.phone || ''),
      escapeHtml(c.email || ''),
      escapeHtml(c.updatedAt || ''),
      escapeHtml(c.lastVisit || ''),
      escapeHtml(c.importantInfo || ''),
      `<span class="bm-status ${String(c.status).toLowerCase()==='nieaktywny' ? 'inactive' : 'active'}">${escapeHtml(c.status || 'aktywny')}</span>`
    ]);
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const rows = getCustomerTableRows(customers);
    const groupOptions = getCustomerGroups();
    const lastAction = loadLastAction();
    const canUndoCustomers = lastAction && lastAction.type === 'customers-delete' && lastAction.companyId === company.id && Array.isArray(lastAction.records) && lastAction.records.length;
    const customerHistoryPermission = 'klienci - historia (przeglądanie historii klientów - tabeli poniżej)';
    const canViewCustomerHistory = hasSystemPermission(user, customerHistoryPermission);
    const customerTableHtml = canViewCustomerHistory ? table(['Imie Nazwisko','Płeć','Telefon','Email','Aktualizacja','Ostatnia wizyta','Ważna informacja','Status'], rows) : permissionBlockedHtml(customerHistoryPermission);

    const content = `<section class="bm-page-card customers-module">
      <div class="bm-page-head customers-head"><h2>Lista klientów</h2><div class="bm-actions-row"><button id="exportCustomersBtn" type="button" class="bm-excel-btn">Export</button><button id="importCustomersBtn" type="button" class="bm-excel-btn">Import</button><input id="importCustomersFile" type="file" accept=".xls,.xlsx,.csv" hidden><button id="showAddCustomer" type="button">Dodaj</button><button id="showDeleteCustomer" type="button" class="bm-danger-btn">Usuń</button></div></div>
      ${canViewCustomerHistory ? `<div class="bm-table-toolbar"><label class="cm-limit-label">${limitDropdownHtml('customersLimit', 200)}</label><label>Szukaj: <input id="customersSearch" type="search" placeholder="Szukaj klienta"></label></div>` : ''}
      <div id="customersTableWrap">${customerTableHtml}</div>
      <p id="customersMessage" class="panel-message"></p>
    </section>
    <section class="bm-page-card" id="customerFormCard" hidden>
      <h2>Dodaj klienta</h2>
      <form id="customerForm" class="bm-form-grid">
        <label>Imie<input name="firstName" placeholder="Imie" required></label>
        <label>Nazwisko<input name="lastName" placeholder="Nazwisko" required></label>
        <label>Płeć<select name="gender" required>${genderOptions.map(g => `<option value="${g}">${g}</option>`).join('')}</select></label>
        <label>Telefon<input name="phone" placeholder="Telefon" required></label>
        <label>Email<input name="email" type="email" placeholder="email@firma.pl"></label>
        <label>Aktualizacja<input name="updatedAt" placeholder="dd.mm.rrrr" value="${currentDisplayDate()}" required></label>
        <label>Ostatnia wizyta<input name="lastVisit" placeholder="dd.mm.rrrr" value="${currentDisplayDate()}"></label>
        <label>Status<select name="status">${statusOptions.map(status => `<option value="${status}">${status}</option>`).join('')}</select></label>
        <label>Skąd klient wie o firmie<input name="source" placeholder="np. Google, Facebook, polecenie"></label>
        <label>Cechy szczególne<input name="specialFeatures" placeholder="np. VIP, preferencje, uwagi"></label>
        <label>Nr karty klienta<input name="cardNumber" placeholder="Nr karty klienta"></label>
        <label>Osoba polecająca<input name="referrer" placeholder="Imię i nazwisko"></label>
        <label>Powiadamiaj o wizytach — SMS<select name="visitSms">${yesNoOptions.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
        <label>Powiadamiaj o wizytach — Email<select name="visitEmail">${yesNoOptions.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
        <label>Zgoda na reklamę — SMS<select name="marketingSms">${yesNoOptions.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
        <label>Zgoda na reklamę — Email<select name="marketingEmail">${yesNoOptions.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
        <label>Rabat na usługi (%)<input name="serviceDiscount" type="number" min="0" max="100" step="1" placeholder="0"></label>
        <label>Rabat na produkty (%)<input name="productDiscount" type="number" min="0" max="100" step="1" placeholder="0"></label>
        <label>Należy do grup<select name="group" id="customerGroupSelect"><option value="">Brak grupy</option>${groupOptions.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join('')}</select></label>
        <label>Dodaj nową grupę<input name="newGroup" placeholder="Nazwa nowej grupy"></label>
        <label>Dzień, miesiąc i rok urodzin<input name="birthDate" type="date"></label>
        <label>Dzień i miesiąc imienin<input name="nameDay" placeholder="DD.MM"></label>
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
        <label>Płeć<select name="gender"><option value="">Nie bierz pod uwagę</option>${genderOptions.map(g => `<option value="${g}">${g}</option>`).join('')}</select></label>
        <label>Telefon<input name="phone" placeholder="Telefon"></label>
        <label>Email<input name="email" type="email" placeholder="email@firma.pl"></label>
        <button type="submit" class="bm-danger-btn">Usuń</button>
      </form>
      <p id="customerDeleteMessage" class="panel-message"></p>
    </section>`;
    renderPanelFrame(ctx, 'customers', content, '', '');

    const renderFilteredCustomers = () => {
      if (!canViewCustomerHistory) return;
      const currentDb = loadDatabase();
      const all = (currentDb.customers || []).filter(c => c.companyId === company.id);
      const search = String(document.querySelector('#customersSearch')?.value || '').toLowerCase().trim();
      const limit = Number(document.querySelector('#customersLimit')?.value || 200);
      const filtered = all.filter(c => {
        const text = `${c.firstName||''} ${c.lastName||''} ${c.gender||''} ${c.phone||''} ${c.email||''} ${c.updatedAt||''} ${c.lastVisit||''} ${c.importantInfo||''} ${c.status||''}`.toLowerCase();
        return !search || text.includes(search);
      });
      const wrap = document.querySelector('#customersTableWrap');
      if (wrap) {
        wrap.innerHTML = table(['Imie Nazwisko','Płeć','Telefon','Email','Aktualizacja','Ostatnia wizyta','Ważna informacja','Status'], getCustomerTableRows(filtered));
        cleanupLegacyPagination(wrap);
        setupGlobalTablePagination(wrap);
      }
    };

    setupLimitDropdown('#customersLimit', renderFilteredCustomers);
    document.querySelector('#customersSearch')?.addEventListener('input', renderFilteredCustomers);
    const customerFormCard = document.querySelector('#customerFormCard');
    const customerDeleteCard = document.querySelector('#customerDeleteCard');
    document.querySelector('#showAddCustomer')?.addEventListener('click', () => showOnlyPanel(customerFormCard, [customerFormCard, customerDeleteCard]));
    document.querySelector('#showDeleteCustomer')?.addEventListener('click', () => showOnlyPanel(customerDeleteCard, [customerFormCard, customerDeleteCard]));
    document.querySelector('#customerForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#customerFormMessage');
      if (!String(data.firstName || '').trim() || !String(data.lastName || '').trim() || !String(data.phone || '').trim() || !String(data.updatedAt || '').trim()) {
        if (msg) { msg.textContent = 'Uzupełnij wymagane dane klienta.'; msg.style.color = '#fca5a5'; msg.style.display = 'block'; }
        return;
      }
      const currentDb = loadDatabase();
      currentDb.customers = currentDb.customers || [];
      currentDb.customerGroups = currentDb.customerGroups || [];
      saveUndoSnapshot('Dodanie klienta', currentDb);
      let selectedGroup = String(data.group || '').trim();
      const newGroup = String(data.newGroup || '').trim();
      if (newGroup) {
        selectedGroup = newGroup;
        if (!currentDb.customerGroups.some(g => g.companyId === company.id && String(g.name).toLowerCase() === newGroup.toLowerCase())) {
          currentDb.customerGroups.push({ id: createId('group'), companyId: company.id, name: newGroup, createdAt: new Date().toISOString() });
        }
      }
      currentDb.customers.push({
        id: createId('customer'),
        companyId: company.id,
        firstName: String(data.firstName || '').trim(),
        lastName: String(data.lastName || '').trim(),
        gender: String(data.gender || '').trim(),
        phone: String(data.phone || '').trim(),
        email: String(data.email || '').trim(),
        updatedAt: String(data.updatedAt || '').trim(),
        lastVisit: String(data.lastVisit || '').trim(),
        importantInfo: String(data.importantInfo || '').trim(),
        status: String(data.status || 'aktywny').trim(),
        source: String(data.source || '').trim(),
        specialFeatures: String(data.specialFeatures || '').trim(),
        cardNumber: String(data.cardNumber || '').trim(),
        referrer: String(data.referrer || '').trim(),
        visitSms: String(data.visitSms || 'tak').trim(),
        visitEmail: String(data.visitEmail || 'tak').trim(),
        marketingSms: String(data.marketingSms || 'nie').trim(),
        marketingEmail: String(data.marketingEmail || 'nie').trim(),
        serviceDiscount: String(data.serviceDiscount || '').trim(),
        productDiscount: String(data.productDiscount || '').trim(),
        group: selectedGroup,
        birthDate: String(data.birthDate || '').trim(),
        nameDay: String(data.nameDay || '').trim(),
        createdAt: new Date().toISOString()
      });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Klient zapisany.'; msg.style.color = '#86efac'; msg.style.display = 'block'; }
      setTimeout(()=>window.location.reload(),650);
    });
    document.querySelector('#exportCustomersBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const data = (currentDb.customers || []).filter(c => c.companyId === company.id);
      const headers = ['Imie','Nazwisko','Płeć','Telefon','Email','Aktualizacja','Ostatnia wizyta','Ważna informacja','Status','Skąd klient wie o firmie','Cechy szczególne','Nr karty klienta','Osoba polecająca','Powiadamiaj o wizytach SMS','Powiadamiaj o wizytach Email','Zgoda na reklamę SMS','Zgoda na reklamę Email','Rabat na usługi (%)','Rabat na produkty (%)','Należy do grup','Dzień, miesiąc i rok urodzin','Dzień i miesiąc imienin'];
      const lines = [headers.join('\t'), ...data.map(c => [
        c.firstName || '', c.lastName || '', c.gender || '', c.phone || '', c.email || '', c.updatedAt || '', c.lastVisit || '', c.importantInfo || '', c.status || '', c.source || '', c.specialFeatures || '', c.cardNumber || '', c.referrer || '', c.visitSms || '', c.visitEmail || '', c.marketingSms || '', c.marketingEmail || '', c.serviceDiscount || '', c.productDiscount || '', c.group || '', c.birthDate || '', c.nameDay || ''
      ].map(value => String(value).replace(/\t/g,' ').replace(/\n/g,' ')).join('\t'))];
      const blob = new Blob([lines.join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'klienci-companymanager.xls';
      link.click();
      URL.revokeObjectURL(url);
    });
    document.querySelector('#importCustomersBtn')?.addEventListener('click', () => {
      document.querySelector('#importCustomersFile')?.click();
    });
    document.querySelector('#importCustomersFile')?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      const msg = document.querySelector('#customersMessage');
      if (file && msg) {
        msg.textContent = `Wybrano plik do importu: ${file.name}. Import danych podepniemy w kolejnym etapie.`;
        msg.style.color = '#86efac';
        msg.style.display = 'block';
      }
    });
    document.querySelector('#customerDeleteForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#customerDeleteMessage');
      const normalize = (value) => String(value || '').trim().toLowerCase();
      const normalizePhone = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();
      const criteria = {
        firstName: normalize(data.firstName),
        lastName: normalize(data.lastName),
        gender: normalize(data.gender),
        phone: normalizePhone(data.phone),
        email: normalize(data.email)
      };
      if (!criteria.firstName && !criteria.lastName && !criteria.gender && !criteria.phone && !criteria.email) {
        if (msg) { msg.textContent = 'Podaj przynajmniej jedną daną klienta do usunięcia.'; msg.style.color = '#fca5a5'; msg.style.display = 'block'; }
        return;
      }
      const currentDb = loadDatabase();
      const removedCustomers = [];
      const beforeDeleteDb = cloneData(currentDb);
      currentDb.customers = (currentDb.customers || []).filter(customer => {
        if (customer.companyId !== company.id) return true;
        const matches =
          (!criteria.firstName || normalize(customer.firstName) === criteria.firstName) &&
          (!criteria.lastName || normalize(customer.lastName) === criteria.lastName) &&
          (!criteria.gender || normalize(customer.gender) === criteria.gender) &&
          (!criteria.phone || normalizePhone(customer.phone) === criteria.phone) &&
          (!criteria.email || normalize(customer.email) === criteria.email);
        if (matches) removedCustomers.push({ ...customer });
        return !matches;
      });
      const removed = removedCustomers.length;
      if (!removed) {
        if (msg) { msg.textContent = 'Nie znaleziono klienta pasującego do podanych danych.'; msg.style.color = '#fca5a5'; msg.style.display = 'block'; }
        return;
      }
      saveLastAction({ type: 'database-snapshot', label: 'Usunięcie klienta', database: beforeDeleteDb });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = `Usunięto klientów: ${removed}. Możesz cofnąć ostatnią zmianę przyciskiem Cofnij Czas.`; msg.style.color = '#86efac'; msg.style.display = 'block'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };

  const formatIsoDatePL = (iso) => {
    const [y,m,d] = String(iso || '').split('-');
    if (!y || !m || !d) return '';
    return `${d}.${m}.${y}`;
  };
  const toIsoDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const isIsoInRange = (iso, start, end) => iso >= start && iso <= end;
  let daysOffCalendarDate = new Date(CM_TODAY.getFullYear(), CM_TODAY.getMonth(), 1);

  const renderPositions = (ctx) => {
    const { db, company } = ctx;
    const positions = getCompanyPositions(db, company.id);
    const rows = positions.map(position => [
      escapeHtml(position.name || '-'),
      escapeHtml(position.description || ''),
      `<span class="bm-status ${position.active === false ? 'inactive' : 'active'}">${position.active === false ? 'NIE' : 'TAK'}</span>`,
      `<button type="button" class="bm-inline-action edit-position-btn" data-id="${position.id}">Edytuj</button>`
    ]);
    const deleteOptions = positions.length
      ? positions.map(position => `<option value="${position.id}">${escapeHtml(position.name || '-')} — ${position.active === false ? 'NIE' : 'TAK'}</option>`).join('')
      : '<option value="">Brak stanowisk do usunięcia</option>';
    const content = `<section class="bm-page-card">
        <div class="bm-page-head"><h2>Stanowiska pracy</h2><div class="bm-action-row"><button id="showAddPosition" type="button">Dodaj</button><button id="showDeletePosition" type="button" class="bm-danger-btn">Usuń</button></div></div>
        <div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('positionsLimit', '50')}</div>
        ${table(['Nazwa','Opis','Aktywne','Akcje'], rows)}
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
          <label>Wybierz stanowisko<select id="deletePositionSelect">${deleteOptions}</select></label>
          <button type="button" id="confirmDeletePosition" class="bm-danger-btn" ${positions.length ? '' : 'disabled'}>Usuń</button>
        </div>
        <p id="deletePositionMessage" class="panel-message"></p>
      </section>`;
    renderPanelFrame(ctx, 'positions', content, '', '');
    setupLimitDropdown('#positionsLimit', null);

    const card = document.querySelector('#positionFormCard');
    const deleteCard = document.querySelector('#positionDeleteCard');
    const panels = [card, deleteCard];
    const form = document.querySelector('#positionForm');
    const title = document.querySelector('#positionFormTitle');
    const msg = document.querySelector('#positionMessage');
    const openForm = (position=null) => {
      if (!card || !form) return;
      form.reset();
      if (msg) msg.textContent = '';
      document.querySelector('#positionId').value = position?.id || '';
      document.querySelector('#positionName').value = position?.name || '';
      document.querySelector('#positionDescription').value = position?.description || '';
      document.querySelector('#positionActive').value = position?.active === false ? 'false' : 'true';
      if (title) title.textContent = position ? 'Edytuj stanowisko pracy' : 'Dodaj stanowisko pracy';
      document.querySelector('#positionSubmit').textContent = position ? 'Zapisz zmiany' : 'Zapisz';
      showOnlyPanel(card, panels, false);
    };
    document.querySelector('#showAddPosition')?.addEventListener('click', () => openForm(null));
    document.querySelector('#showDeletePosition')?.addEventListener('click', () => showOnlyPanel(deleteCard, panels, false));
    document.querySelectorAll('.edit-position-btn').forEach(btn => btn.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const position = getPositionById(currentDb, btn.dataset.id);
      if (position) openForm(position);
    }));
    document.querySelector('#confirmDeletePosition')?.addEventListener('click', () => {
      const select = document.querySelector('#deletePositionSelect');
      const deleteMsg = document.querySelector('#deletePositionMessage');
      if (!select || !select.value) return;
      const currentDb = loadDatabase();
      const position = getPositionById(currentDb, select.value);
      if (!position) return;
      saveUndoSnapshot('Usunięcie stanowiska pracy', currentDb);
      currentDb.positions = (currentDb.positions || []).filter(item => item.id !== position.id);
      currentDb.users = (currentDb.users || []).map(user => user.positionId === position.id ? { ...user, positionId: '' } : user);
      saveDatabase(currentDb);
      if (deleteMsg) { deleteMsg.textContent = 'Stanowisko usunięte. Możesz cofnąć zmianę przyciskiem Cofnij Czas.'; deleteMsg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(form).entries());
      const id = String(data.positionId || '').trim();
      const payload = { name:String(data.name||'').trim(), description:String(data.description||'').trim(), active:data.active === 'true' };
      if (!payload.name || !payload.description) { if (msg) { msg.textContent = 'Uzupełnij nazwę i opis stanowiska.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot(id ? 'Edycja stanowiska pracy' : 'Dodanie stanowiska pracy', currentDb);
      if (id) {
        currentDb.positions = (currentDb.positions || []).map(position => position.id === id ? { ...position, ...payload, updatedAt:new Date().toISOString() } : position);
      } else {
        currentDb.positions = currentDb.positions || [];
        currentDb.positions.push({ id:createId('position'), companyId:company.id, ...payload, createdAt:new Date().toISOString() });
      }
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Stanowisko zapisane.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };

  const buildDaysOffCalendar = (ctx) => {
    const { db, company } = ctx;
    const year = daysOffCalendarDate.getFullYear();
    const month = daysOffCalendarDate.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    let day = 1 - offset;
    const teamUsers = db.users.filter(u => u.companyId === company.id && u.role !== 'owner');
    const offItems = (db.daysOff || []).filter(item => item.companyId === company.id);
    let cells = '';
    for (let i=0; i<42; i++, day++) {
      const cellDate = new Date(year, month, day);
      const iso = toIsoDate(cellDate);
      const outside = cellDate.getMonth() !== month;
      const entries = offItems.filter(item => isIsoInRange(iso, item.start, item.end)).map(item => {
        const employee = teamUsers.find(u => u.id === item.employeeId);
        const label = `${employee?.fullName || 'Pracownik'} - ${item.type}${item.description ? ' - ' + item.description : ''}`;
        return `<span class="day-off-entry">${escapeHtml(label)}</span>`;
      }).join('');
      cells += `<button type="button" class="day-off-cell ${outside ? 'outside' : ''} ${sameDay(cellDate, CM_TODAY) ? 'today' : ''}" data-date="${iso}"><b>${cellDate.getDate()}</b>${entries}</button>`;
    }
    return `<div class="days-off-head"><button id="daysOffPrev" type="button">‹</button><strong>${monthNamesPL[month]} ${year}</strong><button id="daysOffNext" type="button">›</button></div>
      <div class="days-off-weekdays"><span>Po</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pi</span><span>So</span><span>Ni</span></div>
      <div class="days-off-grid">${cells}</div>`;
  };

  const renderDaysOff = (ctx) => {
    const { db, company } = ctx;
    const teamUsers = db.users.filter(u => u.companyId === company.id && u.role !== 'owner');
    const employeeOptions = teamUsers.map(u => `<option value="${u.id}">${escapeHtml(u.fullName || u.email || u.login)}</option>`).join('');
    const todayIso = toIsoDate(CM_TODAY);
    const daysOffItems = (db.daysOff || []).filter(item => item.companyId === company.id);
    const typeOptions = ['zwolnienie lekarskie','szkolenie','urlop','dzień wolny'];
    const dayOffOptions = daysOffItems.map(item => {
      const employee = teamUsers.find(u => u.id === item.employeeId);
      const label = `${employee?.fullName || 'Pracownik'} — ${item.type} — ${formatIsoDatePL(item.start)}${item.end && item.end !== item.start ? ' do ' + formatIsoDatePL(item.end) : ''}${item.description ? ' — ' + item.description : ''}`;
      return `<option value="${item.id}">${escapeHtml(label)}</option>`;
    }).join('');
    const content = `<section class="bm-page-card"><h2>Dni wolne pracowników</h2><div id="daysOffCalendar">${buildDaysOffCalendar(ctx)}</div></section>
      <section class="bm-page-card days-off-actions-card">
        <div class="days-off-action-grid">
          <button type="button" id="showEditDaysOff" class="bm-inline-action">Edytuj</button>
          <button type="button" id="showDeleteDaysOff" class="bm-danger-btn">Usuń</button>
        </div>
      </section>
      <section class="bm-page-card" id="daysOffFormCard" hidden>
        <h2>Dodaj dni wolne pracownika</h2>
        <form id="daysOffForm" class="bm-form-grid">
          <label>Pracownik<select name="employeeId" required>${employeeOptions}</select></label>
          <label>Rodzaj<select name="type" required>${typeOptions.map(type => `<option value="${type}">${type}</option>`).join('')}</select></label>
          <label>Od dnia<input name="start" id="daysOffStart" type="date" value="${todayIso}" required></label>
          <label>Do dnia<input name="end" id="daysOffEnd" type="date" value="${todayIso}" required></label>
          <label class="full">Opis<textarea name="description" placeholder="Przyczyna / powód"></textarea></label>
          <button type="submit">Zapisz dni wolne</button>
        </form>
        <p id="daysOffMessage" class="panel-message"></p>
      </section>
      <section class="bm-page-card" id="daysOffEditPanel" hidden>
        <h2>Edytuj dni wolne</h2>
        ${daysOffItems.length ? `<form id="daysOffEditForm" class="bm-form-grid">
          <label class="full">Wybierz wpis<select id="daysOffEditSelect" name="dayOffId" required>${dayOffOptions}</select></label>
          <label>Pracownik<select name="employeeId" id="editDaysOffEmployee" required>${employeeOptions}</select></label>
          <label>Rodzaj<select name="type" id="editDaysOffType" required>${typeOptions.map(type => `<option value="${type}">${type}</option>`).join('')}</select></label>
          <label>Od dnia<input name="start" id="editDaysOffStart" type="date" required></label>
          <label>Do dnia<input name="end" id="editDaysOffEnd" type="date" required></label>
          <label class="full">Opis<textarea name="description" id="editDaysOffDescription" placeholder="Przyczyna / powód"></textarea></label>
          <button type="submit">Zapisz zmiany</button>
        </form>
        <p id="daysOffEditMessage" class="panel-message"></p>` : `<p class="muted-note">Brak dodanych dni wolnych do edycji.</p>`}
      </section>
      <section class="bm-page-card" id="daysOffDeletePanel" hidden>
        <h2>Usuń dni wolne</h2>
        ${daysOffItems.length ? `<form id="daysOffDeleteForm" class="bm-form-grid">
          <label class="full">Wybierz wpis<select id="daysOffDeleteSelect" name="dayOffId" required>${dayOffOptions}</select></label>
          <label>Pracownik<input id="deleteDaysOffEmployee" type="text" readonly></label>
          <label>Rodzaj<input id="deleteDaysOffType" type="text" readonly></label>
          <label>Od dnia<input id="deleteDaysOffStart" type="date" readonly></label>
          <label>Do dnia<input id="deleteDaysOffEnd" type="date" readonly></label>
          <label class="full">Opis<textarea id="deleteDaysOffDescription" readonly></textarea></label>
          <button type="button" id="deleteDaysOffBtn" class="bm-danger-btn">Usuń dni wolne</button>
        </form>
        <p id="daysOffDeleteMessage" class="panel-message"></p>` : `<p class="muted-note">Brak dodanych dni wolnych do usunięcia.</p>`}
      </section>`;
    renderPanelFrame(ctx, 'daysOff', content, '', '');

    const daysOffUser = getCurrentContext().user || ctx.user;
    const canAddDaysOff = hasSystemPermission(daysOffUser, 'dni wolne (dodawanie)');
    const canManageDaysOff = hasSystemPermission(daysOffUser, 'dni wolne (usuwanie, edycja)');
    const blockDaysOffPermission = (permissionLabel, targetMessageSelector) => {
      const msg = targetMessageSelector ? document.querySelector(targetMessageSelector) : null;
      const text = 'Brak uprawnienia: ' + permissionLabel;
      if (msg) { msg.textContent = text; msg.style.color = '#fca5a5'; }
      else alert(text);
      return false;
    };
    if (!canManageDaysOff) {
      ['#showEditDaysOff', '#showDeleteDaysOff', '#deleteDaysOffBtn'].forEach(selector => {
        document.querySelectorAll(selector).forEach(button => {
          button.setAttribute('disabled', 'disabled');
          button.classList.add('cm-permission-disabled');
          button.title = 'Brak uprawnienia: dni wolne (usuwanie, edycja)';
        });
      });
    }

    const showDaysOffPanel = (panelId) => {
      if ((panelId === 'edit' || panelId === 'delete') && !canManageDaysOff) {
        blockDaysOffPermission('dni wolne (usuwanie, edycja)');
        return;
      }
      const addPanel = document.querySelector('#daysOffFormCard');
      const editPanel = document.querySelector('#daysOffEditPanel');
      const deletePanel = document.querySelector('#daysOffDeletePanel');
      const target = panelId === 'edit' ? editPanel : deletePanel;
      showOnlyPanel(target, [addPanel, editPanel, deletePanel]);
    };
    document.querySelector('#showEditDaysOff')?.addEventListener('click', () => showDaysOffPanel('edit'));
    document.querySelector('#showDeleteDaysOff')?.addEventListener('click', () => showDaysOffPanel('delete'));

    const rerenderCalendar = () => {
      const calendar = document.querySelector('#daysOffCalendar');
      if (calendar) calendar.innerHTML = buildDaysOffCalendar(getCurrentContext());
    };
    document.querySelector('#daysOffCalendar')?.addEventListener('click', (event) => {
      const prev = event.target.closest('#daysOffPrev');
      const next = event.target.closest('#daysOffNext');
      const cell = event.target.closest('.day-off-cell');
      if (prev) { daysOffCalendarDate = new Date(daysOffCalendarDate.getFullYear(), daysOffCalendarDate.getMonth()-1, 1); rerenderCalendar(); return; }
      if (next) { daysOffCalendarDate = new Date(daysOffCalendarDate.getFullYear(), daysOffCalendarDate.getMonth()+1, 1); rerenderCalendar(); return; }
      if (cell) {
        if (!canAddDaysOff) {
          blockDaysOffPermission('dni wolne (dodawanie)', '#daysOffMessage');
          return;
        }
        const selected = cell.dataset.date;
        const formCard = document.querySelector('#daysOffFormCard');
        const editPanel = document.querySelector('#daysOffEditPanel');
        const deletePanel = document.querySelector('#daysOffDeletePanel');
        if (formCard) showOnlyPanel(formCard, [formCard, editPanel, deletePanel], false);
        const start = document.querySelector('#daysOffStart');
        const end = document.querySelector('#daysOffEnd');
        if (start) start.value = selected;
        if (end) end.value = selected;
        formCard?.scrollIntoView({behavior:'smooth', block:'center'});
      }
    });
    document.querySelector('#daysOffForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!hasSystemPermission(getCurrentContext().user || ctx.user, 'dni wolne (dodawanie)')) {
        blockDaysOffPermission('dni wolne (dodawanie)', '#daysOffMessage');
        return;
      }
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#daysOffMessage');
      if (!data.employeeId || !data.type || !data.start || !data.end) { if (msg) { msg.textContent = 'Uzupełnij wszystkie wymagane pola.'; msg.style.color = '#fca5a5'; } return; }
      if (data.end < data.start) { if (msg) { msg.textContent = 'Data końcowa nie może być wcześniejsza niż data początkowa.'; msg.style.color = '#fca5a5'; } return; }
      currentDb.daysOff = currentDb.daysOff || [];
      saveUndoSnapshot('Dodanie dni wolnych', currentDb);
      currentDb.daysOff.push({ id:createId('off'), companyId:company.id, employeeId:data.employeeId, type:data.type, start:data.start, end:data.end, description:String(data.description||'').trim(), createdAt:new Date().toISOString() });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Dni wolne zapisane.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    const editSelect = document.querySelector('#daysOffEditSelect');
    const fillEditForm = () => {
      const currentDb = loadDatabase();
      const selectedId = editSelect?.value;
      const item = (currentDb.daysOff || []).find(entry => entry.id === selectedId);
      if (!item) return;
      const employee = document.querySelector('#editDaysOffEmployee');
      const type = document.querySelector('#editDaysOffType');
      const start = document.querySelector('#editDaysOffStart');
      const end = document.querySelector('#editDaysOffEnd');
      const description = document.querySelector('#editDaysOffDescription');
      if (employee) employee.value = item.employeeId;
      if (type) type.value = item.type;
      if (start) start.value = item.start;
      if (end) end.value = item.end;
      if (description) description.value = item.description || '';
    };
    editSelect?.addEventListener('change', fillEditForm);
    fillEditForm();

    const deleteSelect = document.querySelector('#daysOffDeleteSelect');
    const fillDeleteForm = () => {
      const currentDb = loadDatabase();
      const selectedId = deleteSelect?.value;
      const item = (currentDb.daysOff || []).find(entry => entry.id === selectedId);
      const employeeRecord = (currentDb.users || []).find(u => u.id === item?.employeeId);
      const employee = document.querySelector('#deleteDaysOffEmployee');
      const type = document.querySelector('#deleteDaysOffType');
      const start = document.querySelector('#deleteDaysOffStart');
      const end = document.querySelector('#deleteDaysOffEnd');
      const description = document.querySelector('#deleteDaysOffDescription');
      if (employee) employee.value = item ? (employeeRecord?.fullName || employeeRecord?.email || employeeRecord?.login || 'Pracownik') : '';
      if (type) type.value = item?.type || '';
      if (start) start.value = item?.start || '';
      if (end) end.value = item?.end || '';
      if (description) description.value = item?.description || '';
    };
    deleteSelect?.addEventListener('change', fillDeleteForm);
    fillDeleteForm();

    document.querySelector('#daysOffEditForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!hasSystemPermission(getCurrentContext().user || ctx.user, 'dni wolne (usuwanie, edycja)')) {
        blockDaysOffPermission('dni wolne (usuwanie, edycja)', '#daysOffEditMessage');
        return;
      }
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#daysOffEditMessage');
      if (!data.dayOffId || !data.employeeId || !data.type || !data.start || !data.end) { if (msg) { msg.textContent = 'Uzupełnij wszystkie wymagane pola.'; msg.style.color = '#fca5a5'; } return; }
      if (data.end < data.start) { if (msg) { msg.textContent = 'Data końcowa nie może być wcześniejsza niż data początkowa.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Edycja dni wolnych', currentDb);
      currentDb.daysOff = (currentDb.daysOff || []).map(item => item.id === data.dayOffId ? { ...item, employeeId:data.employeeId, type:data.type, start:data.start, end:data.end, description:String(data.description||'').trim(), updatedAt:new Date().toISOString() } : item);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Dni wolne zaktualizowane.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    document.querySelector('#deleteDaysOffBtn')?.addEventListener('click', () => {
      if (!hasSystemPermission(getCurrentContext().user || ctx.user, 'dni wolne (usuwanie, edycja)')) {
        blockDaysOffPermission('dni wolne (usuwanie, edycja)', '#daysOffDeleteMessage');
        return;
      }
      const currentDb = loadDatabase();
      const selectedId = document.querySelector('#daysOffDeleteSelect')?.value;
      const msg = document.querySelector('#daysOffDeleteMessage');
      if (!selectedId) { if (msg) { msg.textContent = 'Wybierz wpis do usunięcia.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie dni wolnych', currentDb);
      currentDb.daysOff = (currentDb.daysOff || []).filter(item => item.id !== selectedId);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Dni wolne usunięte.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };


  const getServiceCategories = (db, companyId) => (db.serviceCategories || []).filter(category => category.companyId === companyId);
  const getServiceCategoryById = (db, id) => (db.serviceCategories || []).find(category => category.id === id);
  const formatDuration = (hours, minutes) => `${Number(hours || 0)} h ${String(Number(minutes || 0)).padStart(2,'0')} min`;
  const formatPriceRange = (from, to) => {
    const cleanFrom = String(from ?? '').trim();
    const cleanTo = String(to ?? '').trim();
    if (cleanFrom && cleanTo) return `${cleanFrom}–${cleanTo} PLN`;
    if (cleanFrom) return `od ${cleanFrom} PLN`;
    if (cleanTo) return `do ${cleanTo} PLN`;
    return '';
  };


  const visitStatusOptions = ['niezakończone','zakończone','zaplanowane','odwołane','usunięte'];
  const formatPolishDate = (isoDate) => {
    const [y,m,d] = String(isoDate || '').split('-');
    if (!y || !m || !d) return escapeHtml(isoDate || '');
    return `${d}.${m}.${y}`;
  };
  const customerName = (customer) => customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : '-';
  const visitLabel = (db, visit) => {
    const customer = (db.customers || []).find(c => c.id === visit.customerId);
    const employee = (db.users || []).find(u => u.id === visit.employeeId);
    const service = (db.services || []).find(s => s.id === visit.serviceId);
    return `${formatPolishDate(visit.date)} ${visit.time || ''} — ${customerName(customer)} — ${employee?.fullName || '-'} — ${service?.name || '-'} — ${visit.status || '-'}`;
  };

  const renderServices = (ctx) => {
    const { db, company } = ctx;
    const services = (db.services || []).filter(service => service.companyId === company.id);
    const categories = getServiceCategories(db, company.id);
    const activePositions = getActivePositions(db, company.id);
    const rows = services.map(service => {
      const category = getServiceCategoryById(db, service.categoryId);
      const position = getPositionById(db, service.positionId);
      return [
        escapeHtml(category?.name || 'Bez kategorii'),
        escapeHtml(service.name || '-'),
        escapeHtml(formatDuration(service.durationHours, service.durationMinutes)),
        escapeHtml(formatPriceRange(service.priceFrom, service.priceTo)),
        escapeHtml(position?.name || '-'),
        escapeHtml(service.code || '')
      ];
    });
    const categoryOptions = categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
    const positionOptions = activePositions.map(position => `<option value="${escapeHtml(position.id)}">${escapeHtml(position.name)}</option>`).join('');
    const serviceDeleteOptions = services.map(service => {
      const category = getServiceCategoryById(db, service.categoryId);
      return `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name || 'Usługa')} ${category ? `— ${escapeHtml(category.name)}` : ''}</option>`;
    }).join('');
    const categoryDeleteOptions = categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
    const categoryList = categories.length
      ? `<div class="bm-status-list">${categories.map(category => `<p><b>${escapeHtml(category.name)}</b></p>`).join('')}</div>`
      : '<p class="muted">Brak kategorii. Dodaj pierwszą kategorię, żeby przypisać usługę.</p>';
    const content = `<section class="bm-page-card">
        <div class="bm-page-head"><h2>Lista usług</h2><div class="bm-action-row"><button id="exportServicesBtn" type="button" class="bm-excel-btn">Export</button><button id="importServicesBtn" type="button" class="bm-excel-btn">Import</button><input id="importServicesFile" type="file" accept=".xls,.xlsx,.csv,.txt" hidden><button id="showAddService" type="button">Dodaj</button><button id="showDeleteService" type="button" class="bm-danger-btn">Usuń</button></div></div>
        <div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('servicesLimit', '50')}</div>
        ${table(['Kategoria','Nazwa','Czas trwania','Cena','Stanowisko pracy','Kod usługi'], rows)}
      </section>

      <section class="bm-page-card" id="serviceDeleteCard" hidden>
        <h2>Usuń usługę lub kategorię</h2>
        <div class="bm-form-grid bm-wide-form">
          <label>Wybierz usługę do usunięcia
            <select id="deleteServiceSelect">
              <option value="">Wybierz usługę</option>
              ${serviceDeleteOptions}
            </select>
          </label>
          <button type="button" id="deleteServiceBtn" class="bm-danger-btn">Usuń usługę</button>

          <label>Wybierz kategorię do usunięcia
            <select id="deleteServiceCategorySelect">
              <option value="">Wybierz kategorię</option>
              ${categoryDeleteOptions}
            </select>
          </label>
          <p class="muted">Usunięcie kategorii usuwa również usługi przypisane do tej kategorii.</p>
          <button type="button" id="deleteServiceCategoryBtn" class="bm-danger-btn">Usuń kategorię</button>
        </div>
        <p id="serviceDeleteMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceFormCard" hidden>
        <h2>Dodaj usługę</h2>
        <form id="serviceForm" class="bm-form-grid bm-wide-form">
          <label>Kategoria
            <select name="categoryId" id="serviceCategory" required>
              <option value="">Wybierz kategorię</option>
              ${categoryOptions}
            </select>
          </label>
          <button type="button" id="showServiceCategoryManager" class="bm-secondary-btn">Dodaj nową kategorię</button>

          <label>Nazwa
            <input name="name" placeholder="Nazwa usługi" required>
          </label>

          <div class="bm-form-row-2">
            <label>Czas trwania usługi — godziny
              <input name="durationHours" type="number" min="0" step="1" value="0" required>
            </label>
            <label>Czas trwania usługi — minuty
              <input name="durationMinutes" type="number" min="0" max="59" step="1" value="0" required>
            </label>
          </div>

          <div class="bm-form-row-2">
            <label>Cena (PLN) od
              <input name="priceFrom" type="number" min="0" step="0.01" placeholder="0.00">
            </label>
            <label>Cena (PLN) do
              <input name="priceTo" type="number" min="0" step="0.01" placeholder="0.00">
            </label>
          </div>

          <label class="bm-check-row"><input type="checkbox" name="showOnline" value="true"> <span>Pokazuj usługę przy rezerwacji online</span></label>
          <label class="bm-check-row"><input type="checkbox" name="preventOverlap" value="true"> <span>Usługa nie może powtarzać się w tym samym czasie</span></label>

          <label>Wysokość zaliczki przy zapisie online (PLN)
            <input name="deposit" type="number" min="0" step="0.01" placeholder="0.00">
          </label>

          <label>Stanowisko pracy
            <select name="positionId" required>
              <option value="">Wybierz ze stanowisk</option>
              ${positionOptions}
            </select>
          </label>

          <label>Opis
            <textarea name="description" placeholder="Opis usługi"></textarea>
          </label>

          <label>Kod usługi
            <input name="code" placeholder="Kod usługi">
          </label>

          <label class="bm-check-row"><input type="checkbox" name="includeCommission" value="true"> <span>Wliczaj do prowizji pracowników</span></label>
          <label class="bm-check-row"><input type="checkbox" name="includeDiscount" value="true"> <span>Uwzględniaj przy rabacie</span></label>

          <button type="submit">Zapisz usługę</button>
        </form>
        <p id="serviceMessage" class="panel-message"></p>
      </section>

      <section class="bm-page-card" id="serviceCategoryCard" hidden>
        <h2>Kategorie usług</h2>
        ${categoryList}
        <form id="serviceCategoryForm" class="bm-form-grid">
          <label>Nazwa kategorii
            <input name="name" placeholder="Nazwa kategorii" required>
          </label>
          <button type="submit">Zapisz kategorię</button>
        </form>
        <p id="serviceCategoryMessage" class="panel-message"></p>
      </section>`;
    renderPanelFrame(ctx, 'services', content, '', '');
    setupLimitDropdown('#servicesLimit', null);

    const serviceFormCard = document.querySelector('#serviceFormCard');
    const deleteCard = document.querySelector('#serviceDeleteCard');
    const categoryCard = document.querySelector('#serviceCategoryCard');

    document.querySelector('#exportServicesBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const data = (currentDb.services || []).filter(service => service.companyId === company.id);
      const headers = ['Kategoria','Nazwa','Czas godziny','Czas minuty','Cena od (PLN)','Cena do (PLN)','Zaliczka (PLN)','Stanowisko pracy','Opis','Kod usługi','Rezerwacja online','Blokada nakładania','Wliczaj do prowizji','Uwzględniaj przy rabacie'];
      const lines = [headers.join('\t'), ...data.map(service => {
        const category = getServiceCategoryById(currentDb, service.categoryId);
        const position = getPositionById(currentDb, service.positionId);
        return [
          category?.name || '', service.name || '', service.durationHours || '0', service.durationMinutes || '0', service.priceFrom || '', service.priceTo || '', service.deposit || '', position?.name || '', service.description || '', service.code || '', service.showOnline ? 'tak' : 'nie', service.preventOverlap ? 'tak' : 'nie', service.includeCommission ? 'tak' : 'nie', service.includeDiscount ? 'tak' : 'nie'
        ].map(value => String(value).replace(/\t/g,' ').replace(/\n/g,' ')).join('\t');
      })];
      const blob = new Blob([lines.join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'uslugi-companymanager.xls';
      link.click();
      URL.revokeObjectURL(url);
    });

    document.querySelector('#importServicesBtn')?.addEventListener('click', () => {
      document.querySelector('#importServicesFile')?.click();
    });

    document.querySelector('#importServicesFile')?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        const msg = document.querySelector('#serviceMessage') || document.querySelector('#serviceDeleteMessage');
        if (lines.length < 2) { alert('Plik importu usług jest pusty albo ma zły format.'); return; }
        const currentDb = loadDatabase();
        saveUndoSnapshot('Import usług', currentDb);
        currentDb.serviceCategories = currentDb.serviceCategories || [];
        currentDb.services = currentDb.services || [];
        let imported = 0;
        lines.slice(1).forEach(line => {
          const cols = line.split('\t');
          const [categoryName, name, durationHours, durationMinutes, priceFrom, priceTo, deposit, positionName, description, code, showOnline, preventOverlap, includeCommission, includeDiscount] = cols.map(value => String(value || '').trim());
          if (!name) return;
          let categoryId = '';
          if (categoryName) {
            let category = currentDb.serviceCategories.find(item => item.companyId === company.id && normalizeText(item.name) === normalizeText(categoryName));
            if (!category) {
              category = { id:createId('service_category'), companyId:company.id, name:categoryName };
              currentDb.serviceCategories.push(category);
            }
            categoryId = category.id;
          }
          const position = (currentDb.positions || []).find(item => item.companyId === company.id && normalizeText(item.name) === normalizeText(positionName));
          currentDb.services.push({
            id:createId('service'), companyId:company.id, categoryId, name, durationHours:durationHours || '0', durationMinutes:durationMinutes || '0', priceFrom, priceTo, deposit, positionId:position?.id || '', description, code, showOnline:normalizeText(showOnline)==='tak', preventOverlap:normalizeText(preventOverlap)==='tak', includeCommission:normalizeText(includeCommission)==='tak', includeDiscount:normalizeText(includeDiscount)==='tak'
          });
          imported += 1;
        });
        saveDatabase(currentDb);
        if (msg) { msg.textContent = `Zaimportowano usług: ${imported}.`; msg.style.color = '#86efac'; }
        setTimeout(()=>window.location.reload(),700);
      };
      reader.readAsText(file);
    });
    document.querySelector('#showAddService')?.addEventListener('click', () => showOnlyPanel(serviceFormCard, [serviceFormCard, deleteCard, categoryCard]));
    document.querySelector('#showDeleteService')?.addEventListener('click', () => showOnlyPanel(deleteCard, [serviceFormCard, deleteCard, categoryCard]));
    document.querySelector('#showServiceCategoryManager')?.addEventListener('click', () => showOnlyPanel(categoryCard, [serviceFormCard, deleteCard, categoryCard]));

    document.querySelector('#deleteServiceBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const serviceId = document.querySelector('#deleteServiceSelect')?.value;
      const msg = document.querySelector('#serviceDeleteMessage');
      if (!serviceId) { if (msg) { msg.textContent = 'Wybierz usługę do usunięcia.'; msg.style.color = '#fca5a5'; } return; }
      const service = (currentDb.services || []).find(item => item.id === serviceId && item.companyId === company.id);
      if (!service) { if (msg) { msg.textContent = 'Nie znaleziono wybranej usługi.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie usługi', currentDb);
      currentDb.services = (currentDb.services || []).filter(item => item.id !== serviceId);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Usługa usunięta. Możesz użyć Cofnij Czas, jeśli to pomyłka.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    document.querySelector('#deleteServiceCategoryBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const categoryId = document.querySelector('#deleteServiceCategorySelect')?.value;
      const msg = document.querySelector('#serviceDeleteMessage');
      if (!categoryId) { if (msg) { msg.textContent = 'Wybierz kategorię do usunięcia.'; msg.style.color = '#fca5a5'; } return; }
      const category = (currentDb.serviceCategories || []).find(item => item.id === categoryId && item.companyId === company.id);
      if (!category) { if (msg) { msg.textContent = 'Nie znaleziono wybranej kategorii.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie kategorii usług', currentDb);
      currentDb.services = (currentDb.services || []).filter(item => item.categoryId !== categoryId);
      currentDb.serviceCategories = (currentDb.serviceCategories || []).filter(item => item.id !== categoryId);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Kategoria i przypisane usługi zostały usunięte. Możesz użyć Cofnij Czas, jeśli to pomyłka.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    document.querySelector('#serviceCategoryForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const name = String(data.name || '').trim();
      const msg = document.querySelector('#serviceCategoryMessage');
      if (!name) { if (msg) { msg.textContent = 'Wpisz nazwę kategorii.'; msg.style.color = '#fca5a5'; } return; }
      const exists = (currentDb.serviceCategories || []).some(category => category.companyId === company.id && normalizeText(category.name) === normalizeText(name));
      if (exists) { if (msg) { msg.textContent = 'Taka kategoria już istnieje.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Dodanie kategorii usługi', currentDb);
      currentDb.serviceCategories = currentDb.serviceCategories || [];
      currentDb.serviceCategories.push({ id:createId('service_category'), companyId:company.id, name, createdAt:new Date().toISOString() });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Kategoria zapisana.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    document.querySelector('#serviceForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#serviceMessage');
      const durationHours = Number(data.durationHours || 0);
      const durationMinutes = Number(data.durationMinutes || 0);
      if (!data.categoryId || !String(data.name||'').trim() || !data.positionId) { if (msg) { msg.textContent = 'Uzupełnij kategorię, nazwę i stanowisko pracy.'; msg.style.color = '#fca5a5'; } return; }
      if (durationHours <= 0 && durationMinutes <= 0) { if (msg) { msg.textContent = 'Czas trwania usługi musi być większy niż 0.'; msg.style.color = '#fca5a5'; } return; }
      const category = getServiceCategoryById(currentDb, data.categoryId);
      const position = getPositionById(currentDb, data.positionId);
      if (!category || category.companyId !== company.id) { if (msg) { msg.textContent = 'Wybierz poprawną kategorię.'; msg.style.color = '#fca5a5'; } return; }
      if (!position || position.companyId !== company.id || position.active === false) { if (msg) { msg.textContent = 'Wybierz aktywne stanowisko pracy.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Dodanie usługi', currentDb);
      currentDb.services = currentDb.services || [];
      currentDb.services.push({
        id:createId('service'),
        companyId:company.id,
        categoryId:String(data.categoryId),
        name:String(data.name||'').trim(),
        durationHours,
        durationMinutes,
        priceFrom:String(data.priceFrom||'').trim(),
        priceTo:String(data.priceTo||'').trim(),
        showOnline:data.showOnline === 'true',
        preventOverlap:data.preventOverlap === 'true',
        deposit:String(data.deposit||'').trim(),
        positionId:String(data.positionId),
        description:String(data.description||'').trim(),
        code:String(data.code||'').trim(),
        includeCommission:data.includeCommission === 'true',
        includeDiscount:data.includeDiscount === 'true',
        createdAt:new Date().toISOString()
      });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Usługa zapisana.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };


  const renderVisits = (ctx) => {
    const { db, company, user } = ctx;
    const currentFilter = new URLSearchParams(window.location.search).get('status') || 'niezakończone';
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const services = (db.services || []).filter(s => s.companyId === company.id);
    const visits = (db.visits || []).filter(v => v.companyId === company.id);
    const filteredVisits = visits.filter(v => currentFilter === 'usunięte' ? v.deleted === true || v.status === 'usunięte' : v.deleted !== true && v.status === currentFilter);
    const unfinishedHistoryPermission = 'wizyty (niezakończone) - dostęp do historii';
    const finishedHistoryPermission = 'wizyty (zakończone, zaplanowane, odwołane, usunięte) - dostęp do historii (tabeli poniżej)';
    const canViewUnfinishedVisitsHistory = hasSystemPermission(user, unfinishedHistoryPermission);
    const canViewFinishedVisitsHistory = hasSystemPermission(user, finishedHistoryPermission);
    const currentVisitHistoryPermission = currentFilter === 'niezakończone' ? unfinishedHistoryPermission : finishedHistoryPermission;
    const canViewCurrentVisitHistory = currentFilter === 'niezakończone' ? canViewUnfinishedVisitsHistory : canViewFinishedVisitsHistory;
    const currentVisitActionPermission = currentFilter === 'niezakończone'
      ? 'wizyty niezakończone (dodawanie, edycja, usuwanie / odwołanie)'
      : 'wizyty (dodawanie, edycja, zakończenie, usuwanie)';
    const canUseCurrentVisitActions = hasSystemPermission(user, currentVisitActionPermission);
    const visitActionDisabledAttrs = canUseCurrentVisitActions ? '' : ` disabled class="cm-permission-disabled" title="Brak uprawnienia: ${escapeHtml(currentVisitActionPermission)}"`;
    const visitDeleteBtnAttrs = canUseCurrentVisitActions ? 'class="bm-danger-btn"' : `class="bm-danger-btn cm-permission-disabled" disabled title="Brak uprawnienia: ${escapeHtml(currentVisitActionPermission)}"`;

    const statusTabs = visitStatusOptions.map(status => {
      const allowed = status === 'niezakończone' ? canViewUnfinishedVisitsHistory : canViewFinishedVisitsHistory;
      return `<button type="button" class="bm-tab-btn ${status === currentFilter ? 'active' : ''} ${allowed ? '' : 'cm-permission-disabled'}" data-visit-filter="${escapeHtml(status)}" data-required-permission="${escapeHtml(status === 'niezakończone' ? unfinishedHistoryPermission : finishedHistoryPermission)}" ${allowed ? '' : 'disabled'}>${escapeHtml(status)}</button>`;
    }).join('');
    const customerOptions = customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(customerName(c))}</option>`).join('');
    const employeeOptions = employees.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName || u.email || u.login)}</option>`).join('');
    const serviceOptions = services.map(service => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>`).join('');
    const editableVisits = visits.filter(visit => visit.deleted !== true && visit.status !== 'usunięte');
    const visitOptions = editableVisits.map(visit => `<option value="${escapeHtml(visit.id)}">${escapeHtml(visitLabel(db, visit))}</option>`).join('');
    const rows = filteredVisits.map(visit => {
      const customer = customers.find(c => c.id === visit.customerId);
      const employee = employees.find(u => u.id === visit.employeeId);
      const service = services.find(s => s.id === visit.serviceId);
      return [
        escapeHtml(formatPolishDate(visit.date)),
        escapeHtml(visit.time || ''),
        escapeHtml(customerName(customer)),
        escapeHtml(employee?.fullName || '-'),
        escapeHtml(service?.name || '-'),
        escapeHtml(visit.status || '-')
      ];
    });

    const content = `<section class="bm-page-card visits-module">
      <div class="bm-page-head"><h2>Pokaż wizyty:</h2><div class="bm-action-row"><button id="showAddVisit" type="button"${visitActionDisabledAttrs}>Dodaj</button><button id="showEditVisit" type="button" class="bm-secondary-btn${canUseCurrentVisitActions ? '' : ' cm-permission-disabled'}" ${canUseCurrentVisitActions ? '' : `disabled title="Brak uprawnienia: ${escapeHtml(currentVisitActionPermission)}"`}>Edytuj</button><button id="showDeleteVisit" type="button" class="bm-danger-btn${canUseCurrentVisitActions ? '' : ' cm-permission-disabled'}" ${canUseCurrentVisitActions ? '' : `disabled title="Brak uprawnienia: ${escapeHtml(currentVisitActionPermission)}"`}>Usuń</button></div></div>
      <div class="bm-tabs">${statusTabs}</div>
      ${canViewCurrentVisitHistory ? `<div class="bm-table-toolbar cm-limit-toolbar">${limitDropdownHtml('visitsLimit', '50')}</div>${table(['Data','Godzina','Klient','Pracownik','Usługa','Status'], rows)}` : permissionBlockedHtml(currentVisitHistoryPermission)}
    </section>

    <section class="bm-page-card" id="visitFormCard" hidden>
      <h2>Dodaj wizytę</h2>
      <form id="visitForm" class="bm-form-grid">
        <label>Data<input name="date" type="date" value="${toIsoDate(CM_TODAY)}" required></label>
        <label>Godzina<input name="time" type="time" value="10:00" required></label>
        <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
        <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
        <label>Usługa<select name="serviceId" required><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
        <label>Status<select name="status">${visitStatusOptions.filter(s=>s!=='usunięte').map(status => `<option value="${status}">${status}</option>`).join('')}</select></label>
        <button type="submit">Zapisz wizytę</button>
      </form>
      <p id="visitMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="visitEditCard" hidden>
      <h2>Edytuj wizytę</h2>
      <form id="visitEditForm" class="bm-form-grid">
        <label>Wybierz wizytę<select name="visitId" id="editVisitSelect" required><option value="">Wybierz wizytę</option>${visitOptions}</select></label>
        <label>Data<input name="date" type="date" required></label>
        <label>Godzina<input name="time" type="time" required></label>
        <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
        <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
        <label>Usługa<select name="serviceId" required><option value="">Wybierz usługę</option>${serviceOptions}</select></label>
        <label>Status<select name="status">${visitStatusOptions.map(status => `<option value="${status}">${status}</option>`).join('')}</select></label>
        <button type="submit">Zapisz zmiany</button>
      </form>
      <p id="visitEditMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="visitDeleteCard" hidden>
      <h2>Usuń wizytę</h2>
      <div class="bm-form-row bm-delete-row"><select id="deleteVisitSelect"><option value="">Wybierz wizytę</option>${visitOptions}</select><button id="deleteVisitBtn" type="button" ${visitDeleteBtnAttrs}>Usuń</button></div>
      <p id="visitDeleteMessage" class="panel-message"></p>
    </section>`;

    renderPanelFrame(ctx, 'visits', content, '', '');
    setupLimitDropdown('#visitsLimit', null);
    const canEditFinishedPastVisits = hasSystemPermission(getCurrentContext().user, 'wizyty (dodawanie, edycja, zakończenie, usuwanie)');
    const isPastVisitRecord = (visit) => {
      const d = parseIsoDate(visit?.date);
      return !!d && d.getTime() < normalizeDate(new Date()).getTime();
    };
    const isFinishedVisitRecord = (visit) => ['zakończone','zakończona','zakończony'].includes(String(visit?.status || '').toLowerCase());
    const denyFinishedPastVisitAction = (visit, msg) => {
      if (!canEditFinishedPastVisits && isPastVisitRecord(visit) && isFinishedVisitRecord(visit)) {
        if (msg) { msg.textContent = 'Brak uprawnienia do dodawania, edycji lub usuwania zakończonych wizyt z dni wcześniejszych.'; msg.style.color = '#fca5a5'; }
        return true;
      }
      return false;
    };

    document.querySelectorAll('[data-visit-filter]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled || btn.classList.contains('cm-permission-disabled')) {
        alert(btn.getAttribute('title') || `Brak uprawnienia: ${btn.getAttribute('data-required-permission') || 'historia wizyt'}`);
        return;
      }
      const status = btn.getAttribute('data-visit-filter') || 'niezakończone';
      window.location.href = `visits.html?status=${encodeURIComponent(status)}`;
    }));
    const addCard = document.querySelector('#visitFormCard');
    const editCard = document.querySelector('#visitEditCard');
    const deleteCard = document.querySelector('#visitDeleteCard');
    document.querySelector('#showAddVisit')?.addEventListener('click', () => showOnlyPanel(addCard, [addCard, editCard, deleteCard]));
    document.querySelector('#showEditVisit')?.addEventListener('click', () => showOnlyPanel(editCard, [addCard, editCard, deleteCard]));
    document.querySelector('#showDeleteVisit')?.addEventListener('click', () => showOnlyPanel(deleteCard, [addCard, editCard, deleteCard]));

    document.querySelector('#visitForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#visitMessage');
      if (!data.date || !data.time || !data.customerId || !data.employeeId || !data.serviceId) { if(msg){ msg.textContent='Uzupełnij wszystkie dane wizyty.'; msg.style.color='#fca5a5'; } return; }
      saveUndoSnapshot('Dodanie wizyty', currentDb);
      currentDb.visits = currentDb.visits || [];
      const newVisit = { id:createId('visit'), companyId:company.id, date:String(data.date), time:String(data.time), customerId:String(data.customerId), employeeId:String(data.employeeId), serviceId:String(data.serviceId), status:String(data.status || 'zaplanowane'), deleted:false, createdAt:new Date().toISOString() };
      currentDb.visits.push(newVisit);
      const currentCompany = (currentDb.companies || []).find(item => item.id === company.id) || company;
      enqueueAfterAddVisitNotifications(currentDb, currentCompany, newVisit);
      if (['zakończone','zakończona','zakończony'].includes(String(newVisit.status || '').toLowerCase())) enqueueAfterVisitNotifications(currentDb, currentCompany, newVisit);
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Wizyta zapisana.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    document.querySelector('#editVisitSelect')?.addEventListener('change', (event) => {
      const visit = editableVisits.find(v => v.id === event.target.value);
      const form = document.querySelector('#visitEditForm');
      if (!visit || !form) return;
      form.elements.date.value = visit.date || '';
      form.elements.time.value = visit.time || '';
      form.elements.customerId.value = visit.customerId || '';
      form.elements.employeeId.value = visit.employeeId || '';
      form.elements.serviceId.value = visit.serviceId || '';
      form.elements.status.value = visit.status || 'zaplanowane';
    });

    document.querySelector('#visitEditForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#visitEditMessage');
      const index = (currentDb.visits || []).findIndex(v => v.id === data.visitId && v.companyId === company.id && v.deleted !== true && v.status !== 'usunięte');
      if (index < 0) { if(msg){ msg.textContent='Wybierz wizytę do edycji.'; msg.style.color='#fca5a5'; } return; }
      if (!data.date || !data.time || !data.customerId || !data.employeeId || !data.serviceId) { if(msg){ msg.textContent='Uzupełnij wszystkie dane wizyty.'; msg.style.color='#fca5a5'; } return; }
      if (denyFinishedPastVisitAction(currentDb.visits[index], msg)) return;
      saveUndoSnapshot('Edycja wizyty', currentDb);
      const previousVisitStatus = String(currentDb.visits[index].status || '').toLowerCase();
      currentDb.visits[index] = { ...currentDb.visits[index], date:String(data.date), time:String(data.time), customerId:String(data.customerId), employeeId:String(data.employeeId), serviceId:String(data.serviceId), status:String(data.status || 'zaplanowane'), deleted: String(data.status) === 'usunięte' };
      const currentCompany = (currentDb.companies || []).find(item => item.id === company.id) || company;
      const nextVisitStatus = String(currentDb.visits[index].status || '').toLowerCase();
      if (['zakończone','zakończona','zakończony'].includes(nextVisitStatus) && previousVisitStatus !== nextVisitStatus) enqueueAfterVisitNotifications(currentDb, currentCompany, currentDb.visits[index]);
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Wizyta zaktualizowana.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });

    document.querySelector('#deleteVisitBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const visitId = document.querySelector('#deleteVisitSelect')?.value;
      const msg = document.querySelector('#visitDeleteMessage');
      const index = (currentDb.visits || []).findIndex(v => v.id === visitId && v.companyId === company.id && v.deleted !== true && v.status !== 'usunięte');
      if (index < 0) { if(msg){ msg.textContent='Wybierz wizytę do usunięcia.'; msg.style.color='#fca5a5'; } return; }
      if (denyFinishedPastVisitAction(currentDb.visits[index], msg)) return;
      saveUndoSnapshot('Usunięcie wizyty', currentDb);
      currentDb.visits[index] = { ...currentDb.visits[index], status:'usunięte', deleted:true };
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Wizyta przeniesiona do usuniętych. Możesz użyć Cofnij Czas.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };



  const productStockStatus = (product) => {
    const stock = Number(product.packageStock || 0);
    const low = Number(product.lowPackageStock || 0);
    if (!low) return stock > 0 ? 'dużo' : 'mało';
    return stock <= low ? 'mało' : 'dużo';
  };

  const productLabel = (product) => [product.name, product.category, product.companyName].filter(Boolean).join(' — ');

  const renderProducts = (ctx) => {
    const { db, company } = ctx;
    const filter = new URLSearchParams(window.location.search).get('filter') || 'all';
    const products = (db.products || []).filter(product => product.companyId === company.id);
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
    const companies = [...new Set(products.map(product => product.companyName).filter(Boolean))];

    const rows = products.filter(product => {
      if (filter === 'low') return productStockStatus(product) === 'mało';
      if (filter === 'high') return productStockStatus(product) === 'dużo';
      if (filter === 'saleOnly') return product.saleOnly === true;
      return true;
    }).map(product => [
      escapeHtml(product.name || '-'),
      escapeHtml(product.category || '-'),
      escapeHtml(product.packageStock || product.unitStock || '0'),
      escapeHtml(productStockStatus(product)),
      escapeHtml(product.companyName || '-'),
      escapeHtml(product.price ? `${Number(product.price).toFixed(2)} PLN` : '0,00 PLN'),
      escapeHtml(product.code || '')
    ]);

    const filterButtons = [
      ['low','mało na magazynie'],
      ['high','dużo na magazynie'],
      ['saleOnly','tylko do sprzedaży']
    ].map(([value,label]) => `<button type="button" class="bm-tab-btn ${filter === value ? 'active' : ''}" data-product-filter="${value}">${label}</button>`).join('');

    const categoryOptions = categories.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    const companyOptions = companies.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    const productDeleteOptions = products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(productLabel(product) || product.name || 'Produkt')}</option>`).join('');

    const content = `<section class="bm-page-card products-module">
      <div class="bm-page-head customers-head"><h2>Pokaż produkty:</h2><div class="bm-actions-row"><button id="exportProductsBtn" type="button" class="bm-excel-btn">Export</button><button id="importProductsBtn" type="button" class="bm-excel-btn">Import</button><input id="importProductsFile" type="file" accept=".xls,.xlsx,.csv" hidden><button id="showAddProduct" type="button">Dodaj</button><button id="showDeleteProduct" type="button" class="bm-danger-btn">Usuń</button></div></div>
      <div class="bm-tabs">${filterButtons}</div>
      <div class="bm-table-toolbar"><label class="cm-limit-label">${limitDropdownHtml('productsLimit', 50)}</label></div>
      <div class="bm-product-filters">
        <label>Nazwa<input id="productNameSearch" type="search" placeholder="szukaj..."></label>
        <label>Kategoria<input id="productCategorySearch" type="search" placeholder="szukaj..."></label>
        <label>Firma<input id="productCompanySearch" type="search" placeholder="szukaj..."></label>
      </div>
      <div id="productsTableWrap">${rows.length ? table(['Nazwa','Kategoria','Stan','Stan magazynowy','Firma','Cena (PLN)','Kod produktu'], rows) : '<p class="empty-state">Nie znaleziono żadnych danych</p>'}</div>
    </section>

    <section class="bm-page-card" id="productDeleteCard" hidden>
      <h2>Usuń produkt</h2>
      <div class="bm-form-row bm-delete-row">
        <select id="deleteProductSelect">
          <option value="">Wybierz produkt</option>
          ${productDeleteOptions}
        </select>
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
        <div class="bm-form-row-2">
          <label>Stan magazynowy — L.op.<input name="packageStock" type="number" min="0" step="1" placeholder="L.op."></label>
          <label>Niski stan (l.op.)<input name="lowPackageStock" type="number" min="0" step="1" placeholder="Niski stan (l.op.)"></label>
        </div>
        <div class="bm-form-row-2">
          <label>L. jednostek<input name="unitStock" type="number" min="0" step="1" placeholder="L. jednostek"></label>
          <label>L. jednostek w 1 op.<input name="unitsPerPackage" type="number" min="0" step="1" placeholder="L. jednostek w 1 op."></label>
        </div>
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

    renderPanelFrame(ctx, 'products', content, '', '');
    const formCard = document.querySelector('#productFormCard');
    const deleteProductCard = document.querySelector('#productDeleteCard');
    document.querySelector('#exportProductsBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const data = (currentDb.products || []).filter(product => product.companyId === company.id);
      const headers = ['Nazwa','Kategoria','Stan L.op.','Niski stan L.op.','L. jednostek','L. jednostek w 1 op.','Stan magazynowy','Firma','Do sprzedaży','Cena (PLN)','Ostatnia cena zakupu (PLN)','Dostawca','Opis','Kod produktu','Wliczaj do prowizji','Uwzględniaj przy rabacie'];
      const lines = [headers.join('\t'), ...data.map(product => [
        product.name || '', product.category || '', product.packageStock || '', product.lowPackageStock || '', product.unitStock || '', product.unitsPerPackage || '', productStockStatus(product), product.companyName || '', product.saleOnly ? 'tak' : 'nie', product.price || '', product.lastPurchasePrice || '', product.supplier || '', product.description || '', product.code || '', product.includeCommission ? 'tak' : 'nie', product.includeDiscount ? 'tak' : 'nie'
      ].map(value => String(value).replace(/\t/g,' ').replace(/\n/g,' ')).join('\t'))];
      const blob = new Blob([lines.join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'produkty-companymanager.xls';
      link.click();
      URL.revokeObjectURL(url);
    });
    document.querySelector('#importProductsBtn')?.addEventListener('click', () => {
      document.querySelector('#importProductsFile')?.click();
    });
    document.querySelector('#importProductsFile')?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) alert(`Wybrano plik do importu produktów: ${file.name}. Import danych podepniemy w kolejnym etapie.`);
    });
    document.querySelector('#showAddProduct')?.addEventListener('click', () => showOnlyPanel(formCard, [formCard, deleteProductCard]));
    document.querySelector('#showDeleteProduct')?.addEventListener('click', () => showOnlyPanel(deleteProductCard, [formCard, deleteProductCard]));
    document.querySelector('#deleteProductBtn')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const productId = document.querySelector('#deleteProductSelect')?.value;
      const msg = document.querySelector('#productDeleteMessage');
      if (!productId) { if (msg) { msg.textContent = 'Wybierz produkt do usunięcia.'; msg.style.color = '#fca5a5'; } return; }
      const product = (currentDb.products || []).find(item => item.id === productId && item.companyId === company.id);
      if (!product) { if (msg) { msg.textContent = 'Nie znaleziono wybranego produktu.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie produktu', currentDb);
      currentDb.products = (currentDb.products || []).filter(item => item.id !== productId);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Produkt usunięty. Możesz użyć Cofnij Czas, jeśli to pomyłka.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    setupLimitDropdown('#productsLimit', null);
    document.querySelectorAll('[data-product-filter]').forEach(btn => btn.addEventListener('click', () => {
      window.location.href = `products.html?filter=${encodeURIComponent(btn.getAttribute('data-product-filter') || 'all')}`;
    }));
    const categorySelect = document.querySelector('#productCategorySelect');
    const categoryNew = document.querySelector('#productNewCategoryLabel');
    categorySelect?.addEventListener('change', () => { if (categoryNew) categoryNew.hidden = categorySelect.value !== '__new'; });
    const companySelect = document.querySelector('#productCompanySelect');
    const companyNew = document.querySelector('#productNewCompanyLabel');
    companySelect?.addEventListener('change', () => { if (companyNew) companyNew.hidden = companySelect.value !== '__new'; });

    const applyFilters = () => {
      const nameQ = normalizeText(document.querySelector('#productNameSearch')?.value || '');
      const categoryQ = normalizeText(document.querySelector('#productCategorySearch')?.value || '');
      const companyQ = normalizeText(document.querySelector('#productCompanySearch')?.value || '');
      const filtered = products.filter(product => {
        if (filter === 'low' && productStockStatus(product) !== 'mało') return false;
        if (filter === 'high' && productStockStatus(product) !== 'dużo') return false;
        if (filter === 'saleOnly' && product.saleOnly !== true) return false;
        if (nameQ && !normalizeText(product.name || '').includes(nameQ)) return false;
        if (categoryQ && !normalizeText(product.category || '').includes(categoryQ)) return false;
        if (companyQ && !normalizeText(product.companyName || '').includes(companyQ)) return false;
        return true;
      }).map(product => [
        escapeHtml(product.name || '-'), escapeHtml(product.category || '-'), escapeHtml(product.packageStock || product.unitStock || '0'),
        escapeHtml(productStockStatus(product)), escapeHtml(product.companyName || '-'), escapeHtml(product.price ? `${Number(product.price).toFixed(2)} PLN` : '0,00 PLN'), escapeHtml(product.code || '')
      ]);
      const wrap = document.querySelector('#productsTableWrap');
      if (wrap) wrap.innerHTML = filtered.length ? table(['Nazwa','Kategoria','Stan','Stan magazynowy','Firma','Cena (PLN)','Kod produktu'], filtered) : '<p class="empty-state">Nie znaleziono żadnych danych</p>';
    };
    ['#productNameSearch','#productCategorySearch','#productCompanySearch'].forEach(sel => document.querySelector(sel)?.addEventListener('input', applyFilters));

    document.querySelector('#productForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#productFormMessage');
      const name = String(data.name || '').trim();
      const category = data.categorySelect === '__new' ? String(data.newCategory || '').trim() : String(data.categorySelect || '').trim();
      const companyName = data.companySelect === '__new' ? String(data.newCompany || '').trim() : String(data.companySelect || '').trim();
      if (!name) { if(msg){ msg.textContent='Podaj nazwę produktu.'; msg.style.color='#fca5a5'; } return; }
      saveUndoSnapshot('Dodanie produktu', currentDb);
      currentDb.products = currentDb.products || [];
      currentDb.products.push({
        id:createId('product'), companyId:company.id, name, category, packageStock:String(data.packageStock || ''), lowPackageStock:String(data.lowPackageStock || ''),
        unitStock:String(data.unitStock || ''), unitsPerPackage:String(data.unitsPerPackage || ''), companyName, saleOnly:data.saleOnly === 'on', price:String(data.price || ''),
        lastPurchasePrice:String(data.lastPurchasePrice || ''), supplier:String(data.supplier || '').trim(), description:String(data.description || '').trim(), code:String(data.code || '').trim(),
        includeCommission:data.includeCommission === 'on', includeDiscount:data.includeDiscount === 'on', createdAt:new Date().toISOString()
      });
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Produkt zapisany.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };

  const renderWalkins = (ctx) => {
    const { db, company, user } = ctx;
    const companyUsers = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const services = (db.services || []).filter(s => s.companyId === company.id);
    const products = (db.products || []).filter(p => p.companyId === company.id);
    const sales = (db.walkinSales || []).filter(s => s.companyId === company.id);
    const search = normalizeText(new URLSearchParams(window.location.search).get('q') || '');
    const filteredSales = sales.filter(sale => {
      if (!search) return true;
      const customer = customers.find(c => c.id === sale.customerId);
      const employee = companyUsers.find(u => u.id === sale.employeeId);
      const product = products.find(p => p.id === sale.productId);
      const service = services.find(item => item.id === sale.serviceId);
      const combined = normalizeText([
        sale.date, sale.time, sale.productCustom, sale.serviceCustom, sale.amount, sale.paymentMethod,
        customer ? `${customer.firstName || ''} ${customer.lastName || ''}` : '',
        employee ? employee.fullName : '',
        product ? product.name : '',
        service ? service.name : ''
      ].join(' '));
      return combined.includes(search);
    });
    const customerName = (id) => {
      const c = customers.find(item => item.id === id);
      return c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '';
    };
    const employeeName = (id) => (companyUsers.find(u => u.id === id)?.fullName || '');
    const serviceName = (id) => (services.find(item => item.id === id)?.name || '');
    const productName = (id) => (products.find(item => item.id === id)?.name || '');
    const saleItemsLabel = (sale) => [productName(sale.productId) || sale.productCustom, serviceName(sale.serviceId) || sale.serviceCustom].filter(Boolean).join(' + ') || '-';
    const rows = filteredSales.map(sale => [
      escapeHtml(customerName(sale.customerId) || '-'),
      escapeHtml(employeeName(sale.employeeId) || '-'),
      escapeHtml(formatIsoDatePL(sale.date) || sale.date),
      escapeHtml(sale.time || ''),
      escapeHtml(saleItemsLabel(sale)),
      escapeHtml(`${Number(sale.amount || 0).toFixed(2)} PLN`),
      escapeHtml(sale.paymentMethod || '-')
    ]);
    const walkinHistoryPermission = 'sprzedaż bez wizyt (dostęp do historii - tabeli poniżej)';
    const canViewWalkinHistory = hasSystemPermission(user, walkinHistoryPermission);
    const tableHtml = canViewWalkinHistory ? (rows.length ? table(['Klient','Pracownik','Data','Godzina','Produkt/usługa','Kwota','Sprzedaż'], rows) : `<div class="bm-empty-state">Nie znaleziono żadnych danych</div>`) : permissionBlockedHtml(walkinHistoryPermission);
    const employeeOptions = companyUsers.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName || u.email)}</option>`).join('');
    const customerOptions = customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone)}</option>`).join('');
    const productOptions = products.map(p => `<option value="${escapeHtml(p.id)}" data-price="${escapeHtml(p.price || '0')}">${escapeHtml(p.name)}${p.price ? ` — ${escapeHtml(p.price)} PLN` : ''}</option>`).join('');
    const serviceOptions = services.map(service => {
      const price = service.priceTo || service.priceFrom || '0';
      return `<option value="${escapeHtml(service.id)}" data-price="${escapeHtml(price)}">${escapeHtml(service.name)}${price ? ` — ${escapeHtml(price)} PLN` : ''}</option>`;
    }).join('');
    const walkinDeleteOptions = sales.map(sale => {
      const label = [
        formatIsoDatePL(sale.date) || sale.date,
        sale.time || '',
        customerName(sale.customerId) || '-',
        employeeName(sale.employeeId) || '-',
        saleItemsLabel(sale) || '-',
        `${Number(sale.amount || 0).toFixed(2)} PLN`,
        sale.paymentMethod || '-'
      ].join(' — ');
      return `<option value="${escapeHtml(sale.id)}">${escapeHtml(label)}</option>`;
    }).join('');
    const content = `<section class="bm-page-card walkins-module">
      <div class="bm-page-head customers-head"><h2>Sprzedaż bez wizyty</h2><div class="bm-actions-row"><button id="showAddWalkin" type="button">Dodaj</button><button id="showDeleteWalkin" type="button" class="bm-danger-btn">Usuń</button></div></div>
      ${canViewWalkinHistory ? `<div class="bm-table-toolbar"><label class="cm-limit-label">${limitDropdownHtml('walkinsLimit', 50)}</label><label>Szukaj: <input id="walkinsSearch" type="search" placeholder="Szukaj sprzedaży" value="${escapeHtml(new URLSearchParams(window.location.search).get('q') || '')}"></label></div>` : ''}
      <div id="walkinsTableWrap">${tableHtml}</div>
      <p id="walkinsMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinFormCard" hidden>
      <h2>Dodaj sprzedaż bez wizyty</h2>
      <form id="walkinForm" class="bm-form-grid bm-wide-form">
        <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
        <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
        <div class="bm-form-row-2">
          <label>Data sprzedaży<input name="date" type="date" value="${currentIsoDate()}" required></label>
          <label>Godzina<input name="time" type="time" value="06:00" required></label>
        </div>
        <label>Zakup produktów<select name="productId" id="walkinProductSelect"><option value="">Wybierz z posiadanych</option>${productOptions}</select></label>
        <label>Lub wpisz produkt<input name="productCustom" placeholder="Wpisz produkt ręcznie"></label>
        <label>Zakup usług<select name="serviceId" id="walkinServiceSelect"><option value="">Wybierz z posiadanych</option>${serviceOptions}</select></label>
        <label>Lub wpisz usługę<input name="serviceCustom" placeholder="Wpisz usługę ręcznie"></label>
        <label>Razem do zapłaty<input name="amount" id="walkinAmount" type="number" min="0" step="0.01" value="0.00" readonly></label>
        <label>Sprzedaż<select name="paymentMethod" required><option value="gotówka">gotówka</option><option value="karta kredytowa">karta kredytowa</option><option value="pakiet">pakiet</option><option value="karnet">karnet</option><option value="gratis">gratis</option></select></label>
        <label class="full">Opis<textarea name="description" placeholder="Opis sprzedaży"></textarea></label>
        <button type="submit">Zapisz sprzedaż</button>
      </form>
      <p id="walkinFormMessage" class="panel-message"></p>
    </section>

    <section class="bm-page-card" id="walkinDeleteCard" hidden>
      <h2>Usuń sprzedaż bez wizyty</h2>
      <form id="walkinDeleteForm" class="bm-form-grid bm-wide-form">
        <label class="full">Wybierz sprzedaż<select name="saleId" required><option value="">Wybierz z obecnych</option>${walkinDeleteOptions}</select></label>
        <button type="submit" class="bm-danger-btn">Usuń sprzedaż</button>
      </form>
      <p id="walkinDeleteMessage" class="panel-message"></p>
    </section>`;

    renderPanelFrame(ctx, 'walkins', content, '', '');
    const canEditPastWalkins = hasSystemPermission(getCurrentContext().user, 'sprzedaż bez wizyt wczorajsza i wcześniejsza (dodawanie, edycja, usuwanie)');
    const denyPastWalkinAction = (dateValue, msg) => {
      const d = parseIsoDate(dateValue);
      if (!canEditPastWalkins && d && d.getTime() < normalizeDate(new Date()).getTime()) {
        if (msg) { msg.textContent = 'Brak uprawnienia do sprzedaży bez wizyt z dni wcześniejszych.'; msg.style.color = '#fca5a5'; }
        return true;
      }
      return false;
    };
    const formCard = document.querySelector('#walkinFormCard');
    const deleteCard = document.querySelector('#walkinDeleteCard');
    const walkinPanels = [formCard, deleteCard];
    document.querySelector('#showAddWalkin')?.addEventListener('click', () => showOnlyPanel(formCard, walkinPanels));
    document.querySelector('#showDeleteWalkin')?.addEventListener('click', () => showOnlyPanel(deleteCard, walkinPanels));
    if (canViewWalkinHistory) setupLimitDropdown('#walkinsLimit', null);
    const searchInput = document.querySelector('#walkinsSearch');
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const q = encodeURIComponent(searchInput.value || '');
        window.location.href = q ? `walkins.html?q=${q}` : 'walkins.html';
      }
    });
    const updateAmount = () => {
      const productSelect = document.querySelector('#walkinProductSelect');
      const serviceSelect = document.querySelector('#walkinServiceSelect');
      const productPrice = Number(productSelect?.selectedOptions?.[0]?.dataset?.price || 0);
      const servicePrice = Number(serviceSelect?.selectedOptions?.[0]?.dataset?.price || 0);
      const amount = document.querySelector('#walkinAmount');
      if (amount) amount.value = (productPrice + servicePrice).toFixed(2);
    };
    document.querySelector('#walkinProductSelect')?.addEventListener('change', updateAmount);
    document.querySelector('#walkinServiceSelect')?.addEventListener('change', updateAmount);
    document.querySelector('#walkinForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#walkinFormMessage');
      if (!data.date || !data.time || !data.employeeId || !data.customerId) { if(msg){ msg.textContent='Uzupełnij datę, godzinę, pracownika i klienta.'; msg.style.color='#fca5a5'; } return; }
      if (!data.productId && !String(data.productCustom || '').trim() && !data.serviceId && !String(data.serviceCustom || '').trim()) { if(msg){ msg.textContent='Wybierz lub wpisz produkt albo usługę.'; msg.style.color='#fca5a5'; } return; }
      saveUndoSnapshot('Dodanie sprzedaży bez wizyty', currentDb);
      currentDb.walkinSales = currentDb.walkinSales || [];
      currentDb.walkinSales.push({
        id:createId('walkin'), companyId:company.id, date:String(data.date), time:String(data.time),
        employeeId:String(data.employeeId), customerId:String(data.customerId), productId:String(data.productId || ''),
        productCustom:String(data.productCustom || '').trim(), serviceId:String(data.serviceId || ''), serviceCustom:String(data.serviceCustom || '').trim(),
        amount:String(data.amount || '0.00'), paymentMethod:String(data.paymentMethod || 'gotówka'), description:String(data.description || '').trim(), createdAt:new Date().toISOString()
      });
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Sprzedaż zapisana.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
    document.querySelector('#walkinDeleteForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentDb = loadDatabase();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const msg = document.querySelector('#walkinDeleteMessage');
      const saleId = String(data.saleId || '');
      const index = (currentDb.walkinSales || []).findIndex(sale => sale.id === saleId && sale.companyId === company.id);
      if (index < 0) { if(msg){ msg.textContent='Wybierz sprzedaż do usunięcia.'; msg.style.color='#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie sprzedaży bez wizyty', currentDb);
      currentDb.walkinSales.splice(index, 1);
      saveDatabase(currentDb);
      if(msg){ msg.textContent='Sprzedaż usunięta. Możesz użyć Cofnij Czas.'; msg.style.color='#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    });
  };


  const formatDatePL = (value) => {
    if (!value) return '';
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return String(value);
  };
  const moneyPL = (value) => {
    const num = Number(String(value || '0').replace(',', '.'));
    if (Number.isNaN(num)) return String(value || '0');
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDateTimePL = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  };

  const renderMarketing = (ctx) => {
    const { db, company } = ctx;
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const groups = (db.customerGroups || []).filter(g => g.companyId === company.id);
    const campaigns = (db.marketingCampaigns || []).filter(c => c.companyId === company.id);
    const q = normalizeText(new URLSearchParams(window.location.search).get('q') || '');
    const filteredCampaigns = campaigns.filter(c => !q || normalizeText([c.name,c.sentAt,c.channel,c.description,c.status,c.customerGroup].join(' ')).includes(q));

    const groupOptions = groups.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join('');
    const customerOptions = customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone)}</option>`).join('');
    const senderOptions = ['CompanyManager','PWC Studio','CMDEMO'].map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    const emailSenderOptions = ['kontakt@companymanager.local','marketing@companymanager.local'].map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    const campaignRows = filteredCampaigns.map(c => [
      escapeHtml(c.name || '-'),
      escapeHtml(formatDateTimePL(c.sentAt)),
      escapeHtml(c.channel || '-'),
      escapeHtml(c.description || ''),
      escapeHtml(c.customerCount || 0),
      `<span class="bm-status ${String(c.status).toLowerCase()==='aktywna' ? 'active' : 'inactive'}">${escapeHtml(c.status || '-')}</span>`,
      escapeHtml(c.customerGroup || '-')
    ]);
    const campaignsTable = campaignRows.length ? table(['Kampania','Data i godzina wysłania','Kanał','OPIS','L. klientów','Status','Grupa Klientów'], campaignRows) : `<div class="bm-empty-state">Nie znaleziono żadnych danych</div>`;

    const content = `<section class="bm-page-card marketing-module">
      <div class="bm-page-head customers-head"><h2>Marketing</h2><div class="bm-actions-row"><button id="showMarketingSms" type="button">SMS</button><button id="showMarketingEmail" type="button">Email</button><button id="showDeleteCampaign" type="button" class="bm-danger-btn">Usuń</button></div></div>
      <div class="bm-table-toolbar"><div class="cm-limit-toolbar">${limitDropdownHtml('marketingLimit', '50')}</div><label>Szukaj: <input id="marketingSearch" type="search" placeholder="Szukaj kampanii" value="${escapeHtml(new URLSearchParams(window.location.search).get('q') || '')}"></label></div>
      ${campaignsTable}
    </section>

    <section id="marketingSmsCard" class="bm-page-card bm-inner-card" hidden>
      <h2>SMS</h2>
      <form id="marketingSmsForm" class="bm-form-grid bm-wide-form marketing-form">
        <label>Nadawca<input name="smsSender" list="smsSenderList" placeholder="Wpisz nazwę nadawcy lub wybierz z posiadanych"><datalist id="smsSenderList">${senderOptions}</datalist></label>
        <label class="full">Treść wiadomości<textarea name="smsContent" id="smsContent" placeholder="Wpisz treść wiadomości"></textarea></label>
        <div class="full marketing-preview"><strong>Podgląd:</strong><p id="smsPreview">Wiadomość pojawi się tutaj.</p></div>
        <label>Liczba znaków<input id="smsCharCount" type="text" value="0" readonly></label>
        <label>Koszt jednej wiadomości<input type="text" value="1 SMS (0,10 PLN)" readonly></label>
        <div class="bm-form-row-2 full"><label>Test wiadomości<input name="smsTestPhone" placeholder="+48321321321"></label><button type="button" id="sendSmsTest">Wyślij test</button></div>
        ${marketingRecipientsHtml(groupOptions, customerOptions, 'sms')}
        <label>Liczba znalezionych telefonów<input id="smsFoundCount" type="text" value="0" readonly></label>
        <div class="bm-form-row-2 full"><button type="button" id="saveSmsCampaign">Zapisz</button><button type="button" id="sendSmsCampaign">Wyślij</button></div>
      </form>
      <p id="smsMarketingMessage" class="panel-message"></p>
    </section>
    <section id="marketingEmailCard" class="bm-page-card bm-inner-card" hidden>
      <h2>Email</h2>
      <form id="marketingEmailForm" class="bm-form-grid bm-wide-form marketing-form">
        <label>Nadawca<input name="emailSender" list="emailSenderList" placeholder="Wpisz nadawcę lub wybierz z posiadanych"><datalist id="emailSenderList">${emailSenderOptions}</datalist></label>
        <label>Tytuł<input name="emailTitle" id="emailTitle" placeholder="Wpisz tytuł wiadomości"></label>
        <label class="full">Treść<textarea name="emailContent" id="emailContent" placeholder="Wpisz treść wiadomości"></textarea></label>
        <div class="bm-form-row-2 full"><label>Testuj Email<input name="emailTest" placeholder="test@firma.pl"></label><button type="button" id="sendEmailTest">Wyślij test</button></div>
        ${marketingRecipientsHtml(groupOptions, customerOptions, 'email')}
        <label>Liczba znalezionych email<input id="emailFoundCount" type="text" value="0" readonly></label>
        <div class="bm-form-row-2 full"><button type="button" id="saveEmailCampaign">Zapisz</button><button type="button" id="sendEmailCampaign">Wyślij</button></div>
      </form>
      <p id="emailMarketingMessage" class="panel-message"></p>
    </section>
    <section id="marketingDeleteCard" class="bm-page-card bm-inner-card" hidden>
      <h2>Usuń kampanię</h2>
      <form id="marketingDeleteForm" class="bm-form-grid bm-wide-form">
        <label class="full">Wybierz kampanię<select name="campaignId">${campaigns.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml([c.name, formatDateTimePL(c.sentAt), c.channel, String(c.description || '').slice(0,70), c.customerCount + ' klientów', c.status, c.customerGroup].filter(Boolean).join(' — '))}</option>`).join('')}</select></label>
        <div class="bm-form-row-2 full"><button type="button" id="deleteMarketingCampaign" class="bm-danger-btn">Usuń</button></div>
      </form>
      <p id="deleteMarketingMessage" class="panel-message"></p>
    </section>`;

    renderPanelFrame(ctx, 'marketing', content, '', '');
    setupLimitDropdown('#marketingLimit', null);
    const smsCard = document.querySelector('#marketingSmsCard');
    const emailCard = document.querySelector('#marketingEmailCard');
    const deleteCard = document.querySelector('#marketingDeleteCard');
    const marketingPanels = [smsCard, emailCard, deleteCard];
    document.querySelector('#showMarketingSms')?.addEventListener('click', () => showOnlyPanel(smsCard, marketingPanels));
    document.querySelector('#showMarketingEmail')?.addEventListener('click', () => showOnlyPanel(emailCard, marketingPanels));
    document.querySelector('#showDeleteCampaign')?.addEventListener('click', () => showOnlyPanel(deleteCard, marketingPanels));
    const search = document.querySelector('#marketingSearch');
    search?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const val = encodeURIComponent(search.value || '');
        window.location.href = val ? `marketing.html?q=${val}` : 'marketing.html';
      }
    });

    setupMarketingForm('sms', customers);
    setupMarketingForm('email', customers);

    document.querySelector('#sendSmsTest')?.addEventListener('click', () => {
      const msg = document.querySelector('#smsMarketingMessage');
      if (msg) { msg.textContent = 'Test SMS zapisany w wersji demo.'; msg.style.color = '#86efac'; }
    });
    document.querySelector('#sendEmailTest')?.addEventListener('click', () => {
      const msg = document.querySelector('#emailMarketingMessage');
      if (msg) { msg.textContent = 'Test Email zapisany w wersji demo.'; msg.style.color = '#86efac'; }
    });

    const saveCampaign = (channel, statusLabel) => {
      const currentDb = loadDatabase();
      const form = document.querySelector(channel === 'SMS' ? '#marketingSmsForm' : '#marketingEmailForm');
      const msg = document.querySelector(channel === 'SMS' ? '#smsMarketingMessage' : '#emailMarketingMessage');
      const data = Object.fromEntries(new FormData(form).entries());
      const description = channel === 'SMS' ? String(data.smsContent || '').trim() : String(data.emailContent || '').trim();
      const title = channel === 'SMS' ? 'Kampania SMS' : String(data.emailTitle || 'Kampania Email').trim();
      if (!description) { if (msg) { msg.textContent = 'Uzupełnij treść wiadomości.'; msg.style.color = '#fca5a5'; } return; }
      const count = countMarketingRecipients(form, customers, channel === 'SMS' ? 'phone' : 'email');
      const groupLabel = marketingGroupLabel(form);
      saveUndoSnapshot(`${statusLabel} kampanii ${channel}`, currentDb);
      currentDb.marketingCampaigns = currentDb.marketingCampaigns || [];
      currentDb.marketingCampaigns.push({
        id:createId('campaign'), companyId:company.id, name:title || (channel === 'SMS' ? 'SMS' : 'Email'), sentAt:new Date().toISOString(), channel,
        description, customerCount:count, status: statusLabel === 'Wysłanie' ? 'aktywna' : 'nieaktywna', customerGroup:groupLabel
      });
      saveDatabase(currentDb);
      if (msg) { msg.textContent = statusLabel === 'Wysłanie' ? 'Kampania wysłana w wersji demo.' : 'Kampania zapisana.'; msg.style.color = '#86efac'; }
      setTimeout(()=>window.location.reload(),650);
    };
    document.querySelector('#deleteMarketingCampaign')?.addEventListener('click', () => {
      const currentDb = loadDatabase();
      const form = document.querySelector('#marketingDeleteForm');
      const msg = document.querySelector('#deleteMarketingMessage');
      const campaignId = String(new FormData(form).get('campaignId') || '');
      if (!campaignId) { if (msg) { msg.textContent = 'Wybierz kampanię do usunięcia.'; msg.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie kampanii marketingowej', currentDb);
      currentDb.marketingCampaigns = (currentDb.marketingCampaigns || []).filter(c => c.id !== campaignId);
      saveDatabase(currentDb);
      if (msg) { msg.textContent = 'Kampania została usunięta.'; msg.style.color = '#86efac'; }
      setTimeout(() => window.location.reload(), 650);
    });
    document.querySelector('#saveSmsCampaign')?.addEventListener('click', () => saveCampaign('SMS','Zapisanie'));
    document.querySelector('#sendSmsCampaign')?.addEventListener('click', () => saveCampaign('SMS','Wysłanie'));
    document.querySelector('#saveEmailCampaign')?.addEventListener('click', () => saveCampaign('Email','Zapisanie'));
    document.querySelector('#sendEmailCampaign')?.addEventListener('click', () => saveCampaign('Email','Wysłanie'));
  };

  const marketingRecipientsHtml = (groupOptions, customerOptions, prefix) => `
    <fieldset class="full marketing-recipients"><legend>Wyślij do</legend>
      <label class="bm-checkbox-line"><input type="checkbox" name="allCustomers"> wszystkich klientów</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="selectedGroups" class="marketing-mode-checkbox" data-panel="${prefix}GroupPanel"> wybranych grup klientów</label>
      <div id="${prefix}GroupPanel" class="marketing-extra-panel" hidden><label>Wybierz grupy klientów<select name="groups" multiple>${groupOptions}</select></label></div>
      <label class="bm-checkbox-line"><input type="checkbox" name="selectedCustomers" class="marketing-mode-checkbox" data-exclusive="date" data-panel="${prefix}CustomersPanel"> wybranych klientów</label>
      <div id="${prefix}CustomersPanel" class="marketing-extra-panel" hidden><label>Wybierz klientów<select name="customers" multiple>${customerOptions}</select></label></div>
      <label class="bm-checkbox-line"><input type="checkbox" name="allWomen"> wszystkich kobiet</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="allMen"> wszystkich mężczyzn</label>
      <label class="bm-checkbox-line"><input type="checkbox" name="updatedRange" class="marketing-mode-checkbox" data-exclusive="date" data-panel="${prefix}UpdatedPanel"> data ostatniej aktualizacji klienta</label>
      <div id="${prefix}UpdatedPanel" class="marketing-extra-panel" hidden><div class="bm-form-row-2"><label>Od<input name="updatedFrom" type="date" value="${currentIsoDate()}"></label><label>Do<input name="updatedTo" type="date" value="${currentIsoDate()}"></label></div></div>
      <label class="bm-checkbox-line"><input type="checkbox" name="addedRange" class="marketing-mode-checkbox" data-exclusive="date" data-panel="${prefix}AddedPanel"> data dodania klienta</label>
      <div id="${prefix}AddedPanel" class="marketing-extra-panel" hidden><div class="bm-form-row-2"><label>Od<input name="addedFrom" type="date" value="${currentIsoDate()}"></label><label>Do<input name="addedTo" type="date" value="${currentIsoDate()}"></label></div></div>
    </fieldset>`;

  const setupMarketingForm = (prefix, customers) => {
    const form = document.querySelector(`#marketing${prefix === 'sms' ? 'Sms' : 'Email'}Form`);
    if (!form) return;
    const countId = prefix === 'sms' ? '#smsFoundCount' : '#emailFoundCount';
    const recipientKey = prefix === 'sms' ? 'phone' : 'email';
    const updateCount = () => {
      const countEl = document.querySelector(countId);
      if (countEl) countEl.value = String(countMarketingRecipients(form, customers, recipientKey));
    };
    form.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('change', updateCount));
    form.querySelectorAll('.marketing-mode-checkbox').forEach(box => {
      box.addEventListener('change', () => {
        const panelId = box.dataset.panel;
        const panel = panelId ? document.getElementById(panelId) : null;
        if (box.checked && box.dataset.exclusive === 'date') {
          form.querySelectorAll('.marketing-mode-checkbox[data-exclusive="date"]').forEach(other => {
            if (other !== box) { other.checked = false; const otherPanel = document.getElementById(other.dataset.panel); if (otherPanel) otherPanel.hidden = true; }
          });
        }
        if (panel) panel.hidden = !box.checked;
        updateCount();
      });
    });
    if (prefix === 'sms') {
      const smsContent = document.querySelector('#smsContent');
      const preview = document.querySelector('#smsPreview');
      const count = document.querySelector('#smsCharCount');
      smsContent?.addEventListener('input', () => {
        if (preview) preview.textContent = smsContent.value || 'Wiadomość pojawi się tutaj.';
        if (count) count.value = String(smsContent.value.length);
      });
    }
    updateCount();
  };

  const countMarketingRecipients = (form, customers, key) => {
    let selected = customers.slice();
    if (form.querySelector('[name="allWomen"]')?.checked) selected = selected.filter(c => normalizeText(c.gender) === 'kobieta');
    if (form.querySelector('[name="allMen"]')?.checked) selected = selected.filter(c => normalizeText(c.gender) === 'mezczyzna');
    if (form.querySelector('[name="selectedGroups"]')?.checked) {
      const groups = Array.from(form.querySelector('[name="groups"]')?.selectedOptions || []).map(o => normalizeText(o.value));
      if (groups.length) selected = selected.filter(c => groups.includes(normalizeText(c.group)));
    }
    if (form.querySelector('[name="selectedCustomers"]')?.checked) {
      const ids = Array.from(form.querySelector('[name="customers"]')?.selectedOptions || []).map(o => o.value);
      if (ids.length) selected = selected.filter(c => ids.includes(c.id));
    }
    if (!form.querySelector('[name="allCustomers"]')?.checked && !form.querySelector('[name="allWomen"]')?.checked && !form.querySelector('[name="allMen"]')?.checked && !form.querySelector('[name="selectedGroups"]')?.checked && !form.querySelector('[name="selectedCustomers"]')?.checked && !form.querySelector('[name="updatedRange"]')?.checked && !form.querySelector('[name="addedRange"]')?.checked) {
      selected = [];
    }
    return selected.filter(c => String(c[key] || '').trim()).length;
  };

  const marketingGroupLabel = (form) => {
    if (form.querySelector('[name="allCustomers"]')?.checked) return 'Wszyscy';
    if (form.querySelector('[name="allWomen"]')?.checked) return 'Kobiety';
    if (form.querySelector('[name="allMen"]')?.checked) return 'Mężczyźni';
    if (form.querySelector('[name="selectedGroups"]')?.checked) return Array.from(form.querySelector('[name="groups"]')?.selectedOptions || []).map(o=>o.value).join(', ') || 'Wybrane grupy';
    if (form.querySelector('[name="selectedCustomers"]')?.checked) return 'Wybrani klienci';
    if (form.querySelector('[name="updatedRange"]')?.checked) return 'Data ostatniej aktualizacji';
    if (form.querySelector('[name="addedRange"]')?.checked) return 'Data dodania klienta';
    return '-';
  };

  const renderPasses = (ctx) => {
    const { db, company } = ctx;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || 'all';
    const q = normalizeText(params.get('q') || '');
    const limit = params.get('limit') || '50';
    const companyCustomers = (db.customers || []).filter(c => c.companyId === company.id);
    const companyEmployees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const customerLabel = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone || '-';
    const customersById = Object.fromEntries(companyCustomers.map(c => [c.id, customerLabel(c)]));
    const employeeOptions = companyEmployees.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName || u.email || u.login)}</option>`).join('');
    const customerOptions = companyCustomers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(customerLabel(c))}</option>`).join('');
    const passes = (db.passes || []).filter(pass => pass.companyId === company.id);
    const filtered = passes.filter(pass => {
      const statusOk = status === 'all' || normalizeText(pass.status || '') === normalizeText(status);
      const text = normalizeText([pass.name, pass.number, pass.validUntil, pass.description, pass.buyer, customersById[pass.customerId], pass.value, pass.remaining, pass.status].join(' '));
      return statusOk && (!q || text.includes(q));
    });
    const newestPass = passes[passes.length - 1]?.number || 'XXXX';
    const rows = filtered.map(pass => [
      escapeHtml([pass.name, pass.number].filter(Boolean).join(' / ') || '-'),
      escapeHtml(formatDatePL(pass.validUntil)),
      escapeHtml(pass.description || ''),
      escapeHtml(pass.buyer || '-'),
      escapeHtml(customersById[pass.customerId] || '-'),
      escapeHtml(moneyPL(pass.value || '0')),
      escapeHtml(moneyPL(pass.remaining || '0'))
    ]);
    const passOptions = passes.map(pass => `<option value="${escapeHtml(pass.id)}">${escapeHtml([pass.name || 'Karnet', pass.number || '', customersById[pass.customerId] || '-', `ważny do ${formatDatePL(pass.validUntil)}`, `${moneyPL(pass.value || '0')}`, `pozostało ${moneyPL(pass.remaining || '0')}`, pass.status || ''].filter(Boolean).join(' — '))}</option>`).join('');
    const tableHtml = rows.length ? table(['Nazwa / nr. karnetu','Ważności do','Opis','Kto kupił','Klient','Wartość (PLN)','Pozostała kwota (PLN)'], rows) : `<div class="bm-empty-state">Nie znaleziono żadnych danych</div>`;
    const content = `<section class="bm-page-card passes-module">
      <div class="bm-page-head customers-head"><h2>Karnety</h2><div class="bm-actions-row"><button id="showAddPass" type="button">Dodaj</button><button id="showDeletePass" type="button" class="bm-danger-btn">Usuń</button></div></div>
      <div class="bm-filter-tabs">
        <a class="${status === 'all' ? 'active' : ''}" href="passes.html?status=all&limit=${encodeURIComponent(limit)}">pokaż wszystkie</a>
        <a class="${status === 'aktualne' ? 'active' : ''}" href="passes.html?status=aktualne&limit=${encodeURIComponent(limit)}">aktualne</a>
        <a class="${status === 'zrealizowane' ? 'active' : ''}" href="passes.html?status=zrealizowane&limit=${encodeURIComponent(limit)}">zrealizowane</a>
        <a class="${status === 'po terminie' ? 'active' : ''}" href="passes.html?status=po%20terminie&limit=${encodeURIComponent(limit)}">po terminie</a>
      </div>
      <section id="addPassPanel" class="bm-page-card bm-inner-card" hidden>
        <h2>Dodaj karnet</h2>
        <form id="addPassForm" class="bm-form-grid bm-wide-form">
          <div class="bm-form-row-2 full"><label>Data i godzina sprzedaży<input name="saleDate" type="date" value="${currentIsoDate()}" required></label><label>Godzina<input name="saleTime" type="time" value="06:00" required></label></div>
          <label>Pracownik<select name="employeeId" required><option value="">Wybierz pracownika</option>${employeeOptions}</select></label>
          <label>Data ważności karnetu<input name="validUntil" type="date" value="${isoDatePlusMonths(1)}" required></label>
          <label>Wartość karnetu (%)<input name="value" type="number" min="0" step="0.01" value="0.00" required></label>
          <label>Sposób płatności<select name="paymentMethod" required><option value="gotówka">gotówka</option><option value="karta kredytowa">karta kredytowa</option><option value="karnet">karnet</option><option value="pakiet">pakiet</option><option value="gratis">gratis</option></select></label>
          <label>Klient<select name="customerId" required><option value="">Wybierz klienta</option>${customerOptions}</select></label>
          <div class="full"><button type="button" id="showInlinePassCustomer" class="bm-secondary-btn">Dodaj klienta</button></div>
          <div id="inlinePassCustomerPanel" class="bm-page-card bm-inner-card full bm-nested-modal" hidden>
            <h3>Dodaj nowego klienta</h3>
            <div class="bm-form-grid">
              <label>Imię i nazwisko*<input name="newCustomerName" placeholder="Imię i nazwisko"></label>
              <label>Nr telefonu<input name="newCustomerPhone" placeholder="Nr telefonu"><small class="bm-form-hint">np.+48321321321</small></label>
              <label>Adres email<input name="newCustomerEmail" type="email" placeholder="Adres email"></label>
              <label class="full">Opis<textarea name="newCustomerDescription" placeholder="Opis"></textarea></label>
              <div class="full bm-action-row"><button type="button" id="addInlinePassCustomer">Zatwierdź</button><button type="button" id="cancelInlinePassCustomer" class="bm-light-btn">Anuluj</button></div>
            </div>
          </div>
          <label class="full">Opis<textarea name="description" placeholder="Opis"></textarea></label>
          <div class="full"><button type="submit">Dodaj</button></div>
        </form>
      </section>
      <section id="deletePassPanel" class="bm-page-card bm-inner-card" hidden>
        <h2>Usuń karnet</h2>
        <form id="deletePassForm" class="bm-form-grid bm-wide-form">
          <label class="full">Wybierz karnet<select name="passId" required><option value="">Wybierz karnet</option>${passOptions}</select></label>
          <div class="full"><button type="submit" class="bm-danger-btn">Usuń</button></div>
        </form>
      </section>
      <div class="bm-table-toolbar">
        ${pageSizeDropdown('passesPageSize', limit)}
        <label>Szukaj: <input id="passesSearch" type="search" placeholder="Szukaj karnetów" value="${escapeHtml(params.get('q') || '')}"></label>
      </div>
      <div class="bm-latest-pass"><strong>Najnowszy karnet:</strong> <input id="latestPassNumber" type="text" value="${escapeHtml(newestPass)}" aria-label="Najnowszy karnet"></div>
      ${tableHtml}
    </section>`;
    renderPanelFrame(ctx, 'passes', content, '', '');
    const panels = [document.querySelector('#addPassPanel'), document.querySelector('#deletePassPanel')];
    document.querySelector('#showAddPass')?.addEventListener('click', () => showOnlyPanel(panels[0], panels));
    document.querySelector('#showDeletePass')?.addEventListener('click', () => showOnlyPanel(panels[1], panels));
    const search = document.querySelector('#passesSearch');
    const apply = () => {
      const val = encodeURIComponent(search?.value || '');
      window.location.href = `passes.html?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(document.querySelector('#passesPageSize')?.value || limit)}${val ? `&q=${val}` : ''}`;
    };
    search?.addEventListener('keydown', (event) => { if (event.key === 'Enter') apply(); });
    setupLimitDropdown('#passesPageSize', apply);
    document.querySelector('#showInlinePassCustomer')?.addEventListener('click', (event) => {
      event.preventDefault();
      const panel = document.querySelector('#inlinePassCustomerPanel');
      if (panel) { panel.hidden = false; panel.classList.add('bm-nested-modal'); }
      updateGlobalModalState();
    });
    document.querySelector('#cancelInlinePassCustomer')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panel = document.querySelector('#inlinePassCustomerPanel');
      if (panel) panel.hidden = true;
      updateGlobalModalState();
    });
    document.querySelector('#addInlinePassCustomer')?.addEventListener('click', () => {
      const form = document.querySelector('#addPassForm');
      const msgName = String(form?.newCustomerName?.value || '').trim();
      if (!form || !msgName) { alert('Uzupełnij imię i nazwisko klienta.'); return; }
      const parts = msgName.split(/\s+/);
      const firstName = parts.shift() || msgName;
      const lastName = parts.join(' ');
      const phone = String(form.newCustomerPhone?.value || '').trim();
      if (phone && !isValidPhone(phone)) { alert('Zły format numeru telefonu. Akceptujemy +48321321321 albo +48 321 321 321.'); return; }
      const currentDb = loadDatabase();
      saveUndoSnapshot('Dodanie klienta z karnetu', currentDb);
      const customer = { id:createId('customer'), companyId:company.id, firstName, lastName, gender:'', phone, email:String(form.newCustomerEmail?.value || '').trim(), updatedAt:currentDisplayDate(), lastVisit:'', importantInfo:String(form.newCustomerDescription?.value || '').trim(), status:'aktywny', source:'', specialFeatures:'', cardNumber:'', referrer:'', visitSms:'tak', visitEmail:'tak', marketingSms:'nie', marketingEmail:'nie', serviceDiscount:'', productDiscount:'', group:'', birthDate:'', nameDay:'' };
      currentDb.customers = currentDb.customers || [];
      currentDb.customers.push(customer);
      saveDatabase(currentDb);
      const customerSelect = form.querySelector('[name="customerId"]');
      if (customerSelect) {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${firstName} ${lastName}`.trim() || phone || customer.email || 'Nowy klient';
        option.selected = true;
        customerSelect.appendChild(option);
      }
      form.newCustomerName.value = '';
      if (form.newCustomerPhone) form.newCustomerPhone.value = '';
      if (form.newCustomerEmail) form.newCustomerEmail.value = '';
      if (form.newCustomerDescription) form.newCustomerDescription.value = '';
      const panel = document.querySelector('#inlinePassCustomerPanel');
      if (panel) panel.hidden = true;
      updateGlobalModalState();
    });
    document.querySelector('#addPassForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const currentDb = loadDatabase();
      const employee = (currentDb.users || []).find(u => u.id === data.employeeId);
      const nextNumber = `KARNET-${String((currentDb.passes || []).filter(p => p.companyId === company.id).length + 1).padStart(4,'0')}`;
      saveUndoSnapshot('Dodanie karnetu', currentDb);
      currentDb.passes = currentDb.passes || [];
      currentDb.passes.push({ id:createId('pass'), companyId:company.id, name:'Karnet', number:nextNumber, saleDate:data.saleDate, saleTime:data.saleTime, employeeId:data.employeeId, buyer:employee?.fullName || '-', validUntil:data.validUntil, paymentMethod:data.paymentMethod, customerId:data.customerId, value:String(data.value || '0.00'), remaining:String(data.value || '0.00'), description:String(data.description || '').trim(), status:'aktualne', createdAt:new Date().toISOString() });
      saveDatabase(currentDb);
      window.location.reload();
    });
    document.querySelector('#deletePassForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const passId = new FormData(event.currentTarget).get('passId');
      if (!passId) return;
      const currentDb = loadDatabase();
      saveUndoSnapshot('Usunięcie karnetu', currentDb);
      currentDb.passes = (currentDb.passes || []).filter(pass => pass.id !== passId);
      saveDatabase(currentDb);
      window.location.reload();
    });
  };

  const parseAnyDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2])-1, Number(match[3]));
    match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2])-1, Number(match[1]));
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const shortWeekdaysPL = ['Nd','Pon','Wt','Śr','Czw','Pt','So'];
  const reportDayLabel = (date) => `${shortWeekdaysPL[date.getDay()]},${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}`;

  const renderReports = (ctx) => {
    const { db, company } = ctx;
    const today = normalizeDate(new Date());
    const customers = (db.customers || []).filter(customer => customer.companyId === company.id);
    const visits = (db.visits || []).filter(visit => visit.companyId === company.id && visit.status !== 'usunięte');
    const dashboardVisits = (db.dashboardVisits || []).filter(visit => visit.companyId === company.id);
    const shortWeekdaysPL = ['Nd','Pon','Wt','Śr','Czw','Pt','So'];
    const monthShortPL = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const reportDayLabel = (date) => `${shortWeekdaysPL[date.getDay()]},${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}`;
    const sameIso = (date, iso) => {
      const parsed = parseAnyDate(iso);
      return parsed ? sameDay(parsed, date) : false;
    };
    const weekStart = (date) => {
      const d = normalizeDate(date);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      return d;
    };
    const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
    const addMonths = (date, months) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; };
    const addYears = (date, years) => { const d = new Date(date); d.setFullYear(d.getFullYear() + years); return d; };
    const inRange = (date, start, end) => date && date >= start && date <= end;
    const countForRange = (start, end) => {
      const signups = customers.filter(customer => inRange(normalizeDate(parseAnyDate(customer.createdAt) || parseAnyDate(customer.updatedAt) || today), start, end)).length;
      const visitsCount = visits.filter(visit => inRange(normalizeDate(parseAnyDate(visit.date)), start, end)).length + dashboardVisits.filter(visit => inRange(normalizeDate(parseAnyDate(visit.date)), start, end)).length;
      return { signups, visits: visitsCount };
    };
    const buildRows = (mode) => {
      const rows = [];
      const count = 20;
      if (mode === 'weeks') {
        const current = weekStart(today);
        for (let i = count - 1; i >= 0; i--) {
          const start = addDays(current, -7 * i);
          const end = addDays(start, 6);
          const stats = countForRange(start, end);
          rows.push({ label: `${reportDayLabel(start)}–${reportDayLabel(end)}`, ...stats });
        }
      } else if (mode === 'months') {
        const current = new Date(today.getFullYear(), today.getMonth(), 1);
        for (let i = count - 1; i >= 0; i--) {
          const start = addMonths(current, -i);
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
          const stats = countForRange(start, end);
          rows.push({ label: `${monthShortPL[start.getMonth()]} ${start.getFullYear()}`, ...stats });
        }
      } else if (mode === 'quarters') {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        const current = new Date(today.getFullYear(), quarterStartMonth, 1);
        for (let i = count - 1; i >= 0; i--) {
          const start = addMonths(current, -3 * i);
          const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
          const q = Math.floor(start.getMonth() / 3) + 1;
          const stats = countForRange(start, end);
          rows.push({ label: `Q${q} ${start.getFullYear()}`, ...stats });
        }
      } else if (mode === 'years') {
        const currentYear = today.getFullYear();
        for (let i = count - 1; i >= 0; i--) {
          const year = currentYear - i;
          const start = new Date(year, 0, 1);
          const end = new Date(year, 11, 31);
          const stats = countForRange(start, end);
          rows.push({ label: String(year), ...stats });
        }
      } else {
        for (let i = count - 1; i >= 0; i--) {
          const date = addDays(today, -i);
          const stats = countForRange(date, date);
          rows.push({ label: reportDayLabel(date), ...stats });
        }
      }
      return rows;
    };
    const dataByGroup = {
      days: buildRows('days'),
      weeks: buildRows('weeks'),
      months: buildRows('months'),
      quarters: buildRows('quarters'),
      years: buildRows('years')
    };
    const renderChart = (rows, modeLabel = 'dni') => {
      const rawMax = Math.max(25, ...rows.flatMap(row => [row.signups, row.visits]));
      const niceStep = (value) => {
        const target = Math.max(1, value / 8);
        const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
        const normalized = target / magnitude;
        if (normalized <= 1) return magnitude;
        if (normalized <= 2) return 2 * magnitude;
        if (normalized <= 5) return 5 * magnitude;
        return 10 * magnitude;
      };
      const step = niceStep(rawMax);
      const maxValue = Math.max(step, Math.ceil(rawMax / step) * step);
      const ticks = [];
      for (let value = maxValue; value >= 0; value -= step) ticks.push(value);
      if (ticks[ticks.length - 1] !== 0) ticks.push(0);
      const yAxis = ticks.map(value => `<span>${value}</span>`).join('');
      const gridLines = ticks.map(value => `<span style="bottom:${Math.round((value / maxValue) * 100)}%"></span>`).join('');
      const bars = rows.map(row => `
        <div class="cm-report-day" title="${escapeHtml(row.label)} — Zapisało się klientów: ${row.signups}, Liczba klientów: ${row.visits}">
          <div class="cm-report-bars">
            <span class="cm-report-bar cm-report-bar-clients" style="height:${Math.max(row.signups > 0 ? 10 : 0, Math.round((row.signups / maxValue) * 330))}px"></span>
            <span class="cm-report-bar cm-report-bar-visits" style="height:${Math.max(row.visits > 0 ? 10 : 0, Math.round((row.visits / maxValue) * 330))}px"></span>
          </div>
          <small>${escapeHtml(row.label)}</small>
        </div>
      `).join('');
      const tableRows = rows.map((row, index) => [String(index + 1), escapeHtml(row.label), String(row.signups), String(row.visits)]);
      return {
        chart: `<div class="cm-report-chart-inner"><div class="cm-report-y-axis">${yAxis}</div><div class="cm-report-plot"><div class="cm-report-grid">${gridLines}</div><div class="cm-report-days">${bars}</div></div></div>`,
        table: table(['Nr','Data','Zapisało się klientów','Liczba klientów'], tableRows),
        label: modeLabel
      };
    };
    const initial = renderChart(dataByGroup.days, 'dni');
    const content = `<section class="bm-page-card cm-report-card cm-report-chart-card">
      <div class="bm-page-head"><h2>Wykres</h2></div>
      <div class="cm-report-legend">
        <span><i class="cm-legend-dot cm-legend-clients"></i>Zapisało się klientów</span>
        <span><i class="cm-legend-dot cm-legend-visits"></i>Liczba klientów</span>
      </div>
      <div class="cm-report-chart" id="reportChart" aria-label="Statystyka 20 pozycji">
        ${initial.chart}
      </div>
    </section>
    <section class="bm-page-card cm-report-card cm-reports-module">
      <div class="bm-page-head"><h2>Statystyka</h2></div>
      <div class="cm-report-controls">
        <label>Grupuj według
          <select id="reportGroupBy">
            <option value="days" selected>dni</option>
            <option value="weeks">tygodnie</option>
            <option value="months">miesiące</option>
            <option value="quarters">kwartały</option>
            <option value="years">rok</option>
          </select>
        </label>
      </div>
      <div class="cm-report-table" id="reportTable">
        ${initial.table}
      </div>
    </section>`;
    renderPanelFrame(ctx, 'reports', content, '', '');
    addChartPngExportButton('.cm-report-chart-card .bm-page-head');
    addReportExportButton('.cm-reports-module .bm-page-head', 'statystyka', '.cm-reports-module');
    const select = document.querySelector('#reportGroupBy');
    const chart = document.querySelector('#reportChart');
    const tableBox = document.querySelector('#reportTable');
    const modeLabels = { days: 'dni', weeks: 'tygodnie', months: 'miesiące', quarters: 'kwartały', years: 'rok' };
    select?.addEventListener('change', () => {
      const mode = select.value || 'days';
      const rendered = renderChart(dataByGroup[mode] || dataByGroup.days, modeLabels[mode] || 'dni');
      if (chart) chart.innerHTML = rendered.chart;
      if (tableBox) tableBox.innerHTML = rendered.table;
    });
  };


  const renderPeriodReport = (ctx) => {
    const { db, company } = ctx;
    const today = new Date();
    const pad = (n) => String(n).padStart(2,'0');
    const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const periodParams = new URLSearchParams(window.location.search || '');
    const urlFrom = periodParams.get('from');
    const urlTo = periodParams.get('to');
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['visit_1','visit_2','pass_1','campaign_1'].includes(id);
    };
    const companyVisits = (db.visits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v));
    const dashboardVisits = (db.dashboardVisits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v));
    const walkins = (db.walkinSales || []).filter(w => w.companyId === company.id && !isSeedDemoRecord(w));
    const passes = (db.passes || []).filter(p => p.companyId === company.id && !isSeedDemoRecord(p));
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const services = (db.services || []).filter(service => service.companyId === company.id);
    const products = (db.products || []).filter(product => product.companyId === company.id);
    const categories = getServiceCategories(db, company.id);
    const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
    const parseDate = (value) => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
        const [y,m,d] = String(value).slice(0,10).split('-').map(Number);
        return new Date(y, m-1, d);
      }
      return null;
    };
    const inRange = (dateValue, start, end) => {
      const d = parseDate(dateValue);
      if (!d) return false;
      return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    };
    const paymentMethods = ['gotówka','karta kredytowa','karnet','pakiet','gratis'];
    const datePresets = [
      ['currentMonth','bieżący miesiąc'], ['currentWeek','bieżący tydzień'], ['today','dziś'], ['yesterday','wczoraj'],
      ['last7','ostatnie 7 dni'], ['previousWeek','poprzedni tydzień'], ['last14','ostatnie 2 tygodnie'], ['last30','ostatnie 30 dni'],
      ['previousMonth','poprzedni miesiąc'], ['last3Months','ostatnie 3 miesiące'], ['last6Months','ostatnie 6 miesięcy'],
      ['last12Months','ostatnie 12 miesięcy'], ['last90','ostatnie 90 dni'], ['last180','ostatnie 180 dni'], ['last365','ostatnie 365 dni']
    ];
    const employeeCheckboxes = employees.map(employee => `<label class="cm-period-employee-check"><input type="checkbox" class="periodEmployeeCheck" value="${escapeHtml(employee.id)}" checked> ${escapeHtml(employee.fullName || employee.login)}</label>`).join('') || '<span class="bm-muted">Brak pracowników</span>';

    const visitDate = (item) => item.date || item.saleDate || (item.sentAt ? String(item.sentAt).slice(0,10) : '');
    const currentStart = parseDate(urlFrom) || firstDay;
    const currentEnd = parseDate(urlTo) || lastDay;
    const isCancelledVisit = (visit) => ['odwołane','odwołana','odwołany','usunięte','usunięta'].includes(String(visit.status || '').toLowerCase()) || visit.cancelled === true;
    const isFinishedVisit = (visit) => ['zakończone','zakończona','zakończony'].includes(String(visit.status || '').toLowerCase());
    const isPlannedVisit = (visit) => !isCancelledVisit(visit) && !isFinishedVisit(visit) && ['zaplanowane','niezakończone',''].includes(String(visit.status || '').toLowerCase());
    const periodCompanyVisits = companyVisits.filter(v => inRange(v.date, currentStart, currentEnd));
    const periodDashboardVisits = dashboardVisits.filter(v => inRange(v.date, currentStart, currentEnd));
    const activeDashboardVisits = periodDashboardVisits.filter(v => !isCancelledVisit(v));
    const billableDashboardVisits = periodDashboardVisits.filter(v => !isCancelledVisit(v));
    const plannedVisits = periodCompanyVisits.filter(isPlannedVisit).length + activeDashboardVisits.filter(isPlannedVisit).length;
    const finishedVisits = periodCompanyVisits.filter(isFinishedVisit).length + periodDashboardVisits.filter(isFinishedVisit).length;
    const cancelledVisitItems = [...periodCompanyVisits.filter(isCancelledVisit), ...periodDashboardVisits.filter(isCancelledVisit)];
    const cancelledVisits = cancelledVisitItems.length;
    const cancelReasonStats = new Map();
    cancelledVisitItems.forEach(visit => {
      const rawReason = visit.cancelReason || visit.cancellationReason || visit.reason || visit.cancelNote || visit.statusReason || visit.description || visit.note || 'inne';
      const reason = String(rawReason || 'inne').trim() || 'inne';
      cancelReasonStats.set(reason, (cancelReasonStats.get(reason) || 0) + 1);
    });
    const cancelReasonRows = [...cancelReasonStats.entries()]
      .sort((a,b) => b[1] - a[1])
      .map(([reason,count]) => `<div><b>${count}</b><span>${escapeHtml(reason)}</span></div>`)
      .join('') || '<div><b>0</b><span>brak odwołanych wizyt</span></div>';
    const serviceSales = [
      ...billableDashboardVisits.filter(v => v.serviceId),
      ...walkins.filter(w => inRange(w.date || w.saleDate, currentStart, currentEnd) && (w.serviceId || w.serviceCustom || (!w.productId && !w.productName)))
    ];
    const productSales = [...billableDashboardVisits.filter(v => v.productId), ...walkins.filter(w => inRange(w.date || w.saleDate, currentStart, currentEnd) && (w.productId || w.productName))];
    const passSales = passes.filter(p => inRange(p.saleDate || p.createdAt || currentIsoDate(), currentStart, currentEnd));
    const allPayments = [
      ...billableDashboardVisits.map(v => ({ amount:Number(v.total || 0), method:v.payment || 'gotówka' })),
      ...walkins.filter(w => inRange(w.date || w.saleDate, currentStart, currentEnd)).map(w => ({ amount:Number(w.amount || w.total || 0), method:w.paymentMethod || w.payment || 'gotówka' })),
      ...passSales.map(p => ({ amount:Number(p.value || 0), method:p.paymentMethod || 'gotówka' }))
    ];
    const totalPayments = allPayments.reduce((sum, item) => sum + item.amount, 0);
    const cashPayments = allPayments.filter(p => String(p.method).toLowerCase().includes('gotówka')).reduce((sum, item) => sum + item.amount, 0);
    const paymentRows = paymentMethods.map(method => {
      const value = allPayments.filter(p => String(p.method || '').toLowerCase() === method.toLowerCase()).reduce((sum, item) => sum + item.amount, 0);
      return `<div><span>${escapeHtml(method)}</span><b>${money(value)}</b></div>`;
    }).join('');

    const serviceCategoryStats = new Map();
    serviceSales.forEach(sale => {
      const service = services.find(item => item.id === sale.serviceId);
      const category = categories.find(item => item.id === service?.categoryId)?.name || service?.category || '(bez kategorii)';
      const code = service?.code || '';
      const key = `${category}||${code}`;
      const prev = serviceCategoryStats.get(key) || { count:0, value:0, category, code };
      prev.count += 1;
      prev.value += Number(sale.total || sale.amount || service?.priceTo || service?.priceFrom || 0);
      serviceCategoryStats.set(key, prev);
    });
    const serviceRows = [...serviceCategoryStats.values()].map(item => [String(item.count), money(item.value), escapeHtml(item.category), escapeHtml(item.code || '')]);
    const productStats = new Map();
    productSales.forEach(sale => {
      const product = products.find(item => item.id === sale.productId);
      const category = product?.category || sale.category || '(bez kategorii)';
      const code = product?.code || '';
      const key = `${category}||${code}`;
      const prev = productStats.get(key) || { count:0, value:0, category, code };
      prev.count += 1;
      prev.value += Number(sale.amount || sale.total || product?.price || 0);
      productStats.set(key, prev);
    });
    const productRows = [...productStats.values()].map(item => [String(item.count), money(item.value), escapeHtml(item.category), escapeHtml(item.code || '')]);
    const passRows = passSales.length ? passSales.map(p => ['1', money(p.value || 0), escapeHtml(p.number || p.name || 'Karnet')]) : [];
    const employeeRows = employees.map(employee => {
      const ev = billableDashboardVisits.filter(v => v.employeeId === employee.id);
      const regular = periodCompanyVisits.filter(v => v.employeeId === employee.id && !isCancelledVisit(v));
      const empWalkins = walkins.filter(w => inRange(w.date || w.saleDate, currentStart, currentEnd) && w.employeeId === employee.id);
      const empServiceWalkins = empWalkins.filter(w => w.serviceId || w.serviceCustom || (!w.productId && !w.productName));
      const empProductWalkins = empWalkins.filter(w => w.productId || w.productName);
      const servCount = ev.filter(v => v.serviceId).length + regular.filter(v => v.serviceId).length + empServiceWalkins.length;
      const servValue = ev.filter(v => v.serviceId).reduce((sum, v) => sum + Number(v.total || 0), 0) + empServiceWalkins.reduce((sum, w) => sum + Number(w.total || w.amount || 0), 0);
      const prodCount = ev.filter(v => v.productId).length + empProductWalkins.length;
      const prodValue = ev.filter(v => v.productId).reduce((sum, v) => sum + Number(v.total || 0), 0) + empProductWalkins.reduce((sum, w) => sum + Number(w.total || w.amount || 0), 0);
      const empPasses = passSales.filter(p => p.employeeId === employee.id);
      const passValue = empPasses.reduce((sum, p) => sum + Number(p.value || 0), 0);
      return { id: employee.id, cells: [escapeHtml(employee.fullName || employee.login), String(ev.length + regular.length), String(servCount), money(servValue), String(prodCount), money(prodValue), String(empPasses.length), money(passValue), money(0)] };
    });
    const employeeTable = employeeRows.length
      ? `<div class="bm-table-wrap"><table class="bm-table" id="periodEmployeesTable"><thead><tr>${['Pracownik','Wizyty','Usługi liczba','Usługi wartość','Produkty liczba','Produkty wartość','Karnety liczba','Karnety wartość','Prowizja'].map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${employeeRows.map(row=>`<tr data-employee-id="${escapeHtml(row.id)}">${row.cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : table(['Pracownik','Wizyty','Usługi liczba','Usługi wartość','Produkty liczba','Produkty wartość','Karnety liczba','Karnety wartość','Prowizja'], [['-','0','0','0.00 PLN','0','0.00 PLN','0','0.00 PLN','0.00 PLN']]);
    const campaigns = (db.marketingCampaigns || []).filter(c => c.companyId === company.id && !isSeedDemoRecord(c) && inRange(String(c.sentAt || '').slice(0,10), currentStart, currentEnd));
    const smsCount = campaigns.filter(c => String(c.channel).toUpperCase() === 'SMS').length;
    const emailCount = campaigns.filter(c => String(c.channel).toUpperCase() === 'EMAIL').length;

    const content = `<section class="bm-page-card cm-period-report-card">
      <div class="bm-page-head cm-period-head"><h2>Raport z okresu</h2><div class="bm-actions-row"><button type="button" id="periodCheckBtn" class="bm-light-btn">Sprawdź</button><button type="button" id="periodExportBtn" class="cm-sales-export-btn cm-report-export-btn cm-report-export-green">Export</button></div></div>
      <div class="cm-period-controls">
        <label>od <input id="periodFrom" type="date" value="${toIso(currentStart)}"></label>
        <label>do <input id="periodTo" type="date" value="${toIso(currentEnd)}"></label>
        <select id="periodPreset">
          ${datePresets.map(([value,label]) => `<option value="${value}" ${value==='currentMonth'?'selected':''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="cm-period-kpis">
        <div><span>Liczba zaplanowanych wizyt</span><b>${plannedVisits}</b></div>
        <div><span>Liczba zakończonych wizyt</span><b>${finishedVisits}</b></div>
        <div><span>Liczba odwołanych wizyt</span><b>${cancelledVisits}</b></div>
      </div>
      <section class="cm-period-section">
        <h3>Powody odwołania wizyt</h3>
        <div class="cm-cancel-reasons">${cancelReasonRows}</div>
      </section>
      <section class="cm-period-section">
        <h3>Finanse</h3>
        <div class="cm-finance-grid">
          <div><span>Płatności</span><b>${money(totalPayments)}</b>${paymentRows}</div>
          <div><span>Stan kasy</span><b>${money(cashPayments)}</b><small>+${money(cashPayments)} płatności gotówką</small></div>
          <div><span>Obrót</span><b>${money(totalPayments)}</b><small>łączny obrót w wybranym okresie</small></div>
        </div>
      </section>
      <section class="cm-period-section"><h3>Usługi</h3><p>Sprzedane usługi w tym okresie: <b>${serviceSales.length}</b></p>${table(['L.szt.','Wartość PLN','Kategoria','Kod usługi'], serviceRows.length ? serviceRows : [['0','0.00 PLN','(bez kategorii)','']])}</section>
      <section class="cm-period-section"><h3>Produkty</h3><p>Sprzedane produkty w tym okresie: <b>${productSales.length}</b></p>${table(['L.szt.','Wartość PLN','Kategoria','Kod produktu'], productRows.length ? productRows : [['0','0.00 PLN','(bez kategorii)','']])}</section>
      <section class="cm-period-section"><h3>Karnety</h3><p>Sprzedane karnety</p>${table(['L.szt.','Wartość PLN','Kategoria'], passRows.length ? passRows : [['0','0.00 PLN','-']])}</section>
      <section class="cm-period-section">
        <h3>Pracownicy</h3>
        <div class="cm-period-employee-picker"><span>Pracownicy</span><label class="cm-period-employee-check cm-period-all"><input type="checkbox" id="periodEmployeeAll" checked> - wszyscy -</label>${employeeCheckboxes}</div>
        ${employeeTable}
      </section>
      <section class="cm-period-section cm-comm-grid">
        <div><h3>SMS</h3><p>Wysłane SMS</p><b>${smsCount}</b></div>
        <div><h3>Email</h3><p>Wysłane EMAIL</p><b>${emailCount}</b></div>
      </section>
    </section>`;
    renderPanelFrame(ctx, 'periodReport', content, '', '');
    const fromInput = document.querySelector('#periodFrom');
    const toInput = document.querySelector('#periodTo');
    const preset = document.querySelector('#periodPreset');
    const setRange = (mode) => {
      const base = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), 1);
      let end = new Date(base.getFullYear(), base.getMonth()+1, 0);
      const day = base.getDay() || 7;
      if (mode === 'today') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()); end = new Date(start); }
      if (mode === 'yesterday') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-1); end = new Date(start); }
      if (mode === 'currentWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day+1); end = new Date(start); end.setDate(start.getDate()+6); }
      if (mode === 'previousWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day-6); end = new Date(start); end.setDate(start.getDate()+6); }
      if (mode === 'last7') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-6); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === 'last14') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-13); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === 'last30') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-29); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === 'previousMonth') { start = new Date(base.getFullYear(), base.getMonth()-1, 1); end = new Date(base.getFullYear(), base.getMonth(), 0); }
      if (mode === 'last3Months') { start = new Date(base.getFullYear(), base.getMonth()-2, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (mode === 'last6Months') { start = new Date(base.getFullYear(), base.getMonth()-5, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (mode === 'last12Months') { start = new Date(base.getFullYear(), base.getMonth()-11, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (mode === 'last90') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-89); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === 'last180') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-179); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (mode === 'last365') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-364); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (fromInput) fromInput.value = toIso(start);
      if (toInput) toInput.value = toIso(end);
    };
    preset?.addEventListener('change', () => setRange(preset.value));
    document.querySelector('#periodCheckBtn')?.addEventListener('click', () => {
      const from = fromInput?.value || toIso(firstDay);
      const to = toInput?.value || toIso(lastDay);
      const url = new URL(window.location.href);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      window.location.href = url.toString();
    });
    document.querySelector('#periodExportBtn')?.addEventListener('click', () => exportVisibleReportTables('raport-z-okresu', '.cm-period-report-card'));
    const employeeAll = document.querySelector('#periodEmployeeAll');
    const employeeChecks = [...document.querySelectorAll('.periodEmployeeCheck')];
    const updateEmployeeTable = () => {
      const selected = new Set(employeeChecks.filter(check => check.checked).map(check => check.value));
      document.querySelectorAll('#periodEmployeesTable tbody tr[data-employee-id]').forEach(row => {
        row.style.display = selected.has(row.dataset.employeeId) ? '' : 'none';
      });
      if (employeeAll) employeeAll.checked = employeeChecks.length > 0 && employeeChecks.every(check => check.checked);
    };
    employeeAll?.addEventListener('change', () => { employeeChecks.forEach(check => { check.checked = employeeAll.checked; }); updateEmployeeTable(); });
    employeeChecks.forEach(check => check.addEventListener('change', updateEmployeeTable));
    updateEmployeeTable();
  };


  const renderCustomersReports = (ctx) => {
    const { db, company } = ctx;
    const pad = (n) => String(n).padStart(2,'0');
    const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    const parseDate = (value) => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
        const [y,m,d] = String(value).slice(0,10).split('-').map(Number);
        return new Date(y, m-1, d);
      }
      return null;
    };
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const params = new URLSearchParams(window.location.search || '');
    const mode = params.get('view') || 'plannedClients';
    const from = parseDate(params.get('from')) || firstDay;
    const to = parseDate(params.get('to')) || lastDay;
    const selectedEmployees = String(params.get('employees') || '').split(',').filter(Boolean);
    const selectedCategories = String(params.get('categories') || '').split(',').filter(Boolean);
    const searchValue = String(params.get('search') || '');
    const limitValue = String(params.get('limit') || '50');
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['visit_1','visit_2','pass_1','campaign_1'].includes(id);
    };
    const inRange = (dateValue) => {
      const d = parseDate(dateValue);
      if (!d) return false;
      return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
    };
    const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
    const customerLabel = (customer) => {
      if (!customer) return '-';
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || customer.email || customer.phone || '-';
    };
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const services = (db.services || []).filter(svc => svc.companyId === company.id);
    const categories = getServiceCategories(db, company.id);
    const customersById = Object.fromEntries(customers.map(c => [c.id, c]));
    const servicesById = Object.fromEntries(services.map(svc => [svc.id, svc]));
    const catNameById = Object.fromEntries(categories.map(cat => [cat.id, cat.name]));
    const employeeItems = employees.map(employee => ({ id: employee.id, label: employee.fullName || employee.login || employee.email || 'Pracownik' }));
    const categoryItems = categories.map(category => ({ id: category.id, label: category.name || 'Kategoria' }));
    const dropdownFilter = (id, title, items, selected, allLabel) => {
      const allSelected = !selected.length || selected.length >= items.length;
      const checkedCount = allSelected ? items.length : selected.length;
      const buttonText = checkedCount ? `Wybrano: ${checkedCount}` : 'Wybierz';
      const checkboxes = items.length ? items.map(item => {
        const checked = allSelected || selected.includes(item.id);
        return `<label class="cm-cr-dropdown-option"><input type="checkbox" class="${id}-item" value="${escapeHtml(item.id)}" ${checked ? 'checked' : ''}> ${escapeHtml(item.label)}</label>`;
      }).join('') : `<p class="cm-cr-dropdown-empty">Brak danych</p>`;
      return `<div class="cm-cr-dropdown" data-filter="${escapeHtml(id)}">
        <span class="cm-cr-dropdown-label">${escapeHtml(title)}</span>
        <button type="button" class="cm-cr-dropdown-button" id="${escapeHtml(id)}Toggle">${escapeHtml(buttonText)} ▼</button>
        <div class="cm-cr-dropdown-menu" id="${escapeHtml(id)}Menu" hidden>
          <label class="cm-cr-dropdown-option cm-cr-dropdown-all"><input type="checkbox" id="${escapeHtml(id)}All" ${allSelected ? 'checked' : ''}> ${escapeHtml(allLabel)}</label>
          ${checkboxes}
        </div>
      </div>`;
    };
    const presets = [
      ['currentMonth','bieżący miesiąc'], ['currentWeek','bieżący tydzień'], ['today','dziś'], ['yesterday','wczoraj'],
      ['last7','ostatnie 7 dni'], ['previousWeek','poprzedni tydzień'], ['last14','ostatnie 2 tygodnie'], ['last30','ostatnie 30 dni'],
      ['previousMonth','poprzedni miesiąc'], ['last3Months','ostatnie 3 miesiące'], ['last6Months','ostatnie 6 miesięcy'],
      ['last12Months','ostatnie 12 miesięcy'], ['last90','ostatnie 90 dni'], ['last180','ostatnie 180 dni'], ['last365','ostatnie 365 dni']
    ];
    const allVisits = [
      ...(db.visits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v)).map(v => ({...v, source:'visits'})),
      ...(db.dashboardVisits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v)).map(v => ({...v, source:'dashboard'}))
    ].filter(v => inRange(v.date));
    const isCancelled = (visit) => ['odwołane','odwołana','odwołany','usunięte','usunięta'].includes(String(visit.status || '').toLowerCase()) || visit.cancelled === true;
    const isFinished = (visit) => ['zakończone','zakończona','zakończony'].includes(String(visit.status || '').toLowerCase());
    const isPlanned = (visit) => !isCancelled(visit) && !isFinished(visit);
    let filteredVisits = allVisits.filter(mode === 'finishedVisits' ? isFinished : isPlanned);
    if (selectedEmployees.length) filteredVisits = filteredVisits.filter(v => selectedEmployees.includes(v.employeeId));
    if (selectedCategories.length) filteredVisits = filteredVisits.filter(v => {
      const service = servicesById[v.serviceId];
      return service && selectedCategories.includes(service.categoryId || service.category || '');
    });
    const serviceValue = (visit) => {
      const service = servicesById[visit.serviceId];
      return Number(visit.total || service?.priceTo || service?.priceFrom || service?.price || 0);
    };
    const summarizeByCustomer = () => {
      const map = new Map();
      filteredVisits.forEach(visit => {
        const customer = customersById[visit.customerId];
        const label = customerLabel(customer) || visit.clientName || '-';
        const key = visit.customerId || label;
        const prev = map.get(key) || { label, visits:0, services:0, value:0 };
        prev.visits += 1; if (visit.serviceId) prev.services += 1; prev.value += serviceValue(visit); map.set(key, prev);
      });
      return [...map.values()].sort((a,b) => b.visits - a.visits || b.value - a.value);
    };
    const summarizeByCategory = () => {
      const map = new Map();
      filteredVisits.forEach(visit => {
        const service = servicesById[visit.serviceId];
        const label = service ? (catNameById[service.categoryId] || service.category || '(bez kategorii)') : '(bez kategorii)';
        const prev = map.get(label) || { label, visits:0, services:0, value:0 };
        prev.visits += 1; if (visit.serviceId) prev.services += 1; prev.value += serviceValue(visit); map.set(label, prev);
      });
      return [...map.values()].sort((a,b) => b.visits - a.visits || b.value - a.value);
    };
    const rowsRaw = mode === 'plannedCategories' ? summarizeByCategory() : summarizeByCustomer();
    const needle = searchValue.toLowerCase().trim();
    const rowsFiltered = needle ? rowsRaw.filter(row => normalizeText(row.label).includes(needle)) : rowsRaw;
    const limitNumber = Number(limitValue) || 50;
    const rowsLimited = rowsFiltered;
    const totals = rowsRaw.reduce((acc,row) => { acc.visits += row.visits; acc.services += row.services; acc.value += row.value; return acc; }, { visits:0, services:0, value:0 });
    const headers = mode === 'plannedCategories' ? ['Kategoria usług','L. wizyt','L. usług','Wartość'] : ['Klient','L. wizyt','L. usług','Wartość'];
    const tableRows = rowsLimited.map(row => [escapeHtml(row.label), String(row.visits), String(row.services), money(row.value)]);
    const totalRowsCount = rowsFiltered.length;
    const shownFrom = totalRowsCount ? 1 : 0;
    const shownTo = Math.min(limitNumber, totalRowsCount);
    const rowsFooter = `Pozycje od ${shownFrom} do ${shownTo} z ${totalRowsCount} Łącznie`;
    const titles = {
      plannedClients: 'Planowane wizyty według klientów',
      plannedCategories: 'Planowane wizyty według kategorii usług',
      finishedVisits: 'Zakończone wizyty'
    };
    const content = `<section class="bm-page-card cm-customers-reports-page">
      <div class="cm-customer-report-switcher" aria-label="Widok raportu klientów">
        <button type="button" id="customersReportPrev" class="bm-light-btn" aria-label="Poprzedni widok">‹</button>
        <strong>${escapeHtml(titles[mode] || titles.plannedClients)}</strong>
        <button type="button" id="customersReportNext" class="bm-light-btn" aria-label="Następny widok">›</button>
      </div>
      <div class="cm-customer-report-card">
        <div class="bm-page-head customers-head"><h2>${escapeHtml(titles[mode] || titles.plannedClients)}</h2></div>
        <div class="cm-period-controls cm-customers-report-controls">
          <label>od <input id="crFrom" type="date" value="${toIso(from)}"></label>
          <label>do <input id="crTo" type="date" value="${toIso(to)}"></label>
          <select id="crPreset">${presets.map(([value,label]) => `<option value="${value}" ${value==='currentMonth'?'selected':''}>${label}</option>`).join('')}</select>
          ${dropdownFilter('crEmployees', 'Pracownicy', employeeItems, selectedEmployees, 'Zaznacz wszystkich')}
          ${dropdownFilter('crCategories', 'Kategorie usług', categoryItems, selectedCategories, 'Wszystkie kategorie')}
          <button type="button" id="crShow" class="bm-light-btn">Pokaż</button>
        </div>
        <div class="cm-period-kpis cm-customers-report-kpis">
          <div><span>Liczba wizyt</span><b>${totals.visits}</b></div>
          <div><span>Liczba usług</span><b>${totals.services}</b></div>
          <div><span>Wartość usług</span><b>${money(totals.value)}</b></div>
        </div>
        <div class="bm-table-toolbar"><label>${limitDropdownHtml('crLimit', Number(limitValue) || 50, [50,100,150,200])}</label><label>Szukaj: <input id="crSearch" type="search" value="${escapeHtml(searchValue)}" placeholder="Szukaj"></label></div>
        <div id="crTableWrap">${table(headers, tableRows)}<p class="cm-table-footer">${escapeHtml(rowsFooter)}</p></div>
      </div>
    </section>`;
    renderPanelFrame(ctx, 'customersReports', content, '', '');
    addReportExportButton('.cm-customer-report-card .bm-page-head', `klienci-${(titles[mode] || titles.plannedClients).toLowerCase().replace(/\s+/g, '-')}`, '.cm-customer-report-card');
    const modes = ['plannedClients','plannedCategories','finishedVisits'];
    const moveView = (step) => {
      const index = modes.indexOf(mode);
      const next = modes[(index + step + modes.length) % modes.length] || 'plannedClients';
      const url = new URL(window.location.href); url.searchParams.set('view', next); window.location.href = url.toString();
    };
    document.querySelector('#customersReportPrev')?.addEventListener('click', () => moveView(-1));
    document.querySelector('#customersReportNext')?.addEventListener('click', () => moveView(1));
    const fromInput = document.querySelector('#crFrom');
    const toInput = document.querySelector('#crTo');
    const preset = document.querySelector('#crPreset');
    const setRange = (presetMode) => {
      const base = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), 1);
      let end = new Date(base.getFullYear(), base.getMonth()+1, 0);
      const day = base.getDay() || 7;
      if (presetMode === 'today') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()); end = new Date(start); }
      if (presetMode === 'yesterday') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-1); end = new Date(start); }
      if (presetMode === 'currentWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day+1); end = new Date(start); end.setDate(start.getDate()+6); }
      if (presetMode === 'previousWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day-6); end = new Date(start); end.setDate(start.getDate()+6); }
      if (presetMode === 'last7') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-6); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last14') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-13); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last30') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-29); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'previousMonth') { start = new Date(base.getFullYear(), base.getMonth()-1, 1); end = new Date(base.getFullYear(), base.getMonth(), 0); }
      if (presetMode === 'last3Months') { start = new Date(base.getFullYear(), base.getMonth()-2, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last6Months') { start = new Date(base.getFullYear(), base.getMonth()-5, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last12Months') { start = new Date(base.getFullYear(), base.getMonth()-11, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last90') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-89); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last180') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-179); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last365') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-364); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (fromInput) fromInput.value = toIso(start);
      if (toInput) toInput.value = toIso(end);
    };
    preset?.addEventListener('change', () => setRange(preset.value));
    const apply = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', mode);
      url.searchParams.set('from', fromInput?.value || toIso(from));
      url.searchParams.set('to', toInput?.value || toIso(to));
      url.searchParams.set('limit', document.querySelector('#crLimit')?.value || '50');
      url.searchParams.set('search', document.querySelector('#crSearch')?.value || '');
      const collectDropdownValues = (id) => {
        const items = [...document.querySelectorAll(`.${id}-item`)];
        const selected = items.filter(input => input.checked).map(input => input.value);
        return selected.length && selected.length < items.length ? selected.join(',') : '';
      };
      const employeesValue = collectDropdownValues('crEmployees');
      const categoriesValue = collectDropdownValues('crCategories');
      if (employeesValue) url.searchParams.set('employees', employeesValue); else url.searchParams.delete('employees');
      if (categoriesValue) url.searchParams.set('categories', categoriesValue); else url.searchParams.delete('categories');
      window.location.href = url.toString();
    };

    const setupReportDropdown = (id) => {
      const box = document.querySelector(`[data-filter="${id}"]`);
      const toggle = document.querySelector(`#${id}Toggle`);
      const menu = document.querySelector(`#${id}Menu`);
      const all = document.querySelector(`#${id}All`);
      const items = [...document.querySelectorAll(`.${id}-item`)];
      if (!box || !toggle || !menu) return;
      const refreshLabel = () => {
        const selectedCount = items.filter(input => input.checked).length;
        const allSelected = selectedCount === items.length;
        if (all) all.checked = allSelected || selectedCount === 0;
        toggle.textContent = selectedCount ? `Wybrano: ${selectedCount} ▼` : 'Wybierz ▼';
      };
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        document.querySelectorAll('.cm-cr-dropdown-menu').forEach(other => { if (other !== menu) other.hidden = true; });
        menu.hidden = !menu.hidden;
      });
      all?.addEventListener('change', () => {
        items.forEach(input => { input.checked = all.checked; });
        refreshLabel();
      });
      items.forEach(input => input.addEventListener('change', refreshLabel));
      refreshLabel();
    };
    setupReportDropdown('crEmployees');
    setupReportDropdown('crCategories');
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.cm-cr-dropdown')) {
        document.querySelectorAll('.cm-cr-dropdown-menu').forEach(menu => { menu.hidden = true; });
      }
    });

    document.querySelector('#crShow')?.addEventListener('click', apply);
    document.querySelector('#crSearch')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') apply(); });
    setupLimitDropdown('#crLimit', apply);
  };


  const renderEmployeesReports = (ctx, forcedMode = null, standaloneWorkSchedule = false) => {
    const { db, company } = ctx;
    const pad = (n) => String(n).padStart(2,'0');
    const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    const parseDate = (value) => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
        const [y,m,d] = String(value).slice(0,10).split('-').map(Number);
        return new Date(y, m-1, d);
      }
      return null;
    };
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const params = new URLSearchParams(window.location.search || '');
    const legacyMode = params.get('view') || '';
    if (!forcedMode && legacyMode === 'workSchedule') { window.location.href = 'work-schedule.html'; return; }
    const mode = forcedMode || legacyMode || 'workHours';
    const from = parseDate(params.get('from')) || firstDay;
    const to = parseDate(params.get('to')) || lastDay;
    const limitValue = String(params.get('limit') || '50');
    const searchValue = String(params.get('search') || '');
    const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
    const minutesFromTime = (value) => {
      const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      return Number(match[1]) * 60 + Number(match[2]);
    };
    const hoursBetween = (start, end) => {
      const sMin = minutesFromTime(start); const eMin = minutesFromTime(end);
      if (sMin == null || eMin == null || eMin <= sMin) return 0;
      return (eMin - sMin) / 60;
    };
    const inRange = (dateValue) => {
      const d = parseDate(dateValue);
      if (!d) return false;
      return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
    };
    const overlapsRange = (startValue, endValue) => {
      const startDate = parseDate(startValue || endValue);
      const endDate = parseDate(endValue || startValue);
      if (!startDate && !endDate) return false;
      const a = startDate || endDate;
      const b = endDate || startDate;
      return a.getTime() <= to.getTime() && b.getTime() >= from.getTime();
    };
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['visit_1','visit_2','pass_1','campaign_1'].includes(id);
    };
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const employeeById = Object.fromEntries(employees.map(e => [e.id, e]));
    const customers = (db.customers || []).filter(c => c.companyId === company.id);
    const allVisits = [
      ...(db.visits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v)),
      ...(db.dashboardVisits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v))
    ].filter(v => inRange(v.date));
    const activeVisits = allVisits.filter(v => !(['odwołane','odwołana','odwołany','usunięte','usunięta'].includes(String(v.status || '').toLowerCase()) || v.cancelled === true));
    const daysOff = (db.daysOff || []).filter(item => item.companyId === company.id && overlapsRange(item.start, item.end));
    const advances = (db.employeeAdvances || db.advances || []).filter(item => item.companyId === company.id && inRange(item.date || item.advanceDate || item.createdAt));
    const presets = [
      ['currentMonth','bieżący miesiąc'], ['currentWeek','bieżący tydzień'], ['today','dziś'], ['yesterday','wczoraj'],
      ['last7','ostatnie 7 dni'], ['previousWeek','poprzedni tydzień'], ['last14','ostatnie 2 tygodnie'], ['last30','ostatnie 30 dni'],
      ['previousMonth','poprzedni miesiąc'], ['last3Months','ostatnie 3 miesiące'], ['last6Months','ostatnie 6 miesięcy'],
      ['last12Months','ostatnie 12 miesięcy'], ['last90','ostatnie 90 dni'], ['last180','ostatnie 180 dni'], ['last365','ostatnie 365 dni']
    ];
    const dateControls = `<div class="cm-period-controls cm-customers-report-controls">
      <label>od <input id="erFrom" type="date" value="${toIso(from)}"></label>
      <label>do <input id="erTo" type="date" value="${toIso(to)}"></label>
      <select id="erPreset">${presets.map(([value,label]) => `<option value="${value}" ${value==='currentMonth'?'selected':''}>${label}</option>`).join('')}</select>
      <button type="button" id="erShow" class="bm-light-btn">Pokaż</button>
    </div>`;
    const sumFooter = (cells) => `<tr class="cm-summary-row">${cells.map(c=>`<td><b>${c}</b></td>`).join('')}</tr>`;
    const needle = normalizeText(searchValue || '');
    const weekdayShort = ['Nd','Pon','Wt','Śr','Czw','Pt','So'];
    const monthLong = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const monthShort = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const dateMatchesDay = (value, dayDate) => {
      const d = parseDate(value);
      return d && d.getFullYear() === dayDate.getFullYear() && d.getMonth() === dayDate.getMonth() && d.getDate() === dayDate.getDate();
    };
    const dayOffFor = (employeeId, dayDate) => daysOff.find(item => item.employeeId === employeeId && overlapsRangeForDay(item.start, item.end, dayDate));
    function overlapsRangeForDay(startValue, endValue, dayDate) {
      const sDate = parseDate(startValue || endValue);
      const eDate = parseDate(endValue || startValue);
      if (!sDate && !eDate) return false;
      const a = sDate || eDate;
      const b = eDate || sDate;
      const d = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
      return a.getTime() <= d.getTime() && b.getTime() >= d.getTime();
    }
    const buildMonthlySchedule = (year, month) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const header = ['Pracownik'];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        header.push(`${weekdayShort[date.getDay()]} ${d}`);
      }
      header.push('L. godzin');
      const rows = employees.map(emp => {
        let totalHours = 0;
        const cells = [emp.fullName || emp.login || '-'];
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          const off = (db.daysOff || []).find(item => item.companyId === company.id && item.employeeId === emp.id && overlapsRangeForDay(item.start, item.end, date));
          if (off) {
            const type = String(off.type || '').toLowerCase();
            cells.push(type.includes('urlop') ? 'U' : type.includes('szkolenie') ? 'S' : type.includes('zwolnienie') ? 'L4' : 'X');
            continue;
          }
          const dayVisits = [
            ...(db.visits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v)),
            ...(db.dashboardVisits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v))
          ].filter(v => v.employeeId === emp.id && dateMatchesDay(v.date, date) && !(['odwołane','odwołana','odwołany','usunięte','usunięta'].includes(String(v.status || '').toLowerCase()) || v.cancelled === true));
          if (!dayVisits.length) { cells.push('X'); continue; }
          const starts = dayVisits.map(v => minutesFromTime(v.start || v.time)).filter(v => v != null);
          const ends = dayVisits.map(v => minutesFromTime(v.end || v.start || v.time)).filter(v => v != null);
          const minStart = Math.min(...starts);
          const maxEnd = Math.max(...ends);
          const hours = dayVisits.reduce((sum, v) => sum + hoursBetween(v.start || v.time, v.end || v.start || v.time), 0);
          totalHours += hours;
          const formatMin = (m) => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
          cells.push(`${formatMin(minStart)}-${formatMin(maxEnd)} / ${hours.toFixed(1)}h`);
        }
        cells.push(`${totalHours.toFixed(1)}`);
        return cells;
      });
      return { header, rows };
    };
    const downloadCsv = (filename, lines) => {
      const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
    let title = 'Godziny pracy pracowników';
    let statsHtml = '';
    if (mode === 'serviceByEmployees') {
      title = 'Obsługa klientów według pracowników';
      const rows = employees.map(emp => {
        const empVisits = activeVisits.filter(v => v.employeeId === emp.id);
        const clientIds = new Set(empVisits.map(v => v.customerId || v.clientName).filter(Boolean));
        const newClients = [...clientIds].filter(id => {
          const customer = customers.find(c => c.id === id);
          return customer ? inRange(customer.createdAt || customer.updatedIso || customer.updatedAt) : false;
        }).length;
        const returningClients = Math.max(clientIds.size - newClients, 0);
        const totalClients = Math.max(clientIds.size, 1);
        const serviceCount = empVisits.filter(v => v.serviceId || v.serviceName).length;
        const visitHours = empVisits.reduce((sum,v) => sum + hoursBetween(v.start || v.time, v.end || v.time), 0);
        return { label: emp.fullName || emp.login, cells:[emp.fullName || emp.login, String(serviceCount), String(clientIds.size), `${visitHours.toFixed(2)} h`, String(newClients), `${((newClients/totalClients)*100).toFixed(0)}%`, String(returningClients), `${((returningClients/totalClients)*100).toFixed(0)}%`] };
      }).filter(row => !needle || normalizeText(row.label).includes(needle));
      const limited = rows;
      const totals = rows.reduce((acc,row) => { acc.services += Number(row.cells[1] || 0); acc.clients += Number(row.cells[2] || 0); acc.hours += Number(String(row.cells[3]).replace(' h','') || 0); acc.newClients += Number(row.cells[4] || 0); acc.returning += Number(row.cells[6] || 0); return acc; }, {services:0,clients:0,hours:0,newClients:0,returning:0});
      const denom = Math.max(totals.clients,1);
      statsHtml = `${table(['Pracownik','L. usług','L. klientów','Czas wizyt','Nowi klienci liczba','Nowi klienci %','Klienci powracający liczba','Klienci powracający %'], limited.map(row => row.cells.map(escapeHtml)))}
        <div class="bm-table-wrap"><table class="bm-table"><tbody>${sumFooter(['SUMA', totals.services, totals.clients, `${totals.hours.toFixed(2)} h`, totals.newClients, `${((totals.newClients/denom)*100).toFixed(0)}%`, totals.returning, `${((totals.returning/denom)*100).toFixed(0)}%`])}</tbody></table></div>
        <p class="bm-muted">Pozycje od ${limited.length ? 1 : 0} do ${limited.length} z ${rows.length}</p>`;
    } else if (mode === 'advances') {
      title = 'Wypłacone zaliczki';
      const rows = advances.map(item => {
        const emp = employeeById[item.employeeId] || {};
        return { label: emp.fullName || emp.login || item.employeeName || '-', cells:[escapeHtml(formatIsoDatePL(item.date || item.advanceDate || item.createdAt) || item.date || ''), escapeHtml(emp.fullName || emp.login || item.employeeName || '-'), money(item.value || item.amount || 0), escapeHtml(item.description || item.note || '')] };
      }).filter(row => !needle || normalizeText(row.label).includes(needle));
      const limited = rows;
      const totalValue = advances.reduce((sum,item) => sum + Number(item.value || item.amount || 0), 0);
      statsHtml = `<div class="cm-period-kpis"><div><span>Wartość</span><b>${money(totalValue)}</b></div></div>
        ${limited.length ? table(['Data zaliczki','Pracownik','Wartość zaliczki','Opis'], limited.map(row => row.cells)) : table(['Data zaliczki','Pracownik','Wartość zaliczki','Opis'], [['-','-','0.00 PLN','']])}
        <p class="bm-muted">Pozycje od ${limited.length ? 1 : 0} do ${limited.length} z ${rows.length}</p>`;
    } else if (mode === 'workSchedule') {
      title = 'Grafik pracy';
      const base = new Date();
      const months = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(base.getFullYear(), base.getMonth() - 2 + index, 1);
        const label = `${monthLong[date.getMonth()]} ${date.getFullYear()}`;
        return { label, year: date.getFullYear(), month: date.getMonth(), key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` };
      });
      const weekDays = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
      const scheduleTemplates = (db.workScheduleTemplates || []).filter(item => item.companyId === company.id);
      const fallbackTemplates = scheduleTemplates.length ? scheduleTemplates : [
        { name:'Standardowy grafik', hours:{ Poniedziałek:'8-16', Wtorek:'8-16', Środa:'8-16', Czwartek:'8-16', Piątek:'8-16', Sobota:'8-16', Niedziela:'8-16' } }
      ];
      const templateRows = fallbackTemplates.map(item => [
        escapeHtml(item.name || '-'),
        ...weekDays.map(day => escapeHtml((item.hours && item.hours[day]) || '-'))
      ]);
      const buildDayInputs = (prefix = '', hours = {}) => weekDays.map(day => {
        const value = String((hours && hours[day]) || '8-16');
        const parts = value.split('-');
        const startValue = String(parts[0] || '8').replace(/[^0-9]/g, '') || '8';
        const endValue = String(parts[1] || '16').replace(/[^0-9]/g, '') || '16';
        return `<div class="cm-workday-row"><span>${escapeHtml(day)}</span><label>od<input name="${prefix}${day}_from" type="number" min="0" max="23" value="${escapeHtml(startValue)}"></label><span>-</span><label>do<input name="${prefix}${day}_to" type="number" min="0" max="23" value="${escapeHtml(endValue)}"></label></div>`;
      }).join('');
      const dayInputs = buildDayInputs();
      const editOptions = scheduleTemplates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || 'Grafik')}</option>`).join('');
      statsHtml = `<div class="cm-work-schedule-templates">
        <div class="bm-page-head cm-users-head"><h2>Grafik pracy</h2><div class="bm-actions-row"><button id="showAddWorkScheduleBtn" type="button">Dodaj grafik</button><button id="showEditWorkScheduleBtn" type="button" class="bm-light-btn">Edytuj</button><button id="showDeleteWorkScheduleBtn" type="button" class="bm-danger-btn">Usuń</button></div></div>
        ${table(['Nazwa','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'], templateRows)}
      </div>

      <section id="addWorkSchedulePanel" class="bm-page-card bm-collapsible-panel cm-work-schedule-modal" hidden>
        <h2>Dodaj grafik</h2>
        <form id="addWorkScheduleForm" class="bm-form-grid cm-work-schedule-form">
          <label>Nazwa*<input name="name" placeholder="Nazwa" required></label>
          <fieldset class="cm-work-hours-box">
            <legend>Godziny pracy</legend>
            ${dayInputs}
          </fieldset>
          <div class="bm-actions-row"><button type="submit">Dodaj</button><button type="button" class="bm-light-btn" id="cancelAddWorkScheduleBtn">Anuluj</button></div>
        </form>
        <p id="addWorkScheduleMessage" class="panel-message"></p>
      </section>

      <section id="editWorkSchedulePanel" class="bm-page-card bm-collapsible-panel cm-work-schedule-modal" hidden>
        <h2>Edytuj grafik</h2>
        <form id="editWorkScheduleForm" class="bm-form-grid cm-work-schedule-form">
          <label>Wybierz grafik do edytowania<select name="scheduleId" id="editWorkScheduleSelect" required>${editOptions || '<option value="">Brak grafików do edycji</option>'}</select></label>
          <label>Nazwa*<input name="name" id="editWorkScheduleName" placeholder="Nazwa" required></label>
          <fieldset class="cm-work-hours-box">
            <legend>Godziny pracy</legend>
            <div id="editWorkScheduleDays">${buildDayInputs('edit_')}</div>
          </fieldset>
          <div class="bm-actions-row"><button type="submit">Zatwierdź</button><button type="button" class="bm-light-btn" id="cancelEditWorkScheduleBtn">Anuluj</button></div>
        </form>
        <p id="editWorkScheduleMessage" class="panel-message"></p>
      </section>

      <section id="deleteWorkSchedulePanel" class="bm-page-card bm-collapsible-panel cm-work-schedule-modal" hidden>
        <h2>Usuń grafik</h2>
        <form id="deleteWorkScheduleForm" class="bm-form-grid cm-work-schedule-form">
          <label>Wybierz grafik do usunięcia<select name="scheduleId" id="deleteWorkScheduleSelect" required>${editOptions || '<option value="">Brak grafików do usunięcia</option>'}</select></label>
          <div class="bm-actions-row"><button type="submit" class="bm-danger-btn">Usuń</button><button type="button" class="bm-light-btn" id="cancelDeleteWorkScheduleBtn">Anuluj</button></div>
        </form>
        <p id="deleteWorkScheduleMessage" class="panel-message"></p>
      </section>

      <div class="cm-schedule-month-list cm-schedule-downloads">
        <h3>Grafiki miesięczne do pobrania</h3>
        ${months.map(m => `<div class="cm-schedule-month-row"><strong>${escapeHtml(m.label)}</strong><button type="button" class="bm-light-btn cm-download-schedule" data-year="${m.year}" data-month="${m.month}" data-label="${escapeHtml(m.label)}">Pobierz</button></div>`).join('')}
      </div>`;
    } else {
      const rows = employees.map(emp => {
        const empVisits = activeVisits.filter(v => v.employeeId === emp.id);
        const visitHours = empVisits.reduce((sum,v) => sum + hoursBetween(v.start || v.time, v.end || v.time), 0);
        const empDaysOff = daysOff.filter(item => item.employeeId === emp.id);
        const vacation = empDaysOff.filter(item => String(item.type || '').toLowerCase().includes('urlop')).length;
        const training = empDaysOff.filter(item => String(item.type || '').toLowerCase().includes('szkolenie')).length;
        const sick = empDaysOff.filter(item => String(item.type || '').toLowerCase().includes('zwolnienie')).length;
        const free = empDaysOff.filter(item => String(item.type || '').toLowerCase().includes('dzień wolny')).length;
        const scheduledHours = Math.max(visitHours + (empDaysOff.length * 8), 0);
        const percent = scheduledHours ? `${((visitHours / scheduledHours) * 100).toFixed(0)}%` : '0%';
        return { label: emp.fullName || emp.login, cells:[emp.fullName || emp.login, String(empVisits.length), `${visitHours.toFixed(2)} h`, percent, `${scheduledHours.toFixed(2)} h`, String(empDaysOff.length), String(vacation), String(training), String(sick), String(free)] };
      }).filter(row => !needle || normalizeText(row.label).includes(needle));
      const limited = rows;
      const totals = rows.reduce((acc,row) => { acc.visits += Number(row.cells[1] || 0); acc.work += Number(String(row.cells[2]).replace(' h','') || 0); acc.schedule += Number(String(row.cells[4]).replace(' h','') || 0); acc.daysOff += Number(row.cells[5] || 0); acc.vacation += Number(row.cells[6] || 0); acc.training += Number(row.cells[7] || 0); acc.sick += Number(row.cells[8] || 0); acc.free += Number(row.cells[9] || 0); return acc; }, {visits:0,work:0,schedule:0,daysOff:0,vacation:0,training:0,sick:0,free:0});
      const percent = totals.schedule ? `${((totals.work / totals.schedule) * 100).toFixed(0)}%` : '0%';
      statsHtml = `${table(['Pracownik','Wizyty','Grafik l. godzin','Grafik %','Grafik suma','Dni wolne l. godzin','urlop','szkolenie','zwolnienie lekarskie','dzień wolny'], limited.map(row => row.cells.map(escapeHtml)))}
        <div class="bm-table-wrap"><table class="bm-table"><tbody>${sumFooter(['SUMA', totals.visits, `${totals.work.toFixed(2)} h`, percent, `${totals.schedule.toFixed(2)} h`, totals.daysOff, totals.vacation, totals.training, totals.sick, totals.free])}</tbody></table></div>
        <p class="bm-muted">Pozycje od ${limited.length ? 1 : 0} do ${limited.length} z ${rows.length}</p>`;
    }
    const modes = standaloneWorkSchedule ? ['workSchedule'] : ['workHours','serviceByEmployees','advances'];
    const switcherHtml = standaloneWorkSchedule ? '' : `<div class="cm-customer-report-switcher" aria-label="Widok raportu pracowników">
        <button type="button" id="employeesReportPrev" class="bm-light-btn" aria-label="Poprzedni widok">‹</button>
        <strong>${escapeHtml(title)}</strong>
        <button type="button" id="employeesReportNext" class="bm-light-btn" aria-label="Następny widok">›</button>
      </div>`;
    const content = `<section class="bm-page-card cm-customers-reports-page cm-employees-reports-page ${standaloneWorkSchedule ? 'cm-work-schedule-page' : ''}">
      ${switcherHtml}
      <div class="cm-customer-report-card">
        <div class="bm-page-head customers-head"><h2>${escapeHtml(title)}</h2></div>
        ${mode === 'workSchedule' ? '' : dateControls}
        ${mode === 'workSchedule' ? '' : `<div class="bm-table-toolbar"><label>${limitDropdownHtml('erLimit', Number(limitValue) || 50, [50,100,150,200])}</label><label>Szukaj: <input id="erSearch" type="search" value="${escapeHtml(searchValue)}" placeholder="Szukaj"></label></div>`}
        ${statsHtml}
      </div>
    </section>`;
    renderPanelFrame(ctx, standaloneWorkSchedule ? 'workSchedule' : 'employeesReports', content, '', '');
    addReportExportButton('.cm-employees-reports-page .cm-customer-report-card > .bm-page-head', `pracownicy-${title.toLowerCase().replace(/\s+/g, '-')}`, '.cm-customer-report-card');
    const moveView = (step) => { const index = modes.indexOf(mode); const next = modes[(index + step + modes.length) % modes.length] || 'workHours'; const url = new URL(window.location.href); url.searchParams.set('view', next); window.location.href = url.toString(); };
    document.querySelector('#employeesReportPrev')?.addEventListener('click', () => moveView(-1));
    document.querySelector('#employeesReportNext')?.addEventListener('click', () => moveView(1));
    document.querySelectorAll('.cm-download-schedule').forEach(button => {
      button.addEventListener('click', () => {
        const year = Number(button.dataset.year);
        const month = Number(button.dataset.month);
        const label = button.dataset.label || 'grafik';
        const schedule = buildMonthlySchedule(year, month);
        const lines = [`Grafik pracy — ${label}`, schedule.header.join(';'), ...schedule.rows.map(row => row.map(v => String(v).replace(/;/g, ',')).join(';'))];
        downloadCsv(`grafik-pracy-${year}-${String(month+1).padStart(2,'0')}.csv`, lines);
      });
    });
    const addWorkSchedulePanel = document.querySelector('#addWorkSchedulePanel');
    const editWorkSchedulePanel = document.querySelector('#editWorkSchedulePanel');
    const deleteWorkSchedulePanel = document.querySelector('#deleteWorkSchedulePanel');
    const workSchedulePanels = [addWorkSchedulePanel, editWorkSchedulePanel, deleteWorkSchedulePanel];
    const closeWorkSchedulePanels = () => { workSchedulePanels.forEach(panel => { if (panel) panel.hidden = true; }); };
    document.querySelector('#showAddWorkScheduleBtn')?.addEventListener('click', () => showOnlyPanel(addWorkSchedulePanel, workSchedulePanels));
    document.querySelector('#showEditWorkScheduleBtn')?.addEventListener('click', () => { showOnlyPanel(editWorkSchedulePanel, workSchedulePanels); fillEditWorkScheduleForm(); });
    document.querySelector('#showDeleteWorkScheduleBtn')?.addEventListener('click', () => showOnlyPanel(deleteWorkSchedulePanel, workSchedulePanels));
    document.querySelector('#cancelAddWorkScheduleBtn')?.addEventListener('click', closeWorkSchedulePanels);
    document.querySelector('#cancelEditWorkScheduleBtn')?.addEventListener('click', closeWorkSchedulePanels);
    document.querySelector('#cancelDeleteWorkScheduleBtn')?.addEventListener('click', closeWorkSchedulePanels);
    const readWorkScheduleHours = (data, prefix = '') => {
      const days = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
      const hours = {};
      for (const day of days) {
        const start = String(data[`${prefix}${day}_from`] || '').trim() || '8';
        const end = String(data[`${prefix}${day}_to`] || '').trim() || '16';
        hours[day] = `${start}-${end}`;
      }
      return hours;
    };
    const fillEditWorkScheduleForm = () => {
      const select = document.querySelector('#editWorkScheduleSelect');
      const nameInput = document.querySelector('#editWorkScheduleName');
      if (!select || !nameInput) return;
      const currentDb = loadDatabase();
      const templates = (currentDb.workScheduleTemplates || []).filter(item => item.companyId === company.id);
      const selected = templates.find(item => item.id === select.value) || templates[0];
      if (!selected) return;
      select.value = selected.id;
      nameInput.value = selected.name || '';
      const days = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
      for (const day of days) {
        const [start='8', end='16'] = String((selected.hours && selected.hours[day]) || '8-16').split('-');
        const startInput = document.querySelector(`[name="edit_${day}_from"]`);
        const endInput = document.querySelector(`[name="edit_${day}_to"]`);
        if (startInput) startInput.value = String(start).replace(/[^0-9]/g, '') || '8';
        if (endInput) endInput.value = String(end).replace(/[^0-9]/g, '') || '16';
      }
    };
    document.querySelector('#editWorkScheduleSelect')?.addEventListener('change', fillEditWorkScheduleForm);
    document.querySelector('#addWorkScheduleForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const message = document.querySelector('#addWorkScheduleMessage');
      const name = String(data.name || '').trim();
      if (!name) { if (message) { message.textContent = 'Wpisz nazwę grafiku.'; message.style.color = '#fca5a5'; } return; }
      const currentDb = loadDatabase();
      currentDb.workScheduleTemplates = currentDb.workScheduleTemplates || [];
      saveUndoSnapshot('Dodanie grafiku pracy', currentDb);
      currentDb.workScheduleTemplates.push({ id:createId('work_schedule'), companyId:company.id, name, hours:readWorkScheduleHours(data), createdAt:new Date().toISOString() });
      saveDatabase(currentDb);
      if (message) { message.textContent = 'Grafik został dodany.'; message.style.color = '#86efac'; }
      window.location.reload();
    });
    document.querySelector('#editWorkScheduleForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const message = document.querySelector('#editWorkScheduleMessage');
      const scheduleId = String(data.scheduleId || '').trim();
      const name = String(data.name || '').trim();
      if (!scheduleId || !name) { if (message) { message.textContent = 'Wybierz grafik i wpisz nazwę.'; message.style.color = '#fca5a5'; } return; }
      const currentDb = loadDatabase();
      currentDb.workScheduleTemplates = currentDb.workScheduleTemplates || [];
      const index = currentDb.workScheduleTemplates.findIndex(item => item.id === scheduleId && item.companyId === company.id);
      if (index === -1) { if (message) { message.textContent = 'Nie znaleziono grafiku.'; message.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Edycja grafiku pracy', currentDb);
      currentDb.workScheduleTemplates[index] = { ...currentDb.workScheduleTemplates[index], name, hours:readWorkScheduleHours(data, 'edit_'), updatedAt:new Date().toISOString() };
      saveDatabase(currentDb);
      if (message) { message.textContent = 'Grafik został zaktualizowany.'; message.style.color = '#86efac'; }
      window.location.reload();
    });
    document.querySelector('#deleteWorkScheduleForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const message = document.querySelector('#deleteWorkScheduleMessage');
      const scheduleId = String(data.scheduleId || '').trim();
      if (!scheduleId) { if (message) { message.textContent = 'Wybierz grafik do usunięcia.'; message.style.color = '#fca5a5'; } return; }
      const currentDb = loadDatabase();
      currentDb.workScheduleTemplates = currentDb.workScheduleTemplates || [];
      const before = currentDb.workScheduleTemplates.length;
      const selected = currentDb.workScheduleTemplates.find(item => item.id === scheduleId && item.companyId === company.id);
      if (!selected) { if (message) { message.textContent = 'Nie znaleziono grafiku.'; message.style.color = '#fca5a5'; } return; }
      saveUndoSnapshot('Usunięcie grafiku pracy', currentDb);
      currentDb.workScheduleTemplates = currentDb.workScheduleTemplates.filter(item => !(item.id === scheduleId && item.companyId === company.id));
      saveDatabase(currentDb);
      if (message) { message.textContent = before !== currentDb.workScheduleTemplates.length ? 'Grafik został usunięty.' : 'Nie usunięto grafiku.'; message.style.color = '#86efac'; }
      window.location.reload();
    });
    const fromInput = document.querySelector('#erFrom');
    const toInput = document.querySelector('#erTo');
    const preset = document.querySelector('#erPreset');
    const setRange = (presetMode) => {
      const base = new Date(); let start = new Date(base.getFullYear(), base.getMonth(), 1); let end = new Date(base.getFullYear(), base.getMonth()+1, 0); const day = base.getDay() || 7;
      if (presetMode === 'today') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()); end = new Date(start); }
      if (presetMode === 'yesterday') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-1); end = new Date(start); }
      if (presetMode === 'currentWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day+1); end = new Date(start); end.setDate(start.getDate()+6); }
      if (presetMode === 'previousWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-day-6); end = new Date(start); end.setDate(start.getDate()+6); }
      if (presetMode === 'last7') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-6); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last14') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-13); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last30') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-29); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'previousMonth') { start = new Date(base.getFullYear(), base.getMonth()-1, 1); end = new Date(base.getFullYear(), base.getMonth(), 0); }
      if (presetMode === 'last3Months') { start = new Date(base.getFullYear(), base.getMonth()-2, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last6Months') { start = new Date(base.getFullYear(), base.getMonth()-5, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last12Months') { start = new Date(base.getFullYear(), base.getMonth()-11, 1); end = new Date(base.getFullYear(), base.getMonth()+1, 0); }
      if (presetMode === 'last90') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-89); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last180') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-179); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last365') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-364); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (fromInput) fromInput.value = toIso(start); if (toInput) toInput.value = toIso(end);
    };
    preset?.addEventListener('change', () => setRange(preset.value));
    const apply = () => { const url = new URL(window.location.href); url.searchParams.set('view', mode); url.searchParams.set('from', fromInput?.value || toIso(from)); url.searchParams.set('to', toInput?.value || toIso(to)); url.searchParams.set('limit', document.querySelector('#erLimit')?.value || '50'); url.searchParams.set('search', document.querySelector('#erSearch')?.value || ''); window.location.href = url.toString(); };
    document.querySelector('#erShow')?.addEventListener('click', apply);
    document.querySelector('#erSearch')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') apply(); });
    setupLimitDropdown('#erLimit', apply);
  };


  const renderSmsReports = (ctx) => {
    const { db, company } = ctx;
    const monthShort = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const pricePerSms = 0.10;
    const now = new Date();
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['campaign_1'].includes(id);
    };
    const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const monthLabel = (date) => `${monthShort[date.getMonth()]} ${date.getFullYear()}`;
    const monthDate = (offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = monthDate(index);
      return { key: monthKey(date), label: monthLabel(date), year: date.getFullYear(), month: date.getMonth() };
    });
    const smsCampaigns = (db.marketingCampaigns || []).filter(c => {
      if (c.companyId !== company.id || isSeedDemoRecord(c)) return false;
      const channel = String(c.channel || '').toUpperCase();
      const status = String(c.status || '').toLowerCase();
      return channel === 'SMS' && (!status || status === 'aktywna' || status === 'wysłana' || status === 'wyslane' || status === 'wysłane');
    });
    const countForMonth = (key) => smsCampaigns
      .filter(c => String(c.sentAt || c.createdAt || '').slice(0,7) === key)
      .reduce((sum, c) => sum + Number(c.customerCount || c.recipientsCount || c.smsCount || 0), 0);
    const totalSms = months.reduce((sum, m) => sum + countForMonth(m.key), 0);
    const rows = months.map(m => {
      const smsCount = countForMonth(m.key);
      const value = smsCount * pricePerSms;
      return [
        escapeHtml(m.label),
        String(smsCount),
        `${pricePerSms.toFixed(2)} PLN`,
        `${value.toFixed(2)} PLN`,
        `<button type="button" class="bm-light-btn cm-sms-report-download" data-month="${escapeHtml(m.key)}">Pobierz raport</button>`
      ];
    });
    const content = `<section class="bm-page-card cm-sms-report-card">
      <div class="bm-page-head"><h2>SMS</h2></div>
      <div class="cm-period-kpis"><div><span>Liczba wysłanych SMS</span><b id="smsTotalCount">${totalSms}</b></div></div>
      ${table(['Miesiąc','Liczba SMS','Cena','Wartość (PLN)','Raport'], rows)}
    </section>`;
    renderPanelFrame(ctx, 'smsReports', content, '', '');
    document.querySelectorAll('.cm-sms-report-download').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.month;
        const month = months.find(item => item.key === key);
        const monthCampaigns = smsCampaigns.filter(c => String(c.sentAt || c.createdAt || '').slice(0,7) === key);
        const smsCount = countForMonth(key);
        const value = smsCount * pricePerSms;
        const lines = [
          ['Miesiąc','Liczba SMS','Cena jednego SMS','Wartość PLN'].join(';'),
          [month?.label || key, smsCount, pricePerSms.toFixed(2), value.toFixed(2)].join(';'),
          '',
          ['Kampania','Data wysłania','Liczba SMS','Opis'].join(';'),
          ...monthCampaigns.map(c => [c.name || '', formatDateTimePL(c.sentAt || c.createdAt || ''), c.customerCount || 0, String(c.description || '').replace(/[\r\n;]/g, ' ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        ];
        const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raport-sms-${key || 'miesiac'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    });
  };


  const renderEmailReports = (ctx) => {
    const { db, company } = ctx;
    const monthShort = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const now = new Date();
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['campaign_1'].includes(id);
    };
    const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const monthLabel = (date) => `${monthShort[date.getMonth()]} ${date.getFullYear()}`;
    const monthDate = (offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = monthDate(index);
      return { key: monthKey(date), label: monthLabel(date), year: date.getFullYear(), month: date.getMonth() };
    });
    const emailCampaigns = (db.marketingCampaigns || []).filter(c => {
      if (c.companyId !== company.id || isSeedDemoRecord(c)) return false;
      const channel = String(c.channel || '').toUpperCase();
      const status = String(c.status || '').toLowerCase();
      return (channel === 'EMAIL' || channel === 'E-MAIL') && (!status || status === 'aktywna' || status === 'wysłana' || status === 'wyslane' || status === 'wysłane');
    });
    const countForMonth = (key) => emailCampaigns
      .filter(c => String(c.sentAt || c.createdAt || '').slice(0,7) === key)
      .reduce((sum, c) => sum + Number(c.customerCount || c.recipientsCount || c.emailCount || 0), 0);
    const totalEmail = months.reduce((sum, m) => sum + countForMonth(m.key), 0);
    const rows = months.map(m => {
      const emailCount = countForMonth(m.key);
      return [
        escapeHtml(m.label),
        String(emailCount),
        `<button type="button" class="bm-light-btn cm-email-report-download" data-month="${escapeHtml(m.key)}">Pobierz raport</button>`
      ];
    });
    const content = `<section class="bm-page-card cm-email-report-card">
      <div class="bm-page-head"><h2>Email</h2></div>
      <div class="cm-period-kpis"><div><span>Liczba wysłanych Email</span><b id="emailTotalCount">${totalEmail}</b></div></div>
      ${table(['Miesiąc','Liczba Email','Raport'], rows)}
    </section>`;
    renderPanelFrame(ctx, 'emailReports', content, '', '');
    document.querySelectorAll('.cm-email-report-download').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.month;
        const month = months.find(item => item.key === key);
        const monthCampaigns = emailCampaigns.filter(c => String(c.sentAt || c.createdAt || '').slice(0,7) === key);
        const emailCount = countForMonth(key);
        const lines = [
          ['Miesiąc','Liczba Email'].join(';'),
          [month?.label || key, emailCount].join(';'),
          '',
          ['Kampania','Data wysłania','Liczba Email','Opis'].join(';'),
          ...monthCampaigns.map(c => [c.name || '', formatDateTimePL(c.sentAt || c.createdAt || ''), c.customerCount || 0, String(c.description || '').replace(/[\r\n;]/g, ' ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        ];
        const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raport-email-${key || 'miesiac'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    });
  };


  const renderDailyReport = (ctx) => {
    const { db, company } = ctx;
    const pad = (n) => String(n).padStart(2,'0');
    const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    const parseDate = (value) => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
        const [y,m,d] = String(value).slice(0,10).split('-').map(Number);
        return new Date(y, m-1, d);
      }
      return null;
    };
    const params = new URLSearchParams(window.location.search || '');
    const picked = parseDate(params.get('date')) || new Date();
    const dayStart = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
    const dayEnd = new Date(dayStart);
    const money = (value) => `${Number(value || 0).toFixed(2)} PLN`;
    const dayNames = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
    const dailyDateLabel = `${dayNames[dayStart.getDay()]}, ${pad(dayStart.getDate())}.${pad(dayStart.getMonth()+1)}.${dayStart.getFullYear()}`;
    const isSeedDemoRecord = (record) => {
      const id = String(record?.id || '');
      return record?.demo === true || ['visit_1','visit_2','pass_1','campaign_1'].includes(id);
    };
    const inDay = (dateValue) => {
      const d = parseDate(dateValue);
      return !!d && d.getTime() === dayStart.getTime();
    };
    const companyVisits = (db.visits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v) && inDay(v.date));
    const dashboardVisits = (db.dashboardVisits || []).filter(v => v.companyId === company.id && !v.deleted && !isSeedDemoRecord(v) && inDay(v.date));
    const walkins = (db.walkinSales || []).filter(w => w.companyId === company.id && !isSeedDemoRecord(w) && inDay(w.date || w.saleDate));
    const passes = (db.passes || []).filter(p => p.companyId === company.id && !isSeedDemoRecord(p) && inDay(p.saleDate || p.createdAt || currentIsoDate()));
    const employees = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const services = (db.services || []).filter(service => service.companyId === company.id);
    const products = (db.products || []).filter(product => product.companyId === company.id);
    const categories = getServiceCategories(db, company.id);
    const isCancelledVisit = (visit) => ['odwołane','odwołana','odwołany','usunięte','usunięta'].includes(String(visit.status || '').toLowerCase()) || visit.cancelled === true;
    const isFinishedVisit = (visit) => ['zakończone','zakończona','zakończony'].includes(String(visit.status || '').toLowerCase());
    const isPlannedVisit = (visit) => !isCancelledVisit(visit) && !isFinishedVisit(visit) && ['zaplanowane','niezakończone',''].includes(String(visit.status || '').toLowerCase());
    const activeDashboardVisits = dashboardVisits.filter(v => !isCancelledVisit(v));
    const billableDashboardVisits = dashboardVisits.filter(v => !isCancelledVisit(v));
    const plannedVisits = companyVisits.filter(isPlannedVisit).length + activeDashboardVisits.filter(isPlannedVisit).length;
    const finishedVisits = companyVisits.filter(isFinishedVisit).length + dashboardVisits.filter(isFinishedVisit).length;
    const cancelledVisitItems = [...companyVisits.filter(isCancelledVisit), ...dashboardVisits.filter(isCancelledVisit)];
    const cancelledVisits = cancelledVisitItems.length;
    const cancelReasonStats = new Map();
    cancelledVisitItems.forEach(visit => {
      const rawReason = visit.cancelReason || visit.cancellationReason || visit.reason || visit.cancelNote || visit.statusReason || visit.description || visit.note || 'inne';
      const reason = String(rawReason || 'inne').trim() || 'inne';
      cancelReasonStats.set(reason, (cancelReasonStats.get(reason) || 0) + 1);
    });
    const cancelReasonRows = [...cancelReasonStats.entries()].sort((a,b)=>b[1]-a[1]).map(([reason,count]) => `<div><b>${count}</b><span>${escapeHtml(reason)}</span></div>`).join('') || '<div><b>0</b><span>brak odwołanych wizyt</span></div>';
    const serviceSales = [
      ...billableDashboardVisits.filter(v => v.serviceId),
      ...walkins.filter(w => (w.serviceId || w.serviceCustom || (!w.productId && !w.productName)))
    ];
    const productSales = [...billableDashboardVisits.filter(v => v.productId), ...walkins.filter(w => (w.productId || w.productName))];
    const paymentMethods = ['gotówka','karta kredytowa','karnet','pakiet','gratis'];
    const allPayments = [
      ...billableDashboardVisits.map(v => ({ amount:Number(v.total || 0), method:v.payment || 'gotówka' })),
      ...walkins.map(w => ({ amount:Number(w.amount || w.total || 0), method:w.paymentMethod || w.payment || 'gotówka' })),
      ...passes.map(p => ({ amount:Number(p.value || 0), method:p.paymentMethod || 'gotówka' }))
    ];
    const totalPayments = allPayments.reduce((sum, item) => sum + item.amount, 0);
    const cashPayments = allPayments.filter(p => String(p.method).toLowerCase().includes('gotówka')).reduce((sum, item) => sum + item.amount, 0);
    const paymentRows = paymentMethods.map(method => {
      const value = allPayments.filter(p => String(p.method || '').toLowerCase() === method.toLowerCase()).reduce((sum, item) => sum + item.amount, 0);
      return `<div><span>${escapeHtml(method)}</span><b>${money(value)}</b></div>`;
    }).join('');
    const serviceCategoryStats = new Map();
    serviceSales.forEach(sale => {
      const service = services.find(item => item.id === sale.serviceId);
      const category = categories.find(item => item.id === service?.categoryId)?.name || service?.category || '(bez kategorii)';
      const code = service?.code || '';
      const key = `${category}||${code}`;
      const prev = serviceCategoryStats.get(key) || { count:0, value:0, category, code };
      prev.count += 1; prev.value += Number(sale.total || sale.amount || service?.priceTo || service?.priceFrom || 0); serviceCategoryStats.set(key, prev);
    });
    const serviceRows = [...serviceCategoryStats.values()].map(item => [String(item.count), money(item.value), escapeHtml(item.category), escapeHtml(item.code || '')]);
    const productStats = new Map();
    productSales.forEach(sale => {
      const product = products.find(item => item.id === sale.productId);
      const category = product?.category || sale.category || '(bez kategorii)';
      const code = product?.code || '';
      const key = `${category}||${code}`;
      const prev = productStats.get(key) || { count:0, value:0, category, code };
      prev.count += 1; prev.value += Number(sale.amount || sale.total || product?.price || 0); productStats.set(key, prev);
    });
    const productRows = [...productStats.values()].map(item => [String(item.count), money(item.value), escapeHtml(item.category), escapeHtml(item.code || '')]);
    const passRows = passes.length ? passes.map(p => ['1', money(p.value || 0), escapeHtml(p.number || p.name || 'Karnet')]) : [];
    const employeeCheckboxes = employees.map(employee => `<label class="cm-period-employee-check"><input type="checkbox" class="periodEmployeeCheck" value="${escapeHtml(employee.id)}" checked> ${escapeHtml(employee.fullName || employee.login)}</label>`).join('') || '<span class="bm-muted">Brak pracowników</span>';
    const employeeRows = employees.map(employee => {
      const ev = billableDashboardVisits.filter(v => v.employeeId === employee.id);
      const regular = companyVisits.filter(v => v.employeeId === employee.id && !isCancelledVisit(v));
      const empWalkins = walkins.filter(w => w.employeeId === employee.id);
      const empServiceWalkins = empWalkins.filter(w => w.serviceId || w.serviceCustom || (!w.productId && !w.productName));
      const empProductWalkins = empWalkins.filter(w => w.productId || w.productName);
      const servCount = ev.filter(v => v.serviceId).length + regular.filter(v => v.serviceId).length + empServiceWalkins.length;
      const servValue = ev.filter(v => v.serviceId).reduce((sum, v) => sum + Number(v.total || 0), 0) + empServiceWalkins.reduce((sum, w) => sum + Number(w.total || w.amount || 0), 0);
      const prodCount = ev.filter(v => v.productId).length + empProductWalkins.length;
      const prodValue = ev.filter(v => v.productId).reduce((sum, v) => sum + Number(v.total || 0), 0) + empProductWalkins.reduce((sum, w) => sum + Number(w.total || w.amount || 0), 0);
      const empPasses = passes.filter(p => p.employeeId === employee.id);
      const passValue = empPasses.reduce((sum, p) => sum + Number(p.value || 0), 0);
      return { id: employee.id, cells: [escapeHtml(employee.fullName || employee.login), String(ev.length + regular.length), String(servCount), money(servValue), String(prodCount), money(prodValue), String(empPasses.length), money(passValue), money(0)] };
    });
    const employeeTable = employeeRows.length ? `<div class="bm-table-wrap"><table class="bm-table" id="periodEmployeesTable"><thead><tr>${['Pracownik','Wizyty','Usługi liczba','Usługi wartość','Produkty liczba','Produkty wartość','Karnety liczba','Karnety wartość','Prowizja'].map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${employeeRows.map(row=>`<tr data-employee-id="${escapeHtml(row.id)}">${row.cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : table(['Pracownik','Wizyty','Usługi liczba','Usługi wartość','Produkty liczba','Produkty wartość','Karnety liczba','Karnety wartość','Prowizja'], [['-','0','0','0.00 PLN','0','0.00 PLN','0','0.00 PLN','0.00 PLN']]);
    const campaigns = (db.marketingCampaigns || []).filter(c => c.companyId === company.id && !isSeedDemoRecord(c) && inDay(String(c.sentAt || '').slice(0,10)));
    const smsCount = campaigns.filter(c => String(c.channel).toUpperCase() === 'SMS').length;
    const emailCount = campaigns.filter(c => String(c.channel).toUpperCase() === 'EMAIL').length;
    const moveDateUrl = (offset) => {
      const d = new Date(dayStart); d.setDate(d.getDate() + offset);
      const url = new URL(window.location.href); url.searchParams.set('date', toIso(d)); window.location.href = url.toString();
    };
    const content = `<section class="bm-page-card cm-period-report-card cm-daily-report-card">
      <div class="bm-page-head cm-period-head"><h2>Raport dzienny</h2></div>
      <div class="cm-daily-date-row">
        <button type="button" id="dailyPrevDay" class="bm-light-btn cm-daily-arrow" aria-label="Poprzedni dzień">‹</button>
        <label class="cm-daily-date-field" id="dailyDateField" title="Wybierz datę">
          <span>${escapeHtml(dailyDateLabel)}</span>
          <input id="dailyReportDate" type="date" value="${toIso(dayStart)}" aria-label="Wybierz datę raportu dziennego">
        </label>
        <button type="button" id="dailyNextDay" class="bm-light-btn cm-daily-arrow" aria-label="Następny dzień">›</button>
      </div>
      <div class="cm-period-kpis">
        <div><span>Liczba zaplanowanych wizyt</span><b>${plannedVisits}</b></div>
        <div><span>Liczba zakończonych wizyt</span><b>${finishedVisits}</b></div>
        <div><span>Liczba odwołanych wizyt</span><b>${cancelledVisits}</b></div>
      </div>
      <section class="cm-period-section"><h3>Powody odwołania wizyt</h3><div class="cm-cancel-reasons">${cancelReasonRows}</div></section>
      <section class="cm-period-section"><h3>Finanse</h3><div class="cm-finance-grid"><div><span>Płatności</span><b>${money(totalPayments)}</b>${paymentRows}</div><div><span>Stan kasy</span><b>${money(cashPayments)}</b><small>+${money(cashPayments)} płatności gotówką</small></div><div><span>Obrót</span><b>${money(totalPayments)}</b><small>łączny obrót w wybranym dniu</small></div></div></section>
      <section class="cm-period-section"><h3>Usługi</h3><p>Sprzedane usługi w tym dniu: <b>${serviceSales.length}</b></p>${table(['L.szt.','Wartość PLN','Kategoria','Kod usługi'], serviceRows.length ? serviceRows : [['0','0.00 PLN','(bez kategorii)','']])}</section>
      <section class="cm-period-section"><h3>Produkty</h3><p>Sprzedane produkty w tym dniu: <b>${productSales.length}</b></p>${table(['L.szt.','Wartość PLN','Kategoria','Kod produktu'], productRows.length ? productRows : [['0','0.00 PLN','(bez kategorii)','']])}</section>
      <section class="cm-period-section"><h3>Karnety</h3><p>Sprzedane karnety</p>${table(['L.szt.','Wartość PLN','Kategoria'], passRows.length ? passRows : [['0','0.00 PLN','-']])}</section>
      <section class="cm-period-section"><h3>Pracownicy</h3><div class="cm-period-employee-picker"><span>Pracownicy</span><label class="cm-period-employee-check cm-period-all"><input type="checkbox" id="periodEmployeeAll" checked> - wszyscy -</label>${employeeCheckboxes}</div>${employeeTable}</section>
      <section class="cm-period-section cm-comm-grid"><div><h3>SMS</h3><p>Wysłane SMS</p><b>${smsCount}</b></div><div><h3>Email</h3><p>Wysłane EMAIL</p><b>${emailCount}</b></div></section>
    </section>`;
    renderPanelFrame(ctx, 'dailyReport', content, '', '');
    const currentPanelUser = getCurrentContext().user;
    const canBrowsePastDailyReports = hasSystemPermission(currentPanelUser, 'raport dzienny wczorajszy, jutrzejszy (przeglądanie)');
    const todayIso = toIso(new Date());
    if (!canBrowsePastDailyReports) {
      const pickedIso = toIso(dayStart);
      if (pickedIso !== todayIso) {
        const url = new URL(window.location.href);
        url.searchParams.set('date', todayIso);
        window.location.href = url.toString();
        return;
      }
    }
    addReportExportButton('.cm-daily-report-card .cm-period-head', 'raport-dzienny', '.cm-daily-report-card');
    document.querySelector('#dailyPrevDay')?.addEventListener('click', () => moveDateUrl(-1));
    document.querySelector('#dailyNextDay')?.addEventListener('click', () => moveDateUrl(1));
    const dailyReportDateInput = document.querySelector('#dailyReportDate');
    if (dailyReportDateInput && !canBrowsePastDailyReports) dailyReportDateInput.min = todayIso;
    if (!canBrowsePastDailyReports) {
      const prevBtn = document.querySelector('#dailyPrevDay');
      if (prevBtn) { prevBtn.disabled = true; prevBtn.classList.add('cm-permission-disabled'); prevBtn.title = 'Brak uprawnienia: raport dzienny wczorajszy i wcześniejszy (przeglądanie)'; }
    }
    const dailyDateField = document.querySelector('#dailyDateField');
    dailyDateField?.addEventListener('click', (event) => {
      if (!dailyReportDateInput) return;
      if (event.target !== dailyReportDateInput) event.preventDefault();
      if (typeof dailyReportDateInput.showPicker === 'function') dailyReportDateInput.showPicker();
      else dailyReportDateInput.focus();
    });
    dailyReportDateInput?.addEventListener('change', (event) => {
      const selectedValue = event.target.value || toIso(dayStart);
      if (!canBrowsePastDailyReports && selectedValue !== todayIso) { alert('Brak uprawnienia do raportu dziennego wczorajszego, jutrzejszego lub wcześniejszego.'); event.target.value = todayIso; return; }
      const url = new URL(window.location.href); url.searchParams.set('date', selectedValue); window.location.href = url.toString();
    });
    const employeeAll = document.querySelector('#periodEmployeeAll');
    const employeeChecks = [...document.querySelectorAll('.periodEmployeeCheck')];
    const updateEmployeeTable = () => {
      const selected = new Set(employeeChecks.filter(check => check.checked).map(check => check.value));
      document.querySelectorAll('#periodEmployeesTable tbody tr[data-employee-id]').forEach(row => { row.style.display = selected.has(row.dataset.employeeId) ? '' : 'none'; });
      if (employeeAll) employeeAll.checked = employeeChecks.length > 0 && employeeChecks.every(check => check.checked);
    };
    employeeAll?.addEventListener('change', () => { employeeChecks.forEach(check => { check.checked = employeeAll.checked; }); updateEmployeeTable(); });
    employeeChecks.forEach(check => check.addEventListener('change', updateEmployeeTable));
    updateEmployeeTable();
  };


  const setupNativePickers = () => {
    document.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"]').forEach(input => {
      if (input.dataset.cmPickerReady === '1') return;
      input.dataset.cmPickerReady = '1';
      const open = () => {
        try { if (typeof input.showPicker === 'function' && !input.readOnly && !input.disabled) input.showPicker(); } catch (err) {}
      };
      input.addEventListener('click', open);
      input.addEventListener('focus', open);
    });
  };




  const planMonthsMap = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 };
  const addMonthsIso = (months = 1) => {
    const date = new Date();
    date.setMonth(date.getMonth() + Number(months || 1));
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const approveRegistration = (registrationId, reviewerUserId = '') => {
    const db = loadDatabase();
    const registration = (db.registrations || []).find(item => item.id === registrationId);
    if (!registration || registration.status !== 'pending') return { ok:false, message:'Nie znaleziono aktywnego zgłoszenia.' };
    const normalizedEmail = String(registration.owner?.email || '').toLowerCase();
    if (!normalizedEmail) return { ok:false, message:'Zgłoszenie nie ma adresu email.' };
    if ((db.users || []).some(user => String(user.email || user.login || '').toLowerCase() === normalizedEmail)) {
      return { ok:false, message:'Użytkownik z takim adresem email już istnieje.' };
    }
    const now = new Date().toISOString();
    const companyId = createId('company');
    const userId = createId('user');
    const selectedPlan = registration.company?.selectedPlan || '';
    const messageSender = String(registration.company?.messageSender || registration.company?.smsSender || registration.company?.name || '').trim();
    const company = {
      id: companyId,
      name: registration.company?.name || 'Nowa firma',
      ownerName: registration.owner?.fullName || '',
      ownerEmail: normalizedEmail,
      ownerPhone: registration.owner?.phone || '',
      address: registration.company?.address || '',
      postalCode: registration.company?.postalCode || '',
      city: registration.company?.city || '',
      contactPhones: registration.company?.receptionPhones || registration.company?.contactPhones || '',
      contactEmail: registration.company?.receptionEmail || registration.company?.contactEmail || '',
      receptionPhones: registration.company?.receptionPhones || registration.company?.contactPhones || '',
      receptionEmail: registration.company?.receptionEmail || registration.company?.contactEmail || '',
      receptionistPhone: registration.company?.receptionPhones || registration.company?.contactPhones || '',
      receptionistEmail: registration.company?.receptionEmail || registration.company?.contactEmail || '',
      invoiceName: registration.company?.billing?.name || '',
      invoiceAddress: registration.company?.billing?.address || '',
      invoicePostalCode: registration.company?.billing?.postalCode || '',
      invoiceCity: registration.company?.billing?.city || '',
      vatId: registration.company?.billing?.nip || '',
      invoiceEmail: registration.company?.receptionEmail || normalizedEmail,
      billing: {
        name: registration.company?.billing?.name || '',
        address: registration.company?.billing?.address || '',
        postalCode: registration.company?.billing?.postalCode || '',
        city: registration.company?.billing?.city || '',
        nip: registration.company?.billing?.nip || '',
        email: registration.company?.receptionEmail || normalizedEmail
      },
      plan: selectedPlan,
      planValidUntil: selectedPlan ? addMonthsIso(planMonthsMap[selectedPlan] || 1) : '',
      employeesRaw: registration.company?.employeesRaw || '',
      smsSender: messageSender,
      messageSender: messageSender,
      selectedPlan,
      selectedPlanLabel: registration.company?.selectedPlanLabel || planLabels[selectedPlan] || selectedPlan || '',
      notificationSettings: {
        visitSmsSender: messageSender,
        birthdaySmsSender: messageSender,
        afterAddSmsSender: messageSender,
        afterVisitSmsSender: messageSender,
        visitEmailSender: messageSender,
        birthdayEmailSender: messageSender,
        afterAddEmailSender: messageSender,
        afterVisitEmailSender: messageSender
      },
      createdAt: now
    };
    const user = {
      id: userId,
      login: normalizedEmail,
      email: normalizedEmail,
      password: registration.owner?.password || '',
      fullName: registration.owner?.fullName || '',
      phone: registration.owner?.phone || '',
      role: 'admin',
      companyId,
      positionId: '',
      loginBlocked: false,
      loginHoursOnly: false,
      createdAt: now
    };
    db.companies.push(company);
    db.users.push(user);
    registration.status = 'approved';
    registration.userId = userId;
    registration.companyId = companyId;
    registration.reviewedAt = now;
    registration.reviewedBy = reviewerUserId || '';
    saveDatabase(db);
    return { ok:true };
  };
  const rejectRegistration = (registrationId, reviewerUserId = '') => {
    const db = loadDatabase();
    const registration = (db.registrations || []).find(item => item.id === registrationId);
    if (!registration || registration.status !== 'pending') return { ok:false, message:'Nie znaleziono aktywnego zgłoszenia.' };
    registration.status = 'rejected';
    registration.reviewedAt = new Date().toISOString();
    registration.reviewedBy = reviewerUserId || '';
    saveDatabase(db);
    return { ok:true };
  };

  const deleteCompanyByOwner = (companyId, reviewerUserId = '') => {
    const db = loadDatabase();
    const target = (db.companies || []).find(item => item.id === companyId);
    if (!target) return { ok:false, message:'Nie znaleziono firmy do usunięcia.' };
    if (companyId === 'company_main') return { ok:false, message:'Nie można usunąć głównej firmy OWNERA.' };
    saveUndoSnapshot('Usunięto firmę', db);
    const companyArrays = ['customers','customerGroups','positions','daysOff','services','serviceCategories','visits','reservations','products','walkinSales','sales','passes','marketingCampaigns','payments','employeeAdvances','dashboardVisits','notificationOutbox','notificationDeliveryLog'];
    db.companies = (db.companies || []).filter(item => item.id !== companyId);
    db.users = (db.users || []).filter(item => item.companyId !== companyId);
    companyArrays.forEach(key => {
      if (Array.isArray(db[key])) db[key] = db[key].filter(item => item.companyId !== companyId);
    });
    db.registrations = (db.registrations || []).filter(item => item.companyId !== companyId);
    if (db.dashboardWorkerState && typeof db.dashboardWorkerState === 'object') delete db.dashboardWorkerState[companyId];
    saveDatabase(db);
    const session = getSession();
    if (session && (session.companyId === companyId || session.activeCompanyId === companyId)) {
      session.companyId = 'company_main';
      session.activeCompanyId = 'company_main';
      session.switchedAt = new Date().toISOString();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return { ok:true, companyName: target.name || target.companyName || '' };
  };

  const renderCompanies = (ctx) => {
    if (String(ctx.user?.role || '').toLowerCase() !== 'owner') {
      renderPanelFrame(ctx, 'companies', '<section class="bm-page-card"><h2>Brak dostępu</h2><p>Ta zakładka jest dostępna wyłącznie dla właściciela platformy.</p></section>', 'Brak dostępu', 'Moduł właściciela platformy.');
      return;
    }
    const activeCompanyId = ctx.company?.id || ctx.session?.activeCompanyId || ctx.session?.companyId;
    const companies = (Array.isArray(ctx.db?.companies) ? ctx.db.companies : []).filter(company => {
      const text = [company.id, company.name, company.ownerName, company.ownerEmail].join(' ');
      return !/(company_demo|CompanyManager Demo|Admin Demo|Pracownik Demo)/i.test(text);
    });
    const rows = companies.map((company, index) => {
      const isActive = company.id === activeCompanyId;
      const companyName = escapeHtml(company.name || company.companyName || '—');
      return [
        String(index + 1),
        `<button type="button" class="cm-company-switch-btn${isActive ? ' active' : ''}" data-company-switch="${escapeHtml(company.id)}">${companyName}${isActive ? ' <span class="cm-company-active-badge">aktywna</span>' : ''}</button>`,
        escapeHtml(company.ownerName || company.contactName || company.ownerEmail || '—'),
        escapeHtml(company.messageSender || company.smsSender || '—'),
        escapeHtml(company.selectedPlanLabel || planLabels[company.selectedPlan] || planLabels[company.plan] || company.plan || '—'),
        escapeHtml(formatPolishDate(company.planValidUntil || company.validUntil || company.packageValidUntil) || '—')
      ];
    });
    const registrationRows = (Array.isArray(ctx.db?.registrations) ? ctx.db.registrations : [])
      .filter(reg => ['pending','approved','rejected'].includes(String(reg.status || 'pending')))
      .sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map((reg, index) => {
        const status = reg.status || 'pending';
        const actions = status === 'pending'
          ? `<div class="cm-company-actions"><button type="button" class="cm-approve-short" title="Zatwierdź" aria-label="Zatwierdź" data-registration-approve="${escapeHtml(reg.id)}">Z</button><button type="button" class="cm-reject-short" title="Odrzuć" aria-label="Odrzuć" data-registration-reject="${escapeHtml(reg.id)}">O</button></div>`
          : `<span class="bm-muted">${status === 'approved' ? 'Zatwierdzone' : 'Odrzucone'}</span>`;
        const company = reg.company || {};
        const owner = reg.owner || {};
        return [
          String(index + 1),
          escapeHtml(status === 'pending' ? 'Oczekuje' : status === 'approved' ? 'Zatwierdzone' : 'Odrzucone'),
          escapeHtml(formatPolishDate(reg.createdAt) || '—'),
          escapeHtml(company.name || '—'),
          escapeHtml(owner.fullName || '—'),
          escapeHtml(owner.email || '—'),
          escapeHtml(owner.phone || '—'),
          escapeHtml([company.address, company.postalCode, company.city].filter(Boolean).join(', ') || '—'),
          escapeHtml(company.receptionPhones || '—'),
          escapeHtml(company.receptionEmail || '—'),
          escapeHtml(company.smsSender || company.messageSender || '—'),
          escapeHtml(company.selectedPlanLabel || planLabels[company.selectedPlan] || '—'),
          escapeHtml(company.billing?.name || '—'),
          escapeHtml(company.billing?.nip || '—'),
          actions
        ];
      });
    const content = `
      <section class="bm-page-card cm-companies-page">
        <div class="bm-page-head">
          <div>
            <span class="bm-tag">Tylko właściciel</span>
            <h2>Firmy</h2>
          </div>
          <div class="bm-head-actions"><button type="button" class="bm-btn danger" id="openDeleteCompanyModal">Usuń firmę</button></div>
        </div>
        ${rows.length ? table(['Nr','Nazwa Firmy','Właściciel Firmy','Nadawca Wiadomości','Pakiet','Data wygaśnięcia pakietu'], rows) : '<div class="bm-empty-state">Brak aktywnych firm.</div>'}
        <div class="cm-modal-backdrop" id="deleteCompanyModal" hidden>
          <div class="cm-modal-card" role="dialog" aria-modal="true" aria-labelledby="deleteCompanyTitle">
            <h3 id="deleteCompanyTitle">Usuń firmę</h3>
            <p class="bm-muted">Wybierz firmę z platformy i potwierdź usunięcie. Główna firma OWNERA jest zabezpieczona przed usunięciem.</p>
            <label>Firma
              <select id="deleteCompanySelect">
                <option value="">Wybierz firmę</option>
                ${companies.map(company => `<option value="${escapeHtml(company.id)}">${escapeHtml(company.name || company.companyName || '—')} — ${escapeHtml(company.ownerName || company.ownerEmail || '—')}</option>`).join('')}
              </select>
            </label>
            <div class="cm-modal-actions"><button type="button" class="bm-btn danger" id="confirmDeleteCompanyBtn">Usuń</button><button type="button" class="bm-light-btn" id="cancelDeleteCompanyBtn">Anuluj</button></div>
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
        ${registrationRows.length ? table(['Nr','Status','Data','Nazwa firmy','Osoba','Email','Telefon','Adres firmy','Telefony firmowe','Email firmowy','Nadawca Wiadomości','Pakiet','Dane do faktury','NIP / VAT EU','Akcje'], registrationRows) : '<div class="bm-empty-state">Brak zgłoszeń rejestracji.</div>'}
      </section>`;
    renderPanelFrame(ctx, 'companies', content, '', '');
    document.querySelectorAll('[data-company-switch]').forEach(button => {
      button.addEventListener('click', () => {
        const companyId = button.getAttribute('data-company-switch');
        if (!companyId) return;
        const db = loadDatabase();
        const target = (db.companies || []).find(item => item.id === companyId);
        if (!target) { alert('Nie znaleziono firmy.'); return; }
        setOwnerActiveCompany(companyId);
        window.location.href = 'dashboard.html';
      });
    });
    document.querySelectorAll('[data-registration-approve]').forEach(button => {
      button.addEventListener('click', () => {
        if (!confirm('Zatwierdzić tę firmę i utworzyć konto ADMIN?')) return;
        const result = approveRegistration(button.getAttribute('data-registration-approve'), ctx.user?.id || '');
        if (!result.ok) { alert(result.message || 'Nie udało się zatwierdzić zgłoszenia.'); return; }
        window.location.reload();
      });
    });
    document.querySelectorAll('[data-registration-reject]').forEach(button => {
      button.addEventListener('click', () => {
        if (!confirm('Odrzucić to zgłoszenie rejestracji?')) return;
        const result = rejectRegistration(button.getAttribute('data-registration-reject'), ctx.user?.id || '');
        if (!result.ok) { alert(result.message || 'Nie udało się odrzucić zgłoszenia.'); return; }
        window.location.reload();
      });
    });
    const deleteCompanyModal = document.getElementById('deleteCompanyModal');
    const openDeleteCompanyBtn = document.getElementById('openDeleteCompanyModal');
    const cancelDeleteCompanyBtn = document.getElementById('cancelDeleteCompanyBtn');
    const confirmDeleteCompanyBtn = document.getElementById('confirmDeleteCompanyBtn');
    const deleteCompanySelect = document.getElementById('deleteCompanySelect');
    const closeDeleteCompanyModal = () => { if (deleteCompanyModal) deleteCompanyModal.hidden = true; };
    openDeleteCompanyBtn?.addEventListener('click', () => { if (deleteCompanyModal) deleteCompanyModal.hidden = false; });
    cancelDeleteCompanyBtn?.addEventListener('click', closeDeleteCompanyModal);
    deleteCompanyModal?.addEventListener('click', event => { if (event.target === deleteCompanyModal) closeDeleteCompanyModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDeleteCompanyModal(); }, { once:false });
    confirmDeleteCompanyBtn?.addEventListener('click', () => {
      const companyId = deleteCompanySelect?.value || '';
      if (!companyId) { alert('Wybierz firmę do usunięcia.'); return; }
      const selectedName = deleteCompanySelect?.selectedOptions?.[0]?.textContent?.trim() || 'wybraną firmę';
      if (!confirm(`Na pewno usunąć ${selectedName}? Ta operacja usunie firmę i jej dane z lokalnej bazy panelu.`)) return;
      const result = deleteCompanyByOwner(companyId, ctx.user?.id || '');
      if (!result.ok) { alert(result.message || 'Nie udało się usunąć firmy.'); return; }
      window.location.reload();
    });
  };

  const renderOwner = (ctx) => {
    const content = `<section class="bm-page-card bm-owner-page">
      <div class="bm-page-head"><h2>Właściciel strony</h2></div>
      <div class="bm-owner-profile">
        <div class="bm-owner-photo" aria-label="Miejsce na zdjęcie właściciela">
          <span>Zdjęcie</span>
        </div>
        <div class="bm-owner-details">
          <label>Nazwa:</label>
          <h3>Piskorz Kacper</h3>
          <p><a href="mailto:kacper@pwcstudio.pl">kacper@pwcstudio.pl</a> / <a href="mailto:kacper5789@gmail.com">kacper5789@gmail.com</a></p>
          <p>tel. <a href="tel:+48789389126">+48 789 389 126</a></p>
          <p><a class="bm-owner-site-link" href="https://pwcstudio.pl" target="_blank" rel="noopener">www.pwcstudio.pl</a></p>
        </div>
      </div>
    </section>`;
    renderPanelFrame(ctx, 'owner', content, '', '');
  };

  const planMonths = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 };
  const addMonths = (date, months) => {
    const next = new Date(date);
    const day = next.getDate();
    next.setMonth(next.getMonth() + months);
    if (next.getDate() < day) next.setDate(0);
    return next;
  };
  const valueOrDash = (value) => escapeHtml(value || '—');
  const renderInfoRow = (label, value) => `<div class="bm-company-data-row"><span>${escapeHtml(label)}</span><strong>${valueOrDash(value)}</strong></div>`;

  const getCompanyDisplayName = (company = {}) => company.name || company.companyName || company.fullName || company.businessName || 'Nazwa firmy';
  const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const getNotificationDefaults = (company = {}, user = {}) => {
    const settings = company.notificationSettings || {};
    const boolValue = (key, fallback = false) => Object.prototype.hasOwnProperty.call(settings, key) ? Boolean(settings[key]) : fallback;
    const textValue = (key, fallback = '') => Object.prototype.hasOwnProperty.call(settings, key) ? String(settings[key] || '') : String(fallback || '');
    const companySender = String(company.messageSender || company.smsSender || company.name || company.companyName || '').trim();
    const defaultSender = looksLikeEmail(companySender) ? '' : companySender;
    const savedEmailSender = textValue('visitEmailSender', defaultSender);
    const emailSender = looksLikeEmail(savedEmailSender) ? defaultSender : savedEmailSender;
    return {
      visitSms24: boolValue('visitSms24', false),
      visitSmsSender: textValue('visitSmsSender', defaultSender),
      visitSmsTemplate: textValue('visitSmsTemplate', ''),
      visitEmail24: boolValue('visitEmail24', false),
      visitEmailSender: emailSender,
      visitEmailTemplate: textValue('visitEmailTemplate', ''),
      birthdaySms: boolValue('birthdaySms', false),
      birthdaySmsSender: textValue('birthdaySmsSender', defaultSender),
      birthdaySmsTemplate: textValue('birthdaySmsTemplate', ''),
      birthdayEmail: boolValue('birthdayEmail', false),
      birthdayEmailSender: textValue('birthdayEmailSender', defaultSender),
      birthdayEmailTemplate: textValue('birthdayEmailTemplate', ''),
      afterAddSms: boolValue('afterAddSms', false),
      afterAddEmail: boolValue('afterAddEmail', false),
      afterVisitSms: boolValue('afterVisitSms', false),
      afterVisitEmail: boolValue('afterVisitEmail', false),
      afterAddSmsSender: textValue('afterAddSmsSender', defaultSender),
      afterAddSmsTemplate: textValue('afterAddSmsTemplate', ''),
      afterVisitSmsSender: textValue('afterVisitSmsSender', defaultSender),
      afterVisitSmsTemplate: textValue('afterVisitSmsTemplate', ''),
      afterAddEmailSender: textValue('afterAddEmailSender', defaultSender),
      afterAddEmailTemplate: textValue('afterAddEmailTemplate', ''),
      afterVisitEmailSender: textValue('afterVisitEmailSender', defaultSender),
      afterVisitEmailTemplate: textValue('afterVisitEmailTemplate', ''),
      onlinePhones: textValue('onlinePhones', company.receptionPhones || ''),
      onlineEmails: textValue('onlineEmails', company.receptionEmail || user.email || '')
    };
  };

  const initNotificationSettingsForm = (ctx) => {
    const form = document.querySelector('#notificationSettingsForm');
    if (!form) return;
    const { db, company } = ctx;
    const smsToggle = form.elements.visitSms24;
    const smsFields = form.querySelector('[data-visit-sms-fields]');
    const emailToggle = form.elements.visitEmail24;
    const emailFields = form.querySelector('[data-visit-email-fields]');
    const birthdaySmsToggle = form.elements.birthdaySms;
    const birthdaySmsFields = form.querySelector('[data-birthday-sms-fields]');
    const birthdayEmailToggle = form.elements.birthdayEmail;
    const birthdayEmailFields = form.querySelector('[data-birthday-email-fields]');
    const afterAddSmsToggle = form.elements.afterAddSms;
    const afterAddSmsFields = form.querySelector('[data-after-add-sms-fields]');
    const afterVisitSmsToggle = form.elements.afterVisitSms;
    const afterVisitSmsFields = form.querySelector('[data-after-visit-sms-fields]');
    const afterAddEmailToggle = form.elements.afterAddEmail;
    const afterAddEmailFields = form.querySelector('[data-after-add-email-fields]');
    const afterVisitEmailToggle = form.elements.afterVisitEmail;
    const afterVisitEmailFields = form.querySelector('[data-after-visit-email-fields]');
    const status = form.querySelector('#notificationSettingsStatus');
    const syncSmsFields = () => {
      if (smsFields) smsFields.hidden = !smsToggle?.checked;
    };
    const syncEmailFields = () => {
      if (emailFields) emailFields.hidden = !emailToggle?.checked;
    };
    const syncBirthdaySmsFields = () => {
      if (birthdaySmsFields) birthdaySmsFields.hidden = !birthdaySmsToggle?.checked;
    };
    const syncBirthdayEmailFields = () => {
      if (birthdayEmailFields) birthdayEmailFields.hidden = !birthdayEmailToggle?.checked;
    };
    const syncAfterAddSmsFields = () => { if (afterAddSmsFields) afterAddSmsFields.hidden = !afterAddSmsToggle?.checked; };
    const syncAfterVisitSmsFields = () => { if (afterVisitSmsFields) afterVisitSmsFields.hidden = !afterVisitSmsToggle?.checked; };
    const syncAfterAddEmailFields = () => { if (afterAddEmailFields) afterAddEmailFields.hidden = !afterAddEmailToggle?.checked; };
    const syncAfterVisitEmailFields = () => { if (afterVisitEmailFields) afterVisitEmailFields.hidden = !afterVisitEmailToggle?.checked; };
    syncSmsFields();
    syncEmailFields();
    syncBirthdaySmsFields();
    syncBirthdayEmailFields();
    syncAfterAddSmsFields();
    syncAfterVisitSmsFields();
    syncAfterAddEmailFields();
    syncAfterVisitEmailFields();
    smsToggle?.addEventListener('change', syncSmsFields);
    emailToggle?.addEventListener('change', syncEmailFields);
    birthdaySmsToggle?.addEventListener('change', syncBirthdaySmsFields);
    birthdayEmailToggle?.addEventListener('change', syncBirthdayEmailFields);
    afterAddSmsToggle?.addEventListener('change', syncAfterAddSmsFields);
    afterVisitSmsToggle?.addEventListener('change', syncAfterVisitSmsFields);
    afterAddEmailToggle?.addEventListener('change', syncAfterAddEmailFields);
    afterVisitEmailToggle?.addEventListener('change', syncAfterVisitEmailFields);

    const collect = () => ({
      visitSms24: Boolean(form.elements.visitSms24?.checked),
      visitSmsSender: String(form.elements.visitSmsSender?.value || '').trim(),
      visitSmsTemplate: String(form.elements.visitSmsTemplate?.value || '').trim(),
      visitEmail24: Boolean(form.elements.visitEmail24?.checked),
      visitEmailSender: String(form.elements.visitEmailSender?.value || '').trim(),
      visitEmailTemplate: String(form.elements.visitEmailTemplate?.value || '').trim(),
      birthdaySms: Boolean(form.elements.birthdaySms?.checked),
      birthdaySmsSender: String(form.elements.birthdaySmsSender?.value || '').trim(),
      birthdaySmsTemplate: String(form.elements.birthdaySmsTemplate?.value || '').trim(),
      birthdayEmail: Boolean(form.elements.birthdayEmail?.checked),
      birthdayEmailSender: String(form.elements.birthdayEmailSender?.value || '').trim(),
      birthdayEmailTemplate: String(form.elements.birthdayEmailTemplate?.value || '').trim(),
      afterAddSms: Boolean(form.elements.afterAddSms?.checked),
      afterAddSmsSender: String(form.elements.afterAddSmsSender?.value || '').trim(),
      afterAddSmsTemplate: String(form.elements.afterAddSmsTemplate?.value || '').trim(),
      afterAddEmail: Boolean(form.elements.afterAddEmail?.checked),
      afterAddEmailSender: String(form.elements.afterAddEmailSender?.value || '').trim(),
      afterAddEmailTemplate: String(form.elements.afterAddEmailTemplate?.value || '').trim(),
      afterVisitSms: Boolean(form.elements.afterVisitSms?.checked),
      afterVisitSmsSender: String(form.elements.afterVisitSmsSender?.value || '').trim(),
      afterVisitSmsTemplate: String(form.elements.afterVisitSmsTemplate?.value || '').trim(),
      afterVisitEmail: Boolean(form.elements.afterVisitEmail?.checked),
      afterVisitEmailSender: String(form.elements.afterVisitEmailSender?.value || '').trim(),
      afterVisitEmailTemplate: String(form.elements.afterVisitEmailTemplate?.value || '').trim(),
      onlinePhones: String(form.elements.onlinePhones?.value || '').trim(),
      onlineEmails: String(form.elements.onlineEmails?.value || '').trim()
    });

    const save = (showStatus = true) => {
      company.notificationSettings = collect();
      const companyIndex = (db.companies || []).findIndex(item => item.id === company.id);
      if (companyIndex >= 0) db.companies[companyIndex] = { ...db.companies[companyIndex], notificationSettings: company.notificationSettings };
      applyDataRetention(db);
      saveDatabase(db);
      if (showStatus && status) {
        status.textContent = 'Zapisano.';
        window.clearTimeout(status._cmTimer);
        status._cmTimer = window.setTimeout(() => { status.textContent = ''; }, 2200);
      }
    };

    form.addEventListener('submit', event => {
      event.preventDefault();
      save(true);
    });
    form.addEventListener('change', event => {
      if (event.target?.matches('input, textarea, select')) save(false);
    });
  };



  const getProgramSettingsDefaults = (company = {}) => {
    const settings = company.programSettings || {};
    const textValue = (key, fallback = '') => Object.prototype.hasOwnProperty.call(settings, key) ? String(settings[key] ?? '') : String(fallback ?? '');
    const boolValue = (key, fallback = false) => Object.prototype.hasOwnProperty.call(settings, key) ? Boolean(settings[key]) : fallback;
    const methods = Array.isArray(settings.paymentMethods) && settings.paymentMethods.length
      ? settings.paymentMethods
      : [{ name: 'gotówka', turnover: true, commission: true, default: true }];
    return {
      salonOpenHour: textValue('salonOpenHour', '6'),
      salonCloseHour: textValue('salonCloseHour', '21'),
      onlineBreak: textValue('onlineBreak', 'bez przerwy'),
      defaultAdSms: boolValue('defaultAdSms', false),
      defaultAdEmail: boolValue('defaultAdEmail', false),
      dataRetention: textValue('dataRetention', 'nie usuwaj'),
      paymentMethods: methods.map((method, index) => ({
        name: method.name || 'gotówka',
        turnover: method.turnover !== false,
        commission: method.commission !== false,
        default: index === 0 || method.default === true
      }))
    };
  };

  const renderProgramSettingsMarkup = (company = {}) => {
    const defaults = getProgramSettingsDefaults(company);
    const selected = (value, option) => String(value) === String(option) ? 'selected' : '';
    const checked = (value) => value ? 'checked' : '';
    const paymentRows = defaults.paymentMethods.map((method, index) => `
      <div class="cm-payment-method-row">
        <input type="text" name="paymentMethodName" value="${escapeHtml(method.name)}" aria-label="Metoda płatności">
        <label class="cm-check-line"><input type="checkbox" name="paymentMethodTurnover" ${checked(method.turnover)}> obrót</label>
        <label class="cm-check-line"><input type="checkbox" name="paymentMethodCommission" ${checked(method.commission)}> prowizja</label>
        ${index === 0 ? '<span class="bm-muted">domyślna</span>' : '<button class="bm-danger-btn cm-remove-payment-method" type="button">usuń</button>'}
      </div>`).join('');
    return `<section class="bm-page-card cm-program-settings-page" id="program-settings">
      <div class="bm-page-head"><h2>Ustawienia programu</h2></div>
      <form class="bm-form-grid cm-program-settings-form" id="programSettingsForm">
        <fieldset class="cm-notification-box">
          <legend>Godziny pracy Firmy</legend>
          <div class="cm-inline-fields">
            <label>Od<input type="number" name="salonOpenHour" min="0" max="23" value="${escapeHtml(defaults.salonOpenHour)}"></label>
            <span>do</span>
            <label>Do<input type="number" name="salonCloseHour" min="0" max="23" value="${escapeHtml(defaults.salonCloseHour)}"></label>
          </div>
          <label>Zapisy online - przerwa między wizytami*
            <select name="onlineBreak">
              <option ${selected(defaults.onlineBreak, 'bez przerwy')}>bez przerwy</option>
              <option ${selected(defaults.onlineBreak, '5 minut')}>5 minut</option>
              <option ${selected(defaults.onlineBreak, '10 minut')}>10 minut</option>
              <option ${selected(defaults.onlineBreak, '15 minut')}>15 minut</option>
              <option ${selected(defaults.onlineBreak, '30 minut')}>30 minut</option>
            </select>
          </label>
          <div class="cm-full-field" style="display:flex;align-items:center;gap:12px;justify-content:flex-end">
            <button class="bm-secondary-btn" type="submit">Zapisz</button>
            <span id="programSettingsStatus" class="bm-muted"></span>
          </div>
        </fieldset>

        <fieldset class="cm-notification-box">
          <legend>Dodaj klienta</legend>
          <p class="bm-muted">wartości standardowe</p>
          <div class="cm-consent-grid">
            <span>Zgoda na reklamę</span>
            <label class="cm-check-line"><input type="checkbox" name="defaultAdSms" ${checked(defaults.defaultAdSms)}> SMS</label>
            <label class="cm-check-line"><input type="checkbox" name="defaultAdEmail" ${checked(defaults.defaultAdEmail)}> Email</label>
          </div>
        </fieldset>

        <fieldset class="cm-notification-box cm-full-field">
          <legend>Czas przechowywania danych</legend>
          <p class="bm-muted">UWAGA: dane zostaną automatycznie usunięte po upływie określonego czasu!</p>
          <label>Wizyty, sprzedaż bez wizyty, stan kasy, raporty*
            <select name="dataRetention">
              <option ${selected(defaults.dataRetention, 'nie usuwaj')}>nie usuwaj</option>
              <option ${selected(defaults.dataRetention, '3 miesiące')}>3 miesiące</option>
              <option ${selected(defaults.dataRetention, '6 miesięcy')}>6 miesięcy</option>
              <option ${selected(defaults.dataRetention, '12 miesięcy')}>12 miesięcy</option>
              <option ${selected(defaults.dataRetention, '24 miesiące')}>24 miesiące</option>
              <option ${selected(defaults.dataRetention, '36 miesięcy')}>36 miesięcy</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="cm-notification-box cm-full-field">
          <legend>Metody płatności</legend>
          <div class="cm-payment-methods-table" id="companyPaymentMethods">
            <div class="cm-payment-method-row cm-payment-method-head"><span>Metoda</span><span>Obrót</span><span>Prowizja</span><span>Akcja</span></div>
            ${paymentRows}
          </div>
          <button type="button" class="bm-secondary-btn" id="addPaymentMethodBtn">dodaj</button>
        </fieldset>
      </form>
      <section id="addPaymentMethodPanel" class="cm-payment-method-modal" hidden>
        <div class="cm-payment-method-modal-card">
          <h3>Dodaj metodę płatności</h3>
          <label>Metoda<input id="newPaymentMethodName" type="text" placeholder="np. przelew"></label>
          <div class="cm-modal-actions"><button type="button" class="bm-secondary-btn" id="confirmPaymentMethodBtn">Zatwierdź</button><button type="button" class="bm-light-btn" id="cancelPaymentMethodBtn">Anuluj</button></div>
        </div>
      </section>
    </section>`;
  };

  const initProgramSettingsForm = (ctx) => {
    const form = document.querySelector('#programSettingsForm');
    if (!form) return;
    const { db, company } = ctx;
    const status = form.querySelector('#programSettingsStatus');
    const collect = () => {
      const paymentMethods = Array.from(form.querySelectorAll('#companyPaymentMethods .cm-payment-method-row:not(.cm-payment-method-head)')).map((row, index) => ({
        name: String(row.querySelector('input[name="paymentMethodName"]')?.value || '').trim() || 'gotówka',
        turnover: Boolean(row.querySelector('input[name="paymentMethodTurnover"]')?.checked),
        commission: Boolean(row.querySelector('input[name="paymentMethodCommission"]')?.checked),
        default: index === 0
      }));
      return {
        salonOpenHour: String(form.elements.salonOpenHour?.value || '6').trim(),
        salonCloseHour: String(form.elements.salonCloseHour?.value || '21').trim(),
        onlineBreak: String(form.elements.onlineBreak?.value || 'bez przerwy').trim(),
        defaultAdSms: Boolean(form.elements.defaultAdSms?.checked),
        defaultAdEmail: Boolean(form.elements.defaultAdEmail?.checked),
        dataRetention: String(form.elements.dataRetention?.value || 'nie usuwaj').trim(),
        paymentMethods: paymentMethods.length ? paymentMethods : [{ name:'gotówka', turnover:true, commission:true, default:true }]
      };
    };
    const save = (showStatus = true) => {
      company.programSettings = collect();
      const companyIndex = (db.companies || []).findIndex(item => item.id === company.id);
      if (companyIndex >= 0) db.companies[companyIndex] = { ...db.companies[companyIndex], programSettings: company.programSettings };
      applyDataRetention(db);
      saveDatabase(db);
      if (showStatus && status) {
        status.textContent = 'Zapisano.';
        window.clearTimeout(status._cmTimer);
        status._cmTimer = window.setTimeout(() => { status.textContent = ''; }, 2200);
      }
    };
    const bindRemoveButtons = () => form.querySelectorAll('.cm-remove-payment-method').forEach(btn => { btn.onclick = () => { btn.closest('.cm-payment-method-row')?.remove(); save(false); }; });
    bindRemoveButtons();
    form.addEventListener('submit', event => { event.preventDefault(); save(true); });
    form.addEventListener('change', event => { if (event.target?.matches('input, select, textarea')) save(false); });
    form.addEventListener('input', event => { if (event.target?.matches('input[type="text"], input[type="number"]')) save(false); });
    const addPanel = document.querySelector('#addPaymentMethodPanel');
    document.querySelector('#addPaymentMethodBtn')?.addEventListener('click', () => { if (addPanel) { addPanel.hidden = false; addPanel.scrollIntoView({ behavior:'smooth', block:'center' }); } });
    document.querySelector('#cancelPaymentMethodBtn')?.addEventListener('click', () => { if (addPanel) addPanel.hidden = true; });
    document.querySelector('#confirmPaymentMethodBtn')?.addEventListener('click', () => {
      const input = document.querySelector('#newPaymentMethodName');
      const value = input?.value?.trim();
      const list = document.querySelector('#companyPaymentMethods');
      if (!value || !list) return;
      list.insertAdjacentHTML('beforeend', `<div class="cm-payment-method-row"><input type="text" name="paymentMethodName" value="${escapeHtml(value)}" aria-label="Metoda płatności"><label class="cm-check-line"><input type="checkbox" name="paymentMethodTurnover" checked> obrót</label><label class="cm-check-line"><input type="checkbox" name="paymentMethodCommission"> prowizja</label><button class="bm-danger-btn cm-remove-payment-method" type="button">usuń</button></div>`);
      if (input) input.value = '';
      if (addPanel) addPanel.hidden = true;
      bindRemoveButtons();
      save(true);
    });
  };

  const renderSettings = (ctx) => {
    const company = ctx.company || {};
    const user = ctx.user || {};
    const billing = normalizeCompanyBilling(company);
    const planKey = company.selectedPlan || '12m';
    const months = planMonths[planKey] || 12;
    const validUntilDate = company.createdAt ? addMonths(new Date(company.createdAt), months) : addMonths(CM_TODAY, months);
    const validUntil = formatDisplayDate(validUntilDate);
    const invoiceEmail = billing.email || user.email || '';

    const notificationDefaults = getNotificationDefaults(company, user);

    const content = `<section class="bm-page-card bm-company-data-page" id="company-data">
      <div class="bm-page-head"><h2>Dane firmy</h2></div>

      <div class="bm-company-data-grid">
        <article class="bm-company-data-card">
          <h3>Pakiet i osoba do kontaktu</h3>
          ${renderInfoRow('Data ważności', validUntil)}
          ${renderInfoRow('Osoba do kontaktu', user.fullName)}
          ${renderInfoRow('Nr telefonu', user.phone)}
          ${renderInfoRow('Adres email', user.email)}
          ${renderInfoRow('Adres email powiadomienia', user.email)}
        </article>

        <article class="bm-company-data-card">
          <h3>Dane firmy</h3>
          ${renderInfoRow('Nazwa firmy', company.name)}
          ${renderInfoRow('Adres', company.address)}
          ${renderInfoRow('Kod pocztowy', company.postalCode)}
          ${renderInfoRow('Miejscowość', company.city)}
          ${renderInfoRow('Telefon firmowy', company.receptionPhones || company.contactPhones || company.receptionistPhone)}
          ${renderInfoRow('Email firmowy', company.receptionEmail || company.contactEmail || company.receptionistEmail)}
        </article>

        <article class="bm-company-data-card">
          <h3>Dane do faktury VAT</h3>
          ${renderInfoRow('Pełna nazwa firmy', billing.name)}
          ${renderInfoRow('Adres ul.', billing.address)}
          ${renderInfoRow('Kod pocztowy', billing.postalCode)}
          ${renderInfoRow('Miejscowość', billing.city)}
          ${renderInfoRow('NIP / VAT EU', billing.nip)}
          ${renderInfoRow('Adres email - wysyłka faktur', invoiceEmail)}
        </article>

        <article class="bm-company-data-card bm-company-docs-card">
          <h3>Dokumenty związane z serwisem CompanyManager</h3>
          <div class="bm-company-doc-row"><span>Regulamin</span><a href="../regulamin.html" target="_blank" rel="noopener">Pokaż</a></div>
          <div class="bm-company-doc-row"><span>Cennik</span><a href="../login.html" target="_blank" rel="noopener">Pokaż</a></div>
          <div class="bm-company-doc-row"><span>Polityka Prywatności</span><a href="../polityka-prywatnosci.html" target="_blank" rel="noopener">Pokaż</a></div>
          <div class="bm-company-doc-row"><span>Informacja o przetwarzaniu danych osobowych</span><a href="../informacja-o-przetwarzaniu-danych.html" target="_blank" rel="noopener">Pokaż</a></div>
        </article>
      </div>
    </section>

    <section class="bm-page-card cm-notification-settings-page" id="notifications">
      <div class="bm-page-head"><h2>Ustawienia powiadomień</h2></div>
      <form class="bm-form-grid cm-notification-form" id="notificationSettingsForm">
        <fieldset class="cm-notification-box">
          <legend>Powiadomienia automatyczne SMS</legend>
          <label class="cm-check-line"><input type="checkbox" name="visitSms24" ${notificationDefaults.visitSms24 ? 'checked' : ''}> powiadamiaj o wizytach przez SMS - 24h przed wizytą</label>
          <div class="cm-notification-sms-fields cm-full-field" data-visit-sms-fields ${notificationDefaults.visitSms24 ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="visitSmsSender" value="${escapeHtml(notificationDefaults.visitSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="visitSmsTemplate" rows="5" placeholder="Treść SMS...">${escapeHtml(notificationDefaults.visitSmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="birthdaySms" ${notificationDefaults.birthdaySms ? 'checked' : ''}> wyślij życzenia urodzinowe przez SMS - godz. 9:00 w dniu urodzin</label>
          <div class="cm-notification-sms-fields cm-full-field" data-birthday-sms-fields ${notificationDefaults.birthdaySms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="birthdaySmsSender" value="${escapeHtml(notificationDefaults.birthdaySmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="birthdaySmsTemplate" rows="5" placeholder="Treść SMS z życzeniami...">${escapeHtml(notificationDefaults.birthdaySmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterAddSms" ${notificationDefaults.afterAddSms ? 'checked' : ''}> wyślij SMS po dodaniu wizyty</label>
          <div class="cm-notification-sms-fields cm-full-field" data-after-add-sms-fields ${notificationDefaults.afterAddSms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="afterAddSmsSender" value="${escapeHtml(notificationDefaults.afterAddSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="afterAddSmsTemplate" rows="5" placeholder="Treść SMS po dodaniu wizyty...">${escapeHtml(notificationDefaults.afterAddSmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterVisitSms" ${notificationDefaults.afterVisitSms ? 'checked' : ''}> wyślij SMS po wizycie - 1h po zakończeniu wizyty</label>
          <div class="cm-notification-sms-fields cm-full-field" data-after-visit-sms-fields ${notificationDefaults.afterVisitSms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="afterVisitSmsSender" value="${escapeHtml(notificationDefaults.afterVisitSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="afterVisitSmsTemplate" rows="5" placeholder="Treść SMS po wizycie...">${escapeHtml(notificationDefaults.afterVisitSmsTemplate)}</textarea></label>
          </div>
        </fieldset>

        <fieldset class="cm-notification-box">
          <legend>Powiadomienia automatyczne EMAIL</legend>
          <label class="cm-check-line"><input type="checkbox" name="visitEmail24" ${notificationDefaults.visitEmail24 ? 'checked' : ''}> powiadamiaj o wizytach przez EMAIL - 24h przed wizytą</label>
          <div class="cm-notification-email-fields cm-full-field" data-visit-email-fields ${notificationDefaults.visitEmail24 ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="visitEmailSender" value="${escapeHtml(notificationDefaults.visitEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="visitEmailTemplate" rows="6" placeholder="Treść email...">${escapeHtml(notificationDefaults.visitEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="birthdayEmail" ${notificationDefaults.birthdayEmail ? 'checked' : ''}> wyślij życzenia urodzinowe przez EMAIL - godz. 9:00 w dniu urodzin</label>
          <div class="cm-notification-email-fields cm-full-field" data-birthday-email-fields ${notificationDefaults.birthdayEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="birthdayEmailSender" value="${escapeHtml(notificationDefaults.birthdayEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="birthdayEmailTemplate" rows="6" placeholder="Treść email z życzeniami...">${escapeHtml(notificationDefaults.birthdayEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterAddEmail" ${notificationDefaults.afterAddEmail ? 'checked' : ''}> wyślij EMAIL po dodaniu wizyty</label>
          <div class="cm-notification-email-fields cm-full-field" data-after-add-email-fields ${notificationDefaults.afterAddEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="afterAddEmailSender" value="${escapeHtml(notificationDefaults.afterAddEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="afterAddEmailTemplate" rows="6" placeholder="Treść email po dodaniu wizyty...">${escapeHtml(notificationDefaults.afterAddEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterVisitEmail" ${notificationDefaults.afterVisitEmail ? 'checked' : ''}> wyślij EMAIL po wizycie - 1h po zakończeniu wizyty</label>
          <div class="cm-notification-email-fields cm-full-field" data-after-visit-email-fields ${notificationDefaults.afterVisitEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="afterVisitEmailSender" value="${escapeHtml(notificationDefaults.afterVisitEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="afterVisitEmailTemplate" rows="6" placeholder="Treść email po wizycie...">${escapeHtml(notificationDefaults.afterVisitEmailTemplate)}</textarea></label>
          </div>
        </fieldset>
        <div class="cm-full-field" style="display:flex;align-items:center;gap:12px;justify-content:flex-end"><button class="bm-secondary-btn" type="submit">Zapisz</button><span id="notificationSettingsStatus" class="bm-muted"></span></div>
      </form>
    </section>

    ${renderProgramSettingsMarkup(company)}

    <section class="bm-page-card cm-payments-page" id="payments">
      <div class="bm-page-head"><h2>Płatności CompanyManager</h2></div>

      <div class="cm-notification-box cm-full-field">
        <h3>Dane do przelewu</h3>
        <div class="cm-company-grid">
          <div><span>Odbiorca</span><b>CompanyManager sp.z.o.o</b></div>
          <div><span>Bank</span><b>PKO Bank Polski SA</b></div>
          <div><span>Numer konta</span><b>PL53102043170000550203436565</b></div>
          <div><span>SWIFT</span><b>BPKOPLPW</b></div>
        </div>
        <p class="bm-muted">W tytule proszę podać numery faktur.</p>
      </div>

      <div class="cm-notification-box cm-full-field">
        <h3>Lista ostatnich faktur</h3>
        <div class="bm-table-wrap">
          <table class="bm-table">
            <thead>
              <tr>
                <th>Termin płatności</th>
                <th>Faktura</th>
                <th>Treść</th>
                <th>Wartość (PLN)</th>
                <th>Pobierz</th>
                <th>Płatność</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>&lt;termin płatności&gt;</td>
                <td>&lt;numer faktury&gt;</td>
                <td>CompanyManager - SMS 05.2026</td>
                <td>43,05 PLN</td>
                <td><button type="button" class="bm-secondary-btn">Pobierz</button></td>
                <td>&lt;data płatności za&gt;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
    renderPanelFrame(ctx, 'settings', content, '', '');
    initNotificationSettingsForm(ctx);
    initProgramSettingsForm(ctx);
    if (window.location.hash) {
      window.requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };


  const renderCompanyPanel = (ctx) => {
    const company = ctx.company || {};
    const user = ctx.user || {};
    const billing = normalizeCompanyBilling(company);
    const params = new URLSearchParams(window.location.search || '');
    const currentView = params.get('view') || 'company-data';
    const views = [
      ['company-data', 'Dane firmy'],
      ['notifications', 'Ustawienia powiadomień'],
      ['program-settings', 'Ustawienia programu'],
      ['payments', 'Płatności CompanyManager']
    ];
    const activeIndex = Math.max(0, views.findIndex(([id]) => id === currentView));
    const planKey = company.selectedPlan || '12m';
    const months = planMonths[planKey] || 12;
    const validUntilDate = company.createdAt ? addMonths(new Date(company.createdAt), months) : addMonths(CM_TODAY, months);
    const validUntil = formatDisplayDate(validUntilDate);
    const invoiceEmail = billing.email || user.email || '';
    const notificationDefaults = getNotificationDefaults(company, user);
    const navUrl = (view) => `company-panel.html?view=${encodeURIComponent(view)}`;
    const moveUrl = (step) => {
      const next = views[(activeIndex + step + views.length) % views.length][0];
      return navUrl(next);
    };
    const switcher = `<div class="cm-customer-report-switcher cm-company-panel-switcher" aria-label="Panel Firmy">
      <a class="bm-light-btn" href="${moveUrl(-1)}" aria-label="Poprzedni widok">‹</a>
      <strong>${escapeHtml(views[activeIndex][1])}</strong>
      <a class="bm-light-btn" href="${moveUrl(1)}" aria-label="Następny widok">›</a>
    </div>`;

    const companyData = `<section class="bm-page-card bm-company-data-page" id="company-data">
      <div class="bm-page-head"><h2>Dane firmy</h2></div>
      <div class="bm-company-data-grid">
        <article class="bm-company-data-card">
          <h3>Pakiet i osoba do kontaktu</h3>
          ${renderInfoRow('Data ważności', validUntil)}
          ${renderInfoRow('Osoba do kontaktu', user.fullName)}
          ${renderInfoRow('Nr telefonu', user.phone)}
          ${renderInfoRow('Adres email', user.email)}
          ${renderInfoRow('Adres email powiadomienia', user.email)}
        </article>
        <article class="bm-company-data-card">
          <h3>Dane firmy</h3>
          ${renderInfoRow('Nazwa firmy', company.name)}
          ${renderInfoRow('Adres', company.address)}
          ${renderInfoRow('Kod pocztowy', company.postalCode)}
          ${renderInfoRow('Miejscowość', company.city)}
          ${renderInfoRow('Telefon firmowy', company.receptionPhones || company.contactPhones || company.receptionistPhone)}
          ${renderInfoRow('Email firmowy', company.receptionEmail || company.contactEmail || company.receptionistEmail)}
        </article>
        <article class="bm-company-data-card">
          <h3>Dane do faktury VAT</h3>
          ${renderInfoRow('Pełna nazwa firmy', billing.name)}
          ${renderInfoRow('Adres ul.', billing.address)}
          ${renderInfoRow('Kod pocztowy', billing.postalCode)}
          ${renderInfoRow('Miejscowość', billing.city)}
          ${renderInfoRow('NIP / VAT EU', billing.nip)}
          ${renderInfoRow('Adres email - wysyłka faktur', invoiceEmail)}
        </article>
      </div>
    </section>`;

    const notifications = `<section class="bm-page-card cm-notification-settings-page" id="notifications">
      <div class="bm-page-head"><h2>Ustawienia powiadomień</h2></div>
      <form class="bm-form-grid cm-notification-form" id="notificationSettingsForm">
        <fieldset class="cm-notification-box">
          <legend>Powiadomienia automatyczne SMS</legend>
          <label class="cm-check-line"><input type="checkbox" name="visitSms24" ${notificationDefaults.visitSms24 ? 'checked' : ''}> powiadamiaj o wizytach przez SMS - 24h przed wizytą</label>
          <div class="cm-notification-sms-fields cm-full-field" data-visit-sms-fields ${notificationDefaults.visitSms24 ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="visitSmsSender" value="${escapeHtml(notificationDefaults.visitSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="visitSmsTemplate" rows="5" placeholder="Treść SMS...">${escapeHtml(notificationDefaults.visitSmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="birthdaySms" ${notificationDefaults.birthdaySms ? 'checked' : ''}> wyślij życzenia urodzinowe przez SMS - godz. 9:00 w dniu urodzin</label>
          <div class="cm-notification-sms-fields cm-full-field" data-birthday-sms-fields ${notificationDefaults.birthdaySms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="birthdaySmsSender" value="${escapeHtml(notificationDefaults.birthdaySmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="birthdaySmsTemplate" rows="5" placeholder="Treść SMS z życzeniami...">${escapeHtml(notificationDefaults.birthdaySmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterAddSms" ${notificationDefaults.afterAddSms ? 'checked' : ''}> wyślij SMS po dodaniu wizyty</label>
          <div class="cm-notification-sms-fields cm-full-field" data-after-add-sms-fields ${notificationDefaults.afterAddSms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="afterAddSmsSender" value="${escapeHtml(notificationDefaults.afterAddSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="afterAddSmsTemplate" rows="5" placeholder="Treść SMS po dodaniu wizyty...">${escapeHtml(notificationDefaults.afterAddSmsTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterVisitSms" ${notificationDefaults.afterVisitSms ? 'checked' : ''}> wyślij SMS po wizycie - 1h po zakończeniu wizyty</label>
          <div class="cm-notification-sms-fields cm-full-field" data-after-visit-sms-fields ${notificationDefaults.afterVisitSms ? '' : 'hidden'}>
            <label>Nadawca SMS<input type="text" name="afterVisitSmsSender" value="${escapeHtml(notificationDefaults.afterVisitSmsSender)}" placeholder="np. NazwaFirmy"></label>
            <label>Treść SMS<textarea name="afterVisitSmsTemplate" rows="5" placeholder="Treść SMS po wizycie...">${escapeHtml(notificationDefaults.afterVisitSmsTemplate)}</textarea></label>
          </div>
        </fieldset>

        <fieldset class="cm-notification-box">
          <legend>Powiadomienia automatyczne EMAIL</legend>
          <label class="cm-check-line"><input type="checkbox" name="visitEmail24" ${notificationDefaults.visitEmail24 ? 'checked' : ''}> powiadamiaj o wizytach przez EMAIL - 24h przed wizytą</label>
          <div class="cm-notification-email-fields cm-full-field" data-visit-email-fields ${notificationDefaults.visitEmail24 ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="visitEmailSender" value="${escapeHtml(notificationDefaults.visitEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="visitEmailTemplate" rows="6" placeholder="Treść email...">${escapeHtml(notificationDefaults.visitEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="birthdayEmail" ${notificationDefaults.birthdayEmail ? 'checked' : ''}> wyślij życzenia urodzinowe przez EMAIL - godz. 9:00 w dniu urodzin</label>
          <div class="cm-notification-email-fields cm-full-field" data-birthday-email-fields ${notificationDefaults.birthdayEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="birthdayEmailSender" value="${escapeHtml(notificationDefaults.birthdayEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="birthdayEmailTemplate" rows="6" placeholder="Treść email z życzeniami...">${escapeHtml(notificationDefaults.birthdayEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterAddEmail" ${notificationDefaults.afterAddEmail ? 'checked' : ''}> wyślij EMAIL po dodaniu wizyty</label>
          <div class="cm-notification-email-fields cm-full-field" data-after-add-email-fields ${notificationDefaults.afterAddEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="afterAddEmailSender" value="${escapeHtml(notificationDefaults.afterAddEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="afterAddEmailTemplate" rows="6" placeholder="Treść email po dodaniu wizyty...">${escapeHtml(notificationDefaults.afterAddEmailTemplate)}</textarea></label>
          </div>
          <label class="cm-check-line"><input type="checkbox" name="afterVisitEmail" ${notificationDefaults.afterVisitEmail ? 'checked' : ''}> wyślij EMAIL po wizycie - 1h po zakończeniu wizyty</label>
          <div class="cm-notification-email-fields cm-full-field" data-after-visit-email-fields ${notificationDefaults.afterVisitEmail ? '' : 'hidden'}>
            <label>Nadawca email<input type="text" name="afterVisitEmailSender" value="${escapeHtml(notificationDefaults.afterVisitEmailSender)}" placeholder="np. Nazwa firmy"></label>
            <label>Treść email<textarea name="afterVisitEmailTemplate" rows="6" placeholder="Treść email po wizycie...">${escapeHtml(notificationDefaults.afterVisitEmailTemplate)}</textarea></label>
          </div>
        </fieldset>
        <div class="cm-full-field" style="display:flex;align-items:center;gap:12px;justify-content:flex-end"><button class="bm-secondary-btn" type="submit">Zapisz</button><span id="notificationSettingsStatus" class="bm-muted"></span></div>
      </form>
    </section>`;

    const programSettings = renderProgramSettingsMarkup(company);

    const payments = `<section class="bm-page-card cm-payments-page" id="payments">
      <div class="bm-page-head"><h2>Płatności CompanyManager</h2></div>
      <div class="cm-notification-box cm-full-field"><h3>Dane do przelewu</h3><div class="cm-company-grid"><div><span>Odbiorca</span><b>CompanyManager sp.z.o.o</b></div><div><span>Bank</span><b>PKO Bank Polski SA</b></div><div><span>Numer konta</span><b>PL53102043170000550203436565</b></div><div><span>SWIFT</span><b>BPKOPLPW</b></div></div><p class="bm-muted">W tytule proszę podać numery faktur.</p></div>
      <div class="cm-notification-box cm-full-field"><h3>Lista ostatnich faktur</h3><div class="bm-table-wrap"><table class="bm-table"><thead><tr><th>Termin płatności</th><th>Faktura</th><th>Treść</th><th>Wartość (PLN)</th><th>Pobierz</th><th>Płatność</th></tr></thead><tbody><tr><td>&lt;termin płatności&gt;</td><td>&lt;numer faktury&gt;</td><td>CompanyManager - SMS 05.2026</td><td>43,05 PLN</td><td><button type="button" class="bm-secondary-btn" id="downloadCompanyInvoiceBtn">Pobierz</button></td><td>&lt;data płatności za&gt;</td></tr></tbody></table></div></div>
      <div class="cm-notification-box cm-full-field"><h3>Dokumenty związane z serwisem CompanyManager</h3><div class="bm-company-doc-row"><span>Regulamin</span><a href="../regulamin.html" target="_blank" rel="noopener">Pokaż</a></div><div class="bm-company-doc-row"><span>Cennik</span><a href="../login.html" target="_blank" rel="noopener">Pokaż</a></div><div class="bm-company-doc-row"><span>Polityka Prywatności</span><a href="../polityka-prywatnosci.html" target="_blank" rel="noopener">Pokaż</a></div><div class="bm-company-doc-row"><span>Informacja o przetwarzaniu danych osobowych</span><a href="../informacja-o-przetwarzaniu-danych.html" target="_blank" rel="noopener">Pokaż</a></div></div>
    </section>`;

    const sections = { 'company-data': companyData, notifications, 'program-settings': programSettings, payments };
    const content = `<section class="bm-page-card cm-company-panel-page">${switcher}</section>${sections[currentView] || companyData}`;
    renderPanelFrame(ctx, 'companyPanel', content, '', '');
    initNotificationSettingsForm(ctx);
    initProgramSettingsForm(ctx);

    document.querySelector('#downloadCompanyInvoiceBtn')?.addEventListener('click', () => {
      const blob = new Blob(['Faktura testowa CompanyManager\nCompanyManager - SMS 05.2026\nWartość: 43,05 PLN'], { type:'text/plain;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'faktura-companymanager-sms-05-2026.txt'; a.click(); URL.revokeObjectURL(a.href);
    });
  };


  const renderSales = (ctx) => {
    const { db, company } = ctx;
    const params = new URLSearchParams(window.location.search);
    const currentView = params.get('view') || 'services';
    const views = [
      ['services','Usługi'], ['servicesByName','Usługi według nazw'], ['servicesByCategory','Usługi według kategorii'], ['servicesByEmployee','Usługi według pracowników'],
      ['products','Produkty'], ['productsByName','Produkty według nazw'], ['productsByCategory','Produkty według kategorii'], ['productsByEmployee','Produkty według pracowników'],
      ['passes','Karnety'], ['passesByEmployee','Karnety według pracowników'], ['payments','Płatności'], ['paymentsByType','Płatności według typów']
    ];

    const iso = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const currentMonthStart = new Date(CM_TODAY.getFullYear(), CM_TODAY.getMonth(), 1);
    const currentMonthEnd = new Date(CM_TODAY.getFullYear(), CM_TODAY.getMonth() + 1, 0);
    const fromDate = params.get('from') || iso(currentMonthStart);
    const toDate = params.get('to') || iso(currentMonthEnd);
    const limitValue = String(params.get('limit') || '50');
    const searchValue = String(params.get('search') || '');
    const searchNeedle = normalizeText(searchValue || '');

    const users = (db.users || []).filter(u => u.companyId === company.id && u.role !== 'owner');
    const services = (db.services || []).filter(s => s.companyId === company.id);
    const serviceCategories = (db.serviceCategories || []).filter(c => c.companyId === company.id);
    const products = (db.products || []).filter(p => p.companyId === company.id);
    const walkins = (db.walkinSales || []).filter(s => s.companyId === company.id);
    const passes = (db.passes || []).filter(p => p.companyId === company.id);
    const visits = (db.visits || []).filter(v => v.companyId === company.id && v.status !== 'odwołana');

    const userById = Object.fromEntries(users.map(u => [u.id, u]));
    const serviceById = Object.fromEntries(services.map(s => [s.id, s]));
    const serviceCategoryById = Object.fromEntries(serviceCategories.map(c => [c.id, c]));
    const productById = Object.fromEntries(products.map(p => [p.id, p]));
    const customerById = Object.fromEntries((db.customers || []).filter(c => c.companyId === company.id).map(c => [c.id, c]));

    const uniq = (items) => [...new Set(items.filter(Boolean))];
    const money = (value) => Number(value || 0).toFixed(2);
    const displayDateTime = (date, time = '') => {
      if (!date) return '';
      const [y,m,d] = String(date).split('-');
      return `${d}.${m}.${y}${time ? ' ' + time : ''}`;
    };
    const inRange = (date) => String(date || '') >= fromDate && String(date || '') <= toDate;
    const getSelected = (name, allValues) => {
      const selected = params.getAll(name).filter(Boolean);
      return selected.length ? selected : allValues;
    };
    const selectedEmployees = getSelected('employees', users.map(u => u.id));
    const selectedServiceCategories = getSelected('serviceCategories', serviceCategories.map(c => c.id));
    const selectedServiceNames = getSelected('serviceNames', services.map(s => s.id));
    const productCategories = uniq(products.map(p => p.category || '(brak)'));
    const selectedProductCategories = getSelected('productCategories', productCategories);
    const selectedProductNames = getSelected('productNames', products.map(p => p.id));
    const paymentTypes = uniq([...(company.paymentMethods || []).map(p => p.name), ...walkins.map(w => w.paymentMethod), ...passes.map(p => p.paymentMethod), 'gotówka']);
    const selectedPaymentTypes = getSelected('paymentTypes', paymentTypes);

    const subnav = `<div class="bm-filter-tabs cm-sales-tabs">${views.map(([id,label]) => `<a class="${currentView === id ? 'active' : ''}" href="sales.html?view=${encodeURIComponent(id)}">${escapeHtml(label)}</a>`).join('')}</div>`;

    const salesDropdown = (name, title, options, selectedValues) => {
      const normalizedOptions = options.map(option => ({ value: String(option.value || ''), label: option.label || option.value || '-' })).filter(option => option.value);
      const allValues = normalizedOptions.map(option => option.value);
      const selected = (selectedValues && selectedValues.length ? selectedValues : allValues).map(String);
      const selectedSet = new Set(selected);
      const count = normalizedOptions.filter(option => selectedSet.has(option.value)).length;
      const items = normalizedOptions.length ? normalizedOptions.map(option => {
        const checked = selectedSet.has(option.value) ? 'checked' : '';
        return `<label class="cm-cr-dropdown-option"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${checked}> ${escapeHtml(option.label)}</label>`;
      }).join('') : '<span class="cm-cr-dropdown-empty">Brak opcji</span>';
      return `<div class="cm-cr-dropdown cm-sales-dropdown" data-filter="${escapeHtml(name)}" data-total="${normalizedOptions.length}">
        <span class="cm-cr-dropdown-label">${escapeHtml(title)}</span>
        <button class="cm-cr-dropdown-button" type="button">Wybrano: ${count} ▼</button>
        <div class="cm-cr-dropdown-menu" hidden>${items}</div>
      </div>`;
    };

    const employeeFilter = salesDropdown('employees', 'Pracownicy', users.map(u => ({ value: u.id, label: u.fullName || u.email })), selectedEmployees);
    const serviceCategoryFilter = salesDropdown('serviceCategories', 'Kategorie usług', serviceCategories.map(c => ({ value: c.id, label: c.name })), selectedServiceCategories);
    const serviceNameFilter = salesDropdown('serviceNames', 'Nazwa usługi', services.map(s => ({ value: s.id, label: s.name })), selectedServiceNames);
    const productCategoryFilter = salesDropdown('productCategories', 'Kategorie produktów', productCategories.map(c => ({ value: c, label: c })), selectedProductCategories);
    const productNameFilter = salesDropdown('productNames', 'Nazwa produktu', products.map(p => ({ value: p.id, label: p.name })), selectedProductNames);
    const paymentTypeFilter = salesDropdown('paymentTypes', 'Typ płatności', paymentTypes.map(p => ({ value: p, label: p })), selectedPaymentTypes);

    const salesPresets = [
      ['today','dziś'], ['yesterday','wczoraj'], ['currentWeek','bieżący tydzień'], ['previousWeek','poprzedni tydzień'],
      ['last7','ostatnie 7 dni'], ['last14','ostatnie 2 tygodnie'], ['currentMonth','bieżący miesiąc'], ['previousMonth','poprzedni miesiąc'],
      ['last30','ostatnie 30 dni'], ['last90','ostatnie 90 dni'], ['currentYear','bieżący rok'], ['previousYear','poprzedni rok'], ['last365','ostatnie 365 dni']
    ];
    const dateFilters = (filters = '') => `<form class="cm-period-controls cm-customers-report-controls cm-sales-report-controls" method="get" action="sales.html">
      <input type="hidden" name="view" value="${escapeHtml(currentView)}">
      <label>od <input id="salesFrom" class="cm-date-input" type="date" name="from" value="${escapeHtml(fromDate)}"></label>
      <label>do <input id="salesTo" class="cm-date-input" type="date" name="to" value="${escapeHtml(toDate)}"></label>
      <select id="salesPreset">${salesPresets.map(([value,label]) => `<option value="${value}" ${value==='currentMonth'?'selected':''}>${label}</option>`).join('')}</select>
      ${filters}
      <button id="salesShow" class="bm-light-btn" type="submit">Pokaż</button>
    </form>`;
    const listTools = () => `<div class="bm-table-toolbar"><label class="cm-limit-label">${limitDropdownHtml('salesLimit', Number(limitValue) || 50)}</label><label>Szukaj: <input id="salesSearch" type="search" value="${escapeHtml(searchValue)}" placeholder="Szukaj"></label></div>`;
    const pager = (from, to, total, page, pages) => `<div class="cm-sales-pager"><span>${total ? `Pozycje od ${from} do ${to} z ${total} łącznie` : 'Pozycji 0 z 0 dostępnych'}</span>${pages ? `<span>Strona <input value="${page}" inputmode="numeric"> z ${pages}</span>` : ''}</div>`;
    const empty = (headers) => `${table(headers, [headers.map((_,i)=> i === 0 ? 'Nie znaleziono żadnych danych' : '')])}${pager(0,0,0,1,0)}`;
    const filterBySearch = (rows) => !searchNeedle ? rows : rows.filter(row => normalizeText(row.join(' ')).includes(searchNeedle));
    const paginate = (rows) => rows;

    const serviceRowsRaw = visits.map(v => {
      const svc = serviceById[v.serviceId] || {};
      const cat = serviceCategoryById[svc.categoryId] || {};
      return {
        date: v.date, time: v.time || '', employeeId: v.employeeId, customerId: v.customerId, serviceId: svc.id || '', serviceCategoryId: svc.categoryId || '', paymentMethod: v.paymentMethod || 'gotówka',
        employee: userById[v.employeeId]?.fullName || '(brak)', customer: customerById[v.customerId]?.name || '(brak)', category: cat.name || '(brak)', name: svc.name || v.serviceCustom || '(brak)', value: Number(v.total || v.amount || svc.priceFrom || 0)
      };
    }).filter(r => inRange(r.date) && selectedEmployees.includes(r.employeeId) && selectedServiceCategories.includes(r.serviceCategoryId) && selectedServiceNames.includes(r.serviceId));

    const productRowsRaw = walkins.filter(w => w.productId).map(w => {
      const prod = productById[w.productId] || {};
      return {
        date: w.date, time: w.time || '', employeeId: w.employeeId, customerId: w.customerId, productId: prod.id || '', productCategory: prod.category || '(brak)',
        employee: userById[w.employeeId]?.fullName || '(brak)', customer: customerById[w.customerId]?.name || '(brak)', name: prod.name || w.productCustom || '(brak)', qty: Number(w.quantity || w.qty || 1), value: Number(w.total || w.amount || prod.price || 0)
      };
    }).filter(r => inRange(r.date) && selectedEmployees.includes(r.employeeId) && selectedProductCategories.includes(r.productCategory) && selectedProductNames.includes(r.productId));

    const passRowsRaw = passes.map(p => ({
      date: p.saleDate || p.date, time: p.saleTime || p.time || '', employeeId: p.employeeId, customerId: p.customerId,
      employee: userById[p.employeeId]?.fullName || '(brak)', customer: customerById[p.customerId]?.name || p.buyer || '(brak)', value: Number(p.value || p.total || 0), note: p.description || p.name || '', paymentMethod: p.paymentMethod || 'gotówka'
    })).filter(r => inRange(r.date) && selectedEmployees.includes(r.employeeId));

    const paymentRowsRaw = [
      ...serviceRowsRaw.map(r => ({ date: r.date, time: r.time, employeeId: r.employeeId, employee: r.employee, customer: r.customer, type: r.paymentMethod || 'gotówka', value: r.value })),
      ...productRowsRaw.map(r => ({ date: r.date, time: r.time, employeeId: r.employeeId, employee: r.employee, customer: r.customer, type: r.paymentMethod || 'gotówka', value: r.value })),
      ...passRowsRaw.map(r => ({ date: r.date, time: r.time, employeeId: r.employeeId, employee: r.employee, customer: r.customer, type: r.paymentMethod || 'gotówka', value: r.value }))
    ].filter(r => selectedPaymentTypes.includes(r.type));

    const groupRows = (rows, keyFn) => {
      const grouped = new Map();
      rows.forEach(row => {
        const key = keyFn(row) || '(brak)';
        const current = grouped.get(key) || { count: 0, value: 0 };
        current.count += Number(row.qty || 1);
        current.value += Number(row.value || 0);
        grouped.set(key, current);
      });
      return [...grouped.entries()].map(([key, val]) => [key, String(val.count), money(val.value)]).sort((a,b) => Number(b[2]) - Number(a[2]));
    };

    const serviceRows = serviceRowsRaw.map(r => [displayDateTime(r.date, r.time), r.employee, r.customer, r.category, r.name, money(r.value), r.paymentMethod]);
    const productRows = productRowsRaw.map(r => [displayDateTime(r.date, r.time), r.employee, r.customer, r.productCategory, r.name, String(r.qty), money(r.value)]);
    const passRows = passRowsRaw.map(r => [displayDateTime(r.date, r.time), r.employee, r.customer, money(r.value), r.note]);
    const paymentRows = paymentRowsRaw.map(r => [displayDateTime(r.date, r.time), r.employee, r.customer, r.type, money(r.value)]);
    const paymentByTypeRows = groupRows(paymentRowsRaw, r => r.type).map(row => {
      const totalCount = paymentRowsRaw.length || 1;
      const percentage = Math.round(Number(row[1]) / totalCount * 100);
      return [row[0], row[1], `${percentage}%`, row[2]];
    });

    const sectionTable = (headers, rows) => {
      const visibleRows = filterBySearch(rows);
      const limitedRows = paginate(visibleRows);
      const limit = Number(limitValue) || 50;
      return visibleRows.length ? `${table(headers, limitedRows.map(r => r.map(escapeHtml)))}${pager(1, Math.min(limit, visibleRows.length), visibleRows.length, 1, Math.ceil(visibleRows.length / limit))}` : empty(headers);
    };
    const summary = (left, count, right, value) => `<div class="cm-sales-summary"><b>${escapeHtml(left)}: ${count}</b><b>${escapeHtml(right)}: ${money(value)} PLN</b></div>`;

    const sections = {
      services: `<h2>Sprzedaż usług</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary('Liczba usług', serviceRowsRaw.length, 'Wartość usług', serviceRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Data sprzedaży','Pracownik','Klient','Kategoria usługi','Nazwa usługi','Wartość','Płatność'], serviceRows)}`,
      servicesByName: `<h2>Sprzedaż usług według nazw</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary('Liczba usług', serviceRowsRaw.length, 'Wartość usług', serviceRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Nazwa','Liczba','Wartość PLN'], groupRows(serviceRowsRaw, r => r.name))}`,
      servicesByCategory: `<h2>Sprzedaż usług według kategorii</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary('Liczba usług', serviceRowsRaw.length, 'Wartość usług', serviceRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Kategoria','Liczba','Wartość PLN'], groupRows(serviceRowsRaw, r => r.category))}`,
      servicesByEmployee: `<h2>Sprzedaż usług według pracowników</h2>${dateFilters(employeeFilter + serviceCategoryFilter + serviceNameFilter)}${summary('Liczba usług', serviceRowsRaw.length, 'Wartość usług', serviceRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Pracownik','Liczba','Wartość PLN'], groupRows(serviceRowsRaw, r => r.employee))}`,
      products: `<h2>Sprzedaż produktów</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary('Liczba produktów', productRowsRaw.reduce((sum,r)=>sum+r.qty,0), 'Wartość produktów', productRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Data sprzedaży','Pracownik','Klient','Kategoria produktu','Nazwa produktu','L.szt.','Wartość'], productRows)}`,
      productsByName: `<h2>Sprzedaż produktów według nazw</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary('Liczba produktów', productRowsRaw.reduce((sum,r)=>sum+r.qty,0), 'Wartość produktów', productRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Nazwa','Liczba','Wartość PLN'], groupRows(productRowsRaw, r => r.name))}`,
      productsByCategory: `<h2>Sprzedaż produktów według kategorii</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary('Liczba produktów', productRowsRaw.reduce((sum,r)=>sum+r.qty,0), 'Wartość produktów', productRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Kategoria','Liczba','Wartość PLN'], groupRows(productRowsRaw, r => r.productCategory))}`,
      productsByEmployee: `<h2>Sprzedaż produktów według pracowników</h2>${dateFilters(employeeFilter + productCategoryFilter + productNameFilter)}${summary('Liczba produktów', productRowsRaw.reduce((sum,r)=>sum+r.qty,0), 'Wartość produktów', productRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Pracownik','Liczba','Wartość PLN'], groupRows(productRowsRaw, r => r.employee))}`,
      passes: `<h2>Sprzedaż - karnety</h2>${dateFilters(employeeFilter)}${summary('Liczba szt.', passRowsRaw.length, 'Wartość', passRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Data sprzedaży','Pracownik','Klient','Wartość','Notatka'], passRows)}`,
      passesByEmployee: `<h2>Sprzedaż - karnety według pracowników</h2>${dateFilters(employeeFilter)}${summary('Liczba szt.', passRowsRaw.length, 'Wartość', passRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Pracownik','Liczba','Wartość PLN'], groupRows(passRowsRaw, r => r.employee))}`,
      payments: `<h2>Płatności</h2>${dateFilters(employeeFilter + paymentTypeFilter)}${summary('Liczba płatności', paymentRowsRaw.length, 'Wartość płatności', paymentRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Data sprzedaży','Pracownik','Klient','Typ płatności','Wartość (PLN)'], paymentRows)}`,
      paymentsByType: `<h2>Płatności według typów</h2>${dateFilters(employeeFilter + paymentTypeFilter)}${summary('Liczba płatności', paymentRowsRaw.length, 'Wartość płatności', paymentRowsRaw.reduce((sum,r)=>sum+r.value,0))}${listTools()}${sectionTable(['Typ płatności','Liczba','Procent','Wartość PLN'], paymentByTypeRows)}`
    };

    const content = `<section class="bm-page-card cm-sales-page">${subnav}<div class="cm-sales-view"><div class="cm-sales-view-actions"><button id="salesExportBtn" class="cm-sales-export-btn" type="button">Export</button></div>${sections[currentView] || sections.services}</div></section>`;
    renderPanelFrame(ctx, 'sales', content, '', '');

    document.querySelectorAll('.cm-sales-dropdown .cm-cr-dropdown-button').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const dropdown = button.closest('.cm-sales-dropdown');
        const menu = dropdown?.querySelector('.cm-cr-dropdown-menu');
        if (!menu) return;
        const isHidden = menu.hasAttribute('hidden');
        document.querySelectorAll('.cm-sales-dropdown .cm-cr-dropdown-menu').forEach(openMenu => openMenu.setAttribute('hidden', ''));
        if (isHidden) menu.removeAttribute('hidden');
      });
    });
    document.querySelectorAll('.cm-sales-dropdown input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const dropdown = input.closest('.cm-sales-dropdown');
        const button = dropdown?.querySelector('.cm-cr-dropdown-button');
        const count = dropdown?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
        if (button) button.textContent = `Wybrano: ${count} ▼`;
      });
    });
    const salesForm = document.querySelector('.cm-sales-report-controls');
    const applySalesFilters = () => {
      if (!salesForm) return;
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/[^/]*$/, 'sales.html');
      url.search = '';
      url.searchParams.set('view', currentView);
      url.searchParams.set('from', salesForm.querySelector('input[name="from"]')?.value || fromDate);
      url.searchParams.set('to', salesForm.querySelector('input[name="to"]')?.value || toDate);
      url.searchParams.set('limit', document.querySelector('#salesLimit')?.value || limitValue || '50');
      url.searchParams.set('search', document.querySelector('#salesSearch')?.value || '');
      salesForm.querySelectorAll('.cm-sales-dropdown').forEach(dropdown => {
        const name = dropdown.dataset.filter;
        if (!name) return;
        const inputs = [...dropdown.querySelectorAll('input[type="checkbox"]')];
        const selected = inputs.filter(input => input.checked).map(input => input.value);
        if (selected.length && selected.length < inputs.length) {
          selected.forEach(value => url.searchParams.append(name, value));
        }
      });
      window.location.href = url.toString();
    };
    salesForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      applySalesFilters();
    });
    const salesFromInput = document.querySelector('#salesFrom');
    const salesToInput = document.querySelector('#salesTo');
    const salesPreset = document.querySelector('#salesPreset');
    const setSalesRange = (presetMode) => {
      const base = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), 1);
      let end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const day = base.getDay() || 7;
      if (presetMode === 'today') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate()); end = new Date(start); }
      if (presetMode === 'yesterday') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1); end = new Date(start); }
      if (presetMode === 'currentWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day + 1); end = new Date(start); end.setDate(start.getDate() + 6); }
      if (presetMode === 'previousWeek') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day - 6); end = new Date(start); end.setDate(start.getDate() + 6); }
      if (presetMode === 'last7') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last14') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 13); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last30') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 29); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'previousMonth') { start = new Date(base.getFullYear(), base.getMonth() - 1, 1); end = new Date(base.getFullYear(), base.getMonth(), 0); }
      if (presetMode === 'currentYear') { start = new Date(base.getFullYear(), 0, 1); end = new Date(base.getFullYear(), 11, 31); }
      if (presetMode === 'previousYear') { start = new Date(base.getFullYear() - 1, 0, 1); end = new Date(base.getFullYear() - 1, 11, 31); }
      if (presetMode === 'last90') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 89); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (presetMode === 'last365') { start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 364); end = new Date(base.getFullYear(), base.getMonth(), base.getDate()); }
      if (salesFromInput) salesFromInput.value = iso(start);
      if (salesToInput) salesToInput.value = iso(end);
    };
    salesPreset?.addEventListener('change', () => setSalesRange(salesPreset.value));
    document.querySelector('#salesSearch')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') applySalesFilters(); });
    setupLimitDropdown('#salesLimit', applySalesFilters);
    document.querySelector('#salesExportBtn')?.addEventListener('click', () => {
      if (!hasSystemPermission(getCurrentContext().user, 'export danych z całej platformy')) { alert('Brak uprawnienia: export danych z całej platformy'); return; }
      const activeLabel = (views.find(([id]) => id === currentView)?.[1] || 'Sprzedaz').replace(/\s+/g, '-').toLowerCase();
      const tableEl = document.querySelector('.cm-sales-view table');
      if (!tableEl) return;
      const rows = [...tableEl.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(cell => `"${String(cell.textContent || '').trim().replace(/"/g, '""')}"`).join(';'));
      const csv = '\ufeff' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `companymanager-${activeLabel}-${fromDate}-${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    });
  };

  const renderModulePage = (ctx, page) => {
    const configs = {
      visits: ['Wizyty', ['Data','Godzina','Klient','Usługa','Status'], [[currentDisplayDate(),'10:00','Jan Kowalski','Konsultacja','Potwierdzona'],[currentDisplayDate(),'13:30','Firma Testowa','Spotkanie','Oczekuje']]],
      walkins: ['Sprzedaż bez wizyty', ['Data','Produkt/usługa','Kwota','Pracownik'], [[currentDisplayDate(),'Produkt testowy','120 PLN','Admin Demo'],[currentDisplayDate(),'Usługa szybka','80 PLN','Pracownik Demo']]],
      products: ['Produkty', ['Nazwa','Kategoria','Stan','Cena'], [['Produkt A','Sprzedaż','12','49 PLN'],['Produkt B','Magazyn','4','89 PLN']]],
      services: ['Usługi', ['Nazwa','Czas','Cena','Aktywna'], [['Konsultacja','60 min','150 PLN','Tak'],['Spotkanie','30 min','0 PLN','Tak']]],
      passes: ['Karnety', ['Nazwa','Ważność','Cena','Status'], [['Karnet 5 wejść','90 dni','400 PLN','Aktywny'],['Pakiet VIP','180 dni','900 PLN','Aktywny']]],
      daysOff: ['Dni wolne pracowników', ['Pracownik','Od','Do','Powód'], [['Admin Demo','20.06.2026','21.06.2026','Urlop'],['Pracownik Demo','25.06.2026','25.06.2026','Wolne']]],
      positions: ['Stanowiska pracy', ['Nazwa','Opis','Aktywne'], [['Recepcja','Obsługa kontaktu i grafiku','Tak'],['Specjalista','Realizacja usług','Tak']]],
      marketing: ['Marketing', ['Kampania','Kanał','Status','Odbiorcy'], [['Przypomnienia','SMS','Aktywna','Klienci z wizytami'],['Powrót klienta','Email','Projekt','Nieaktywni']]],
      reports: ['Raporty', ['Raport','Okres','Wynik'], [['Sprzedaż', monthNamesPL[CM_TODAY.getMonth()] + ' ' + CM_TODAY.getFullYear(), '2 450 PLN'],['Wizyty', monthNamesPL[CM_TODAY.getMonth()] + ' ' + CM_TODAY.getFullYear(), '24'],['Nowi klienci', monthNamesPL[CM_TODAY.getMonth()] + ' ' + CM_TODAY.getFullYear(), '8']]],
      settings: ['Ustawienia', ['Sekcja','Status','Opis'], [['Dane firmy','Aktywne','Nazwa, adres, NIP'],['Powiadomienia','Aktywne','SMS i e-mail'],['Uprawnienia','Wersja demo','Role użytkowników']]]
    };
    const [title, headers, rows] = configs[page] || ['Moduł', ['Nazwa','Status'], [['Wersja demo','Do rozbudowy']]];
    const content = `<section class="bm-page-card"><div class="bm-page-head"><h2>${escapeHtml(title)}</h2><button>Dodaj</button></div>${table(headers, rows.map(r=>r.map(escapeHtml)))}</section>`;
    renderPanelFrame(ctx, page, content, title, 'Widok administracyjny modułu.');
  };

  const initPublicLanguagePickers = () => {
    const pickers = Array.from(document.querySelectorAll('[data-public-language-picker]'));
    if (!pickers.length) return;
    const langLabels = CM_LANGUAGE_LABELS;
    const langNames = CM_LANGUAGE_NAMES;
    const langOrder = CM_LANGUAGE_ORDER;
    let savedLang = localStorage.getItem('cmLanguage') || 'pl';
    if (!langLabels[savedLang]) savedLang = 'pl';

    const renderPicker = (picker) => {
      const toggle = picker.querySelector('.cm-language-current');
      const menu = picker.querySelector('.cm-language-menu');
      if (!toggle || !menu) return;
      toggle.textContent = langLabels[savedLang] || 'PL';
      menu.innerHTML = langOrder
        .filter(lang => lang !== savedLang)
        .map(lang => `<button type="button" data-lang="${lang}" aria-label="${langNames[lang]}">${langLabels[lang]}</button>`)
        .join('');
    };

    const closeAll = () => {
      pickers.forEach((picker) => {
        const toggle = picker.querySelector('.cm-language-current');
        const menu = picker.querySelector('.cm-language-menu');
        if (menu) menu.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    };

    pickers.forEach((picker) => {
      const toggle = picker.querySelector('.cm-language-current');
      const menu = picker.querySelector('.cm-language-menu');
      renderPicker(picker);
      if (!toggle || !menu) return;

      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        renderPicker(picker);
        const nextOpen = menu.hidden;
        closeAll();
        menu.hidden = !nextOpen;
        toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      });

      menu.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-lang]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const lang = btn.getAttribute('data-lang') || 'pl';
        if (!langLabels[lang]) return;
        savedLang = lang;
        localStorage.setItem('cmLanguage', savedLang);
        pickers.forEach(renderPicker);
        closeAll();
        window.location.reload();
      });
    });

    schedulePlatformLanguage(savedLang);
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAll(); });
  };

  initPublicLanguagePickers();

  if (dashboardRoot) {
    const page = document.body.dataset.panelPage || 'dashboard';
    const ctx = getCurrentContext();
    if (!ctx.session || !ctx.user || !ctx.company) { clearSession(); window.location.href = '../login.html'; return; }
    scheduleNotificationProcessors(ctx.company.id);
    if (!canAccessPage(ctx.user, page)) { renderPanelFrame(ctx, page, '<section class="bm-page-card"><h2>Brak dostępu</h2><p>Twoja rola nie ma dostępu do tego modułu.</p></section>', 'Brak dostępu', 'Ten moduł jest ograniczony rolą użytkownika.'); return; }
    if (page === 'dashboard') renderDashboard(ctx);
    else if (page === 'employees') renderEmployees(ctx);
    else if (page === 'users') renderUsers(ctx);
    else if (page === 'calendar') renderCalendar(ctx);
    else if (page === 'customers') renderCustomers(ctx);
    else if (page === 'positions') renderPositions(ctx);
    else if (page === 'daysOff' && window.cmSupabase) {
      // Supabase module owns Dni wolne pracowników.
      // Do not render the legacy localStorage version here, because it overwrites
      // the RPC-powered form and makes "Zapisz dni wolne" appear not to work.
      renderPanelFrame(ctx, 'daysOff', '<section class="bm-page-card"><h2>Dni wolne pracowników</h2><p class="bm-muted">Ładowanie danych z Supabase...</p></section>', '', '');
    }
    else if (page === 'daysOff') renderDaysOff(ctx);
    else if (page === 'services') renderServices(ctx);
    else if (page === 'visits') renderVisits(ctx);
    else if (page === 'reports') renderReports(ctx);
    else if (page === 'customersReports') renderCustomersReports(ctx);
    else if (page === 'dailyReport') renderDailyReport(ctx);
    else if (page === 'periodReport') renderPeriodReport(ctx);
    else if (page === 'employeesReports') renderEmployeesReports(ctx);
    else if (page === 'workSchedule') renderEmployeesReports(ctx, 'workSchedule', true);
    else if (page === 'smsReports') renderSmsReports(ctx);
    else if (page === 'emailReports') renderEmailReports(ctx);
    else if (page === 'walkins') renderWalkins(ctx);
    else if (page === 'products') renderProducts(ctx);
    else if (page === 'marketing') renderMarketing(ctx);
    else if (page === 'passes') renderPasses(ctx);
    else if (page === 'sales') renderSales(ctx);
    else if (page === 'companyPanel') renderCompanyPanel(ctx);
    else if (page === 'owner') renderOwner(ctx);
    else if (page === 'companies') renderCompanies(ctx);
    else if (page === 'settings') renderSettings(ctx);
    else renderModulePage(ctx, page);
    setupNativePickers();
    setupGlobalModalObserver();
  }
});
