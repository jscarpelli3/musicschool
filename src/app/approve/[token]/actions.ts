"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { dispatchOwnerResponseEmails } from "@/lib/notifications/dispatch-owner-notifications";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";

async function protectApprovalAction(token: string, action: string) {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return false;
  try {
    await protectServerAction({ scope: `billing.approval.${action}`, subject: `token:${token}`, limit: 10, windowSeconds: 900, blockSeconds: 900 });
    return true;
  } catch (caught) {
    if (caught instanceof RequestBoundaryError) return false;
    return false;
  }
}

export async function approveBillingRequest(token: string) {
  if (!await protectApprovalAction(token,"approve")) return { ok: false, message: "This request could not be validated. Wait a moment, reload, and try again." };
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("approve_billing_request", {
    raw_token: token,
  });

  if (error) return { ok: false, message: "We could not record this approval. Please try again." };

  if (data === "approved" || data === "already_approved") {
    if (data === "approved") await dispatchOwnerResponseEmails(token);
    return {
      ok: true,
      message: data === "approved"
        ? "Approval recorded. This is not a payment receipt."
        : "This amount was already approved.",
    };
  }

  const messages: Record<string, string> = {
    expired: "This approval link has expired. Ask the school for a new one.",
    cancelled: "This request was cancelled by the school.",
    not_found: "This approval link is invalid.",
  };

  return { ok: false, message: messages[String(data)] ?? "This request cannot be approved." };
}

export type RejectBillingState = { ok: boolean; message: string };

export async function rejectBillingRequest(token: string, _previous: RejectBillingState, formData: FormData): Promise<RejectBillingState> {
  void _previous;
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!await protectApprovalAction(token,"reject")) return { ok: false, message: "This request could not be validated. Wait a moment, reload, and try again." };
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("reject_billing_request", {
    p_note: note || undefined,
    p_reason_code: reason,
    raw_token: token,
  });
  if (error) return { ok: false, message: "Your response could not be recorded. The proposal is still pending." };
  if (data === "rejected" || data === "already_rejected") {
    if (data === "rejected") await dispatchOwnerResponseEmails(token);
    revalidatePath(`/approve/${token}`);
    return { ok: true, message: data === "rejected" ? "Sent back to the school for review. No payment was started." : "This proposal was already sent back for review." };
  }
  const messages: Record<string, string> = {
    invalid_reason: "Choose the reason these charges need review.",
    note_required: "Add a short note when choosing Other.",
    note_too_long: "Keep the note under 1,000 characters.",
    approved: "This proposal was already approved.",
    expired: "This proposal expired. Contact the school if the amount still needs review.",
    cancelled: "The school already replaced or cancelled this proposal.",
    not_found: "This approval link is invalid.",
  };
  return { ok: false, message: messages[String(data)] ?? "This proposal cannot be sent back for review." };
}

export async function enrollAutoChargeMandate(token: string, capValue: string, noCap: boolean, noticeDays: number) {
  if (!await protectApprovalAction(token,"mandate-enroll")) return { ok: false, message: "This request could not be validated. Wait a moment, reload, and try again." };
  const capText = capValue.trim();
  if (!noCap && !/^\d{1,7}(\.\d{1,2})?$/.test(capText)) return { ok: false, message: "Enter a valid monthly maximum." };
  if (!Number.isInteger(noticeDays) || noticeDays < 1 || noticeDays > 14) return { ok: false, message: "Choose a valid advance-notice period." };
  const capCents = noCap ? null : Math.round(Number(capText) * 100);
  const requestHeaders = await headers();
  const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
  const evidence = {
    ip_sha256: fingerprint(requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable"),
    user_agent_sha256: fingerprint(requestHeaders.get("user-agent") || "unavailable"),
    disclosure_render: "automatic-monthly-itemized-v1",
  };
  const admin = createAdminClient();
  const { error } = await admin.rpc("enroll_auto_charge_mandate", {
    p_advance_notice_days: noticeDays,
    p_evidence: evidence,
    p_monthly_cap_cents: capCents!,
    raw_token: token,
  });
  if (error) {
    const message = error.message.includes("cap_below_current_amount")
      ? "The monthly maximum cannot be lower than the amount you just approved."
      : error.message.includes("active_saved_method_required")
        ? "A currently authorized saved payment method is required."
        : "Automatic payment could not be enabled. Your existing monthly approval remains valid.";
    return { ok: false, message };
  }
  revalidatePath(`/approve/${token}`);
  return { ok: true, message: "Automatic monthly payment authorized. Future itemized statements will follow this preference." };
}

export async function revokeAutoChargeMandate(token: string) {
  if (!await protectApprovalAction(token,"mandate-revoke")) return { ok: false, message: "This request could not be validated. Wait a moment, reload, and try again." };
  const requestHeaders = await headers();
  const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_auto_charge_mandate", {
    p_evidence: {
      ip_sha256: fingerprint(requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable"),
      user_agent_sha256: fingerprint(requestHeaders.get("user-agent") || "unavailable"),
    },
    raw_token: token,
  });
  if (error) return { ok: false, message: "Automatic payment could not be revoked. Please contact the school before the next charge." };
  revalidatePath(`/approve/${token}`);
  return { ok: true, message: data === "revoked" ? "Automatic payment revoked for future charges." : "Automatic payment was already inactive." };
}
