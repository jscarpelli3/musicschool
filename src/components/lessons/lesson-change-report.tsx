"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type Result = { ok: boolean; message: string };

export function LessonChangeReport({
  action,
  buttonLabel,
  title,
  description,
  fieldLabel = "What happened?",
}: {
  action: (note: string) => Promise<Result>;
  buttonLabel: string;
  title: string;
  description: string;
  fieldLabel?: string;
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mt-5 text-sm text-danger underline-offset-4 hover:underline">{buttonLabel}</button>;
  }
  return (
    <section className="mt-5 border border-danger/40 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
      <label className="mt-4 block">
        <span className="text-xs text-muted">{fieldLabel}</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
      </label>
      <div className="mt-4">
        <HoldToConfirm action={() => action(note)} disabled={!note.trim()} idleLabel="Hold to send for review" holdingLabel="Keep holding…" submittingLabel="Recording report…" successLabel="Sent for review" refreshOnSuccess />
      </div>
      <button type="button" onClick={() => setOpen(false)} className="mt-3 text-xs text-muted hover:text-ink">Never mind</button>
    </section>
  );
}
