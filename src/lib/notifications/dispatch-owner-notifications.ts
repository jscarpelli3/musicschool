import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResendRequestError, sendResendEmail } from "@/lib/resend/server";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function dispatchOwnerResponseEmails(rawToken: string) {
  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data: request } = await admin.from("billing_approval_requests").select("id, school_id").eq("token_hash", tokenHash).maybeSingle();
  if (!request) return;
  const { data: deliveries } = await admin.from("owner_notification_email_outbox")
    .select("id").eq("approval_request_id", request.id).eq("status", "pending");
  for (const delivery of deliveries ?? []) {
    await dispatchOwnerNotificationEmail(delivery.id);
  }
}

export async function dispatchOwnerNotificationEmail(deliveryId: string) {
  const admin = createAdminClient();
  const { data: delivery } = await admin.from("owner_notification_email_outbox")
    .select("id, school_id, recipient_email, subject, message_text, idempotency_key, status, retry_count")
    .eq("id", deliveryId)
    .eq("status", "pending")
    .maybeSingle();
  if (!delivery) return { ok: false as const, reason: "not_retryable" as const };
  const { data: school } = await admin.from("schools").select("name").eq("id", delivery.school_id).single();
  try {
    const result = await sendResendEmail({
      from: `${school?.name ?? "Common Time school"} via Common Time <notifications@notifications.commontime.studio>`,
      to: delivery.recipient_email,
      subject: delivery.subject,
      text: `${delivery.subject}\n\n${delivery.message_text}`,
      html: `<h1>${escape(delivery.subject)}</h1><p>${escape(delivery.message_text)}</p>`,
      idempotencyKey: delivery.idempotency_key,
      messageKind: "owner_payer_response",
    });
    const { error } = await admin.from("owner_notification_email_outbox").update({
      status: "accepted", provider_email_id: result.id, accepted_at: new Date().toISOString(),
      provider_error_code: null, provider_error_message: null, failed_at: null,
      retry_not_before: null,
    }).eq("id", delivery.id).eq("status", "pending");
    return error ? { ok: false as const, reason: "state_update_failed" as const } : { ok: true as const };
  } catch (error) {
    const provider = error instanceof ResendRequestError ? error : null;
    await admin.from("owner_notification_email_outbox").update({
      status: "failed", provider_error_code: provider?.code ?? "request_failed",
      provider_error_message: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed.",
      failed_at: new Date().toISOString(),
      retry_not_before: new Date(Date.now() + Math.min(60, delivery.retry_count === 0 ? 1 : 5 * delivery.retry_count) * 60_000).toISOString(),
    }).eq("id", delivery.id).eq("status", "pending");
    return { ok: false as const, reason: "provider_failed" as const };
  }
}
