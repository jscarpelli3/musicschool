import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioStatusCallbackUrl, validateTwilioFormRequest } from "@/lib/twilio/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    return Response.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const params = Object.fromEntries(form.entries());
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const callbackUrl = getTwilioStatusCallbackUrl();

  if (!validateTwilioFormRequest({ signature, url: callbackUrl, params })) {
    return Response.json({ error: "Invalid Twilio signature." }, { status: 400 });
  }

  const messageSid = form.get("MessageSid") ?? form.get("SmsSid") ?? "";
  const messageStatus = form.get("MessageStatus") ?? form.get("SmsStatus") ?? "";
  const accountSid = form.get("AccountSid") ?? "";
  if (accountSid !== process.env.TWILIO_ACCOUNT_SID?.trim()) {
    return Response.json({ error: "Unexpected Twilio account." }, { status: 400 });
  }
  if (!/^SM[0-9a-fA-F]{32}$/.test(messageSid) || !messageStatus) {
    return Response.json({ error: "Invalid delivery event." }, { status: 400 });
  }

  const fingerprint = createHash("sha256").update(rawBody).digest("hex");
  const { error } = await createAdminClient().rpc("record_twilio_delivery_status", {
    p_event_fingerprint: fingerprint,
    p_provider_error_code: form.get("ErrorCode") ?? "",
    p_provider_message_sid: messageSid,
    p_provider_status: messageStatus,
  });
  if (error) {
    console.error("Twilio delivery callback could not be recorded", { code: error.code });
    return Response.json({ error: "Delivery event intake failed." }, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
