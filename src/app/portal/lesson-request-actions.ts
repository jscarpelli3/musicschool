"use server";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { dispatchLessonRequestEmails } from "@/lib/notifications/dispatch-lesson-request-emails";

type RequestType = "cancellation" | "reschedule";
type Preview = { lesson_id: string; request_type: RequestType; lesson_starts_at: string; cutoff_hours: number; within_policy_window: boolean; policy_disposition: string; policy_guidance: string; accounting_state: string };
const UUID = /^[0-9a-f-]{36}$/i;
function object(value: Json): Record<string, Json | undefined> | null { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
function parsePreview(value: Json): Preview | null {
  const item = object(value);
  if (!item || typeof item.lesson_id !== "string" || typeof item.lesson_starts_at !== "string" || typeof item.cutoff_hours !== "number" || typeof item.within_policy_window !== "boolean" || typeof item.policy_guidance !== "string" || typeof item.accounting_state !== "string" || typeof item.policy_disposition !== "string") return null;
  return { lesson_id: item.lesson_id, request_type: item.request_type as RequestType, lesson_starts_at: item.lesson_starts_at, cutoff_hours: item.cutoff_hours, within_policy_window: item.within_policy_window, policy_disposition: item.policy_disposition, policy_guidance: item.policy_guidance, accounting_state: item.accounting_state };
}
export async function previewLessonRequest(lessonId: string, requestType: RequestType) {
  if (!UUID.test(lessonId)) return { ok: false as const, message: "That lesson could not be verified." };
  const { data, error } = await (await createClient()).rpc("preview_client_lesson_change_request", { p_lesson_event_id: lessonId, p_request_type: requestType });
  const preview = data ? parsePreview(data) : null;
  return error || !preview ? { ok: false as const, message: "This request cannot be prepared. Contact the school for help." } : { ok: true as const, preview };
}
export async function submitLessonRequest(lessonId: string, requestType: RequestType, resolution: "cancel" | "reschedule" | "lesson_credit") {
  if (!UUID.test(lessonId)) return { ok: false as const, message: "That lesson could not be verified." };
  const { data, error } = await (await createClient()).rpc("submit_client_lesson_change_request", { p_lesson_event_id: lessonId, p_request_type: requestType, p_requested_resolution: resolution });
  const result = data ? object(data) : null;
  if (error || !result || typeof result.request_id !== "string") return { ok: false as const, message: "Your request was not recorded. Please try again." };
  const delivery = await dispatchLessonRequestEmails(result.request_id);
  return { ok: true as const, result: result.result, requestId: result.request_id, requestedAt: typeof result.requested_at === "string" ? result.requested_at : new Date().toISOString(), deliveryFailed: delivery.failed > 0 };
}
