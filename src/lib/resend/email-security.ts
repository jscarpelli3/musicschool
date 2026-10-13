import "server-only";

import { CANONICAL_APP_ORIGIN, resolveEmailDeliveryPolicy } from "@/lib/resend/email-delivery-policy";

export { CANONICAL_APP_ORIGIN };

export function emailDeliveryPolicy() {
  return resolveEmailDeliveryPolicy({
    deliveryMode: process.env.EMAIL_DELIVERY_MODE,
    allowedRecipients: process.env.EMAIL_ALLOWED_RECIPIENTS,
    appUrl: process.env.APP_URL,
    vercelEnvironment: process.env.VERCEL_ENV,
    nodeEnvironment: process.env.NODE_ENV,
  });
}

export function emailDisplayName(value: string) {
  return value.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Common Time school";
}

export function schoolEmailSender(schoolName: string) {
  return `${emailDisplayName(schoolName)} via Common Time <notifications@notifications.commontime.studio>`;
}

export function secureEmailContent(input: { text: string; html: string; includePortalFallback?: boolean }) {
  const { safetySentence } = emailDeliveryPolicy();
  const portal = `${CANONICAL_APP_ORIGIN}/portal`;
  const fallbackText = input.includePortalFallback
    ? `\n\nYou can also sign in at ${portal} to verify this message without using an email action link.`
    : "";
  const safetyText = `${fallbackText}\n\n${safetySentence}`;
  const fallbackHtml = input.includePortalFallback
    ? `<p style="margin:12px 0 0">You can also sign in at <a href="${portal}">${portal}</a> to verify this message without using an email action link.</p>`
    : "";
  const safetyHtml = `<div style="margin-top:32px;padding-top:18px;border-top:1px solid #19344b;color:#8da5b8;font-size:12px;line-height:1.6">${fallbackHtml}<p style="margin:12px 0 0">${safetySentence}</p></div>`;
  const html = input.html.includes("</body>")
    ? input.html.replace("</body>", `${safetyHtml}</body>`)
    : `${input.html}${safetyHtml}`;
  return { text: `${input.text}${safetyText}`, html };
}

export function normalizeReplyTo(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 320 ? normalized : undefined;
}
