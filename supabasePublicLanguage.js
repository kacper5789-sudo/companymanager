// CompanyManager — public PL/ENG language sync for login, register and legal pages
(function () {
  const LANG_LABELS = { pl: 'PL', 'en-gb': 'ENG' };
  const LANG_ORDER = ['pl', 'en-gb'];
  const LANG_NAMES = { pl: 'Polski', 'en-gb': 'English' };

  function normalizeLanguage(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'en' || raw === 'eng' || raw === 'english' || raw === 'gb') return 'en-gb';
    if (raw === 'pl' || raw === 'polski' || raw === 'polish') return 'pl';
    return raw === 'en-gb' ? 'en-gb' : 'pl';
  }

  function currentLanguage() {
    return normalizeLanguage(localStorage.getItem('cmLanguage') || localStorage.getItem('cm_public_language') || 'pl');
  }

  function setGlobalLanguage(lang) {
    const normalized = normalizeLanguage(lang);
    localStorage.setItem('cmLanguage', normalized);
    localStorage.setItem('cm_public_language', normalized);
    localStorage.setItem('cm_language_source', 'public');
    try {
      const settings = JSON.parse(localStorage.getItem('cm_company_settings') || '{}') || {};
      settings.language = normalized;
      localStorage.setItem('cm_company_settings', JSON.stringify(settings));
    } catch (_) {
      localStorage.setItem('cm_company_settings', JSON.stringify({ language: normalized }));
    }
    try {
      const access = JSON.parse(localStorage.getItem('cm_access') || 'null');
      if (access) {
        access.language = normalized;
        access.profile_language = normalized;
        access.company_language = normalized;
        localStorage.setItem('cm_access', JSON.stringify(access));
      }
    } catch (_) {}
    return normalized;
  }

  window.cmNormalizePublicLanguage = normalizeLanguage;
  window.cmGetPublicLanguage = currentLanguage;
  window.cmSetPublicLanguage = setGlobalLanguage;

  const COMMON = {
    'Logowanie — CompanyManager': 'Login — CompanyManager',
    'Rejestracja — CompanyManager': 'Registration — CompanyManager',
    'Regulamin — CompanyManager': 'Terms and conditions — CompanyManager',
    'Polityka Prywatności — CompanyManager': 'Privacy policy — CompanyManager',
    'Informacja o przetwarzaniu danych — CompanyManager': 'Data processing information — CompanyManager',
    'Logowanie': 'Login',
    'Rejestracja': 'Registration',
    'Regulamin': 'Terms and conditions',
    'Polityka Prywatności': 'Privacy policy',
    'RODO': 'GDPR',
    'Cennik CompanyManager': 'CompanyManager price list',
    '3 miesiące': '3 months',
    '6 miesięcy': '6 months',
    '12 miesięcy': '12 months',
    '24 miesiące': '24 months',
    '100 PLN netto': '100 PLN net',
    '175 PLN netto': '175 PLN net',
    '300 PLN netto': '300 PLN net',
    '500 PLN netto': '500 PLN net',
    'SMS Polska:': 'SMS Poland:',
    'SMS zagranica:': 'International SMS:',
    '0,10 PLN netto / szt.': '0.10 PLN net / item',
    '0,75 PLN netto / szt.': '0.75 PLN net / item',
    'Do cen należy doliczyć 23% VAT.': '23% VAT must be added to the prices.',
    'Panel firmy': 'Company panel',
    'Zaloguj się': 'Log in',
    'Wejdź do panelu CompanyManager i zarządzaj firmą z poziomu przeglądarki.': 'Access the CompanyManager panel and manage your company from your browser.',
    'Adres email': 'Email address',
    'Hasło': 'Password',
    'Nie pamiętasz hasła?': 'Forgot password?',
    'Utwórz firmę': 'Create a company',
    'System dla firm': 'Business management system',
    'Zarejestruj firmę w CompanyManager.': 'Register your company in CompanyManager.',
    'Jedno miejsce do zarządzania klientami, pracownikami, rezerwacjami, powiadomieniami i organizacją firmy.': 'One place to manage customers, employees, bookings, notifications and company operations.',
    'Dla firm usługowych, lokalnych, handlowych, edukacyjnych, automotive i wszystkich firm które pragną zarządzać swoją firmą szybko, przejrzyście i wygodnie.': 'For service, local, retail, education, automotive and other businesses that want to manage their company quickly, clearly and conveniently.',
    'Panel właściciela firmy, administratorów i pracowników.': 'Panel for company owners, administrators and employees.',
    'Aplikacja przeglądarkowa dostępna online po zalogowaniu.': 'Browser application available online after login.',
    'klienci': 'customers',
    'powiadomienia': 'notifications',
    'firmy': 'company',
    'Utwórz konto właściciela i dodaj podstawowe dane firmy.': 'Create the owner account and add basic company details.',
    'Użytkownik / właściciel firmy': 'User / company owner',
    'Nr telefonu*': 'Phone number*',
    'Np. +48321321321': 'E.g. +48321321321',
    'Hasło*': 'Password*',
    'Potwierdzenie hasła*': 'Confirm password*',
    'Imię i nazwisko*': 'Full name*',
    'Dane adresowe firmy': 'Company address details',
    'Nazwa firmy*': 'Company name*',
    'Adres*': 'Address*',
    'Kod pocztowy*': 'Postcode*',
    'Format: XX-XXX': 'Format: XX-XXX',
    'Miejscowość*': 'City*',
    'Telefony kontaktowe*': 'Contact phone numbers*',
    'Email firmowy': 'Company email',
    'Dane do faktury': 'Invoice details',
    'Pełna nazwa firmy*': 'Full company name*',
    'NIP / VAT EU': 'Tax ID / VAT EU',
    'Ustawienia powiadomień': 'Notification settings',
    'Nadawca Wiadomości*': 'Message sender*',
    'Uzupełniając pole „Nadawca Wiadomości” oświadczasz, że posiadasz prawo do używania wskazanego oznaczenia jako nadawcy wiadomości SMS/email generowanych na zlecenie firmy.': 'By completing the “Message sender” field you declare that you have the right to use the specified designation as the sender of SMS/email messages generated on behalf of the company.',
    'Cennik CompanyManager — wybierz pakiet*': 'CompanyManager price list — select a package*',
    'Wybierz jeden pakiet abonamentowy. Bez wyboru pakietu rejestracja nie przejdzie dalej.': 'Select one subscription package. Registration cannot continue without selecting a package.',
    'Regulamin i dokumenty': 'Terms and documents',
    'Oświadczam, że zapoznałem/am się z': 'I declare that I have read the',
    'Regulaminem': 'Terms and conditions',
    'i akceptuję jego treść*': 'and accept its content*',
    'Informacją o przetwarzaniu danych osobowych': 'Information on personal data processing',
    'Polityką Prywatności': 'Privacy policy',
    'Utwórz konto firmy': 'Create company account',
    'Masz już konto?': 'Already have an account?',
    'Wróć do rejestracji': 'Back to registration',
    'Created by': 'Created by'
  };

  const CLEANUPS = [
    [/Polityką Prywatności/g, 'Privacy policy'],
    [/Informacją o przetwarzaniu danych osobowych/g, 'Information on personal data processing'],
    [/Regulaminem/g, 'Terms and conditions'],
    [/Adres email\*/g, 'Email address*']
  ];

  function translateText(text) {
    if (!text || !text.trim()) return text;
    const leading = text.match(/^\s*/)?.[0] || '';
    const trailing = text.match(/\s*$/)?.[0] || '';
    const raw = text.trim();
    let translated = COMMON[raw] || COMMON[raw.replace(/\s+/g, ' ')];
    if (!translated) {
      translated = raw;
      let changed = false;
      Object.entries(COMMON).sort((a, b) => b[0].length - a[0].length).forEach(([pl, en]) => {
        if (pl.length > 3 && translated.includes(pl)) {
          translated = translated.split(pl).join(en);
          changed = true;
        }
      });
      if (!changed) return text;
    }
    CLEANUPS.forEach(([pattern, replacement]) => { translated = translated.replace(pattern, replacement); });
    return leading + translated + trailing;
  }

  function translateDom(root = document.body) {
    document.documentElement.lang = 'en-GB';
    if (document.title) document.title = translateText(document.title);
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skip.has(parent.tagName) || parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = translateText(node.nodeValue); });
    root.querySelectorAll?.('[placeholder]').forEach((el) => el.setAttribute('placeholder', translateText(el.getAttribute('placeholder'))));
    root.querySelectorAll?.('[title]').forEach((el) => el.setAttribute('title', translateText(el.getAttribute('title'))));
    root.querySelectorAll?.('[aria-label]').forEach((el) => el.setAttribute('aria-label', translateText(el.getAttribute('aria-label'))));
    root.querySelectorAll?.('option').forEach((el) => { el.textContent = translateText(el.textContent).trim(); });
    root.querySelectorAll?.('input[type=submit][value], input[type=button][value]').forEach((el) => { el.value = translateText(el.value).trim(); });
  }

  const LEGAL_EN = {
    'regulamin.html': `
      <h1>Terms and conditions for using CompanyManager</h1>
      <p class="meta">Terms for the provision of electronic services. Production version v1.0. The Operator details must be completed before publication.</p>
      <h2>§1 General provisions</h2>
      <p>These Terms define the rules for using the CompanyManager online service, available as a browser-based SaaS application. The Operator of the service is [OPERATOR NAME] with its registered office at [ADDRESS], Tax ID [NIP], REGON [REGON], e-mail address: [EMAIL].</p>
      <p>CompanyManager enables companies to manage selected organisational processes, including customers, employees, bookings, services, products, schedules, SMS and e-mail notifications, reports, company settings and company data.</p>
      <p>The Terms constitute terms for the provision of electronic services under Polish law. Use of the Service means acceptance of these Terms, the Privacy Policy and the information on personal data processing.</p>
      <h2>§2 Definitions</h2>
      <p>Service — the CompanyManager web application, its interface, modules, functions, documentation, integrations and technical infrastructure made available by the Operator.</p>
      <p>Operator — the entity providing electronic services within the Service.</p>
      <p>User — an entrepreneur, company, organisation, person conducting business activity or a person acting on behalf of a company using the Service.</p>
      <p>Company — a business entity, organisation or person conducting business activity that uses the Service to manage business processes.</p>
      <p>Company Administrator — a person managing the Company account, its users, permissions, data and settings.</p>
      <p>Employee — a person granted access to the Service by the Company Administrator within the Company account.</p>
      <p>Account — individual access to the Service protected by login, password and security mechanisms.</p>
      <p>Price list — the current list of fees for using the Service and additional services, in particular SMS, e-mail or other integrations.</p>
      <p>External providers — entities providing technical, hosting, database, e-mail, SMS, payment, accounting, analytical or other services necessary for the operation of the Service.</p>
      <h2>§3 Registration and account</h2>
      <p>Before using the Service, the User completes the registration form, providing the details of the owner or representative of the company, company address details, invoice details and selected Service settings. The provided data should be true and legally accurate.</p>
      <p>The User login is the e-mail address. The User must keep the password confidential and must not disclose it to unauthorised persons.</p>
      <p>The password should meet current security requirements specified by the Operator. The Operator may require a password change where justified by security reasons.</p>
      <p>The User is obliged to update account and company data if they change.</p>
      <p>The Company Administrator is responsible for creating Employee accounts, assigning roles and permissions and for actions performed by those persons in the Service within the granted permissions.</p>
      <h2>§4 Services provided in the Service</h2>
      <p>The Service may include creating customer, employee, service, product and booking databases, filtering and searching data, maintaining activity history, sending SMS and e-mail messages, creating reports, work schedules, handling appointment notifications and managing company settings.</p>
      <p>The scope of the Service may be developed, changed, limited or extended by the Operator, including new modules, reports, integrations, notifications, payments, data exports or other tools supporting company management.</p>
      <p>The Operator may provide test, beta or experimental functions. Such functions may be unstable, changed or withdrawn without prior notice.</p>
      <h2>§5 Rules of use</h2>
      <p>The Service operates online and requires Internet access and an up-to-date web browser.</p>
      <p>The User must not use the Service in a manner that violates law, third-party rights, data security, the Operator's reputation or fair business practices.</p>
      <p>The User must not overload the Service, bypass security, obtain unauthorised access, disrupt the system, test security without written consent, scrape data, mass-download data, use bots or exploit vulnerabilities.</p>
      <p>The User must not attempt to access data of other companies, accounts of other users, the technical infrastructure of the Service or any data for which the User has not been authorised.</p>
      <p>The User must immediately notify the Operator of any suspected security breach, unauthorised account access or password disclosure.</p>
      <h2>§6 SMS, e-mail and customer communication</h2>
      <p>The Service may enable sending SMS and e-mail messages, including marketing messages, reminders, booking confirmations, birthday wishes and automatic notifications.</p>
      <p>The User is fully responsible for the content of SMS and e-mail messages sent through the Service and for having the required legal bases, marketing consents, telecommunications consents or other rights to contact recipients.</p>
      <p>The Operator provides a technical tool for sending messages but does not verify each recipient database, message content or consent held by the User.</p>
      <p>The User must not send spam, unlawful, misleading or infringing content, or content violating personal rights, intellectual property rights or good practices.</p>
      <p>The Operator may suspend or limit SMS/e-mail sending in the event of suspected abuse, legal violations, recipient complaints, provider blocks, lack of funds, exceeded limits or breach of these Terms.</p>
      <h2>§7 Payments and additional services</h2>
      <p>Use of the Service is paid according to the current Price list. Prices may cover access to the Service for a selected period and additional services, in particular SMS, e-mail, integrations or additional functions.</p>
      <p>After the trial period or paid period expires, access to selected functions may be limited until payment is settled.</p>
      <p>Failure to pay on time may result in limitation, suspension or termination of the services.</p>
      <p>Fees for unused subscription periods are non-refundable unless mandatory law provides otherwise or the Operator decides otherwise in an individual case.</p>
      <p>For services billed by usage, in particular SMS, the User must pay for the actual usage in accordance with the Price list, Service reports or other terms agreed with the Operator.</p>
      <h2>§8 Availability, security and external providers</h2>
      <p>The Operator takes measures to ensure proper and secure operation of the Service, including access control, logical separation of company data, encrypted transmission, logging of selected events, permission mechanisms and cooperation with infrastructure providers.</p>
      <p>The Operator reserves the right to temporary unavailability resulting from maintenance, updates, failures, actions of external providers, network failures, attacks, force majeure or events beyond the Operator's control.</p>
      <p>The Service may use external providers, in particular hosting, database, e-mail, SMS and payment providers. The Operator is not responsible for failures or limitations caused solely by such providers, to the extent permitted by law.</p>
      <h2>§9 Data, backups and company separation</h2>
      <p>Data entered by the User into the Service remains the User's data. Each Company's data is logically separated from data of other Companies.</p>
      <p>The Operator applies security measures and may create backups, but the User should keep copies of the most important information outside the Service where such data is critical to the User's business.</p>
      <p>The User is responsible for the accuracy of data entered into the Service, for permissions granted to Employees and for actions performed within the Company account.</p>
      <h2>§10 Intellectual property</h2>
      <p>The Service, its source and object code, interface, layout, graphics, structure, logic, modules, functions, database structure, name, trademarks, documentation and know-how are the property of the Operator or are used by the Operator under appropriate rights.</p>
      <p>Use of the Service does not transfer any intellectual property rights to the User. The User receives only the right to use the Service in accordance with these Terms.</p>
      <p>It is prohibited to copy, modify, reproduce, sell, sublicense, share, decompile, reverse engineer, analyse the source code or create derivative or competing systems based on the Service without the Operator's written consent.</p>
      <h2>§11 Complaints</h2>
      <p>Complaints regarding the Service may be submitted electronically to [EMAIL]. The complaint should include a description of the problem, account details and a contact e-mail address.</p>
      <p>The Operator reviews complaints within 14 days of receiving a valid submission. If the complaint requires supplementation, the period may run from the date complete information is received.</p>
      <h2>§12 Personal data protection</h2>
      <p>The Operator processes personal data in accordance with applicable law, in particular the GDPR, the Act on providing electronic services and the documents: Information on personal data processing and Privacy Policy.</p>
      <p>For personal data of customers, employees or other persons entered by the User into the Service, the User remains the controller and the Operator acts as a processor on behalf of the User, unless agreed otherwise.</p>
      <h2>§13 Data export, resignation and account deletion</h2>
      <p>The User may resign from the Service by contacting the Operator at [EMAIL] or by using functions available in the Service if provided.</p>
      <p>The User may request data export to the extent technically possible and compliant with law. The Operator may refuse export if it concerns data of other entities, violates law, security or third-party rights.</p>
      <p>After termination of the services, data may be deleted after the period specified by the Operator, taking into account legal obligations, settlements, security and claims.</p>
      <h2>§14 Liability</h2>
      <p>The Operator takes steps to ensure proper operation of the Service but does not guarantee uninterrupted and error-free availability.</p>
      <p>To the extent permitted by law, the Operator is not liable for damage resulting from improper use, failures of the User's hardware or software, force majeure, external providers, lack of Internet, incorrect data, actions of Employees, password disclosure or breach of these Terms.</p>
      <p>The Service and reports are supporting tools. The User is responsible for business, tax, accounting, HR, marketing and organisational decisions made on the basis of Service data.</p>
      <h2>§15 Changes to the Terms</h2>
      <p>The Operator may change these Terms by informing Users about significant changes electronically or in the Service. Continued use after changes enter into force means acceptance, unless mandatory law requires another procedure.</p>
      <h2>§16 Final provisions</h2>
      <p>Matters not regulated are governed by Polish law and applicable European Union law.</p>
      <p>Any disputes related to the Service will be resolved by the competent common court in accordance with applicable law.</p>
      <p><a href="register.html">Back to registration</a></p>
    `,
    'polityka-prywatnosci.html': `
      <h1>CompanyManager Privacy Policy</h1>
      <p class="meta">Production version v1.0. The Operator details must be completed before publication.</p>
      <h2>1. General information</h2>
      <p>[OPERATOR NAME] respects users' privacy and applies technical and organisational measures designed to protect personal data processed within CompanyManager.</p>
      <p>This Policy explains what data may be processed, for what purposes, on what legal bases, who may receive the data and what rights data subjects have.</p>
      <h2>2. Data controller</h2>
      <p>The controller of personal data of Service users is [OPERATOR NAME], [ADDRESS], Tax ID [NIP], REGON [REGON]. Contact with the Operator is possible at: [EMAIL].</p>
      <h2>3. Scope of data</h2>
      <p>The Service may process data such as name and surname, e-mail address, phone number, company details, address details, Tax ID/VAT EU, invoice data, IP address, session identifiers, security logs and data entered by the User concerning employees, customers, services, products, bookings, notifications, reports, settlements, marketing consents and account settings.</p>
      <p>The scope of data depends on how the Service is used, the User's role, granted permissions and functions activated by the Company.</p>
      <h2>4. Purposes and legal bases</h2>
      <p>Data is processed to register accounts, conclude and perform agreements, provide electronic services, operate the Service, communicate, settle payments, issue accounting documents, handle requests and complaints, ensure security, prevent abuse, keep technical logs and establish, pursue or defend claims.</p>
      <p>Legal bases may include performance of a contract or pre-contractual actions, legal obligations, legitimate interests of the Operator, consent of the data subject and, for data entrusted by the User, a data processing agreement or another basis resulting from the relationship between the User and the data subject.</p>
      <h2>5. Data of customers and employees entered by the User</h2>
      <p>For data of customers, employees or other persons entered by the User into the Service, the User remains the controller and the Operator may act as processor on behalf of the User.</p>
      <p>The User is responsible for lawful collection of data, scope of data, information obligations, legal bases, marketing consents and content of messages sent to customers or employees.</p>
      <p>The Operator applies technical and organisational mechanisms for logical separation of company data, while the User is responsible for granting access to its Employees correctly.</p>
      <h2>6. Marketing, SMS and e-mail communication</h2>
      <p>With consent or on the basis of a legitimate interest, the Operator may send information about CompanyManager services. Consent may be withdrawn at any time.</p>
      <p>For SMS and e-mail messages sent by the User to its customers, the Operator provides a technical tool. The User is responsible for having appropriate consents and legal bases and for compliance of message content with data protection, electronic services and electronic communication laws.</p>
      <h2>7. Data recipients</h2>
      <p>Data may be disclosed to entities providing services to the Operator, in particular hosting, database, IT infrastructure, security, e-mail, SMS, payment, accounting, legal, technical support providers and entities authorised by law.</p>
      <p>The Operator uses or may use external providers necessary for the Service. The scope of entrusted data is limited to what is necessary for a given service.</p>
      <h2>8. Transfers outside the EEA</h2>
      <p>As a rule, data is not transferred outside the European Economic Area unless necessary for the Service, the use of technology providers or functions selected by the User. In such case, transfers take place using safeguards required by the GDPR, such as standard contractual clauses, adequacy decisions or other mechanisms provided by law.</p>
      <h2>9. Cookies and similar technologies</h2>
      <p>The Service uses cookies and similar technologies necessary for application operation, login session maintenance, security, remembering settings, language, currency, time zone and correct operation of the panel.</p>
      <p>The User may manage cookies in browser settings, but limiting them may affect the Service, especially login and panel use.</p>
      <h2>10. Security</h2>
      <p>Data is treated as confidential and protected against unauthorised access. Account access is protected by login and password. The Service uses permission mechanisms, company separation, logging of selected activity, encrypted transmission and access control.</p>
      <p>The User should protect the password, not disclose it to third parties and immediately report any suspected account security breach.</p>
      <h2>11. Data retention</h2>
      <p>Data is stored during use of the Service and after cooperation ends for the period required by law or necessary for settlements, complaints, security, abuse prevention and claims.</p>
      <p>Data entrusted by the User may be deleted or anonymised after the services end, taking into account legal obligations, technical backups and legitimate interests of the Operator.</p>
      <h2>12. Rights of data subjects</h2>
      <p>Data subjects have the right to access data, rectify, erase, restrict processing, data portability, object, withdraw consent and lodge a complaint with the President of the Personal Data Protection Office.</p>
      <p>For data of customers or employees entered by the User, requests may require the participation of the User as the controller of that data.</p>
      <h2>13. Automated processing</h2>
      <p>Data may be processed automatically for operation of the Service, reports, notifications, activity history and settings, but will not be profiled in a way that produces legal or similarly significant effects unless separately communicated and legally justified.</p>
      <h2>14. Changes to the Policy</h2>
      <p>The Privacy Policy may be updated. Users will be informed about significant changes in the Service or by electronic means.</p>
      <p><a href="register.html">Back to registration</a></p>
    `,
    'informacja-o-przetwarzaniu-danych.html': `
      <h1>Information on personal data processing</h1>
      <p class="meta">CompanyManager — production version v1.0. The Operator details must be completed before publication.</p>
      <p>The controller of personal data of CompanyManager users is [OPERATOR NAME], [ADDRESS], Tax ID [NIP], REGON [REGON]. Contact: [EMAIL].</p>
      <p>Personal data is processed in accordance with the GDPR, the Act on providing electronic services, personal data protection laws and other applicable Polish and European Union laws.</p>
      <p>The legal basis for processing is in particular: conclusion and performance of the electronic services agreement, actions before conclusion of the agreement, legal obligations of the Operator, legitimate interest of the Operator and consent of the data subject where required.</p>
      <p>Personal data is processed for registration of the account, operation of the Service, contact with the User, settlements, complaint handling, security, abuse prevention, technical logs, support requests and establishment, pursuit or defence of claims.</p>
      <p>Data may also be processed for direct marketing of the Operator's own services where permitted by law or where the User has given consent. Electronic marketing communication is conducted only in accordance with applicable law.</p>
      <p>The scope of data may include in particular: name and surname, e-mail address, phone number, company details, address details, Tax ID/VAT EU, invoice data, IP address, security logs, session identifiers, employee, customer, service, product, booking, notification, report, setting and settlement data.</p>
      <p>Providing data is voluntary but necessary to create an account and use the Service where identification, company service or settlements are required.</p>
      <p>Data will be stored for the period of using the Service and after cooperation ends for the period required by law or necessary for claims, settlements, complaints, security and abuse prevention.</p>
      <p>The User has the right to access data, rectify, erase, restrict processing, data portability, object and withdraw consent where processing is based on consent.</p>
      <p>Data may be entrusted or disclosed to entities supporting the Service, in particular hosting, database, IT infrastructure, security, accounting, payment, e-mail, SMS, technical support, legal support providers and entities authorised by law.</p>
      <p>For data of customers, employees and other persons entered by the User into the Service, the User remains the controller and the Operator acts as processor on behalf of the User unless otherwise agreed.</p>
      <p>The User, as controller of data of its customers and employees, is responsible for legal bases, information obligations, marketing consents, data accuracy and the content of SMS and e-mail messages sent through the Service.</p>
      <p>Data of each Company is logically separated from data of other Companies. Access to data depends on the role and permissions granted in the Service.</p>
      <p>As a rule, data is not transferred outside the European Economic Area unless necessary for the Service or technology providers and with safeguards required by the GDPR.</p>
      <p>Data may be processed automatically for Service operation, notifications, reports, activity history and settings, but will not be profiled in a way producing legal or similarly significant effects unless separately communicated.</p>
      <p>The User has the right to lodge a complaint with the President of the Personal Data Protection Office if they believe that processing violates data protection law.</p>
      <p>For personal data matters, contact the Operator at: [EMAIL].</p>
      <p><a href="register.html">Back to registration</a></p>
    `
  };

  function applyLegalPage(lang) {
    const file = location.pathname.split('/').pop() || 'login.html';
    const article = document.querySelector('.doc-card');
    if (!article) return;
    if (!article.dataset.originalHtml) article.dataset.originalHtml = article.innerHTML;
    if (lang === 'en-gb' && LEGAL_EN[file]) article.innerHTML = LEGAL_EN[file];
    if (lang === 'pl') article.innerHTML = article.dataset.originalHtml;
  }

  function renderPickers(lang) {
    document.querySelectorAll('[data-public-language-picker]').forEach((picker) => {
      const current = picker.querySelector('.cm-language-current');
      const menu = picker.querySelector('.cm-language-menu');
      if (!current || !menu) return;
      current.textContent = LANG_LABELS[lang] || 'PL';
      current.setAttribute('aria-label', lang === 'en-gb' ? 'Choose language' : 'Wybierz język');
      menu.innerHTML = LANG_ORDER.filter((item) => item !== lang).map((item) => `<button type="button" data-lang="${item}" aria-label="${LANG_NAMES[item]}">${LANG_LABELS[item]}</button>`).join('');
    });
  }

  function closeMenus() {
    document.querySelectorAll('[data-public-language-picker]').forEach((picker) => {
      const menu = picker.querySelector('.cm-language-menu');
      const current = picker.querySelector('.cm-language-current');
      if (menu) menu.hidden = true;
      if (current) current.setAttribute('aria-expanded', 'false');
    });
  }

  function applyLanguage(lang) {
    const normalized = setGlobalLanguage(lang);
    document.documentElement.lang = normalized === 'en-gb' ? 'en-GB' : 'pl';
    applyLegalPage(normalized);
    if (normalized === 'en-gb') translateDom(document.body);
    renderPickers(normalized);
    return normalized;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const lang = currentLanguage();
    applyLanguage(lang);

    document.querySelectorAll('[data-public-language-picker]').forEach((picker) => {
      const current = picker.querySelector('.cm-language-current');
      const menu = picker.querySelector('.cm-language-menu');
      if (!current || !menu) return;
      current.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        renderPickers(currentLanguage());
        const shouldOpen = menu.hidden;
        closeMenus();
        menu.hidden = !shouldOpen;
        current.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      });
      menu.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-lang]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const nextLang = setGlobalLanguage(btn.getAttribute('data-lang'));
        // Reload to restore Polish source HTML cleanly or apply English from a clean page.
        const url = new URL(window.location.href);
        url.searchParams.set('lang', nextLang === 'en-gb' ? 'eng' : 'pl');
        window.location.href = url.toString();
      });
    });
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenus(); });
  });
})();
