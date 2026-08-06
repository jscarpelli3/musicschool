"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { getStripe, getStripeMode } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function paymentsPath(schoolId: string, status?: string) {
  const path = `/schools/${schoolId}/payments`;
  return status ? `${path}?stripe=${status}` : path;
}

function applicationUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing required server environment variable: APP_URL");
}

function onboardingFailureStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("responsibilities of managing losses")) {
    return "platform-profile";
  }

  console.error("Stripe onboarding failed", error);
  return "error";
}

async function requireSchoolAdmin(schoolId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${paymentsPath(schoolId)}`);

  const [{ data: school, error: schoolError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
  ]);

  if (schoolError || membershipError || !school || !membership || !["owner", "admin"].includes(membership.role)) {
    redirect(`/schools/${schoolId}`);
  }

  return { profileId, school, supabase };
}

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
    last_synced_at: new Date().toISOString(),
  };
}

async function persistConnection(schoolId: string, account: Stripe.Account, actorProfileId: string) {
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  const { data: connection, error } = await admin.from("school_payment_connections").upsert({
    school_id: schoolId,
    provider: "stripe",
    livemode,
    provider_account_id: account.id,
    ...connectionState(account),
  }, { onConflict: "school_id,provider,livemode" }).select("id").single();

  if (error || !connection) throw error ?? new Error("Stripe connection was not persisted.");

  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: schoolId,
    actor_profile_id: actorProfileId,
    action: "stripe.connection_synced",
    entity_type: "school_payment_connection",
    entity_id: connection.id,
    metadata: { livemode, status: connectionState(account).status },
  });
  if (auditError) throw auditError;

  return connection;
}

export async function startStripeOnboarding(schoolId: string) {
  const { profileId, school, supabase } = await requireSchoolAdmin(schoolId);
  const stripe = getStripe();
  const livemode = getStripeMode() === "live";
  let destination = paymentsPath(schoolId, "error");

  try {
    const { data: existing, error: existingError } = await supabase.from("school_payment_connections")
      .select("provider_account_id")
      .eq("school_id", schoolId)
      .eq("provider", "stripe")
      .eq("livemode", livemode)
      .maybeSingle();
    if (existingError) throw existingError;

    let account: Stripe.Account;
    if (existing?.provider_account_id) {
      account = await stripe.accounts.retrieve(existing.provider_account_id);
    } else {
      const created = await stripe.v2.core.accounts.create({
        display_name: school.name,
        identity: { country: "US" },
        dashboard: "full",
        defaults: {
          currency: "usd",
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
        },
        configuration: {
          merchant: { capabilities: { card_payments: { requested: true } } },
        },
        metadata: { school_id: schoolId },
        include: ["configuration.merchant", "defaults", "requirements"],
      }, { idempotencyKey: `school-connect-v2-full-${schoolId}-${livemode ? "live" : "test"}-v1` });
      account = await stripe.accounts.retrieve(created.id);
    }

    await persistConnection(schoolId, account, profileId);

    const baseUrl = applicationUrl();
    const link = await stripe.v2.core.accountLinks.create({
      account: account.id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          collection_options: { fields: "eventually_due", future_requirements: "include" },
          refresh_url: `${baseUrl}${paymentsPath(schoolId, "refresh")}`,
          return_url: `${baseUrl}${paymentsPath(schoolId, "returned")}`,
        },
      },
    });
    destination = link.url;
  } catch (error) {
    destination = paymentsPath(schoolId, onboardingFailureStatus(error));
  }

  redirect(destination);
}

export async function syncStripeConnection(schoolId: string) {
  const { profileId, supabase } = await requireSchoolAdmin(schoolId);
  const livemode = getStripeMode() === "live";
  let status = "sync-error";

  try {
    const { data: connection, error } = await supabase.from("school_payment_connections")
      .select("provider_account_id")
      .eq("school_id", schoolId)
      .eq("provider", "stripe")
      .eq("livemode", livemode)
      .maybeSingle();
    if (error || !connection?.provider_account_id) throw error ?? new Error("No Stripe connection exists.");

    const account = await getStripe().accounts.retrieve(connection.provider_account_id);
    await persistConnection(schoolId, account, profileId);
    status = account.charges_enabled && account.payouts_enabled ? "ready" : "synced";
  } catch (error) {
    console.error("Stripe connection synchronization failed", error);
    status = "sync-error";
  }

  redirect(paymentsPath(schoolId, status));
}
