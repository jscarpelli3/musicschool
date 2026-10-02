import "server-only";

import { emailDeliveryPolicy } from "@/lib/resend/email-security";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export class ResendRequestError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
    this.name = "ResendRequestError";
  }
}

export class ResendUnknownOutcomeError extends Error {
  constructor(message = "Resend did not answer before the request deadline; provider acceptance is unknown.") {
    super(message);
    this.name = "ResendUnknownOutcomeError";
  }
}

function apiKey() {
  const value = process.env.RESEND_API_KEY?.trim();
  if (!value) throw new Error("Missing required server environment variable: RESEND_API_KEY");
  return value;
}

export async function sendResendEmail(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
  messageKind?: string;
  timeoutMs?: number;
}) {
  const from = input.from.replace(/[\r\n]/g, " ").replace(/\s+/g, " ").trim();
  const subject = input.subject.replace(/[\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 998);
  const recipient = input.to.trim().toLowerCase();
  const replyTo = input.replyTo?.trim().toLowerCase();
  const policy = emailDeliveryPolicy();
  if (!/^[^<>\r\n]+ <notifications@notifications\.commontime\.studio>$/.test(from)) throw new Error("Email sender must use the authenticated Common Time notification domain.");
  if (!subject) throw new Error("Email subject is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient) || recipient.length > 320) throw new Error("Email recipient is invalid.");
  if (policy.allowedRecipients && !policy.allowedRecipients.has(recipient)) throw new Error("Email recipient is not permitted in this environment.");
  if (replyTo && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo) || replyTo.length > 320)) throw new Error("Email reply address is invalid.");
  if (!input.text.includes(policy.safetySentence) || !input.html.includes(policy.safetySentence)) throw new Error("Transactional email is missing the environment safety notice.");
  const urls = [...input.text.matchAll(/https?:\/\/[^\s<>"']+/g), ...input.html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)]
    .map((match) => match[1] ?? match[0]);
  if (urls.some((url) => {
    try { return !policy.allowedOrigins.has(new URL(url).origin); }
    catch { return true; }
  })) throw new Error("Transactional email contains a link outside the canonical application origin.");
  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        reply_to: replyTo,
        html: input.html,
        text: input.text,
        tags: [{ name: "message_kind", value: input.messageKind ?? "billing_approval" }],
      }),
      signal: input.timeoutMs ? AbortSignal.timeout(input.timeoutMs) : undefined,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "TimeoutError") throw new ResendUnknownOutcomeError();
    throw caught;
  }

  const result = await response.json().catch(() => null) as { id?: string; name?: string; message?: string } | null;
  if (!response.ok || !result?.id) {
    throw new ResendRequestError(result?.message ?? "Resend did not accept the email.", result?.name, response.status);
  }
  return { id: result.id };
}
