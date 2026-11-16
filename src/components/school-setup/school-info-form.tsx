"use client";

import { useActionState } from "react";
import { updateSchoolInfo, type SchoolInfoField, type SchoolInfoState } from "@/app/schools/[schoolId]/setup/actions";

type SchoolInfo = {
  name: string;
  phone: string | null;
  reply_to_email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  timezone: string;
};

const initialState: SchoolInfoState = { ok: false, message: "", fieldErrors: {} };

export function SchoolInfoForm({ schoolId, school, layout = "settings", ownerName, ownerEmail }: {
  schoolId: string;
  school: SchoolInfo;
  layout?: "settings" | "onboarding";
  ownerName?: string | null;
  ownerEmail?: string | null;
}) {
  const [state, action, pending] = useActionState(updateSchoolInfo.bind(null, schoolId), initialState);
  const onboarding = layout === "onboarding";
  const formClass = onboarding ? "rounded-control bg-surface p-5 sm:p-6" : "ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8";
  const fieldsClass = onboarding ? "grid gap-4 sm:grid-cols-2" : "grid gap-7 md:grid-cols-2";
  const fieldClass = onboarding
    ? "mt-2 w-full rounded-control border border-line bg-canvas/60 px-3 py-2.5 text-sm outline-none transition focus:border-brand disabled:opacity-60"
    : "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand disabled:opacity-60";
  const span = onboarding ? "sm:col-span-2" : "md:col-span-2";
  const error = (field: SchoolInfoField) => state.fieldErrors[field];
  const inputClass = (field: SchoolInfoField) => `${fieldClass} ${error(field) ? "border-danger" : ""}`;
  const fieldError = (field: SchoolInfoField) => error(field) ? <span id={`${field}-error`} className="mt-2 block text-xs leading-5 text-danger">{error(field)}</span> : null;

  return <form action={action} noValidate aria-busy={pending} className={formClass}>
    {!onboarding ? <div><h2 className="font-display text-3xl">Contact</h2><p className="mt-3 text-sm text-muted">Timezone: {school.timezone}</p></div> : null}
    <div>
      {onboarding ? <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-control bg-canvas/60 px-4 py-3 text-sm"><span><span className="text-muted">Owner</span> · {ownerName || "Not added"}</span><span className="break-all"><span className="text-muted">Account email</span> · {ownerEmail || "Not available"}</span><span><span className="text-muted">Timezone</span> · {school.timezone}</span></div> : null}
      <div className={fieldsClass}>
        <label className={span}><span className="text-xs text-muted">School name</span><input name="name" defaultValue={school.name} disabled={pending} aria-invalid={Boolean(error("name"))} aria-describedby={error("name") ? "name-error" : undefined} className={inputClass("name")} />{fieldError("name")}</label>
        <label className={onboarding ? "" : span}><span className="text-xs text-muted">Primary school email</span><input name="reply_to_email" type="text" inputMode="email" autoComplete="email" defaultValue={school.reply_to_email ?? ""} disabled={pending} aria-invalid={Boolean(error("reply_to_email"))} aria-describedby={error("reply_to_email") ? "reply_to_email-error" : undefined} placeholder={ownerEmail ?? "school@example.com"} className={inputClass("reply_to_email")} />{fieldError("reply_to_email")}<span className="mt-2 block text-xs leading-5 text-muted">Families and teachers can reply here. Leave blank to add it later.</span></label>
        <label className={onboarding ? "" : span}><span className="text-xs text-muted">Phone number</span><input name="phone" type="tel" defaultValue={school.phone ?? ""} disabled={pending} aria-invalid={Boolean(error("phone"))} aria-describedby={error("phone") ? "phone-error" : undefined} className={inputClass("phone")} />{fieldError("phone")}</label>
        <label className={span}><span className="text-xs text-muted">Address</span><input name="address_line_1" autoComplete="street-address" defaultValue={school.address_line_1 ?? ""} disabled={pending} aria-invalid={Boolean(error("address_line_1"))} aria-describedby={error("address_line_1") ? "address_line_1-error" : undefined} className={inputClass("address_line_1")} />{fieldError("address_line_1")}</label>
        <label className={span}><span className="text-xs text-muted">Suite or unit</span><input name="address_line_2" defaultValue={school.address_line_2 ?? ""} disabled={pending} aria-invalid={Boolean(error("address_line_2"))} aria-describedby={error("address_line_2") ? "address_line_2-error" : undefined} className={inputClass("address_line_2")} />{fieldError("address_line_2")}</label>
        <label><span className="text-xs text-muted">City</span><input name="city" autoComplete="address-level2" defaultValue={school.city ?? ""} disabled={pending} aria-invalid={Boolean(error("city"))} aria-describedby={error("city") ? "city-error" : undefined} className={inputClass("city")} />{fieldError("city")}</label>
        <label><span className="text-xs text-muted">State or region</span><input name="region" autoComplete="address-level1" defaultValue={school.region ?? ""} disabled={pending} aria-invalid={Boolean(error("region"))} aria-describedby={error("region") ? "region-error" : undefined} className={inputClass("region")} />{fieldError("region")}</label>
        <label><span className="text-xs text-muted">Postal code</span><input name="postal_code" autoComplete="postal-code" defaultValue={school.postal_code ?? ""} disabled={pending} aria-invalid={Boolean(error("postal_code"))} aria-describedby={error("postal_code") ? "postal_code-error" : undefined} className={inputClass("postal_code")} />{fieldError("postal_code")}</label>
        <div className="flex items-end"><button disabled={pending} className="w-full rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-canvas transition hover:opacity-90 disabled:cursor-wait disabled:opacity-65">{pending ? "Saving school info…" : "Save school info"}</button></div>
      </div>
      {state.message ? <p role={state.ok ? "status" : "alert"} aria-live="polite" className={`mt-5 rounded-control px-4 py-3 text-sm ${state.ok ? "bg-brand/10 text-brand" : "bg-danger/10 text-danger"}`}>{state.message}</p> : null}
      {pending ? <p role="status" aria-live="polite" className="mt-3 text-xs text-muted">Keep this page open while Common Time saves these details.</p> : null}
    </div>
  </form>;
}
