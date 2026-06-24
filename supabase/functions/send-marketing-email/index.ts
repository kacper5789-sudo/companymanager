// CompanyManager — send-marketing-email Edge Function
// Wysyła kampanie EMAIL przez Resend. Wymaga sekretu RESEND_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "no-reply@companymanager.com.pl";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripTags(value: string) {
  return String(value || "").replace(/<[^>]*>/g, "");
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

function senderName(value: unknown) {
  const raw = String(value || "CompanyManager")
    .replace(/[<>"';\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return raw || "CompanyManager";
}

function renderPlainTextAsHtml(text: string) {
  const safe = escapeHtml(text || "");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap">${safe}</div>`;
}

function applyVariables(text: string, data: Record<string, unknown>) {
  const replacements: Record<string, string> = {
    "{klient}": String(data.recipient_name || "Kliencie"),
    "{firma}": String(data.company_name || ""),
  };
  let output = String(text || "");
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(key).join(value);
  }
  return output;
}

async function sendWithResend(input: {
  to: string;
  fromName: string;
  subject: string;
  body: string;
  companyName?: string;
}) {
  const from = `${senderName(input.fromName)} <${FROM_EMAIL}>`;
  const text = stripTags(input.body);
  const html = input.body.includes("<") ? input.body : renderPlainTextAsHtml(input.body);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend HTTP ${response.status}`);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!RESEND_API_KEY) return jsonResponse({ error: "Missing RESEND_API_KEY secret" }, 500);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return jsonResponse({ error: "Missing Supabase Edge environment" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const body = await req.json().catch(() => ({}));
  const campaignId = String(body?.campaign_id || "").trim();
  const mode = String(body?.mode || "campaign").trim();
  if (!campaignId) return jsonResponse({ error: "Missing campaign_id" }, 400);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: campaign, error: campaignError } = await supabase
    .from("marketing_campaigns")
    .select("id, company_id, channel, sender_name, subject, body, status, recipient_count")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) return jsonResponse({ error: campaignError?.message || "Campaign not found" }, 404);
  if (String(campaign.channel).toLowerCase() !== "email") return jsonResponse({ error: "Only email campaigns are supported in this function" }, 400);

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, company_email, contact_email")
    .eq("id", campaign.company_id)
    .maybeSingle();

  const allowedStatuses = mode === "test" ? ["test"] : ["ready", "pending"];
  const { data: recipients, error: recipientsError } = await supabase
    .from("marketing_campaign_recipients")
    .select("id, recipient_name, email, status")
    .eq("campaign_id", campaignId)
    .eq("channel", "email")
    .in("status", allowedStatuses)
    .limit(50);

  if (recipientsError) return jsonResponse({ error: recipientsError.message }, 500);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ recipient_id: string; email?: string; error: string }> = [];

  for (const recipient of recipients || []) {
    const to = String(recipient.email || "").trim();
    if (!to || !to.includes("@")) {
      skipped += 1;
      await supabase
        .from("marketing_campaign_recipients")
        .update({ status: "skipped", error_message: "Brak poprawnego adresu email" })
        .eq("id", recipient.id);
      continue;
    }

    const data = {
      recipient_name: recipient.recipient_name,
      company_name: company?.name || "",
    };
    const subject = applyVariables(String(campaign.subject || "Wiadomość"), data).slice(0, 120);
    const mailBody = applyVariables(String(campaign.body || ""), data);

    try {
      const resendResult = await sendWithResend({
        to,
        fromName: campaign.sender_name || company?.name || "CompanyManager",
        subject,
        body: mailBody,
        companyName: company?.name || "",
      });
      sent += 1;
      await supabase
        .from("marketing_campaign_recipients")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: resendResult?.id || null,
          error_message: null,
        })
        .eq("id", recipient.id);
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      errors.push({ recipient_id: recipient.id, email: to, error: msg });
      await supabase
        .from("marketing_campaign_recipients")
        .update({ status: "failed", error_message: msg })
        .eq("id", recipient.id);
    }
  }

  const finalStatus = failed > 0 ? "ready_to_send" : "sent";
  await supabase
    .from("marketing_campaigns")
    .update({
      status: mode === "test" ? "test" : finalStatus,
      sent_at: mode === "test" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return jsonResponse({
    campaign_id: campaignId,
    processed: (recipients || []).length,
    sent,
    failed,
    skipped,
    errors: errors.slice(0, 10),
  });
});
