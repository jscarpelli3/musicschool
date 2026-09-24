import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";
import { startStripeOnboarding, syncStripeConnection } from "./actions";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { stripeConnectionPresentation } from "@/lib/stripe/connection-presentation";

export const dynamic = "force-dynamic";

const messages: Record<string, { text: string; error?: boolean }> = {
  "returned-synced": { text: "Stripe onboarding ended and the latest account status was checked automatically." },
  refresh: { text: "That Stripe onboarding link expired or was interrupted. Continue onboarding to create a fresh link." },
  ready: { text: "Stripe confirmed that charges and payouts are enabled." },
  synced: { text: "Stripe status synchronized. Additional requirements may still be due." },
  error: { text: "Stripe onboarding could not be started. Nothing was marked complete; try again.", error: true },
  "platform-profile": { text: "Stripe requires the platform loss-responsibility profile to be confirmed before a school account can be created. Complete that item in Stripe Connect settings, then try again.", error: true },
  "sync-error": { text: "Stripe status could not be synchronized. The previous durable status is unchanged.", error: true },
};

const requirementLabels: Array<[string, string, string]> = [
  ["individual.id_number", "Identity number", "Stripe needs the account owner’s test identity number."],
  ["representative.", "Account representative", "Stripe needs more information about the person representing the school."],
  ["business_profile.", "Business profile", "Stripe needs public business details for payments and receipts."],
  ["business_type", "Business type", "Stripe needs the school’s legal business type."],
  ["external_account", "Payout account", "Stripe needs a bank account for payouts."],
  ["settings.payments.statement_descriptor", "Statement descriptor", "Stripe needs the name families will recognize on card statements."],
  ["tos_acceptance.", "Stripe agreement", "The account owner must accept Stripe’s service agreement."],
  ["company.", "Business identity", "Stripe needs additional legal business information."],
];

function requirementTasks(values: unknown) {
  if (!Array.isArray(values)) return [];
  const tasks = values.map((value) => {
    const field = String(value);
    const known = requirementLabels.find(([prefix]) => field === prefix || field.startsWith(prefix));
    return known ? { key: known[0], title: known[1], detail: known[2] } : {
      key: "additional",
      title: "Additional Stripe information",
      detail: "Stripe needs a few more business details. Open Stripe to see and complete the secure form.",
    };
  });
  return [...new Map(tasks.map((task) => [task.key, task])).values()];
}

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

  const [{ data: school }, { data: membership }, { data: connection, error: connectionError },capabilities] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_payment_connections").select("status, details_submitted, charges_enabled, payouts_enabled, disabled_reason, currently_due, past_due, pending_verification, requirement_errors, requirements_deadline, last_synced_at").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", false).maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);
  if (!school || !membership) notFound();
  if (!capabilities.has("school.billing.manage")) redirect(`/schools/${schoolId}`);
  if (connectionError) throw connectionError;

  const message = query.stripe ? messages[query.stripe] : undefined;
  const requirementFields = [
    ...(Array.isArray(connection?.past_due) ? connection.past_due : []),
    ...(Array.isArray(connection?.currently_due) ? connection.currently_due : []),
  ].map(String);
  const pendingFields = Array.isArray(connection?.pending_verification) ? connection.pending_verification.map(String) : [];
  const requirements = requirementTasks(requirementFields);
  const errors = Array.isArray(connection?.requirement_errors) ? connection.requirement_errors : [];
  const presentation = stripeConnectionPresentation({
    connected: Boolean(connection),
    detailsSubmitted: Boolean(connection?.details_submitted),
    chargesEnabled: Boolean(connection?.charges_enabled),
    payoutsEnabled: Boolean(connection?.payouts_enabled),
    requirements: requirementFields,
    pendingVerification: pendingFields,
    requirementErrors: errors,
    disabledReason: connection?.disabled_reason ?? null,
  });
  const ready = presentation === "ready";
  const actionRequired = presentation === "action_required";
  const underReview = presentation === "under_review";
  const notApproved = presentation === "not_approved";
  const statusTitle = ({
    ready: "Ready for payments",
    action_required: "Action required",
    under_review: "Payment account is in review",
    not_approved: "Payment account not approved",
    setup_in_progress: "Setup in progress",
    not_connected: "Not connected",
  } as const)[presentation];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="payments" />
      {message ? <p className={`mt-5 rounded-md bg-surface-raised px-4 py-3 text-sm ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</p> : null}

      <section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8">
        <div>
          <p className="text-xs text-brand">Stripe Connect · Test mode</p>
          <h2 className="mt-3 font-display text-3xl">Payments</h2>
          <p className="mt-3 text-sm leading-6 text-muted">The school receives family payments directly and manages its account in Stripe. Stripe remains responsible for fees, requirements, and unrecoverable account losses.</p>
        </div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-7">
            <div>
              <p className="text-xs text-muted">Connection status</p>
              <p className="mt-2 font-display text-3xl">{statusTitle}</p>
              {underReview ? <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/60 bg-brand/10 px-3 py-1 text-xs text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />Awaiting approval</span> : null}
            </div>
            <span className={`mt-2 h-2.5 w-2.5 rounded-full ${ready ? "bg-brand" : "bg-muted"}`} aria-hidden="true" />
          </div>

          {underReview ? <div className="border-b border-line py-7">
            <h3 className="font-display text-2xl">Stripe is reviewing your information</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">You have completed the current setup steps. Stripe is verifying your business and payout details. This usually requires no action from you.</p>
            <dl className="mt-7 divide-y divide-line border-y border-line">
              <div className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr]"><dt className="font-medium">Submitted <span className="text-brand" aria-label="complete">✓</span></dt><dd className="text-sm text-muted">Your account information was received.</dd></div>
              <div className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr]"><dt className="font-medium">Payments <span className="block text-xs font-normal text-muted">Waiting for Stripe</span></dt><dd className="text-sm text-muted">You can accept payments after approval.</dd></div>
              <div className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr]"><dt className="font-medium">Payouts <span className="block text-xs font-normal text-muted">Waiting for Stripe</span></dt><dd className="text-sm text-muted">Earnings can be deposited after approval.</dd></div>
            </dl>
            <div className="mt-7 border-l-2 border-brand pl-4"><p className="font-medium">What happens next</p><p className="mt-2 text-sm leading-6 text-muted">Common Time will update this status automatically. If Stripe needs anything else, we’ll show a clear action here.</p></div>
          </div> : <dl className="grid grid-cols-2 border-b border-line py-7 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Details</dt><dd className="mt-2">{connection?.details_submitted ? "Submitted" : "Pending"}</dd></div>
            <div><dt className="text-muted">Payments</dt><dd className="mt-2">{connection?.charges_enabled ? "Enabled" : "Pending"}</dd></div>
            <div className="mt-5 sm:mt-0"><dt className="text-muted">Payouts</dt><dd className="mt-2">{connection?.payouts_enabled ? "Enabled" : "Pending"}</dd></div>
          </dl>}

          {actionRequired ? <div className="border-b border-line py-7"><p className="text-xs uppercase tracking-[0.15em] text-danger">Owner action required</p><div className="mt-5 space-y-5">{requirements.map((task) => <div key={task.key} className="border-l border-danger pl-4"><p className="text-sm text-ink">{task.title}</p><p className="mt-1 text-sm leading-6 text-muted">{task.detail}</p></div>)}</div>{connection?.requirements_deadline ? <p className="mt-5 text-xs text-danger">Due by {new Date(connection.requirements_deadline).toLocaleString("en-US")}</p> : null}</div> : null}
          {notApproved ? <div className="border-b border-line py-7"><p className="text-xs uppercase tracking-[0.15em] text-danger">Stripe could not approve this account</p><p className="mt-3 text-sm leading-6 text-muted">Integrated payments will stay unavailable, but you can keep using Common Time for scheduling, attendance, and billing records. If Stripe offers a correction or appeal, open Stripe to review it.</p></div> : null}
          {!actionRequired && !underReview && !notApproved && connection?.disabled_reason && !ready ? <p className="border-b border-line py-5 text-sm text-danger">Stripe has limited this account: {connection.disabled_reason.replaceAll("_", " ").replaceAll(".", " › ")}</p> : null}

          <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-center">
            {!ready && !underReview ? (
              <form action={startStripeOnboarding.bind(null, schoolId)}>
                <button className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-surface sm:w-auto">{notApproved ? "Review options in Stripe →" : connection ? actionRequired ? "Provide details in Stripe →" : "Continue Stripe setup →" : "Connect with Stripe →"}</button>
              </form>
            ) : null}
            {connection && (underReview || query.stripe === "sync-error") ? (
              <form action={syncStripeConnection.bind(null, schoolId)}>
                <button className="w-full border border-line px-5 py-3 text-sm text-ink transition hover:border-brand hover:text-brand sm:w-auto">Check status</button>
              </form>
            ) : null}
          </div>
          {!ready ? <p className="mt-5 text-xs leading-5 text-muted">Integrated payments are optional. Your school can keep using the rest of Common Time while setup is incomplete, under review, or unavailable.</p> : null}
          {connection?.last_synced_at ? <p className="mt-6 text-xs text-muted">Last synchronized {new Date(connection.last_synced_at).toLocaleString("en-US")}</p> : null}
        </div>
      </section>
    </main>
  );
}
