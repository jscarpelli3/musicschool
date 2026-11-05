import { commonTimeEmailFrame, EMAIL_COLORS } from "@/lib/resend/email-brand";
import { secureEmailContent } from "@/lib/resend/email-security";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function schoolOnboardingInvitationEmail({ schoolName, inviteUrl }: { schoolName?: string; inviteUrl: string }) {
  const subject = "Your Common Time beta invitation";
  const greeting = schoolName ? `${schoolName} has a place in the Common Time private beta.` : "You have a place in the Common Time private beta.";
  const text = `${greeting}\n\nUse your private link within 14 days to confirm this email address and create your school:\n${inviteUrl}\n\nThis link only works with the email address that received it.`;
  const html = commonTimeEmailFrame(`<p style="margin:0;color:${EMAIL_COLORS.muted};font-size:13px;letter-spacing:.08em;text-transform:uppercase">Private beta invitation</p><h1 style="margin:16px 0;font-size:32px;font-weight:500">Welcome to Common Time.</h1><p style="line-height:1.65">${escape(greeting)}</p><p style="line-height:1.65">Use this private link within 14 days to confirm your email address and create your school.</p><p style="margin:28px 0"><a href="${escape(inviteUrl)}" style="display:inline-block;background:${EMAIL_COLORS.brand};color:${EMAIL_COLORS.canvas};padding:14px 20px;text-decoration:none">Set up your school</a></p><p style="color:${EMAIL_COLORS.muted};font-size:13px;line-height:1.6">This link only works with the email address that received it.</p>`);
  return { subject, ...secureEmailContent({ text, html }) };
}
