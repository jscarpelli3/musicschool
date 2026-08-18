"use server";

import { revalidatePath } from "next/cache";
import { dispatchOwnerNotificationEmail } from "@/lib/notifications/dispatch-owner-notifications";
import { createClient } from "@/lib/supabase/server";

export async function retryOwnerNotificationEmail(deliveryId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Sign in again before retrying this email." };

  const { data: delivery } = await supabase.from("owner_notification_email_outbox")
    .select("id, school_id, status")
    .eq("id", deliveryId)
    .eq("status", "failed")
    .maybeSingle();
  if (!delivery) return { ok: false, message: "This email is no longer eligible for retry." };

  const { data: membership } = await supabase.from("school_members").select("role")
    .eq("school_id", delivery.school_id).eq("profile_id", profileId).eq("status", "active").maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return { ok: false, message: "Only an owner or admin can retry this email." };

  const { data: claim } = await supabase.rpc("claim_owner_notification_email_retry", { p_delivery_id: delivery.id });
  if (claim !== "claimed") return { ok: false, message: claim === "cooldown"
    ? "Retry is cooling down. Wait until the time shown, then try again."
    : claim === "retry_limit_reached" ? "This email reached its retry limit. Contact support before trying again."
    : "This email is no longer eligible for retry." };
  const result = await dispatchOwnerNotificationEmail(delivery.id);
  revalidatePath("/", "layout");
  return result.ok
    ? { ok: true, message: "Email retry accepted. Delivery status will update here." }
    : { ok: false, message: result.reason === "provider_failed" ? "The provider failed again. The payer response remains recorded." : "This email is no longer eligible for retry." };
}

export async function reportOwnerNotificationEmailProblem(deliveryId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, message: "Sign in again before reporting this problem." };
  const { data, error } = await supabase.rpc("report_owner_notification_email_problem", { p_delivery_id: deliveryId });
  if (error || !data) return { ok: false, message: "The problem report could not be recorded. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Problem reported to Common Time support." };
}
