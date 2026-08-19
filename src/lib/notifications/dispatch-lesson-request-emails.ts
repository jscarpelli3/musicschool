import { createAdminClient } from "@/lib/supabase/admin";
import { ResendRequestError, sendResendEmail } from "@/lib/resend/server";

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
      });
      await admin.rpc("record_lesson_request_email_submission", { p_delivery_id: delivery.id, p_provider_email_id: result.id });
      accepted += 1;
    } catch (caught) {
      const provider = caught instanceof ResendRequestError ? caught : null;
      await admin.rpc("record_lesson_request_email_submission", {
        p_delivery_id: delivery.id,
        p_provider_email_id: null,
        p_error_code: provider?.code ?? "request_failed",
        p_error_message: caught instanceof Error ? caught.message : "Provider request failed",
      });
      failed += 1;
    }
  }
  return { accepted, failed };
}
