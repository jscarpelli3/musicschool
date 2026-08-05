"use server";

import { createPublicClient } from "@/lib/supabase/public";

export async function approveBillingRequest(token: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("approve_billing_request", {
    raw_token: token,
  });

  if (error) return { ok: false, message: "We could not record this approval. Please try again." };

  if (data === "approved" || data === "already_approved") {
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
