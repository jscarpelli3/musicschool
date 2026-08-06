import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";
import { startStripeOnboarding, syncStripeConnection } from "./actions";

export const dynamic = "force-dynamic";

const messages: Record<string, { text: string; error?: boolean }> = {
  returned: { text: "Stripe onboarding returned successfully. Synchronize below to check the durable account status." },
  refresh: { text: "That Stripe onboarding link expired or was interrupted. Continue onboarding to create a fresh link." },
  ready: { text: "Stripe confirmed that charges and payouts are enabled." },
  synced: { text: "Stripe status synchronized. Additional requirements may still be due." },
  error: { text: "Stripe onboarding could not be started. Nothing was marked complete; try again.", error: true },
  "platform-profile": { text: "Stripe requires the platform loss-responsibility profile to be confirmed before a school account can be created. Complete that item in Stripe Connect settings, then try again.", error: true },
  "sync-error": { text: "Stripe status could not be synchronized. The previous durable status is unchanged.", error: true },
};

export default async function SchoolPaymentsPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/payments`);

  const [{ data: school }, { data: membership }, { data: connection, error: connectionError }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_payment_connections").select("status, details_submitted, charges_enabled, payouts_enabled, disabled_reason, currently_due, last_synced_at").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", false).maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);
  if (connectionError) throw connectionError;

  const message = query.stripe ? messages[query.stripe] : undefined;
  const ready = connection?.charges_enabled && connection?.payouts_enabled;
  const requirements = Array.isArray(connection?.currently_due) ? connection.currently_due : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="payments" />
      {message ? <p className={`border-b border-line py-4 text-sm ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</p> : null}

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <p className="text-xs text-brand">Stripe Connect · Test mode</p>
          <h2 className="mt-3 font-display text-3xl">Payments</h2>
          <p className="mt-3 text-sm leading-6 text-muted">The school receives family payments directly and manages its account in Stripe. Stripe remains responsible for fees, requirements, and unrecoverable account losses.</p>
        </div>
        <div className="py-10 md:pl-10">
          <div className="flex items-start justify-between gap-6 border-b border-line pb-7">
            <div>
              <p className="text-xs text-muted">Connection status</p>
              <p className="mt-2 font-display text-3xl">{ready ? "Ready" : connection ? "Setup in progress" : "Not connected"}</p>
            </div>
            <span className={`mt-2 h-2.5 w-2.5 rounded-full ${ready ? "bg-brand" : "bg-muted"}`} aria-hidden="true" />
          </div>

          <dl className="grid grid-cols-2 border-b border-line py-7 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Details</dt><dd className="mt-2">{connection?.details_submitted ? "Submitted" : "Pending"}</dd></div>
            <div><dt className="text-muted">Charges</dt><dd className="mt-2">{connection?.charges_enabled ? "Enabled" : "Pending"}</dd></div>
            <div className="mt-5 sm:mt-0"><dt className="text-muted">Payouts</dt><dd className="mt-2">{connection?.payouts_enabled ? "Enabled" : "Pending"}</dd></div>
          </dl>

          {connection?.disabled_reason ? <p className="border-b border-line py-5 text-sm text-danger">Stripe restriction: {connection.disabled_reason}</p> : null}
          {requirements.length ? <p className="border-b border-line py-5 text-sm text-muted">Stripe still requires {requirements.length} {requirements.length === 1 ? "item" : "items"}. Continue onboarding to resolve them securely in Stripe.</p> : null}

          <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-center">
            {!ready ? (
              <form action={startStripeOnboarding.bind(null, schoolId)}>
                <button className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-surface sm:w-auto">{connection ? "Continue Stripe onboarding" : "Connect with Stripe"}</button>
              </form>
            ) : null}
            {connection ? (
              <form action={syncStripeConnection.bind(null, schoolId)}>
                <button className="w-full border-b border-line px-1 py-2 text-sm text-muted transition hover:border-brand hover:text-ink sm:w-auto">Synchronize status</button>
              </form>
            ) : null}
          </div>
          {connection?.last_synced_at ? <p className="mt-6 text-xs text-muted">Last synchronized {new Date(connection.last_synced_at).toLocaleString("en-US")}</p> : null}
        </div>
      </section>
    </main>
  );
}
