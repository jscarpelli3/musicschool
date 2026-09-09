"use server";

import { revalidatePath } from "next/cache";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function revokePortalAutoChargeMandate(schoolId: string, billingAccountId: string) {
  if (!UUID_PATTERN.test(schoolId) || !UUID_PATTERN.test(billingAccountId)) {
    return { ok: false as const, message: "That billing account could not be verified." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false as const, message: "Sign in again to change automatic payment." };

  try {
    await protectServerAction({
      scope: "portal.collection.mandate.revoke",
      subject: `actor:${auth.claims.sub}|school:${schoolId}|account:${billingAccountId}`,
      limit: 10,
      windowSeconds: 3600,
    });
  } catch (caught) {
    return {
      ok: false as const,
      message: caught instanceof RequestBoundaryError && caught.code === "rate_limited"
        ? "Too many automatic-payment changes were requested. Wait before trying again."
        : "This request could not be validated.",
    };
  }

  const { data, error } = await supabase.rpc("revoke_client_portal_auto_charge_mandate", {
    p_school_id: schoolId,
    p_billing_account_id: billingAccountId,
  });
  if (error) return { ok: false as const, message: "Automatic payment could not be stopped. Contact the school before the next charge." };

  revalidatePath("/portal");
  return {
    ok: true as const,
    message: data === "revoked"
      ? "Automatic payment is stopped for future statements. Your saved payment method was not removed."
      : "Automatic payment was already inactive.",
  };
}
