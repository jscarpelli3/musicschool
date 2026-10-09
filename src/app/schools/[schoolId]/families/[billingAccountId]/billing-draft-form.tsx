"use client";

import { useFormStatus } from "react-dom";
import { prepareFamilyBillingDraft } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="w-full rounded-control bg-brand px-5 py-3 text-sm text-canvas transition hover:-translate-y-px hover:bg-brand-hover disabled:opacity-50 sm:w-auto">
      {pending ? "Preparing…" : "Prepare a new invoice →"}
    </button>
  );
}

export function BillingDraftForm({ schoolId, billingAccountId, defaultMonth }: {
  schoolId: string;
  billingAccountId: string;
  defaultMonth: string;
}) {
  return (
    <form action={prepareFamilyBillingDraft.bind(null, schoolId, billingAccountId)} className="grid gap-4 border-b border-line pb-7 sm:grid-cols-[auto_minmax(10rem,1fr)] sm:items-end">
      <Submit />
      <label className="sm:justify-self-end">
        <span className="block text-xs text-muted sm:text-right">Invoice month</span>
        <input required type="month" name="month" defaultValue={defaultMonth} className="mt-2 w-full rounded-control border border-line bg-surface px-3 py-2.5 outline-none transition focus:border-brand sm:w-52" />
      </label>
    </form>
  );
}
