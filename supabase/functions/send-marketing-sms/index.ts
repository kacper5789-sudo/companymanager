// CompanyManager — send-marketing-sms Edge Function
// Ręczna wysyłka kampanii SMS przez wybranego providera.
// Domyślnie: SMSPLANET. Secrets: SMS_PROVIDER=smsplanet, SMS_PROVIDER_TOKEN. Opcjonalnie: SMS_PROVIDER_URL, SMS_DRY_RUN=true, SMS_CLEAR_POLISH=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
const SMS_PROVIDER = String(Deno.env.get("SMS_PROVIDER") || "smsplanet").toLowerCase();
const SMS_PROVIDER_TOKEN = Deno.env.get("SMS_PROVIDER_TOKEN") || "";
const SMS_PROVIDER_URL = Deno.env.get("SMS_PROVIDER_URL") || Deno.env.get("SMSPLANET_URL") || "https://api2.smsplanet.pl/sms";
const SMS_FALLBACK_FROM = Deno.env.get("SMS_FALLBACK_FROM") || "";
const SMS_CLEAR_POLISH = !["0", "false", "no", "nie"].includes(String(Deno.env.get("SMS_CLEAR_POLISH") || "true").toLowerCase());
const SMS_FORCE_LIVE = ["1", "true", "yes", "tak"].includes(String(Deno.env.get("SMS_FORCE_LIVE") || "").toLowerCase());
const SMS_DRY_RUN = !SMS_FORCE_LIVE && ["1", "true", "yes", "tak"].includes(String(Deno.env.get("SMS_DRY_RUN") || "").trim().toLowerCase());

type AnyRow = Record<string, any>;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeSmsSender(value: unknown, fallback = "") {
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

async function sendSms(input: { to: string; from: string; message: string }) {
  const to = normalizePhone(input.to);
  if (!isValidPhone(to)) throw new Error("Niepoprawny numer telefonu");
  const from = normalizeSmsSender(input.from, SMS_FALLBACK_FROM);
  const message = normalizeText(input.message).slice(0, 918);
  if (!message) throw new Error("Pusta treść SMS");

  if (SMS_DRY_RUN) {
    console.log("SMS dry run active", { provider: SMS_PROVIDER, to, from, forceLive: SMS_FORCE_LIVE });
    return { dry_run: true, messageId: `dry_${Date.now()}`, to, from, provider: SMS_PROVIDER, points: 0 };
  }
  console.log("SMS live send active", { provider: SMS_PROVIDER, to, from, forceLive: SMS_FORCE_LIVE });
  if (!SMS_PROVIDER_TOKEN) throw new Error("Missing SMS_PROVIDER_TOKEN secret");
  if (SMS_PROVIDER !== "smsplanet") throw new Error(`Unsupported SMS_PROVIDER: ${SMS_PROVIDER}`);
  if (!from) throw new Error("Brak nadawcy SMS. Ustaw nadawcę w Panelu firmy i zatwierdź go u operatora SMSPLANET.");

  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to.replace(/^\+/, ""));
  body.set("msg", message);
  if (SMS_CLEAR_POLISH) body.set("clear_polish", "1");

  const response = await fetch(SMS_PROVIDER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SMS_PROVIDER_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
  if (!response.ok || payload?.errorMsg || payload?.errorCode) {
    throw new Error(payload?.errorMsg || payload?.message || payload?.error || `SMSPLANET HTTP ${response.status}`);
  }
  return payload;
}

async function updateRecipient(supabase: any, id: string, payload: AnyRow) {
  const { error } = await supabase
    .from("marketing_campaign_recipients")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("recipient update failed", error.message);
}

async function logNotification(supabase: any, row: AnyRow) {
  const { error } = await supabase.from("notification_logs").insert({
    company_id: row.company_id,
    client_id: row.client_id || null,
    channel: "sms",
    type: row.type || "marketing",
    recipient: row.recipient || null,
    recipient_name: row.recipient_name || null,
    sender_name: row.sender_name || null,
    content: row.content || null,
    status: row.status || "pending",
    provider: SMS_DRY_RUN ? `${SMS_PROVIDER}_dry_run` : SMS_PROVIDER,
    provider_message_id: row.provider_message_id || null,
    error_message: row.error_message || null,
    dedupe_key: row.dedupe_key || null,
    sent_at: row.sent_at || null,
    updated_at: new Date().toISOString(),
  });
  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    console.error("notification log insert failed", error.message);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    if (!SUPABASE_URL) return jsonResponse({ error: "Missing SUPABASE_URL" }, 500);
    if (!SERVICE_ROLE_KEY) return jsonResponse({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const campaignId = normalizeText(body.campaign_id);
    const mode = normalizeText(body.mode, "campaign");
    if (!campaignId) return jsonResponse({ error: "Missing campaign_id" }, 400);

    const { data: campaign, error: campaignError } = await supabase
      .from("marketing_campaigns")
      .select("id,company_id,channel,sender_name,body,status,test_recipient")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignError) return jsonResponse({ error: campaignError.message, stage: "campaign_query" }, 500);
    if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);
    if (String(campaign.channel || "").toLowerCase() !== "sms") return jsonResponse({ error: "Campaign is not SMS" }, 400);

    const { data: recipients, error: recipientsError } = await supabase
      .from("marketing_campaign_recipients")
      .select("id,company_id,campaign_id,client_id,recipient_name,phone,status")
      .eq("campaign_id", campaignId)
      .eq("channel", "sms")
      .in("status", mode === "test" ? ["test"] : ["ready", "pending"])
      .limit(1000);
    if (recipientsError) return jsonResponse({ error: recipientsError.message, stage: "recipients_query" }, 500);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const recipient of recipients || []) {
      const phone = normalizePhone(recipient.phone);
      const dedupeKey = `sms:marketing:${campaign.id}:${recipient.id}`;
      if (!isValidPhone(phone)) {
        skipped += 1;
        await updateRecipient(supabase, recipient.id, { status: "skipped", error_message: "Brak poprawnego numeru telefonu" });
        await logNotification(supabase, { company_id: campaign.company_id, client_id: recipient.client_id, recipient: recipient.phone, recipient_name: recipient.recipient_name, sender_name: campaign.sender_name, content: campaign.body, status: "skipped", error_message: "Brak poprawnego numeru telefonu", dedupe_key: dedupeKey });
        continue;
      }
      try {
        const result = await sendSms({ to: phone, from: campaign.sender_name, message: campaign.body });
        const providerId = result?.messageId || result?.list?.[0]?.id || result?.id || result?.message_id || null;
        sent += 1;
        await updateRecipient(supabase, recipient.id, { status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId, error_message: null });
        await logNotification(supabase, { company_id: campaign.company_id, client_id: recipient.client_id, recipient: phone, recipient_name: recipient.recipient_name, sender_name: campaign.sender_name, content: campaign.body, status: "sent", provider_message_id: providerId, dedupe_key: dedupeKey, sent_at: new Date().toISOString() });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failed += 1;
        await updateRecipient(supabase, recipient.id, { status: "failed", error_message: msg });
        await logNotification(supabase, { company_id: campaign.company_id, client_id: recipient.client_id, recipient: phone, recipient_name: recipient.recipient_name, sender_name: campaign.sender_name, content: campaign.body, status: "failed", error_message: msg, dedupe_key: dedupeKey });
      }
    }

    const nextStatus = failed > 0 && sent === 0 ? "ready_to_send" : "sent";
    await supabase.from("marketing_campaigns").update({ status: nextStatus, sent_at: sent > 0 ? new Date().toISOString() : null, updated_at: new Date().toISOString(), last_error: failed > 0 ? `${failed} błędów wysyłki SMS` : null }).eq("id", campaignId);

    return jsonResponse({ ok: true, provider: SMS_DRY_RUN ? `${SMS_PROVIDER}_dry_run` : SMS_PROVIDER, dryRun: SMS_DRY_RUN, forceLive: SMS_FORCE_LIVE, sent, failed, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("send-marketing-sms fatal error", { message, stack });
    return jsonResponse({ ok: false, error: message, stack: stack ? String(stack).slice(0, 1500) : null }, 500);
  }
});
