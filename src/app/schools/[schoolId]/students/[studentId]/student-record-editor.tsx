"use client";

import { useActionState, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { updateStudentRecord, type StudentRecordState } from "./actions";

const initialState: StudentRecordState = { ok: false, message: "" };

export function StudentRecordEditor({ schoolId, studentId, record }: { schoolId: string; studentId: string; record: { firstName: string; lastName: string; preferredName: string; email: string; phone: string; birthDate: string; enrollmentStatus: string; notes: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: StudentRecordState, formData: FormData) => {
    const result = await updateStudentRecord(schoolId, studentId, previous, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialState);
  const field = "mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand";
  return <FocusedModal triggerLabel="Edit student record" eyebrow="Student" title="Edit student record." description="Use the names this school actually uses. A first name, last name, or both is enough." open={open} onOpenChange={setOpen}>
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label><span className="text-xs text-muted">First name</span><input name="firstName" defaultValue={record.firstName} className={field} /></label>
      <label><span className="text-xs text-muted">Last name</span><input name="lastName" defaultValue={record.lastName} className={field} /></label>
      <label><span className="text-xs text-muted">Preferred name</span><input name="preferredName" defaultValue={record.preferredName} className={field} /></label>
      <label><span className="text-xs text-muted">Enrollment</span><select name="enrollmentStatus" defaultValue={record.enrollmentStatus} className={field}><option value="prospect">Prospect</option><option value="active">Active</option><option value="paused">Paused</option><option value="former">Former</option></select></label>
      <label><span className="text-xs text-muted">Email</span><input name="email" type="email" defaultValue={record.email} className={field} /></label>
      <label><span className="text-xs text-muted">Phone</span><input name="phone" type="tel" defaultValue={record.phone} className={field} /></label>
      <label><span className="text-xs text-muted">Birth date</span><input name="birthDate" type="date" defaultValue={record.birthDate} className={field} /></label>
      <label className="sm:col-span-2"><span className="text-xs text-muted">Staff-only notes</span><textarea name="notes" defaultValue={record.notes} rows={4} className={field} /></label>
      <button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand hover:bg-brand hover:text-canvas disabled:opacity-50 sm:col-span-2">{pending ? "Saving…" : "Save student"}</button>
      {state.message ? <p role="status" className={`text-sm sm:col-span-2 ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  </FocusedModal>;
}
