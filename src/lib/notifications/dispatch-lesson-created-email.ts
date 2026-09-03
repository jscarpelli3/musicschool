import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ResendRequestError, ResendUnknownOutcomeError, sendResendEmail } from "@/lib/resend/server";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

export async function dispatchLessonCreatedEmail(entityType: "lesson_event" | "lesson_series", entityId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_lesson_created_email", {
    p_entity_type: entityType,
    p_entity_id: entityId,
  });
  if (error) {
    console.error("Lesson email claim failed", { entityType, entityId, code: error.code });
    return { status: "queued" as const };
  }
  const delivery = data?.[0];
  if (!delivery) return { status: "queued" as const };

  try {
    const sent = await sendResendEmail({
      from: `${delivery.school_name} via Common Time <notifications@notifications.commontime.studio>`,
      to: delivery.recipient_email,
      subject: delivery.subject,
      text: delivery.message_text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65"><h1>${escapeHtml(delivery.subject)}</h1><p>${escapeHtml(delivery.message_text)}</p></div>`,
      idempotencyKey: delivery.idempotency_key,
      messageKind: "lesson_created",
      timeoutMs: 10_000,
    });
    const recorded = await admin.rpc("record_lesson_created_email_submission", {
      p_delivery_id: delivery.id,
      p_provider_email_id: sent.id,
    });
    if (recorded.error) {
      console.error("Lesson email accepted but finalization failed", { deliveryId: delivery.id, providerEmailId: sent.id, code: recorded.error.code });
      return { status: "reconciliation_required" as const };
    }
    return { status: "accepted" as const };
  } catch (caught) {
    if (caught instanceof ResendUnknownOutcomeError) {
      const marked = await admin.rpc("mark_lesson_created_email_reconciliation_required", {
        p_delivery_id: delivery.id,
        p_error_message: caught.message,
      });
      if (marked.error) console.error("Lesson email unknown outcome could not be recorded", { deliveryId: delivery.id, code: marked.error.code });
      return { status: "reconciliation_required" as const };
    }
    const provider = caught instanceof ResendRequestError ? caught : null;
    const recorded = await admin.rpc("record_lesson_created_email_submission", {
      p_delivery_id: delivery.id,
      p_provider_email_id: undefined,
      p_error_code: provider?.code ?? "request_failed",
      p_error_message: caught instanceof Error ? caught.message : "Provider request failed.",
    });
    if (recorded.error) console.error("Lesson email failure could not be recorded", { deliveryId: delivery.id, code: recorded.error.code });
    return { status: "failed" as const };
  }
}
