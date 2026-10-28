import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { formatCompactDate } from "@/lib/date-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MdCalendarMonth, MdCheckCircleOutline, MdFamilyRestroom, MdReceiptLong } from "react-icons/md";
import { approveBillingRequest } from "./actions";
import { AutoChargeEnrollment } from "./auto-charge-enrollment";
import { RejectChargesForm } from "./reject-charges-form";
import { OneTimeInvoicePayment } from "./one-time-invoice-payment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review lesson charges",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type LineItem = {
  label: string;
  detail?: string;
  amount_cents: number;
};

type Approval = {
  school_name: string;
  billing_account_name: string;
  student_names: string[];
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  line_items: LineItem[];
  amount_cents: number;
  currency: string;
  approval_status: string;
  payment_status: string;
  collection_action: string;
  expires_at: string;
  approved_at: string | null;
  has_newer_request: boolean;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function StatementDetails({ approval, sentBack = false }: { approval: Approval; sentBack?: boolean }) {
  return (
    <section className="relative py-8 sm:py-10" aria-labelledby="charge-breakdown">
      <div className={sentBack ? "pointer-events-none select-none opacity-45 grayscale" : undefined} aria-hidden={sentBack || undefined}>
        <div className="ui-card grid gap-6 p-6 sm:grid-cols-[1.25fr_1fr_auto] sm:items-center sm:p-7">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdFamilyRestroom aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-muted">Family</p><p className="mt-1 font-display text-2xl">{approval.billing_account_name}</p><p className="mt-1 text-sm text-muted">{approval.student_names.length ? approval.student_names.join(", ") : "Student details unavailable"}</p></div></div>
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdCalendarMonth aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-muted">Billing period</p><p className="mt-1 text-lg">{approval.period_label}</p>{approval.period_start && approval.period_end ? <p className="mt-1 text-sm text-muted">{formatCompactDate(approval.period_start)}–{formatCompactDate(approval.period_end)}</p> : null}</div></div>
          <div className="border-t border-line pt-5 text-left sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right"><p className="text-xs uppercase tracking-[0.14em] text-muted">{sentBack ? "Invoice total" : "Amount to approve"}</p><p className="mt-1 font-display text-4xl text-brand">{money(approval.amount_cents, approval.currency)}</p></div>
        </div>

        <div className="ui-card mt-6 overflow-hidden p-6 sm:p-7">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdReceiptLong aria-hidden="true" /></span>
            <div><h2 id="charge-breakdown" className="font-display text-2xl">Charge breakdown</h2><p className="mt-1 text-sm text-muted">{sentBack ? "The invoice returned to the school." : "Review each lesson included in this amount."}</p></div>
          </div>
          <ul>{approval.line_items.map((item, index) => <li key={`${item.label}-${index}`} className="grid grid-cols-[1fr_auto] gap-5 border-b border-line py-5"><div><p>{item.label}</p>{item.detail ? <p className="mt-1 text-sm text-muted">{formatCompactDate(item.detail)}</p> : null}</div><p>{money(item.amount_cents, approval.currency)}</p></li>)}</ul>
        </div>
      </div>
      {sentBack ? <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-3" aria-hidden="true"><div className="-rotate-6 border-4 border-brand bg-canvas/95 px-5 py-4 text-center font-display text-3xl uppercase leading-none tracking-[0.05em] text-brand shadow-xl sm:px-9 sm:py-5 sm:text-5xl">Sent back<br />for review</div></div> : null}
    </section>
  );
}

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_billing_approval", { raw_token: token });
  const approval = (data?.[0] ?? null) as Approval | null;

  if (error || !approval) notFound();

  const portalClient = await createClient();
  const { data: portalAuth } = await portalClient.auth.getClaims();
  const portalSignedIn = Boolean(portalAuth?.claims?.sub);

  const canApprove = approval.approval_status === "pending";
  const invalidated = ["rejected", "cancelled", "expired"].includes(approval.approval_status);
  const sentBack = approval.approval_status === "rejected" && !approval.has_newer_request;
  const invalidatedTitle = approval.has_newer_request
    ? "This statement was updated."
    : approval.approval_status === "rejected"
      ? "This statement was sent back."
      : approval.approval_status === "expired"
        ? "This link has expired."
        : "This statement was cancelled.";
  const invalidatedMessage = approval.has_newer_request
    ? "This link can no longer be used. Check your email for the revised statement from the school."
    : approval.approval_status === "rejected"
      ? "Your response was sent to the school. This link can no longer be approved."
      : approval.approval_status === "expired"
        ? "Contact the school if you need a new statement."
        : "Contact the school if you expected a replacement statement.";
  const approve = approveBillingRequest.bind(null, token);
  const { data: enrollmentRows } = approval.approval_status === "approved"
    ? await supabase.rpc("get_auto_charge_enrollment", { raw_token: token })
    : { data: null };
  const enrollment = enrollmentRows?.[0];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-line pb-7">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">{approval.school_name}</p>
        <h1 className="mt-2 font-display text-3xl leading-none sm:text-4xl">{sentBack ? "Invoice sent back for review" : invalidated ? "Statement unavailable" : "Review lesson charges"}</h1>
      </header>

      {sentBack ? <>
        <section className="pt-10 text-center sm:pt-14" aria-labelledby="sent-back-heading">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">Request received</p>
          <h2 id="sent-back-heading" className="mt-3 font-display text-4xl leading-tight sm:text-5xl">The school has your change request.</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">Nothing was charged. The school can review your note, update the invoice, and send you a new approval request.</p>
        </section>
        <StatementDetails approval={approval} sentBack />
      </> : invalidated ? (
        <section className="py-14 sm:py-20" aria-labelledby="invalidated-statement">
          <p className="text-sm text-brand">This link is no longer active</p>
          <h2 id="invalidated-statement" className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-6xl">{invalidatedTitle}</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">{invalidatedMessage}</p>
        </section>
      ) : <>
      <StatementDetails approval={approval} />

      <section>
        {canApprove ? (
          <>
            <div className="ui-card border border-brand/30 p-6 sm:p-7">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdCheckCircleOutline aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Everything looks right</p><h2 className="mt-1 font-display text-2xl">Approve {money(approval.amount_cents, approval.currency)}</h2></div></div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Hold below to approve this exact amount. Approval itself does not charge your card; it allows the school to collect it separately.</p>
              <div className="mt-6"><HoldToConfirm action={approve} idleLabel={`Hold to approve ${money(approval.amount_cents, approval.currency)}`} refreshOnSuccess /></div>
              <p className="mt-4 text-xs leading-5 text-muted">Want to pay now without leaving a card on file? Approve the amount first, then choose the one-time payment option.</p>
            </div>
            <RejectChargesForm token={token} />
          </>
        ) : (
          <div className={`ui-card p-6 sm:p-7 ${approval.approval_status === "approved" ? "border border-brand/30" : ""}`}>
            <p className="font-display text-3xl">{approval.approval_status === "approved" ? "Approved!" : approval.approval_status}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {approval.approval_status === "approved"
                ? `You approved ${approval.school_name} to charge ${money(approval.amount_cents, approval.currency)} to your card on file. The school can now collect this amount. Your card has not been charged yet.`
                : "Contact the school if you need a new approval request."}
            </p>
          </div>
        )}

        {approval.approval_status === "approved" && approval.payment_status !== "succeeded" ? <OneTimeInvoicePayment token={token} amount={money(approval.amount_cents, approval.currency)} /> : null}

        <div className="mt-10 grid gap-4 border-t border-line pt-6 text-sm text-muted sm:grid-cols-2">
          <p>Expires {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(approval.expires_at))}</p>
          <p className="sm:text-right">A Stripe receipt is emailed only after a successful charge.</p>
        </div>
        {approval.approval_status === "approved" && enrollment ? <AutoChargeEnrollment token={token} schoolName={enrollment.school_name} accountName={enrollment.billing_account_name} methodLabel={enrollment.payment_method_label ?? "saved payment method"} lastFour={enrollment.payment_method_last_four} amountCents={enrollment.current_amount_cents} currency={enrollment.currency} eligible={enrollment.eligible} activeMandate={Boolean(enrollment.active_mandate_id)} initialCapCents={enrollment.monthly_cap_cents} initialNoticeDays={enrollment.advance_notice_days} /> : null}
      </section>
      </>}
      <aside className="mt-12 rounded-card bg-surface-raised p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8" aria-labelledby="family-portal-heading">
        <div><p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">Your family account</p><h2 id="family-portal-heading" className="mt-2 font-display text-2xl">Schedules, invoices, and lesson requests</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">{portalSignedIn ? "You’re already signed in on this device." : "You’ll verify your email with a one-time code before seeing private family information."}</p></div>
        <Link href="/portal" className="mt-5 inline-flex shrink-0 items-center justify-center rounded-control bg-brand px-5 py-3 text-sm font-semibold uppercase tracking-[0.06em] text-canvas transition hover:-translate-y-px sm:mt-0">{portalSignedIn ? "Go to family portal" : "Log in to family portal"} →</Link>
      </aside>
    </main>
  );
}
