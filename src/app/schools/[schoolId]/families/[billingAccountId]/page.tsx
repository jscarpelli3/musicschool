import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DetailHeader, DetailSection, EmptyDetail } from "@/components/people/detail-shell";
import { normalizeE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CardSetupControls } from "./card-setup-controls";
import { BillingDraftForm } from "./billing-draft-form";
import { BillingApprovalEmail } from "./billing-approval-email";
import { BillingContactEmail } from "./billing-contact-email";
import { BillingContactPhone } from "./billing-contact-phone";
import { BillingPeriodLock } from "./billing-period-lock";
import { BillingPeriodUnlock } from "./billing-period-unlock";
import { PaymentMethodRemove } from "./payment-method-remove";
import { BillingAdjustmentForm, BillingAdjustmentRemove } from "./billing-adjustments";

export const dynamic = "force-dynamic";

function name(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function FamilyDetailPage({ params, searchParams }: {
  params: Promise<{ schoolId: string; billingAccountId: string }>;
  searchParams: Promise<{ card?: string; billing?: string; period?: string }>;
}) {
  const { schoolId, billingAccountId } = await params;
  const { card, billing, period: selectedPeriodId } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/families/${billingAccountId}`);

  const initial = await Promise.all([
    supabase.from("schools").select("id, name, currency, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_accounts").select("id, name, status, billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle(),
  ]);
  const failedInitial = initial.find((result) => result.error);
  if (failedInitial?.error) throw new Error(`Family detail could not load: ${failedInitial.error.message}`);
  const [{ data: school }, { data: membership }, { data: account }] = initial;
  if (!school || !membership || !account) notFound();

  const related = await Promise.all([
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("billing_account_students").select("student_id").eq("school_id", schoolId).eq("billing_account_id", billingAccountId),
    supabase.from("billing_periods").select("id, label, period_start, period_end, status, amount_due_cents, currency").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("period_start", { ascending: false }).limit(12),
    supabase.from("billing_payment_methods").select("id, display_label, brand, last_four, exp_month, exp_year, is_default, status").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("is_default", { ascending: false }),
    supabase.from("payment_attempts").select("billing_period_id, amount_cents, status").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("status", "succeeded"),
    supabase.from("payment_method_setup_requests").select("id, status, expires_at, created_at").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("created_at", { ascending: false }).limit(3),
    supabase.from("school_payment_connections").select("status, charges_enabled").eq("school_id", schoolId).eq("provider", "stripe").maybeSingle(),
    supabase.from("billing_approval_requests").select("id, billing_period_id, approval_status, approved_at, created_at").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("created_at", { ascending: false }),
    supabase.from("email_deliveries").select("approval_request_id, status, created_at").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("created_at", { ascending: false }),
  ]);
  const failedRelated = related.find((result) => result.error);
  if (failedRelated?.error) throw new Error(`Family detail could not load: ${failedRelated.error.message}`);
  const [peopleResult, studentsResult, periodsResult, methodsResult, attemptsResult, setupRequestsResult, connectionResult, approvalRequestsResult, emailDeliveriesResult] = related;
  const periodIds = (periodsResult.data ?? []).map((period) => period.id);
  const { data: lineItems, error: lineItemsError } = periodIds.length
    ? await supabase.from("billing_line_items")
      .select("id, billing_period_id, description, service_date, amount_cents, metadata, source_type")
      .eq("school_id", schoolId).in("billing_period_id", periodIds)
      .order("service_date", { ascending: true, nullsFirst: false }).order("created_at")
    : { data: [], error: null };
  if (lineItemsError) throw new Error(`Billing detail could not load: ${lineItemsError.message}`);
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const contact = people.get(account.billing_contact_person_id);
  const contactPhone = normalizeE164(contact?.phone ?? "");
  const { data: smsConsentState } = contactPhone
    ? await createAdminClient().rpc("get_sms_consent_state", { p_phone_e164: contactPhone, p_school_name: school.name })
    : { data: "not_enrolled" };
  const students = (studentsResult.data ?? []).flatMap((link) => {
    const person = people.get(link.student_id);
    return person ? [{ id: link.student_id, person }] : [];
  });
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const paidByPeriod = (attemptsResult.data ?? []).reduce<Record<string, number>>((totals, attempt) => {
    totals[attempt.billing_period_id] = (totals[attempt.billing_period_id] ?? 0) + attempt.amount_cents;
    return totals;
  }, {});
  const canManagePayments = ["owner", "admin"].includes(membership.role);
  const stripeReady = connectionResult.data?.status === "enabled" && connectionResult.data.charges_enabled;
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: school.timezone, year: "numeric", month: "2-digit" }).format(new Date());
  const billingMessages: Record<string, string> = {
    prepared: "Draft prepared from the current schedule and saved to the billing ledger.",
    needs_review: "Draft stopped without changing the ledger. At least one lesson needs an outcome or an effective cancellation policy.",
    not_refreshable: "That period has already moved beyond review and cannot be refreshed.",
    invalid_month: "Choose a valid service month.",
    error: "The draft could not be prepared. The prior ledger state was left intact.",
  };
  const billingLines = lineItems ?? [];
  type BillingLine = (typeof billingLines)[number];
  const linesByPeriod = billingLines.reduce<Record<string, BillingLine[]>>((groups, line) => {
    (groups[line.billing_period_id] ??= []).push(line);
    return groups;
  }, {});
  const periodByApprovalRequest = new Map((approvalRequestsResult.data ?? []).map((request) => [request.id, request.billing_period_id]));
  const latestApprovalByPeriod = new Map<string, (typeof approvalRequestsResult.data extends (infer T)[] | null ? T : never)>();
  for (const request of approvalRequestsResult.data ?? []) if (request.billing_period_id && !latestApprovalByPeriod.has(request.billing_period_id)) latestApprovalByPeriod.set(request.billing_period_id, request);
  const latestEmailStatusByPeriod = new Map<string, string>();
  for (const delivery of emailDeliveriesResult.data ?? []) {
    const billingPeriodId = periodByApprovalRequest.get(delivery.approval_request_id);
    if (billingPeriodId && !latestEmailStatusByPeriod.has(billingPeriodId)) latestEmailStatusByPeriod.set(billingPeriodId, delivery.status);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <DetailHeader backHref={`/schools/${schoolId}`} backLabel="Dashboard" eyebrow={`${school.name} · Family account`} title={account.name} meta={`${account.status} billing relationship · ${students.length} ${students.length === 1 ? "student" : "students"}`} />

      <DetailSection title="Primary payer" description="The person currently responsible for this billing account.">
        {contact ? <div><p className="font-display text-3xl">{name(contact)}</p><p className="mt-3 text-xs uppercase tracking-[0.14em] text-brand">{contact.status}</p>{canManagePayments ? <><BillingContactEmail schoolId={schoolId} billingAccountId={billingAccountId} email={contact.email ?? ""} /><BillingContactPhone schoolId={schoolId} schoolName={school.name} billingAccountId={billingAccountId} phone={contact.phone ?? ""} consentState={smsConsentState ?? "not_enrolled"} /></> : <><p className="mt-3 text-sm text-muted">{contact.email || "No email recorded"}</p><p className="mt-3 text-sm text-muted">{contact.phone || "No mobile number recorded"}</p></>}</div> : <EmptyDetail>The billing contact record is unavailable.</EmptyDetail>}
      </DetailSection>

      <DetailSection title="Students" description="Students whose charges roll into this family billing account.">
        <div className="space-y-1">
          {students.map(({ id, person }) => <Link key={id} href={`/schools/${schoolId}/students/${id}`} className="flex items-center justify-between border-b border-line py-5 first:pt-0 hover:text-brand"><span>{name(person)}</span><span className="text-brand">→</span></Link>)}
          {!students.length ? <EmptyDetail>No students are linked to this account.</EmptyDetail> : null}
        </div>
      </DetailSection>

      <DetailSection title="Billing history" description="Durable monthly billing periods. Draft amounts remain visibly distinct from paid provider truth.">
        <div className="space-y-7">
          {canManagePayments ? <BillingDraftForm schoolId={schoolId} billingAccountId={billingAccountId} defaultMonth={currentMonth} /> : null}
          {billing && billingMessages[billing] ? <p role="status" className={`border-l-2 pl-4 text-sm leading-6 ${billing === "prepared" ? "border-brand text-ink" : "border-danger text-danger"}`}>{billingMessages[billing]}</p> : null}
          <div className="space-y-1">
          {(periodsResult.data ?? []).map((billingPeriod) => {
            const periodLines = linesByPeriod[billingPeriod.id] ?? [];
            return (
              <details key={billingPeriod.id} open={billingPeriod.id === selectedPeriodId} className="border-b border-line py-5 first:pt-0">
                <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-4 marker:hidden">
                  <div><p>{billingPeriod.label}</p><p className="mt-2 text-xs text-muted">{billingPeriod.period_start}–{billingPeriod.period_end} · <span className="uppercase">{billingPeriod.status}</span> · {periodLines.length} lines</p></div>
                  <div className="text-right"><p>{money(billingPeriod.amount_due_cents, billingPeriod.currency)}</p><p className="mt-2 text-xs text-muted">{money(paidByPeriod[billingPeriod.id] ?? 0, billingPeriod.currency)} paid</p></div>
                </summary>
                <div className="mt-5 border-l border-line pl-4 sm:pl-5">
                  {periodLines.map((line) => {
                    const metadata = line.metadata && typeof line.metadata === "object" && !Array.isArray(line.metadata) ? line.metadata : {};
                    const disposition = "disposition" in metadata && typeof metadata.disposition === "string" ? metadata.disposition : line.source_type.replaceAll("_", " ");
                    return <div key={line.id} className="grid gap-2 border-t border-line py-4 first:border-t-0 sm:grid-cols-[1fr_auto] sm:gap-6"><div><p className="text-sm">{line.description}</p><p className="mt-1 text-xs text-muted">{line.service_date ?? "Period adjustment"} · <span className="uppercase">{line.source_type === "manual_adjustment" ? "owner adjustment" : disposition}</span></p>{canManagePayments && ["draft", "review"].includes(billingPeriod.status) && line.source_type === "manual_adjustment" ? <div className="mt-2"><BillingAdjustmentRemove schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={billingPeriod.id} adjustmentId={line.id} /></div> : null}</div><p className={`text-sm sm:text-right ${(line.amount_cents ?? 0) < 0 ? "text-brand" : ""}`}>{money(line.amount_cents ?? 0, billingPeriod.currency)}</p></div>;
                  })}
                  {!periodLines.length ? <EmptyDetail>No line items are recorded.</EmptyDetail> : null}
                  {canManagePayments && ["draft", "review"].includes(billingPeriod.status) ? <BillingAdjustmentForm schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={billingPeriod.id} /> : null}
                  {canManagePayments && ["draft", "review"].includes(billingPeriod.status) && billingPeriod.amount_due_cents > 0 ? <div className="border-t border-line pt-5"><p className="max-w-lg text-xs leading-5 text-muted">Lock only after reviewing every line. Locking freezes this exact amount for the separate payer-approval step.</p><BillingPeriodLock schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={billingPeriod.id} /></div> : null}
                  {canManagePayments && billingPeriod.status === "locked" && !latestApprovalByPeriod.get(billingPeriod.id) ? <BillingPeriodUnlock schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={billingPeriod.id} /> : null}
                  {canManagePayments && ["locked", "approval_pending", "approved"].includes(billingPeriod.status) && billingPeriod.amount_due_cents > 0 ? <BillingApprovalEmail schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={billingPeriod.id} latestStatus={latestEmailStatusByPeriod.get(billingPeriod.id)} approvalStatus={latestApprovalByPeriod.get(billingPeriod.id)?.approval_status} approvedAt={latestApprovalByPeriod.get(billingPeriod.id)?.approved_at} /> : null}
                </div>
              </details>
            );
          })}
          {!(periodsResult.data ?? []).length ? <EmptyDetail>No billing periods have been prepared.</EmptyDetail> : null}
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Payment methods" description="Safe provider references only. MusicSchool never stores card numbers or bank credentials.">
        <div className="space-y-5">
          {card === "complete" ? <p className="border-l-2 border-brand pl-4 text-sm text-ink">Stripe received the setup. The saved method will appear here after verified webhook reconciliation.</p> : null}
          {card === "canceled" ? <p className="border-l-2 border-line pl-4 text-sm text-muted">Card setup was canceled. Nothing was saved.</p> : null}
          {card === "error" ? <p className="border-l-2 border-danger pl-4 text-sm text-danger">Secure card setup could not start. No card information was collected.</p> : null}
          {(methodsResult.data ?? []).map((method) => <div key={method.id} className="grid gap-4 border-b border-line pb-5 last:border-0 sm:grid-cols-[1fr_auto]"><div><p className="capitalize">{method.brand ?? "Payment method"}{method.last_four ? ` ending in ${method.last_four}` : ""}</p>{method.exp_month && method.exp_year ? <p className="mt-2 text-xs text-muted">Expires {method.exp_month}/{method.exp_year}</p> : null}<span className="mt-3 block text-xs uppercase tracking-[0.14em] text-brand">{method.is_default ? "Default" : method.status}</span></div>{canManagePayments && method.status !== "detached" ? <div className="w-full sm:w-48"><PaymentMethodRemove schoolId={schoolId} billingAccountId={billingAccountId} paymentMethodId={method.id} /></div> : null}</div>)}
          {!(methodsResult.data ?? []).length ? <EmptyDetail>No payment method has been set up.</EmptyDetail> : null}
          {canManagePayments ? <CardSetupControls schoolId={schoolId} billingAccountId={billingAccountId} disabled={!stripeReady} /> : null}
          {canManagePayments && (setupRequestsResult.data ?? []).length ? <div className="border-t border-line pt-5"><p className="text-xs uppercase tracking-[0.14em] text-muted">Recent setup activity</p><div className="mt-3 space-y-2">{(setupRequestsResult.data ?? []).map((request) => <p key={request.id} className="flex justify-between gap-4 text-xs text-muted"><span>{new Date(request.created_at).toLocaleString()}</span><span className="uppercase text-brand">{request.status}</span></p>)}</div></div> : null}
        </div>
      </DetailSection>
    </main>
  );
}
