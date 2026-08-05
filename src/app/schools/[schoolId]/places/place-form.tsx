"use client";

import { useActionState } from "react";
import { createPlace, type PlaceState } from "./actions";

const initialState: PlaceState = { error: null };
const fieldClass = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export function PlaceForm({ schoolId }: { schoolId: string }) {
  const [state, action, pending] = useActionState(createPlace.bind(null, schoolId), initialState);

  return (
    <form action={action} className="mt-10 grid gap-8">
      <label>
        <span className="block text-xs text-muted">What your school calls this place</span>
        <input required name="name" maxLength={120} className={fieldClass} placeholder="Studio A" />
      </label>
      <label>
        <span className="block text-xs text-muted">Details <span className="opacity-60">optional</span></span>
        <input name="details" maxLength={500} className={fieldClass} placeholder="Address, entrance, room notes, or video link" />
      </label>
      {state.error ? <p className="border-l border-danger pl-4 text-sm text-danger">{state.error}</p> : null}
      <button disabled={pending} className="justify-self-start border-b border-brand pb-2 text-sm text-brand-hover disabled:opacity-50">
        {pending ? "Adding…" : "Add place →"}
      </button>
    </form>
  );
}
