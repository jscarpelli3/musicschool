import { MdArrowDownward, MdCreditCard } from "react-icons/md";

export function BillingCollectionStatus({ amount, hasPaymentMethod }: {
  amount: string;
  hasPaymentMethod: boolean;
}) {
  return (
    <div className="mt-5 rounded-card border border-brand/30 bg-brand/5 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl text-brand"><MdCreditCard /></span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Payment collection</p>
          <h3 className="mt-1 font-display text-2xl">{hasPaymentMethod ? "Approved — collection is not enabled yet" : "Approved — card setup needed"}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {hasPaymentMethod
              ? `The payer approved ${amount}, and an active payment method is saved. This build does not execute invoice charges yet, so no collection button is shown and nothing will be charged.`
              : `The payer approved ${amount}, but this family has no active saved payment method. Common Time cannot collect this invoice until the payer securely adds one.`}
          </p>
          {!hasPaymentMethod ? <a href="#payment-methods" className="mt-5 inline-flex items-center gap-2 border border-brand px-4 py-2.5 text-sm text-brand transition hover:bg-brand hover:text-canvas">Go to payment-method setup <MdArrowDownward aria-hidden="true" /></a> : null}
          {!hasPaymentMethod ? <p className="mt-3 max-w-2xl text-xs leading-5 text-muted">Create a secure Stripe setup link below and send it to the payer. Saving a card will prepare the account, but invoice charge execution is still the next workflow to be built.</p> : null}
        </div>
      </div>
    </div>
  );
}
