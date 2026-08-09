import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTwilioIncomingWebhookUrl,
  getTwilioMessagingServiceSid,
  validateTwilioFormRequest,
} from "@/lib/twilio/server";

export const runtime = "nodejs";

const stopKeywords = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const startKeywords = new Set(["START", "UNSTOP"]);
const helpKeywords = new Set(["HELP", "INFO"]);

function emptyTwiml() {
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function classify(form: URLSearchParams) {
  const providerType = form.get("OptOutType")?.trim().toUpperCase();
  if (providerType === "STOP") return "opted_out";
  if (providerType === "START") return "opted_in";
  if (providerType === "HELP") return "help_requested";

  const body = form.get("Body")?.trim().toUpperCase() ?? "";
  if (stopKeywords.has(body)) return "opted_out";
  if (startKeywords.has(body)) return "opted_in";
  if (helpKeywords.has(body)) return "help_requested";
  return null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    return Response.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!validateTwilioFormRequest({
    signature,
    url: getTwilioIncomingWebhookUrl(),
    params: Object.fromEntries(form.entries()),
  })) {
    return Response.json({ error: "Invalid Twilio signature." }, { status: 400 });
  }

  if (form.get("AccountSid") !== process.env.TWILIO_ACCOUNT_SID?.trim()
    || form.get("MessagingServiceSid") !== getTwilioMessagingServiceSid()) {
    return Response.json({ error: "Unexpected Twilio account or messaging service." }, { status: 400 });
  }

  const eventType = classify(form);
  if (!eventType) return emptyTwiml();
  const messageSid = form.get("MessageSid") ?? form.get("SmsMessageSid") ?? "";
  const phone = form.get("From") ?? "";
  if (!/^SM[0-9a-fA-F]{32}$/.test(messageSid) || !/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    return Response.json({ error: "Invalid inbound message event." }, { status: 400 });
  }

  const { error } = await createAdminClient().rpc("record_twilio_sms_consent_event", {
    p_event_fingerprint: createHash("sha256").update(rawBody).digest("hex"),
    p_event_type: eventType,
    p_messaging_service_sid: getTwilioMessagingServiceSid(),
    p_phone_e164: phone,
    p_provider_message_sid: messageSid,
  });
  if (error) {
    console.error("Twilio consent keyword could not be recorded", { code: error.code });
    return Response.json({ error: "Inbound message intake failed." }, { status: 500 });
  }

  // Twilio Advanced Opt-Out owns the compliant STOP/START/HELP reply. Sending
  // another response here would duplicate it, so acknowledge with empty TwiML.
  return emptyTwiml();
}
