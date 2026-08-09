"use client";

import { useActionState } from "react";
import { sendBillingApprovalSms, type BillingApprovalSmsState } from "./actions";

const initialState: BillingApprovalSmsState = { ok: false, message: "" };

export function BillingApprovalSms({ schoolId, billingAccountId, billingPeriodId, latestStatus }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  latestStatus?: string;
}) {
  const [state, action, pending] = useActionState(
    sendBillingApprovalSms.bind(null, schoolId, billingAccountId, billingPeriodId),
    initialState,
  );

  return (
    <form action={action} className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm">Payer approval by text</p>
          <p className="mt-1 text-xs text-muted">
            {latestStatus ? <>Latest delivery: <span className="uppercase text-brand">{latestStatus}</span></> : "No approval text has been prepared."}
          </p>
        </div>
        <button type="submit" disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">
          {pending ? "Sending…" : latestStatus ? "Send a new link" : "Send approval link"}
        </button>
      </div>
      {state.message ? <p role="status" className={`mt-4 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
