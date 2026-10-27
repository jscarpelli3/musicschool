"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { dispatchOwnerResponseEmailsByRequestId } from "@/lib/notifications/dispatch-owner-notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Result = { result?: Json; approval_request_id?: Json };

async function portalActor(schoolId: string, billingPeriodId: string, action: string) {
  if (!UUID.test(schoolId) || !UUID.test(billingPeriodId)) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return null;
  try {
    await protectServerAction({ scope: `portal.invoice.${action}`, subject: `actor:${auth.claims.sub}|school:${schoolId}|period:${billingPeriodId}`, limit: 10, windowSeconds: 900, blockSeconds: 900 });
  } catch (caught) {
    if (caught instanceof RequestBoundaryError) return null;
    return null;
  }
  return supabase;
}

export async function approvePortalInvoice(schoolId: string, billingPeriodId: string) {
  const supabase = await portalActor(schoolId, billingPeriodId, "approve");
  if (!supabase) return { ok: false as const, message: "Sign in again or wait a moment before trying again." };
  const { data, error } = await supabase.rpc("approve_client_portal_billing_request", { p_school_id: schoolId, p_billing_period_id: billingPeriodId });
  const result = data && typeof data === "object" && !Array.isArray(data) ? data as Result : null;
  if (error || !result) return { ok: false as const, message: "This invoice could not be approved. Reload and try again." };
  if (result.result === "approved" || result.result === "already_approved") {
    if (result.result === "approved" && typeof result.approval_request_id === "string") await dispatchOwnerResponseEmailsByRequestId(result.approval_request_id);
    revalidatePath("/portal");
    return { ok: true as const, message: result.result === "approved" ? "Approval recorded. The school has not charged your card yet." : "This invoice was already approved." };
  }
  return { ok: false as const, message: result.result === "expired" ? "This approval request expired. Ask the school to send a new one." : "This invoice is no longer waiting for approval." };
}

export type PortalInvoiceReviewState = { ok: boolean; message: string };
export async function rejectPortalInvoice(schoolId: string, billingPeriodId: string, _previous: PortalInvoiceReviewState, formData: FormData): Promise<PortalInvoiceReviewState> {
  void _previous;
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const supabase = await portalActor(schoolId, billingPeriodId, "review");
  if (!supabase) return { ok: false, message: "Sign in again or wait a moment before trying again." };
  const { data, error } = await supabase.rpc("reject_client_portal_billing_request", { p_school_id: schoolId, p_billing_period_id: billingPeriodId, p_reason_code: reason, p_note: note || undefined });
  const result = data && typeof data === "object" && !Array.isArray(data) ? data as Result : null;
  if (error || !result) return { ok: false, message: "Your request was not recorded. Reload and try again." };
  if (result.result === "rejected" || result.result === "already_rejected") {
    if (result.result === "rejected" && typeof result.approval_request_id === "string") await dispatchOwnerResponseEmailsByRequestId(result.approval_request_id);
    revalidatePath("/portal");
    return { ok: true, message: result.result === "rejected" ? "Sent back to the school for review. Nothing was charged." : "This invoice was already sent back for review." };
  }
  const messages: Record<string, string> = { invalid_reason: "Choose what needs review.", note_required: "Add a short note when choosing Other.", note_too_long: "Keep the note under 1,000 characters.", expired: "This request expired. Ask the school for a new one." };
  return { ok: false, message: messages[String(result.result)] ?? "This invoice is no longer waiting for a response." };
}
