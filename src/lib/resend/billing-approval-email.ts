import { EMAIL_COLORS, EMAIL_FONT } from "@/lib/resend/email-brand";
import { secureEmailContent } from "@/lib/resend/email-security";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export type BillingApprovalEmailGroup = {
  studentName: string;
  lessonCount: number;
  lines: Array<{ description: string; serviceDate: string | null; amount: string }>;
};

export type BillingApprovalEmailLine = { description: string; serviceDate: string | null; amount: string };

function dateLabel(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function textLine(line: BillingApprovalEmailLine) {
  const when = dateLabel(line.serviceDate);
  return `  ${when ? `${when} · ` : ""}${line.description} — ${line.amount}`;
}

function htmlLine(line: BillingApprovalEmailLine) {
  const when = dateLabel(line.serviceDate);
  return `<tr><td style="padding:9px 14px 9px 0;border-top:1px solid ${EMAIL_COLORS.line};font-size:14px;line-height:1.45">${when ? `<span style="display:block;color:${EMAIL_COLORS.muted};font-size:12px">${escapeHtml(when)}</span>` : ""}${escapeHtml(line.description)}</td><td style="padding:9px 0;border-top:1px solid ${EMAIL_COLORS.line};font-size:14px;text-align:right;white-space:nowrap">${escapeHtml(line.amount)}</td></tr>`;
}

export function billingApprovalEmail(input: {
  schoolName: string;
  payerName: string;
  periodLabel: string;
  amount: string;
  approvalUrl: string;
  studentGroups: BillingApprovalEmailGroup[];
  otherLines: BillingApprovalEmailLine[];
}) {
  const school = escapeHtml(input.schoolName);
  const payer = escapeHtml(input.payerName);
  const period = escapeHtml(input.periodLabel);
  const amount = escapeHtml(input.amount);
  const url = escapeHtml(input.approvalUrl);
  const subject = `${input.schoolName}: review ${input.periodLabel} lesson charges`;
  const textDetails = input.studentGroups.flatMap((group) => ["", `${group.studentName} · ${group.lessonCount} ${group.lessonCount === 1 ? "lesson" : "lessons"}`, ...group.lines.map(textLine)]);
  if (input.otherLines.length) textDetails.push("", "Other charges and credits", ...input.otherLines.map(textLine));
  const text = [
    `Hi ${input.payerName},`, "", `${input.schoolName} has prepared your ${input.periodLabel} invoice.`, ...textDetails,
    "", `Total — ${input.amount}`, "", "You can review the invoice, approve the charges, or ask the school to make a change:", input.approvalUrl, "",
    "Approval does not charge your card. The school initiates payment separately after approval.",
    "This secure link expires in seven days. If you did not expect this request, contact the school directly.",
  ].join("\n");
  const groupHtml = input.studentGroups.map((group) => `<div style="margin-top:24px"><h2 style="margin:0 0 8px;font-size:16px;font-weight:600">${escapeHtml(group.studentName)} <span style="color:${EMAIL_COLORS.muted};font-weight:400">· ${group.lessonCount} ${group.lessonCount === 1 ? "lesson" : "lessons"}</span></h2><table role="presentation" style="width:100%;border-collapse:collapse">${group.lines.map(htmlLine).join("")}</table></div>`).join("");
  const otherHtml = input.otherLines.length ? `<div style="margin-top:24px"><h2 style="margin:0 0 8px;font-size:16px;font-weight:600">Other charges and credits</h2><table role="presentation" style="width:100%;border-collapse:collapse">${input.otherLines.map(htmlLine).join("")}</table></div>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:${EMAIL_COLORS.canvas};color:${EMAIL_COLORS.ink};font-family:${EMAIL_FONT}"><div style="max-width:600px;margin:0 auto;padding:48px 24px"><p style="margin:0 0 32px;color:${EMAIL_COLORS.muted};font-size:12px;letter-spacing:.14em;text-transform:uppercase">${school}</p><h1 style="margin:0 0 24px;font-size:34px;font-weight:600;line-height:1.15">Review ${period} lesson charges</h1><p style="margin:0 0 16px;line-height:1.65">Hi ${payer},</p><p style="margin:0;line-height:1.65">Here is the invoice ${school} prepared for you.</p>${groupHtml}${otherHtml}<div style="display:flex;justify-content:space-between;gap:20px;margin:28px 0;padding-top:18px;border-top:2px solid ${EMAIL_COLORS.ink};font-size:18px;font-weight:600"><span>Total</span><span>${amount}</span></div><p style="margin:0 0 18px;line-height:1.55">You can approve these charges or ask the school to make a change.</p><a href="${url}" style="display:inline-block;border:1px solid ${EMAIL_COLORS.brand};color:${EMAIL_COLORS.ink};padding:14px 22px;text-decoration:none">Review, approve, or request changes&nbsp; →</a><p style="margin:30px 0 0;color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.65">Approval does not charge your card. The school initiates payment separately after approval. This secure link expires in seven days.</p><div style="border-top:1px solid ${EMAIL_COLORS.line};margin-top:40px;padding-top:20px;color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.6">If you did not expect this request, contact the school directly.</div></div></body></html>`;
  return { subject, ...secureEmailContent({ text, html, includePortalFallback: true }) };
}
