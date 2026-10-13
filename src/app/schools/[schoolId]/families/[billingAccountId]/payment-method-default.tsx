"use client";

import { useActionState } from "react";
import { setDefaultFamilyPaymentMethod } from "./actions";

const initialState = { ok: false, message: "" };

export function PaymentMethodDefault({ schoolId, billingAccountId, paymentMethodId }: {
  schoolId: string;
  billingAccountId: string;
  paymentMethodId: string;
}) {
  const boundAction = setDefaultFamilyPaymentMethod.bind(null, schoolId, billingAccountId, paymentMethodId);
  const [state, action, pending] = useActionState(boundAction, initialState);
  return <div>
    <form action={action}><button disabled={pending} className="w-full rounded-control border border-line px-4 py-2 text-sm text-brand transition hover:border-brand hover:bg-brand/10 disabled:cursor-wait disabled:opacity-50">{pending ? "Updating…" : "Make default"}</button></form>
    {state.message ? <p role="status" className={`mt-2 text-xs leading-5 ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
  </div>;
}
