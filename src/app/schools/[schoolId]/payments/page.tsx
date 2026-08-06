import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";
import { startStripeOnboarding, syncStripeConnection } from "./actions";

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
      key: field,
      title: "Additional Stripe information",
      detail: `Stripe requires ${field.replaceAll("_", " ").replaceAll(".", " › ")}.`,
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

  const [{ data: school }, { data: membership }, { data: connection, error: connectionError }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_payment_connections").select("status, details_submitted, charges_enabled, payouts_enabled, disabled_reason, currently_due, past_due, pending_verification, requirement_errors, requirements_deadline, last_synced_at").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", false).maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);
  if (connectionError) throw connectionError;

  const message = query.stripe ? messages[query.stripe] : undefined;
  const ready = connection?.charges_enabled && connection?.payouts_enabled;
  const requirements = requirementTasks([
    ...(Array.isArray(connection?.past_due) ? connection.past_due : []),
    ...(Array.isArray(connection?.currently_due) ? connection.currently_due : []),
  ]);
  const pending = requirementTasks(connection?.pending_verification);
  const errors = Array.isArray(connection?.requirement_errors) ? connection.requirement_errors : [];
  const actionRequired = requirements.length > 0;
  const statusTitle = ready ? "Ready" : actionRequired ? "Action required" : pending.length ? "Under review" : connection ? "Setup in progress" : "Not connected";

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
              <p className="mt-2 font-display text-3xl">{statusTitle}</p>
            </div>
            <span className={`mt-2 h-2.5 w-2.5 rounded-full ${ready ? "bg-brand" : "bg-muted"}`} aria-hidden="true" />
          </div>

          <dl className="grid grid-cols-2 border-b border-line py-7 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Details</dt><dd className="mt-2">{connection?.details_submitted ? "Submitted" : "Pending"}</dd></div>
            <div><dt className="text-muted">Charges</dt><dd className="mt-2">{connection?.charges_enabled ? "Enabled" : "Pending"}</dd></div>
            <div className="mt-5 sm:mt-0"><dt className="text-muted">Payouts</dt><dd className="mt-2">{connection?.payouts_enabled ? "Enabled" : "Pending"}</dd></div>
          </dl>

          {actionRequired ? <div className="border-b border-line py-7"><p className="text-xs uppercase tracking-[0.15em] text-danger">Owner action required</p><div className="mt-5 space-y-5">{requirements.map((task) => <div key={task.key} className="border-l border-danger pl-4"><p className="text-sm text-ink">{task.title}</p><p className="mt-1 text-sm leading-6 text-muted">{task.detail}</p></div>)}</div>{connection?.requirements_deadline ? <p className="mt-5 text-xs text-danger">Due by {new Date(connection.requirements_deadline).toLocaleString("en-US")}</p> : null}</div> : null}
          {pending.length ? <div className="border-b border-line py-7"><p className="text-xs uppercase tracking-[0.15em] text-brand">Stripe is reviewing</p>{pending.map((task) => <p key={task.key} className="mt-3 text-sm text-muted">{task.title}</p>)}</div> : null}
          {errors.length ? <p className="border-b border-line py-5 text-sm text-danger">Stripe rejected some submitted information. Continue in Stripe to review and correct it.</p> : null}
          {!actionRequired && !pending.length && connection?.disabled_reason && !ready ? <p className="border-b border-line py-5 text-sm text-danger">Stripe has limited this account: {connection.disabled_reason.replaceAll("_", " ").replaceAll(".", " › ")}</p> : null}

          <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-center">
            {!ready ? (
              <form action={startStripeOnboarding.bind(null, schoolId)}>
                <button className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-surface sm:w-auto">{connection ? actionRequired ? "Provide details in Stripe →" : "Continue Stripe setup →" : "Connect with Stripe →"}</button>
              </form>
            ) : null}
            {connection && (pending.length > 0 || query.stripe === "sync-error") ? (
              <form action={syncStripeConnection.bind(null, schoolId)}>
                <button className="w-full border-b border-line px-1 py-2 text-sm text-muted transition hover:border-brand hover:text-ink sm:w-auto">Check Stripe again</button>
              </form>
            ) : null}
          </div>
          {pending.length ? <p className="mt-4 text-xs leading-5 text-muted">Stripe normally updates this automatically. Use “Check Stripe again” only after waiting for a review or completing something in another Stripe tab.</p> : null}
          {connection?.last_synced_at ? <p className="mt-6 text-xs text-muted">Last synchronized {new Date(connection.last_synced_at).toLocaleString("en-US")}</p> : null}
        </div>
      </section>
    </main>
  );
}
