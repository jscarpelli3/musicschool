"use client";

import { useEffect, useRef, useState } from "react";
import { TeacherInviteForm } from "@/components/teacher/teacher-invite-form";
import { TeacherInstrumentFields } from "@/components/staff/teacher-instrument-fields";

export function AddTeacherDialog({ instruments, action }: {
  instruments: string[];
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); } };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKey); };
  }, [open]);

  const closeWithSuccess = () => {
    close();
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: {
      title: "Teacher invited",
      message: "The teacher record was created and the access invitation was submitted.",
    } }));
  };

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} disabled={instruments.length === 0} className="border border-brand bg-brand px-5 py-3 text-sm text-canvas transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted">
      Add teacher +
    </button>
    {instruments.length === 0 ? <p className="mt-3 text-xs text-muted">Choose school instruments in School Setup before adding staff.</p> : null}
    {open ? <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="add-teacher-title">
      <button type="button" aria-label="Close add teacher" onClick={close} className="fixed inset-0 border-0 bg-[var(--ui-overlay)]" />
      <section className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-surface p-6 shadow-xl sm:p-9">
        <header className="flex items-start justify-between gap-5 border-b border-line pb-6"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Staff access</p><h2 id="add-teacher-title" className="mt-3 font-display text-4xl">Add a teacher.</h2><p className="mt-3 text-sm leading-6 text-muted">Create their staff record and send passwordless access.</p></div><button type="button" onClick={close} className="text-sm text-muted hover:text-ink">Close</button></header>
        <TeacherInviteForm action={action} disabled={instruments.length === 0} onSuccess={closeWithSuccess} className="grid gap-6 pt-7 md:grid-cols-2">
          <label><span className="text-xs text-muted">First name</span><input required name="first_name" autoFocus className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label><span className="text-xs text-muted">Last name</span><input required name="last_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Email</span><input required type="email" name="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <TeacherInstrumentFields instruments={instruments} />
        </TeacherInviteForm>
      </section>
    </div> : null}
  </>;
}
