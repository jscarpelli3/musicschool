"use client";

import { useActionState, useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { saveFamilyServiceLocation, type ServiceLocationState } from "./service-location-actions";

type Location = { mode: string; label: string; address_line_1: string | null; address_line_2: string | null; city: string | null; region: string | null; postal_code: string | null; access_notes: string | null } | null;
const initialState: ServiceLocationState = { status: "idle", message: "" };
const field = "mt-2 w-full border-b border-line bg-transparent py-2.5 outline-none focus:border-brand";

export function ServiceLocationForm({ schoolId, billingAccountId, location }: { schoolId: string; billingAccountId: string; location: Location }) {
  const [mode, setMode] = useState(location?.mode === "arranged_privately" ? "arranged_privately" : "stored");
  const [state, action, pending] = useActionState(saveFamilyServiceLocation.bind(null, schoolId, billingAccountId), initialState);
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
    <div className="sm:col-span-2"><button disabled={pending} className="rounded-control bg-brand px-4 py-2.5 text-sm text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save home lesson location"}</button></div>
  </form>;
}
