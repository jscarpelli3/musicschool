import { EMAIL_COLORS, EMAIL_FONT } from "@/lib/resend/email-brand";
import { secureEmailContent } from "@/lib/resend/email-security";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function billingApprovalReminderEmail(input: { schoolName: string; payerName: string; periodLabel: string; amount: string; approvalUrl: string }) {
  const school = escapeHtml(input.schoolName);
  const payer = escapeHtml(input.payerName);
  const period = escapeHtml(input.periodLabel);
  const amount = escapeHtml(input.amount);
  const url = escapeHtml(input.approvalUrl);
  const subject = `${input.schoolName}: reminder to review ${input.periodLabel}`;
  const text = [
    `Hi ${input.payerName},`, "",
    `${input.schoolName} is still waiting for your review of the ${input.periodLabel} invoice for ${input.amount}.`,
    "Review the itemized invoice, approve the charges, or ask the school to make a change:",
    input.approvalUrl, "",
    "Approval does not charge your card. The school initiates payment separately after approval.",
    "This refreshed secure link expires in seven days. If you have already handled this with the school, you can ignore this reminder.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:${EMAIL_COLORS.canvas};color:${EMAIL_COLORS.ink};font-family:${EMAIL_FONT}"><div style="max-width:600px;margin:0 auto;padding:48px 24px"><p style="margin:0 0 32px;color:${EMAIL_COLORS.muted};font-size:12px;letter-spacing:.14em;text-transform:uppercase">${school}</p><h1 style="margin:0 0 24px;font-size:34px;font-weight:600;line-height:1.15">A friendly invoice reminder</h1><p style="margin:0 0 16px;line-height:1.65">Hi ${payer},</p><p style="margin:0 0 20px;line-height:1.65">${school} is still waiting for your review of <strong>${period}</strong>.</p><div style="margin:24px 0;padding:18px 0;border-top:1px solid ${EMAIL_COLORS.line};border-bottom:1px solid ${EMAIL_COLORS.line};font-size:18px;font-weight:600">Amount to review: ${amount}</div><p style="margin:0 0 18px;line-height:1.55">You can review the itemized invoice, approve the charges, or ask the school to make a change.</p><a href="${url}" style="display:inline-block;border:1px solid ${EMAIL_COLORS.brand};color:${EMAIL_COLORS.ink};padding:14px 22px;text-decoration:none">Review invoice&nbsp; →</a><p style="margin:30px 0 0;color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.65">Approval does not charge your card. This refreshed secure link expires in seven days. If you have already handled this with the school, you can ignore this reminder.</p></div></body></html>`;
  return { subject, ...secureEmailContent({ text, html, includePortalFallback: true }) };
}
