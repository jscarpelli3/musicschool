"use client";

import { useActionState, useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { retireFamilyServiceLocation, saveFamilyServiceLocation, type ServiceLocationState } from "./service-location-actions";

type Location = { mode: string; label: string; address_line_1: string | null; address_line_2: string | null; city: string | null; region: string | null; postal_code: string | null; access_notes: string | null } | null;
const initialState: ServiceLocationState = { status: "idle", message: "" };
const field = "mt-2 w-full border-b border-line bg-transparent py-2.5 outline-none focus:border-brand";

export function ServiceLocationForm({ schoolId, billingAccountId, location }: { schoolId: string; billingAccountId: string; location: Location }) {
  const [mode, setMode] = useState(location?.mode === "arranged_privately" ? "arranged_privately" : "stored");
  const [editing, setEditing] = useState(!location);
  const [state, action, pending] = useActionState(saveFamilyServiceLocation.bind(null, schoolId, billingAccountId), initialState);
  if (location && (!editing || state.status === "success")) {
    const address = location.mode === "arranged_privately"
      ? "Arranged directly with the family"
      : [location.address_line_1, location.address_line_2, [location.city, location.region, location.postal_code].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    return <div className="mt-5 rounded-control bg-surface-raised p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-muted">{location.label}</p>
      <p className="mt-2 text-sm leading-6">{address}</p>
      {location.access_notes ? <p className="mt-2 text-xs leading-5 text-muted">Arrival notes: {location.access_notes}</p> : null}
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
    <label className="sm:col-span-2"><span className="text-xs text-muted">How is the address handled?</span><AppSelect name="mode" value={mode} onChange={(event) => setMode(event.target.value)} className={field}><option value="stored">Save a protected service address</option><option value="arranged_privately">Arrange the address outside Common Time</option></AppSelect></label>
    {mode === "stored" ? <>
      <label className="sm:col-span-2"><span className="text-xs text-muted">Label</span><input name="label" defaultValue={location?.label ?? "Home"} maxLength={80} className={field} /></label>
      <label className="sm:col-span-2"><span className="text-xs text-muted">Street address</span><input required name="address_line_1" defaultValue={location?.address_line_1 ?? ""} maxLength={160} autoComplete="off" className={field} /></label>
      <label className="sm:col-span-2"><span className="text-xs text-muted">Apartment or unit <span className="opacity-60">optional</span></span><input name="address_line_2" defaultValue={location?.address_line_2 ?? ""} maxLength={160} autoComplete="off" className={field} /></label>
      <label><span className="text-xs text-muted">City</span><input required name="city" defaultValue={location?.city ?? ""} maxLength={120} autoComplete="off" className={field} /></label>
      <label><span className="text-xs text-muted">State or region</span><input required name="region" defaultValue={location?.region ?? ""} maxLength={120} autoComplete="off" className={field} /></label>
      <label><span className="text-xs text-muted">Postal code</span><input required name="postal_code" defaultValue={location?.postal_code ?? ""} maxLength={24} autoComplete="off" className={field} /></label>
      <label><span className="text-xs text-muted">Arrival notes <span className="opacity-60">optional</span></span><input name="access_notes" defaultValue={location?.access_notes ?? ""} maxLength={500} autoComplete="off" className={field} /></label>
    </> : <input type="hidden" name="label" value="Home" />}
    {state.message ? <p role="status" className={`sm:col-span-2 text-sm ${state.status === "error" ? "text-danger" : "text-brand"}`}>{state.message}</p> : null}
    <div className="sm:col-span-2 flex items-center gap-5"><button disabled={pending} className="rounded-control bg-brand px-4 py-2.5 text-sm text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save home lesson location"}</button>{location ? <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted hover:text-ink">Cancel</button> : null}</div>
  </form>;
}
