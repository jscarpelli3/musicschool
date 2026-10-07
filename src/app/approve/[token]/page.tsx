import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { formatCompactDate } from "@/lib/date-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { MdCalendarMonth, MdCheckCircleOutline, MdFamilyRestroom, MdReceiptLong } from "react-icons/md";
import { approveBillingRequest } from "./actions";
import { AutoChargeEnrollment } from "./auto-charge-enrollment";
import { RejectChargesForm } from "./reject-charges-form";

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

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_billing_approval", { raw_token: token });
  const approval = (data?.[0] ?? null) as Approval | null;

  if (error || !approval) notFound();

  const canApprove = approval.approval_status === "pending";
  const invalidated = ["rejected", "cancelled", "expired"].includes(approval.approval_status);
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
        <h1 className="mt-2 font-display text-3xl leading-none sm:text-4xl">{invalidated ? "Statement unavailable" : "Review lesson charges"}</h1>
      </header>

      {invalidated ? (
        <section className="py-14 sm:py-20" aria-labelledby="invalidated-statement">
          <p className="text-sm text-brand">This link is no longer active</p>
          <h2 id="invalidated-statement" className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-6xl">{invalidatedTitle}</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">{invalidatedMessage}</p>
        </section>
      ) : <>
      <section className="py-8 sm:py-10" aria-labelledby="charge-breakdown">
        <div className="ui-card grid gap-6 p-6 sm:grid-cols-[1.25fr_1fr_auto] sm:items-center sm:p-7">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdFamilyRestroom aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-muted">Family</p><p className="mt-1 font-display text-2xl">{approval.billing_account_name}</p><p className="mt-1 text-sm text-muted">{approval.student_names.length ? approval.student_names.join(", ") : "Student details unavailable"}</p></div></div>
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdCalendarMonth aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-muted">Billing period</p><p className="mt-1 text-lg">{approval.period_label}</p>{approval.period_start && approval.period_end ? <p className="mt-1 text-sm text-muted">{formatCompactDate(approval.period_start)}–{formatCompactDate(approval.period_end)}</p> : null}</div></div>
          <div className="border-t border-line pt-5 text-left sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right"><p className="text-xs uppercase tracking-[0.14em] text-muted">Amount to approve</p><p className="mt-1 font-display text-4xl text-brand">{money(approval.amount_cents, approval.currency)}</p></div>
        </div>

        <div className="ui-card mt-6 overflow-hidden p-6 sm:p-7">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdReceiptLong aria-hidden="true" /></span>
            <div>
              <h2 id="charge-breakdown" className="font-display text-2xl">Charge breakdown</h2>
              <p className="mt-1 text-sm text-muted">Review each lesson included in this amount.</p>
            </div>
          </div>

        <ul>
          {approval.line_items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="grid grid-cols-[1fr_auto] gap-5 border-b border-line py-5">
              <div>
                <p>{item.label}</p>
                {item.detail ? <p className="mt-1 text-sm text-muted">{formatCompactDate(item.detail)}</p> : null}
              </div>
              <p>{money(item.amount_cents, approval.currency)}</p>
            </li>
          ))}
        </ul>
        </div>
      </section>

      <section>
        {canApprove ? (
          <>
            <div className="ui-card border border-brand/30 p-6 sm:p-7">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdCheckCircleOutline aria-hidden="true" /></span><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Everything looks right</p><h2 className="mt-1 font-display text-2xl">Approve {money(approval.amount_cents, approval.currency)}</h2></div></div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Hold below to approve this exact amount. Approval itself does not charge your card; it allows the school to collect it separately.</p>
              <div className="mt-6"><HoldToConfirm action={approve} idleLabel={`Hold to approve ${money(approval.amount_cents, approval.currency)}`} refreshOnSuccess /></div>
            </div>
            <RejectChargesForm token={token} />
          </>
        ) : (
          <div className="border-l border-brand pl-5">
            <p className="font-display text-3xl capitalize">{approval.approval_status}</p>
            <p className="mt-2 text-sm text-muted">
              {approval.approval_status === "approved"
                ? "The school has your approval. This does not mean the payment has been processed."
                : "Contact the school if you need a new approval request."}
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-4 border-t border-line pt-6 text-sm text-muted sm:grid-cols-2">
          <p>Expires {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(approval.expires_at))}</p>
          <p className="sm:text-right">A Stripe receipt is emailed only after a successful charge.</p>
        </div>
        {approval.approval_status === "approved" && enrollment ? <AutoChargeEnrollment token={token} schoolName={enrollment.school_name} accountName={enrollment.billing_account_name} methodLabel={enrollment.payment_method_label ?? "saved payment method"} lastFour={enrollment.payment_method_last_four} amountCents={enrollment.current_amount_cents} currency={enrollment.currency} eligible={enrollment.eligible} activeMandate={Boolean(enrollment.active_mandate_id)} initialCapCents={enrollment.monthly_cap_cents} initialNoticeDays={enrollment.advance_notice_days} /> : null}
      </section>
      </>}
    </main>
  );
}
