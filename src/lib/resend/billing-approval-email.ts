import { EMAIL_COLORS, EMAIL_FONT } from "@/lib/resend/email-brand";
import { secureEmailContent } from "@/lib/resend/email-security";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function billingApprovalEmail(input: {
  schoolName: string;
  payerName: string;
  periodLabel: string;
  amount: string;
  approvalUrl: string;
}) {
  const school = escapeHtml(input.schoolName);
  const payer = escapeHtml(input.payerName);
  const period = escapeHtml(input.periodLabel);
  const amount = escapeHtml(input.amount);
  const url = escapeHtml(input.approvalUrl);
  const subject = `${input.schoolName}: review ${input.periodLabel} lesson charges`;
  const text = [
    `Hi ${input.payerName},`,
    "",
    `${input.schoolName} has prepared ${input.periodLabel} lesson charges totaling ${input.amount}.`,
    `Review the itemized amount and approve it here: ${input.approvalUrl}`,
    "",
    "Approval does not charge your card. The school initiates payment separately after approval.",
    "This secure link expires in 72 hours. If you did not expect this request, contact the school directly.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:${EMAIL_COLORS.canvas};color:${EMAIL_COLORS.ink};font-family:${EMAIL_FONT}"><div style="max-width:600px;margin:0 auto;padding:48px 24px"><p style="margin:0 0 32px;color:${EMAIL_COLORS.muted};font-size:12px;letter-spacing:.14em;text-transform:uppercase">${school}</p><h1 style="margin:0 0 24px;font-size:34px;font-weight:600;line-height:1.15">Review ${period} lesson charges</h1><p style="margin:0 0 16px;line-height:1.65">Hi ${payer},</p><p style="margin:0 0 28px;line-height:1.65">${school} has prepared an itemized total of <strong>${amount}</strong>.</p><a href="${url}" style="display:inline-block;border:1px solid ${EMAIL_COLORS.brand};color:${EMAIL_COLORS.ink};padding:14px 22px;text-decoration:none">Review and approve&nbsp; →</a><p style="margin:30px 0 0;color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.65">Approval does not charge your card. The school initiates payment separately after approval. This secure link expires in 72 hours.</p><div style="border-top:1px solid ${EMAIL_COLORS.line};margin-top:40px;padding-top:20px;color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.6">If you did not expect this request, contact the school directly.</div></div></body></html>`;
  return { subject, ...secureEmailContent({ text, html, includePortalFallback: true }) };
}
