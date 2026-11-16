"use client";

import { useActionState, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { updateContactRelationship, type ContactRelationshipState } from "./actions";

const initialState: ContactRelationshipState = { ok: false, message: "" };
export function RelationshipEditor({ schoolId, studentId, contactPersonId, relationship }: { schoolId: string; studentId: string; contactPersonId: string; relationship: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: ContactRelationshipState, data: FormData) => {
    const result = await updateContactRelationship(schoolId, studentId, contactPersonId, previous, data);
    if (result.ok) setOpen(false);
    return result;
  }, initialState);
  return <FocusedModal triggerLabel="Edit relationship" eyebrow="Family contact" title="How is this person connected?" description="Use the wording that makes sense to the school." open={open} onOpenChange={setOpen}>
    <form action={action} className="space-y-5"><label><span className="text-xs text-muted">Relationship</span><input name="relationship" defaultValue={relationship} required maxLength={40} className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label><button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save relationship"}</button>{state.message ? <p role="status" className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}</form>
  </FocusedModal>;
}
