"use client";

import { useState } from "react";
import { TeacherInviteForm } from "@/components/teacher/teacher-invite-form";
import { TeacherInstrumentFields } from "@/components/staff/teacher-instrument-fields";
import { FocusedModal } from "@/components/ui/focused-modal";

export function AddTeacherDialog({ instruments, action }: {
  instruments: string[];
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const closeWithSuccess = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: {
      title: "Teacher invited",
      message: "The teacher record was created and the access invitation was submitted.",
    } }));
  };

  return <div>
    <FocusedModal triggerLabel="Add teacher +" eyebrow="Staff access" title="Add a teacher." description="Create their staff record and send passwordless access." disabled={instruments.length === 0} open={open} onOpenChange={setOpen}>
      <TeacherInviteForm action={action} disabled={instruments.length === 0} onSuccess={closeWithSuccess} className="grid gap-6 md:grid-cols-2">
        <label><span className="text-xs text-muted">First name</span><input required name="first_name" autoFocus className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
        <label><span className="text-xs text-muted">Last name</span><input required name="last_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
        <label className="md:col-span-2"><span className="text-xs text-muted">Email</span><input required type="email" name="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
        <TeacherInstrumentFields instruments={instruments} />
      </TeacherInviteForm>
    </FocusedModal>
    {instruments.length === 0 ? <p className="mt-3 text-xs text-muted">Choose school instruments in School Setup before adding staff.</p> : null}
  </div>;
}
