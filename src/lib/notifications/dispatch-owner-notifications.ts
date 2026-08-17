import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResendRequestError, sendResendEmail } from "@/lib/resend/server";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function dispatchOwnerResponseEmails(rawToken: string) {
  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data: request } = await admin.from("billing_approval_requests").select("id, school_id").eq("token_hash", tokenHash).maybeSingle();
  if (!request) return;
  const [{ data: school }, { data: deliveries }] = await Promise.all([
    admin.from("schools").select("name").eq("id", request.school_id).single(),
    admin.from("owner_notification_email_outbox").select("id, recipient_email, subject, message_text, idempotency_key").eq("approval_request_id", request.id).eq("status", "pending"),
  ]);
  for (const delivery of deliveries ?? []) {
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
      await admin.from("owner_notification_email_outbox").update({ status: "accepted", provider_email_id: result.id, accepted_at: new Date().toISOString() }).eq("id", delivery.id).eq("status", "pending");
    } catch (error) {
      const provider = error instanceof ResendRequestError ? error : null;
      await admin.from("owner_notification_email_outbox").update({ status: "failed", provider_error_code: provider?.code ?? "request_failed", provider_error_message: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed.", failed_at: new Date().toISOString() }).eq("id", delivery.id).eq("status", "pending");
    }
  }
}
