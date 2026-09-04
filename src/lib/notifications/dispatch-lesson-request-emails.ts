import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ResendRequestError, ResendUnknownOutcomeError, sendResendEmail } from "@/lib/resend/server";

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function dispatchLessonRequestEmails(requestId: string) {
  const admin = createAdminClient();
  const { data: deliveries, error } = await admin.rpc("get_pending_lesson_request_emails", { p_request_id: requestId });
  if (error) return { accepted: 0, failed: 0 };
  let accepted = 0;
  let failed = 0;
  for (const delivery of deliveries ?? []) {
    try {
      const result = await sendResendEmail({
        from: "Common Time <notifications@notifications.commontime.studio>",
        to: delivery.recipient_email,
        subject: delivery.subject,
        text: delivery.message_text,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.65"><h1>${escape(delivery.subject)}</h1><p>${escape(delivery.message_text)}</p></div>`,
        idempotencyKey: delivery.idempotency_key,
        messageKind: "lesson_change_request",
        timeoutMs: 10_000,
      });
      const recorded = await admin.rpc("record_lesson_request_email_submission", { p_delivery_id: delivery.id, p_provider_email_id: result.id });
      if (recorded.error) {
        console.error("Lesson request email accepted but finalization failed", { deliveryId: delivery.id, providerEmailId: result.id, code: recorded.error.code });
        failed += 1;
      } else accepted += 1;
    } catch (caught) {
      if (caught instanceof ResendUnknownOutcomeError) {
        const marked = await admin.from("lesson_request_email_outbox").update({ status: "reconciliation_required", provider_error_code: "provider_outcome_unknown", provider_error_message: caught.message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", delivery.id).eq("status", "pending").select("id").maybeSingle();
        if (marked.error || !marked.data) console.error("Lesson request email unknown outcome could not be recorded", { deliveryId: delivery.id, code: marked.error?.code });
        failed += 1;
        continue;
      }
      const provider = caught instanceof ResendRequestError ? caught : null;
      const recorded = await admin.rpc("record_lesson_request_email_submission", {
        p_delivery_id: delivery.id,
        p_error_code: provider?.code ?? "request_failed",
        p_error_message: caught instanceof Error ? caught.message : "Provider request failed",
      });
      if (recorded.error) console.error("Lesson request email failure could not be recorded", { deliveryId: delivery.id, code: recorded.error.code });
      failed += 1;
    }
  }
  return { accepted, failed };
}
