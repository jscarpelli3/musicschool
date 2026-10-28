import { createHash, randomBytes } from "node:crypto";
import { billingApprovalReminderEmail } from "@/lib/resend/billing-approval-reminder-email";
import { normalizeReplyTo, schoolEmailSender } from "@/lib/resend/email-security";
import { EmailDeliveryPolicyError, ResendRequestError, ResendUnknownOutcomeError, sendResendEmail } from "@/lib/resend/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const origin = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!origin) return Response.json({ ok: false, error: "application_origin_missing" }, { status: 500 });
  const { data: candidates, error } = await admin.rpc("list_due_billing_approval_reminders");
  if (error) {
    console.error("Billing reminder candidate query failed", { code: error.code });
    return Response.json({ ok: false, error: "candidate_query_failed" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of candidates ?? []) {
    const rawToken = randomBytes(32).toString("base64url");
    const approvalUrl = `${origin}/approve/${rawToken}`;
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: candidate.currency }).format(candidate.amount_cents / 100);
    const payerName = `${candidate.payer_preferred_name || candidate.payer_first_name || "there"}${candidate.payer_last_name ? ` ${candidate.payer_last_name}` : ""}`;
    const message = billingApprovalReminderEmail({ schoolName: candidate.school_name, payerName, periodLabel: candidate.period_label, amount, approvalUrl });
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
    const from = schoolEmailSender(candidate.school_name);
    const prepared = await admin.rpc("prepare_billing_approval_reminder", {
      p_approval_request_id: candidate.approval_request_id,
      p_body_sha256: hash(`${message.text}\n${message.html}`),
      p_expires_at: expiresAt,
      p_from_address: from,
      p_recipient_email: candidate.recipient_email,
      p_subject: message.subject,
      p_token_hash: hash(rawToken),
    }).maybeSingle();
    if (prepared.error || !prepared.data) {
      skipped += 1;
      continue;
    }
    try {
      const provider = await sendResendEmail({
        from,
        to: prepared.data.recipient_email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: normalizeReplyTo(candidate.reply_to_email),
        idempotencyKey: prepared.data.idempotency_key,
        messageKind: "billing_reminder",
      });
      const completed = await admin.rpc("complete_email_provider_submission", { p_delivery_id: prepared.data.email_delivery_id, p_provider_email_id: provider.id });
      if (completed.error) {
        console.error("Billing reminder was accepted but local completion failed", { deliveryId: prepared.data.email_delivery_id, code: completed.error.code });
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (caught) {
      if (caught instanceof ResendUnknownOutcomeError) {
        console.error("Billing reminder provider outcome is unknown", { deliveryId: prepared.data.email_delivery_id });
      } else {
        const provider = caught instanceof ResendRequestError ? caught : null;
        const policy = caught instanceof EmailDeliveryPolicyError ? caught : null;
        await admin.rpc("fail_email_provider_submission", {
          p_delivery_id: prepared.data.email_delivery_id,
          p_provider_error_code: provider?.code ?? (provider?.status ? String(provider.status) : policy?.code),
          p_provider_error_message: caught instanceof Error ? caught.message : "Provider request failed.",
        });
      }
      failed += 1;
    }
  }
  return Response.json({ ok: failed === 0, candidates: candidates?.length ?? 0, sent, skipped, failed }, { status: failed === 0 ? 200 : 207 });
}
