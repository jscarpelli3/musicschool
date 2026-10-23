"use client";

import { useActionState, useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { retireFamilyServiceLocation, saveFamilyServiceLocation, type ServiceLocationState } from "./service-location-actions";

type Location = { mode: string; label: string; address_line_1: string | null; address_line_2: string | null; city: string | null; region: string | null; postal_code: string | null; access_notes: string | null } | null;
const initialState: ServiceLocationState = { status: "idle", message: "" };
const field = "mt-2 w-full border-b border-line bg-transparent py-2.5 outline-none focus:border-brand";

export function ServiceLocationForm({ schoolId, billingAccountId, location }: { schoolId: string; billingAccountId: string; location: Location }) {
  const [editing, setEditing] = useState(!location);
  const [state, action, pending] = useActionState(saveFamilyServiceLocation.bind(null, schoolId, billingAccountId), initialState);
  if (location && (!editing || state.status === "success")) {
    const address = location.mode === "arranged_privately"
      ? "Arranged directly with the family"
      : [location.address_line_1, location.city].filter(Boolean).join(" · ");
    return <div className="mt-5 rounded-control bg-surface-raised p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-muted">{location.label}</p>
      <p className="mt-2 text-sm leading-6">{address}</p>
      <div className="mt-4 flex flex-wrap items-start gap-5">
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-brand hover:text-brand-hover">Change location</button>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer list-none hover:text-danger">Remove stored location</summary>
          <div className="mt-3 max-w-sm rounded-control bg-surface p-4">
            <p className="mb-3 text-xs leading-5 text-muted">This permanently clears the address. Common Time will stop you if an upcoming home lesson still needs it.</p>
            <HoldToConfirm compact action={() => retireFamilyServiceLocation(schoolId, billingAccountId)} idleLabel="Hold to remove address" holdingLabel="Keep holding to remove…" submittingLabel="Checking upcoming lessons…" successLabel="Address removed" refreshOnSuccess />
          </div>
        </details>
      </div>
    </div>;
  }
  return <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="text-xs text-muted">Street address</span><input required name="address_line_1" defaultValue={location?.address_line_1 ?? ""} maxLength={160} autoComplete="off" className={field} /></label>
      <label className="sm:col-span-2"><span className="text-xs text-muted">City</span><input required name="city" defaultValue={location?.city ?? ""} maxLength={120} autoComplete="off" className={field} /></label>
    {state.message ? <p role="status" className={`sm:col-span-2 text-sm ${state.status === "error" ? "text-danger" : "text-brand"}`}>{state.message}</p> : null}
    <div className="sm:col-span-2 flex items-center gap-5"><button disabled={pending} className="rounded-control bg-brand px-4 py-2.5 text-sm text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save address"}</button>{location ? <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted hover:text-ink">Cancel</button> : null}</div>
  </form>;
}
