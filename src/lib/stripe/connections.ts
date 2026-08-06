import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

function connectionState(account: Stripe.Account) {
  const requirements = account.requirements;
  const status = account.charges_enabled && account.payouts_enabled
    ? "enabled"
    : account.details_submitted
      ? "restricted"
      : "onboarding";

  return {
    status,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    disabled_reason: requirements?.disabled_reason ?? null,
    currently_due: requirements?.currently_due ?? [],
    eventually_due: requirements?.eventually_due ?? [],
    past_due: requirements?.past_due ?? [],
    pending_verification: requirements?.pending_verification ?? [],
    requirement_errors: requirements?.errors?.map((error) => ({
      code: error.code,
      reason: error.reason,
      requirement: error.requirement,
    })) ?? [],
    requirements_deadline: requirements?.current_deadline
      ? new Date(requirements.current_deadline * 1000).toISOString()
      : null,
    last_synced_at: new Date().toISOString(),
  };
}

export async function synchronizeStripeConnection(schoolId: string, providerAccountId: string, actorProfileId: string | null) {
  const account = await getStripe().accounts.retrieve(providerAccountId);
  const state = connectionState(account);
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  const { data: connection, error } = await admin.from("school_payment_connections").upsert({
    school_id: schoolId,
    provider: "stripe",
    livemode,
    provider_account_id: account.id,
    ...state,
  }, { onConflict: "school_id,provider,livemode" }).select("id").single();
  if (error || !connection) throw error ?? new Error("Stripe connection was not persisted.");

  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: schoolId,
    actor_profile_id: actorProfileId,
    action: "stripe.connection_synced",
    entity_type: "school_payment_connection",
    entity_id: connection.id,
    metadata: { livemode, status: state.status },
  });
  if (auditError) throw auditError;
  return { account, state };
}
