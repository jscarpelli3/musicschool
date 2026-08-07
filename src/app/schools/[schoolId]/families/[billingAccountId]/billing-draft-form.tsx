"use client";

import { useFormStatus } from "react-dom";
import { prepareFamilyBillingDraft } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50 sm:w-auto">
      {pending ? "Preparing…" : "Prepare / refresh draft →"}
    </button>
  );
}

export function BillingDraftForm({ schoolId, billingAccountId, defaultMonth }: {
  schoolId: string;
  billingAccountId: string;
  defaultMonth: string;
}) {
  return (
    <form action={prepareFamilyBillingDraft.bind(null, schoolId, billingAccountId)} className="grid gap-5 border-l border-brand pl-5 sm:grid-cols-[minmax(10rem,1fr)_auto] sm:items-end">
      <label>
        <span className="block text-xs text-muted">Service month</span>
        <input required type="month" name="month" defaultValue={defaultMonth} className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none transition focus:border-brand" />
      </label>
      <Submit />
    </form>
  );
}
