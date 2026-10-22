"use client";

import { useActionState, useState } from "react";
import { createPlace, type PlaceState } from "./actions";
import { AppSelect } from "@/components/ui/app-select";

const initialState: PlaceState = { error: null };
const fieldClass = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export function PlaceForm({ schoolId, returnPath }: { schoolId: string; returnPath?: string }) {
  const [state, action, pending] = useActionState(createPlace.bind(null, schoolId, returnPath), initialState);
  const [kind, setKind] = useState("school");

  return (
    <form action={action} className="mt-10 grid gap-8">
      <label>
        <span className="block text-xs text-muted">Type</span>
        <AppSelect name="kind" value={kind} onChange={(event) => setKind(event.target.value)} className={fieldClass}>
          <option value="school">School location</option>
          <option value="student_home">Student home</option>
          <option value="online">Online</option>
        </AppSelect>
      </label>
      {kind === "school" ? <label>
        <span className="block text-xs text-muted">What your school calls this place</span>
        <input required name="name" maxLength={120} className={fieldClass} placeholder="Studio A" />
      </label> : <input type="hidden" name="name" value={kind === "student_home" ? "Student home" : "Online"} />}
      {kind === "student_home" ? <p className="text-sm leading-6 text-muted">Each family’s protected address is added only when an in-home lesson needs it.</p> : kind === "online" ? <p className="text-sm leading-6 text-muted">Online lessons use one shared Online choice. Meeting integrations can be added later.</p> : <label>
        <span className="block text-xs text-muted">Details <span className="opacity-60">optional</span></span>
        <input name="details" maxLength={500} className={fieldClass} placeholder="Room notes or directions" />
      </label>}
      {state.error ? <p className="border-l border-danger pl-4 text-sm text-danger">{state.error}</p> : null}
      <button disabled={pending} className="justify-self-start border-b border-brand pb-2 text-sm text-brand-hover disabled:opacity-50">
        {pending ? "Adding…" : "Add place →"}
      </button>
    </form>
  );
}
