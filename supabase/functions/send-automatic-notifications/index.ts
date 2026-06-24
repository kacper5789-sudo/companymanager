// CompanyManager — send-automatic-notifications Edge Function
// Automatyczne EMAIL/SMS: 24h przed wizytą, po dodaniu wizyty, po zakończeniu wizyty, urodziny.
// EMAIL przez Resend, SMS przez SMSAPI. Secrets: RESEND_API_KEY, SMSAPI_TOKEN, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "no-reply@companymanager.com.pl";
const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN") || "";
const SMSAPI_URL = Deno.env.get("SMSAPI_URL") || "https://api.smsapi.pl/sms.do";
const SMSAPI_FROM = Deno.env.get("SMSAPI_FROM") || "";
const SMS_DRY_RUN = ["1", "true", "yes", "tak"].includes(String(Deno.env.get("SMS_DRY_RUN") || "").toLowerCase());
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CRON_SECRET = Deno.env.get("AUTOMATION_CRON_SECRET") || "";

type AnyRow = Record<string, any>;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function sanitizeSender(value: unknown, fallback = "CompanyManager") {
  const raw = normalizeText(value, fallback)
    .replace(/[<>"';\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return raw || fallback;
}

function stripTags(value: string) {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function sanitizeSmsSender(value: unknown, fallback = "") {
  const raw = normalizeText(value, fallback)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 11);
  return raw || normalizeText(fallback).replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
}

function normalizePhone(value: unknown) {
  let phone = normalizeText(value).replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (/^\d{9}$/.test(phone)) phone = "+48" + phone;
  return phone;
}

function isValidPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[c] || c));
}

function renderPlainTextAsHtml(text: string) {
  const safe = escapeHtml(text || "");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap">${safe}</div>`;
}

function formatDate(dateValue: unknown) {
  const raw = normalizeText(dateValue);
  if (!raw) return "";
  const [y, m, d] = raw.slice(0, 10).split("-");
  if (y && m && d) return `${d}.${m}.${y}`;
  return raw;
}

function formatTime(timeValue: unknown) {
  const raw = normalizeText(timeValue);
  if (!raw) return "";
  return raw.slice(0, 5);
}

function clientName(client: AnyRow | null | undefined) {
  return normalizeText(client?.full_name) || normalizeText(client?.name) || normalizeText(client?.email) || "Kliencie";
}

function employeeName(employee: AnyRow | null | undefined) {
  return normalizeText(employee?.full_name) || normalizeText(employee?.name) || normalizeText(employee?.email) || "";
}

function applyVariables(template: string, data: Record<string, unknown>) {
  const map: Record<string, string> = {
    "{klient}": normalizeText(data.client_name, "Kliencie"),
    "{firma}": normalizeText(data.company_name),
    "{data}": normalizeText(data.date),
    "{godzina}": normalizeText(data.time),
    "{pracownik}": normalizeText(data.employee_name),
    "{usługa}": normalizeText(data.service_name),
    "{usluga}": normalizeText(data.service_name),
  };
  let out = String(template || "");
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(value);
  return out;
}

async function sendWithResend(input: { to: string; fromName: string; subject: string; body: string }) {
  const from = `${sanitizeSender(input.fromName)} <${FROM_EMAIL}>`;
  const text = stripTags(input.body || "");
  const html = (input.body || "").includes("<") ? input.body : renderPlainTextAsHtml(input.body || "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject || "Wiadomość",
      html,
      text,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Resend HTTP ${response.status}`);
  return payload;
}

async function sendWithSmsApi(input: { to: string; fromName: string; body: string }) {
  const to = normalizePhone(input.to);
  if (!isValidPhone(to)) throw new Error("Niepoprawny numer telefonu");
  const from = sanitizeSmsSender(input.fromName, SMSAPI_FROM);
  const message = normalizeText(input.body).slice(0, 918);
  if (!message) throw new Error("Pusta treść SMS");
  if (SMS_DRY_RUN) return { dry_run: true, id: `dry_${Date.now()}`, to, from };
  if (!SMSAPI_TOKEN) throw new Error("Missing SMSAPI_TOKEN secret");

  const body = new URLSearchParams();
  body.set("to", to.replace(/^\+/, ""));
  body.set("message", message);
  body.set("format", "json");
  if (from) body.set("from", from);

  const response = await fetch(SMSAPI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SMSAPI_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
  if (!response.ok || payload?.error) throw new Error(payload?.message || payload?.error || `SMSAPI HTTP ${response.status}`);
  return payload;
}

async function logNotification(supabase: any, row: AnyRow) {
  const payload = {
    company_id: row.company_id,
    client_id: row.client_id || null,
    appointment_id: row.appointment_id || null,
    visit_id: row.visit_id || row.appointment_id || null,
    channel: row.channel || "email",
    type: row.type,
    recipient: row.recipient || null,
    recipient_name: row.recipient_name || null,
    sender_name: row.sender_name || null,
    subject: row.subject || null,
    content: row.content || null,
    status: row.status || "pending",
    provider: row.provider || "resend",
    provider_message_id: row.provider_message_id || null,
    error_message: row.error_message || null,
    dedupe_key: row.dedupe_key || null,
    sent_at: row.sent_at || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("notification_logs").insert(payload);
  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    console.error("notification log insert failed", error.message);
  }
}

async function alreadyLogged(supabase: any, dedupeKey: string) {
  const { data, error } = await supabase
    .from("notification_logs")
    .select("id,status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

function getEmailSettings(company: AnyRow, type: string) {
  if (type === "visit_24") {
    return {
      enabled: !!company.visit_email_24,
      sender: company.visit_email_sender || company.name || "CompanyManager",
      subject: company.visit_email_subject || "Przypomnienie o wizycie",
      body: company.visit_email_template || "Cześć {klient},\nprzypominamy o wizycie {data} o {godzina}.\n{firma}",
    };
  }
  if (type === "after_add") {
    return {
      enabled: !!company.after_add_email,
      sender: company.after_add_email_sender || company.name || "CompanyManager",
      subject: company.after_add_email_subject || "Potwierdzenie rezerwacji",
      body: company.after_add_email_template || "Cześć {klient},\nTwoja wizyta została zapisana na {data} o {godzina}.\n{firma}",
    };
  }
  if (type === "after_visit") {
    return {
      enabled: !!company.after_visit_email,
      sender: company.after_visit_email_sender || company.name || "CompanyManager",
      subject: company.after_visit_email_subject || "Dziękujemy za wizytę",
      body: company.after_visit_email_template || "Cześć {klient},\ndziękujemy za wizytę.\n{firma}",
    };
  }
  return {
    enabled: !!company.birthday_email,
    sender: company.birthday_email_sender || company.name || "CompanyManager",
    subject: company.birthday_email_subject || "Wszystkiego najlepszego",
    body: company.birthday_email_template || "Cześć {klient},\nżyczymy wszystkiego najlepszego!\n{firma}",
  };
}


function getSmsSettings(company: AnyRow, type: string) {
  if (type === "visit_24") {
    return {
      enabled: !!company.visit_sms_24,
      sender: company.visit_sms_sender || company.sms_sender || company.message_sender || SMSAPI_FROM || "",
      body: company.visit_sms_template || "Cześć {klient}, przypominamy o wizycie {data} o {godzina}. {firma}",
    };
  }
  if (type === "after_add") {
    return {
      enabled: !!company.after_add_sms,
      sender: company.after_add_sms_sender || company.sms_sender || company.message_sender || SMSAPI_FROM || "",
      body: company.after_add_sms_template || "Cześć {klient}, Twoja wizyta została zapisana na {data} o {godzina}. {firma}",
    };
  }
  if (type === "after_visit") {
    return {
      enabled: !!company.after_visit_sms,
      sender: company.after_visit_sms_sender || company.sms_sender || company.message_sender || SMSAPI_FROM || "",
      body: company.after_visit_sms_template || "Cześć {klient}, dziękujemy za wizytę. {firma}",
    };
  }
  return {
    enabled: !!company.birthday_sms,
    sender: company.birthday_sms_sender || company.sms_sender || company.message_sender || SMSAPI_FROM || "",
    body: company.birthday_sms_template || "Cześć {klient}, życzymy wszystkiego najlepszego! {firma}",
  };
}

async function sendAutomaticEmail(supabase: any, company: AnyRow, client: AnyRow, appointment: AnyRow | null, type: string, dedupeKey: string, extra: AnyRow = {}) {
  if (await alreadyLogged(supabase, dedupeKey)) return { skipped: true, reason: "duplicate" };

  const settings = getEmailSettings(company, type);
  if (!settings.enabled) return { skipped: true, reason: "disabled" };

  const to = normalizeText(client?.email);
  if (!to || !to.includes("@")) {
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "email",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      subject: settings.subject,
      content: settings.body,
      status: "skipped",
      error_message: "Brak poprawnego adresu email",
      dedupe_key: dedupeKey,
    });
    return { skipped: true, reason: "missing_email" };
  }

  const variables = {
    client_name: clientName(client),
    company_name: company.name || "",
    date: formatDate(appointment?.date || appointment?.starts_at || extra.date),
    time: formatTime(appointment?.time || appointment?.start_time || appointment?.starts_at || extra.time),
    employee_name: employeeName(extra.employee),
    service_name: normalizeText(extra.service?.name || appointment?.service_name),
  };
  const subject = applyVariables(settings.subject, variables).slice(0, 120);
  const content = applyVariables(settings.body, variables);

  try {
    const result = await sendWithResend({ to, fromName: settings.sender, subject, body: content });
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "email",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      subject,
      content,
      status: "sent",
      provider_message_id: result?.id || null,
      dedupe_key: dedupeKey,
      sent_at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "email",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      subject,
      content,
      status: "failed",
      error_message: msg,
      dedupe_key: dedupeKey,
    });
    return { failed: true, error: msg };
  }
}


async function sendAutomaticSms(supabase: any, company: AnyRow, client: AnyRow, appointment: AnyRow | null, type: string, dedupeKey: string, extra: AnyRow = {}) {
  if (await alreadyLogged(supabase, dedupeKey)) return { skipped: true, reason: "duplicate" };

  const settings = getSmsSettings(company, type);
  if (!settings.enabled) return { skipped: true, reason: "disabled" };

  const to = normalizePhone(client?.phone || client?.phone_number || client?.mobile);
  if (!to || !isValidPhone(to)) {
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "sms",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      content: settings.body,
      status: "skipped",
      provider: SMS_DRY_RUN ? "smsapi_dry_run" : "smsapi",
      error_message: "Brak poprawnego numeru telefonu",
      dedupe_key: dedupeKey,
    });
    return { skipped: true, reason: "missing_phone" };
  }

  const variables = {
    client_name: clientName(client),
    company_name: company.name || "",
    date: formatDate(appointment?.date || appointment?.starts_at || extra.date),
    time: formatTime(appointment?.time || appointment?.start_time || appointment?.starts_at || extra.time),
    employee_name: employeeName(extra.employee),
    service_name: normalizeText(extra.service?.name || appointment?.service_name),
  };
  const content = applyVariables(settings.body, variables).slice(0, 918);

  try {
    const result = await sendWithSmsApi({ to, fromName: settings.sender, body: content });
    const providerId = result?.list?.[0]?.id || result?.id || result?.message_id || null;
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "sms",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      content,
      status: "sent",
      provider: SMS_DRY_RUN ? "smsapi_dry_run" : "smsapi",
      provider_message_id: providerId,
      dedupe_key: dedupeKey,
      sent_at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await logNotification(supabase, {
      company_id: company.id,
      client_id: client?.id,
      appointment_id: appointment?.id,
      channel: "sms",
      type,
      recipient: to,
      recipient_name: clientName(client),
      sender_name: settings.sender,
      content,
      status: "failed",
      provider: SMS_DRY_RUN ? "smsapi_dry_run" : "smsapi",
      error_message: msg,
      dedupe_key: dedupeKey,
    });
    return { failed: true, error: msg };
  }
}

async function fetchRelated(supabase: any, appointment: AnyRow) {
  const clientId = appointment.client_id || appointment.customer_id;
  const employeeId = appointment.employee_id;
  const serviceId = appointment.service_id;
  const [clientRes, employeeRes, serviceRes] = await Promise.all([
    clientId ? supabase.from("clients").select("id,full_name,name,email,phone,phone_number,mobile,marketing_email,marketing_sms,date_of_birth,birth_date,birthday,active,deleted_at").eq("id", clientId).maybeSingle() : Promise.resolve({ data: null }),
    employeeId ? supabase.from("employees").select("id,full_name,name,email").eq("id", employeeId).maybeSingle() : Promise.resolve({ data: null }),
    serviceId ? supabase.from("services").select("id,name").eq("id", serviceId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { client: clientRes.data, employee: employeeRes.data, service: serviceRes.data };
}

async function processAppointments(supabase: any, company: AnyRow, summary: AnyRow) {
  const now = new Date();
  const today = isoDate(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDate = isoDate(tomorrow);
  const recent = new Date(now.getTime() - 35 * 60 * 1000).toISOString();

  // 24h przed wizytą: wizyty z datą jutro.
  if (company.visit_email_24 || company.visit_sms_24) {
    const { data: rows } = await supabase
      .from("appointments")
      .select("id,company_id,client_id,customer_id,employee_id,service_id,date,time,start_time,status,active,deleted_at")
      .eq("company_id", company.id)
      .eq("date", tomorrowDate)
      .neq("deleted", true)
      .is("deleted_at", null)
      .limit(100);
    for (const appt of rows || []) {
      const status = normalizeText(appt.status).toLowerCase();
      if (["odwołane", "odwolane", "cancelled", "canceled", "deleted", "usunięte", "usuniete"].includes(status)) continue;
      const related = await fetchRelated(supabase, appt);
      if (!related.client) continue;
      if (company.visit_email_24) {
        const key = `email:visit_24:${appt.id}:${tomorrowDate}`;
        const r = await sendAutomaticEmail(supabase, company, related.client, appt, "visit_24", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
      if (company.visit_sms_24) {
        const key = `sms:visit_24:${appt.id}:${tomorrowDate}`;
        const r = await sendAutomaticSms(supabase, company, related.client, appt, "visit_24", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
    }
  }

  // Po dodaniu wizyty: tylko świeżo utworzone, żeby nie odpalić starych danych.
  if (company.after_add_email || company.after_add_sms) {
    const { data: rows } = await supabase
      .from("appointments")
      .select("id,company_id,client_id,customer_id,employee_id,service_id,date,time,start_time,status,created_at,active,deleted_at")
      .eq("company_id", company.id)
      .gte("created_at", recent)
      .neq("deleted", true)
      .is("deleted_at", null)
      .limit(100);
    for (const appt of rows || []) {
      const related = await fetchRelated(supabase, appt);
      if (!related.client) continue;
      if (company.after_add_email) {
        const key = `email:after_add:${appt.id}`;
        const r = await sendAutomaticEmail(supabase, company, related.client, appt, "after_add", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
      if (company.after_add_sms) {
        const key = `sms:after_add:${appt.id}`;
        const r = await sendAutomaticSms(supabase, company, related.client, appt, "after_add", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
    }
  }

  // Po wizycie: świeżo zaktualizowane i zakończone.
  if (company.after_visit_email || company.after_visit_sms) {
    const { data: rows } = await supabase
      .from("appointments")
      .select("id,company_id,client_id,customer_id,employee_id,service_id,date,time,start_time,status,updated_at,active,deleted_at")
      .eq("company_id", company.id)
      .gte("updated_at", recent)
      .neq("deleted", true)
      .is("deleted_at", null)
      .limit(100);
    for (const appt of rows || []) {
      const status = normalizeText(appt.status).toLowerCase();
      if (!["zakończone", "zakonczone", "completed", "done", "finished", "zrealizowane"].includes(status)) continue;
      const related = await fetchRelated(supabase, appt);
      if (!related.client) continue;
      if (company.after_visit_email) {
        const key = `email:after_visit:${appt.id}`;
        const r = await sendAutomaticEmail(supabase, company, related.client, appt, "after_visit", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
      if (company.after_visit_sms) {
        const key = `sms:after_visit:${appt.id}`;
        const r = await sendAutomaticSms(supabase, company, related.client, appt, "after_visit", key, related);
        if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
      }
    }
  }
}

async function processBirthdays(supabase: any, company: AnyRow, summary: AnyRow) {
  if (!company.birthday_email && !company.birthday_sms) return;
  const now = new Date();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const todayKey = isoDate(now);
  const { data: clients } = await supabase
    .from("clients")
    .select("id,company_id,full_name,name,email,phone,phone_number,mobile,marketing_email,marketing_sms,date_of_birth,birth_date,birthday,active,deleted_at")
    .eq("company_id", company.id)
    .is("deleted_at", null)
    .limit(500);

  for (const client of clients || []) {
    const bday = normalizeText(client.date_of_birth || client.birth_date || client.birthday);
    if (!bday || bday.length < 10) continue;
    if (bday.slice(5, 10) !== `${month}-${day}`) continue;
    if (company.birthday_email && client.marketing_email) {
      const key = `email:birthday:${client.id}:${todayKey}`;
      const r = await sendAutomaticEmail(supabase, company, client, null, "birthday", key, { date: todayKey });
      if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
    }
    if (company.birthday_sms && client.marketing_sms) {
      const key = `sms:birthday:${client.id}:${todayKey}`;
      const r = await sendAutomaticSms(supabase, company, client, null, "birthday", key, { date: todayKey });
      if (r.sent) summary.sent += 1; else if (r.failed) summary.failed += 1; else summary.skipped += 1;
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    // RESEND_API_KEY jest wymagany tylko dla aktywnych emaili. SMS używa SMSAPI_TOKEN.
    if (!SUPABASE_URL) return jsonResponse({ error: "Missing SUPABASE_URL environment" }, 500);

    if (CRON_SECRET) {
      const provided = req.headers.get("x-cron-secret") || "";
      if (provided !== CRON_SECRET) return jsonResponse({ error: "Unauthorized cron" }, 401);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const bearerKey = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    const dbKey = SERVICE_ROLE_KEY || bearerKey || ANON_KEY;

    if (!dbKey) {
      return jsonResponse({
        error: "Missing Supabase key",
        hint: "Dodaj SUPABASE_SERVICE_ROLE_KEY w Edge Function Secrets albo wywołuj cron z Authorization: Bearer <secret/service_role key>.",
      }, 500);
    }

    const supabase = createClient(SUPABASE_URL, dbKey, {
      global: { headers: { Authorization: `Bearer ${dbKey}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const companyFilter = normalizeText(body.company_id);

    const query = supabase
      .from("companies")
      .select("id,name,message_sender,sms_sender,visit_email_24,visit_email_sender,visit_email_subject,visit_email_template,birthday_email,birthday_email_sender,birthday_email_subject,birthday_email_template,after_add_email,after_add_email_sender,after_add_email_subject,after_add_email_template,after_visit_email,after_visit_email_sender,after_visit_email_subject,after_visit_email_template,visit_sms_24,visit_sms_sender,visit_sms_template,birthday_sms,birthday_sms_sender,birthday_sms_template,after_add_sms,after_add_sms_sender,after_add_sms_template,after_visit_sms,after_visit_sms_sender,after_visit_sms_template,active,deleted_at")
      .limit(200);

    const { data: companies, error: companyError } = companyFilter
      ? await query.eq("id", companyFilter)
      : await query;

    if (companyError) {
      console.error("companies query failed", companyError);
      return jsonResponse({ error: companyError.message, stage: "companies_query" }, 500);
    }

    const summary = {
      companies: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const company of companies || []) {
      if (company.deleted_at || company.active === false) continue;
      summary.companies += 1;
      await processAppointments(supabase, company, summary);
      await processBirthdays(supabase, company, summary);
    }

    return jsonResponse({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("send-automatic-notifications fatal error", { message, stack });
    return jsonResponse({
      ok: false,
      error: message,
      stack: stack ? String(stack).slice(0, 1500) : null,
    }, 500);
  }
});
