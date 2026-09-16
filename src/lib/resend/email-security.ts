import "server-only";

export const CANONICAL_APP_ORIGIN = "https://app.commontime.studio";
export const EMAIL_SAFETY_SENTENCE = "We will only ever send you to app.commontime.studio. Never enter a card number from an email link.";

export function emailDisplayName(value: string) {
  return value.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Common Time school";
}

export function schoolEmailSender(schoolName: string) {
  return `${emailDisplayName(schoolName)} via Common Time <notifications@notifications.commontime.studio>`;
}

export function secureEmailContent(input: { text: string; html: string; includePortalFallback?: boolean }) {
  const portal = `${CANONICAL_APP_ORIGIN}/portal`;
  const fallbackText = input.includePortalFallback
    ? `\n\nYou can also sign in at ${portal} to verify this message without using an email action link.`
    : "";
  const safetyText = `${fallbackText}\n\n${EMAIL_SAFETY_SENTENCE}`;
  const fallbackHtml = input.includePortalFallback
    ? `<p style="margin:12px 0 0">You can also sign in at <a href="${portal}">${portal}</a> to verify this message without using an email action link.</p>`
    : "";
  const safetyHtml = `<div style="margin-top:32px;padding-top:18px;border-top:1px solid #19344b;color:#8da5b8;font-size:12px;line-height:1.6">${fallbackHtml}<p style="margin:12px 0 0">${EMAIL_SAFETY_SENTENCE}</p></div>`;
  const html = input.html.includes("</body>")
    ? input.html.replace("</body>", `${safetyHtml}</body>`)
    : `${input.html}${safetyHtml}`;
  return { text: `${input.text}${safetyText}`, html };
}

export function normalizeReplyTo(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 320 ? normalized : undefined;
}
