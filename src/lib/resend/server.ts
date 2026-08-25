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
  idempotencyKey: string;
  messageKind?: string;
  timeoutMs?: number;
}) {
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
        from: input.from,
        to: [input.to],
        subject: input.subject,
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
