"use client";

import { useActionState, useState } from "react";
import { createProduct, type ProductState } from "./actions";

const initialState: ProductState = { error: null };
const fieldClass = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export function ProductForm({ schoolId }: { schoolId: string }) {
  const [format, setFormat] = useState("private_lesson");
  const [state, action, pending] = useActionState(createProduct.bind(null, schoolId), initialState);

  return (
    <form action={action} className="mt-10">
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="block text-xs text-muted">Name</span>
          <input required name="name" maxLength={120} className={fieldClass} placeholder="Weekly piano lesson" />
        </label>
        <label>
          <span className="block text-xs text-muted">Format</span>
          <select name="format" value={format} onChange={(event) => setFormat(event.target.value)} className={fieldClass}>
            <option value="private_lesson">Private lesson</option>
            <option value="group_class">Group class</option>
          </select>
        </label>
        <label>
          <span className="block text-xs text-muted">Duration</span>
          <select name="duration_minutes" defaultValue="30" className={fieldClass}>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
            <option value="120">2 hours</option>
          </select>
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-xs text-muted">Frequency</legend>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <label>
              <span className="sr-only">Sessions per interval</span>
              <input required name="sessions_per_interval" type="number" min={1} max={31} defaultValue={1} className={fieldClass} />
            </label>
            <span className="pb-3 text-sm text-muted">session(s) every</span>
            <div className="grid grid-cols-[1fr_1.5fr] gap-3">
              <input required name="interval_count" aria-label="Interval count" type="number" min={1} max={12} defaultValue={1} className={fieldClass} />
              <select name="interval_unit" aria-label="Interval unit" defaultValue="week" className={fieldClass}>
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
              </select>
            </div>
          </div>
        </fieldset>
        <input type="hidden" name="pricing_model" value="per_session" />
        <label className="md:col-span-2">
          <span className="block text-xs text-muted">When this offering is billed</span>
          <select name="billing_timing" defaultValue="school_default" className={fieldClass}>
            <option value="school_default">Use the school default</option>
            <option value="before_service">Before lessons happen</option>
            <option value="after_service">After lessons happen</option>
          </select>
          <span className="mt-2 block text-xs leading-5 text-muted">This becomes an immutable term when a student is enrolled. Changing the default later does not rewrite existing agreements.</span>
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs text-muted">Price per lesson or class meeting</span>
          <div className="flex border-b border-line focus-within:border-brand">
            <span className="py-3 text-muted">$</span>
            <input required name="price" inputMode="decimal" className="w-full bg-transparent py-3 pl-2 outline-none" placeholder="40.00" />
          </div>
          <span className="mt-2 block text-xs leading-5 text-muted">Monthly totals use the number of lessons actually scheduled. A weekly lesson may occur three, four, or five times in a calendar month.</span>
        </label>
        {format === "group_class" ? (
          <label>
            <span className="block text-xs text-muted">Class capacity</span>
            <input required name="capacity" type="number" min={2} max={500} defaultValue={8} className={fieldClass} />
          </label>
        ) : (
          <input type="hidden" name="capacity" value="1" />
        )}
        <label className={format === "group_class" ? "" : "md:col-span-2"}>
          <span className="block text-xs text-muted">Description <span className="opacity-60">optional</span></span>
          <input name="description" className={fieldClass} placeholder="Who this is for or what it includes" />
        </label>
      </div>
      {state.error ? <p className="mt-6 border-l border-danger pl-4 text-sm text-danger">{state.error}</p> : null}
      <button disabled={pending} className="mt-10 border-b border-brand pb-2 text-sm text-brand-hover disabled:opacity-50">
        {pending ? "Creating…" : "Create offering →"}
      </button>
    </form>
  );
}
