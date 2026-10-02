"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MdHelpOutline } from "react-icons/md";

const sections = [
  { title: "School owners", steps: [
    "Use the dashboard for lessons needing a time, the school calendar, student records, and invoice activity.",
    "Open a lesson for payment, rescheduling, family billing, and student shortcuts.",
    "Use School settings beside your avatar for school details, offerings, spaces, policies, payments, and appearance.",
  ] },
  { title: "Teachers", steps: [
    "Open My schedule for assigned lessons, proposed times, availability, and recent lessons.",
    "Open a lesson to record its outcome after it ends or request a change before it begins.",
    "A proposed change does not move the lesson until the required person approves it.",
  ] },
  { title: "Families and payers", steps: [
    "Use the Family portal with the exact email the school has on file.",
    "The portal shows lessons, statements, payment status, and calendar subscriptions.",
    "If a message seems suspicious, open app.commontime.studio yourself and compare the school, period, and amount.",
  ] },
];

export function HelpModal() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 transition hover:text-canvas focus-visible:text-canvas"><MdHelpOutline aria-hidden="true" className="text-lg" />Help</button>
    {open ? <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <button type="button" aria-label="Close help" onClick={close} className="absolute inset-0 bg-[var(--ui-overlay)]" />
      <section className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-card border border-line bg-canvas p-6 text-ink shadow-[var(--ui-shadow-strong)] sm:p-9">
        <header className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div><p className="text-xs uppercase tracking-[0.16em] text-brand">Common Time help</p><h2 id="help-modal-title" className="mt-3 font-display text-4xl">What can we help with?</h2></div>
          <button ref={closeRef} type="button" onClick={close} className="text-sm text-muted hover:text-ink">Close</button>
        </header>
        <div className="mt-6 grid gap-3">
          {sections.map((section, index) => <details key={section.title} open={index === 0} className="rounded-card border border-line bg-surface p-5">
            <summary className="cursor-pointer list-none font-display text-2xl marker:hidden">{section.title}<span aria-hidden="true" className="float-right text-brand">+</span></summary>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">{section.steps.map((step) => <li key={step} className="border-l-2 border-brand pl-4">{step}</li>)}</ul>
          </details>)}
        </div>
        <div className="mt-6 rounded-card bg-ink p-5 text-canvas">
          <p className="font-display text-2xl">Need to verify a message?</p>
          <p className="mt-2 text-sm leading-6 text-canvas/70">Legitimate application links use app.commontime.studio. Open the portal directly when you are unsure.</p>
          <Link href="/portal" onClick={close} className="mt-4 inline-block rounded-control bg-canvas px-4 py-2.5 text-sm font-medium text-ink">Open family portal</Link>
        </div>
        <p className="mt-6 text-xs leading-5 text-muted">For a lesson, policy, statement, or charge, contact the music school named in the app. For text-message help, reply HELP. Reply STOP to stop future messages.</p>
      </section>
    </div> : null}
  </>;
}
