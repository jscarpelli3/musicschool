function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function billingStatementNoticeEmail(input: {
  schoolName: string;
  periodLabel: string;
  amount: string;
  noticeDays: number;
  portalUrl: string;
}) {
  const school = escapeHtml(input.schoolName);
  const period = escapeHtml(input.periodLabel);
  const amount = escapeHtml(input.amount);
  const portalUrl = escapeHtml(input.portalUrl);
  const subject = `${input.schoolName}: ${input.periodLabel} statement notice`;
  const text = [
    `${input.schoolName} has prepared your itemized ${input.periodLabel} statement totaling ${input.amount}.`,
    "",
    `Your automatic-payment preference requires at least ${input.noticeDays} day(s) notice before collection. No charge is being made by this email.`,
    `Review your schedule and automatic-payment preference: ${input.portalUrl}`,
    "",
    "Contact the school before the notice period ends if anything needs attention.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#031012;color:#e8fcfa;font-family:'Avenir Next',Avenir,Montserrat,'Segoe UI',Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:48px 24px"><p style="margin:0 0 32px;color:#91b7b6;font-size:12px;letter-spacing:.14em;text-transform:uppercase">${school}</p><h1 style="margin:0 0 24px;font-family:'Avenir Next',Avenir,Montserrat,'Segoe UI',Arial,sans-serif;font-size:34px;font-weight:400;line-height:1.15">Your ${period} statement</h1><p style="margin:0 0 18px;line-height:1.65">The itemized total is <strong>${amount}</strong>.</p><p style="margin:0 0 28px;line-height:1.65">Your automatic-payment preference requires at least ${input.noticeDays} day(s) notice before collection. No charge is being made by this email.</p><a href="${portalUrl}" style="display:inline-block;border:1px solid #42dfd0;color:#e8fcfa;padding:14px 22px;text-decoration:none">Open family portal&nbsp; →</a><p style="margin:30px 0 0;color:#91b7b6;font-size:13px;line-height:1.65">Contact the school before the notice period ends if anything needs attention.</p></div></body></html>`;
  return { subject, ...secureEmailContent({ text, html, includePortalFallback: true }) };
}
import { secureEmailContent } from "@/lib/resend/email-security";
