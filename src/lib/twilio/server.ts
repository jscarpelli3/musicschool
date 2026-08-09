import "server-only";

import twilio from "twilio";

type TwilioMessage = {
  sid: string;
  status: string;
  error_code?: number | null;
  error_message?: string | null;
};

export class TwilioRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "TwilioRequestError";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function getTwilioMessagingServiceSid() {
  const sid = requiredEnvironment("TWILIO_MESSAGING_SERVICE_SID");
  if (!/^MG[0-9a-fA-F]{32}$/.test(sid)) throw new Error("TWILIO_MESSAGING_SERVICE_SID is invalid.");
  return sid;
}

export function getTwilioStatusCallbackUrl() {
  const origin = new URL(requiredEnvironment("APP_URL"));
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS outside local development.");
  }
  return new URL("/api/twilio/status", origin).toString();
}

export function validateTwilioFormRequest(input: {
  signature: string;
  url: string;
  params: Record<string, string>;
}) {
  if (!input.signature) return false;
  return twilio.validateRequest(
    requiredEnvironment("TWILIO_AUTH_TOKEN"),
    input.signature,
    input.url,
    input.params,
  );
}

export async function sendTwilioMessage(input: { to: string; body: string }) {
  const accountSid = requiredEnvironment("TWILIO_ACCOUNT_SID");
  const apiKeySid = requiredEnvironment("TWILIO_API_KEY_SID");
  const apiKeySecret = requiredEnvironment("TWILIO_API_KEY_SECRET");
  const messagingServiceSid = getTwilioMessagingServiceSid();

  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) throw new Error("TWILIO_ACCOUNT_SID is invalid.");
  if (!/^SK[0-9a-fA-F]{32}$/.test(apiKeySid)) throw new Error("TWILIO_API_KEY_SID is invalid.");
  if (!/^\+[1-9][0-9]{7,14}$/.test(input.to)) throw new Error("SMS recipient must use E.164 format.");

  const form = new URLSearchParams({
    To: input.to,
    Body: input.body,
    MessagingServiceSid: messagingServiceSid,
    StatusCallback: getTwilioStatusCallbackUrl(),
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  const payload = await response.json() as Partial<TwilioMessage> & { message?: string; code?: number };

  if (!response.ok || !payload.sid || !payload.status) {
    throw new TwilioRequestError(
      payload.message || "Twilio rejected the message request.",
      response.status,
      payload.code == null ? null : String(payload.code),
    );
  }

  return {
    sid: payload.sid,
    status: payload.status,
    errorCode: payload.error_code == null ? null : String(payload.error_code),
    errorMessage: payload.error_message ?? null,
  };
}
