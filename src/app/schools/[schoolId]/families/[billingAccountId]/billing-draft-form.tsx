"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FocusedModal } from "@/components/ui/focused-modal";
import { prepareFamilyBillingDraft, type BillingDraftState } from "./actions";

const initialState: BillingDraftState = { ok: false, message: "", periodId: null, invoice: null };

export function BillingDraftForm({ schoolId, billingAccountId, defaultMonth, initialOpen = false }: {
  schoolId: string;
  billingAccountId: string;
  defaultMonth: string;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [state, action, pending] = useActionState(prepareFamilyBillingDraft.bind(null, schoolId, billingAccountId), initialState);

  useEffect(() => {
    if (!state.ok || !state.periodId) return;
    router.replace(`/schools/${schoolId}/families/${billingAccountId}?billing=prepared&period=${state.periodId}`, { scroll: false });
    router.refresh();
  }, [billingAccountId, router, schoolId, state]);

  return (
    <FocusedModal open={open} onOpenChange={setOpen} triggerLabel="Prepare invoice" eyebrow="New invoice" title="Choose what you want to bill." description="Start with the unpaid eligible lessons in a service month. You can leave individual lessons for a later invoice before locking." triggerClassName="rounded-control bg-brand px-5 py-3 text-sm text-canvas transition hover:-translate-y-px hover:bg-brand-hover">
      <form action={action} className="grid gap-6">
        <label>
          <span className="block text-xs text-muted">Service month</span>
          <input required type="month" name="month" defaultValue={defaultMonth} onClick={(event) => event.currentTarget.showPicker?.()} className="mt-2 w-full cursor-pointer rounded-control border border-line bg-canvas px-3 py-3 outline-none transition focus:border-brand" />
        </label>
        <p className="text-xs leading-5 text-muted">Preparing does not send or charge anything. You will review the included lessons and choose what to leave for later.</p>
        {state.message && !state.ok ? <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{state.message}</p> : null}
        <button disabled={pending} className="justify-self-start rounded-control bg-brand px-5 py-3 text-sm text-canvas transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-50">{pending ? "Preparing…" : "Prepare invoice →"}</button>
      </form>
    </FocusedModal>
  );
}
