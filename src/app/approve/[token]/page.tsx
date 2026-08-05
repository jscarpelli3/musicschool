import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { createPublicClient } from "@/lib/supabase/public";
import { approveBillingRequest } from "./actions";

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
  period_label: string;
  line_items: LineItem[];
  amount_cents: number;
  currency: string;
  approval_status: string;
  payment_status: string;
  collection_action: string;
  expires_at: string;
  approved_at: string | null;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_billing_approval", { raw_token: token });
  const approval = (data?.[0] ?? null) as Approval | null;

  if (error || !approval) notFound();

  const canApprove = approval.approval_status === "pending";
  const approve = approveBillingRequest.bind(null, token);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-line pb-8 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{approval.school_name}</p>
          <h1 className="mt-3 font-display text-4xl leading-none sm:text-6xl">Review this month</h1>
        </div>
        <p className="mt-5 text-sm text-muted sm:mt-0">{approval.period_label}</p>
      </header>

      <section className="py-8 sm:py-12" aria-labelledby="charge-breakdown">
        <div className="flex items-baseline justify-between gap-6 border-b border-line pb-5">
          <div>
            <h2 id="charge-breakdown" className="text-lg">Charge breakdown</h2>
            <p className="mt-1 text-sm text-muted">For {approval.billing_account_name}</p>
          </div>
          <p className="font-display text-3xl text-brand sm:text-4xl">
            {money(approval.amount_cents, approval.currency)}
          </p>
        </div>

        <ul>
          {approval.line_items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="grid grid-cols-[1fr_auto] gap-5 border-b border-line py-5">
              <div>
                <p>{item.label}</p>
                {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
              </div>
              <p>{money(item.amount_cents, approval.currency)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line pt-8">
        {canApprove ? (
          <>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Hold below to approve this exact amount. The school may then charge the payment method you authorized them to keep on file. Approval itself does not charge your card.
            </p>
            <div className="mt-6">
              <HoldToConfirm action={approve} idleLabel={`Hold to approve ${money(approval.amount_cents, approval.currency)}`} />
            </div>
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
      </section>
    </main>
  );
}
