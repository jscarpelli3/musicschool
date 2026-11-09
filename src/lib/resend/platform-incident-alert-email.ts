import { commonTimeEmailFrame, EMAIL_COLORS } from "@/lib/resend/email-brand";
import { secureEmailContent } from "@/lib/resend/email-security";

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function platformIncidentAlertEmail(input: { title: string; summary: string; provider: string; incidentId: string; adminUrl: string; occurredAt: string }) {
  const subject = `[Urgent] Common Time: ${input.title}`;
  const text = `Common Time recorded an urgent production incident.\n\n${input.title}\n${input.summary}\n\nProvider: ${input.provider}\nIncident: ${input.incidentId}\nLast seen: ${input.occurredAt}\n\nReview and acknowledge it in platform admin:\n${input.adminUrl}`;
  const html = commonTimeEmailFrame(`<p style="margin:0;color:${EMAIL_COLORS.brand};font-size:13px;letter-spacing:.08em;text-transform:uppercase">Urgent platform incident</p><h1 style="margin:16px 0;font-size:30px;font-weight:500">${escape(input.title)}</h1><p style="line-height:1.65">${escape(input.summary)}</p><dl style="margin:24px 0;color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.8"><dt style="display:inline">Provider: </dt><dd style="display:inline;margin:0">${escape(input.provider)}</dd><br><dt style="display:inline">Incident: </dt><dd style="display:inline;margin:0">${escape(input.incidentId)}</dd><br><dt style="display:inline">Last seen: </dt><dd style="display:inline;margin:0">${escape(input.occurredAt)}</dd></dl><p style="margin:28px 0 0"><a href="${escape(input.adminUrl)}" style="display:inline-block;background:${EMAIL_COLORS.brand};color:${EMAIL_COLORS.canvas};padding:14px 20px;text-decoration:none">Review incident</a></p>`);
  return { subject, ...secureEmailContent({ text, html }) };
}
