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

  const result = await dispatchOwnerNotificationEmail(delivery.id, true);
  revalidatePath("/", "layout");
  return result.ok
    ? { ok: true, message: "Notification email handed back to the provider." }
    : { ok: false, message: result.reason === "provider_failed" ? "The provider failed again. The payer response remains recorded." : "This email is no longer eligible for retry." };
}
