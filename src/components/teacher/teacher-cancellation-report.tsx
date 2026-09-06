"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type Result = { ok: boolean; message: string };

export function TeacherCancellationReport({ action }: { action: (reason: string) => Promise<Result> }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-5 text-sm text-danger underline-offset-4 hover:underline">I can’t provide this lesson</button>;
  return <section className="mt-5 border border-danger/40 p-4">
    <h3 className="text-sm font-medium">Report a teacher cancellation</h3>
    <p className="mt-2 text-xs leading-5 text-muted">This sends the lesson to the owner for a scenario-specific remedy decision. It does not pretend the student cancelled or choose a financial result for the owner.</p>
    <label className="mt-4 block"><span className="text-xs text-muted">What happened?</span><textarea value={reason} onChange={(event)=>setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" /></label>
    <div className="mt-4"><HoldToConfirm action={()=>action(reason)} disabled={!reason.trim()} idleLabel="Hold to report cancellation" holdingLabel="Keep holding…" submittingLabel="Recording report…" successLabel="Sent for owner review" refreshOnSuccess /></div>
    <button type="button" onClick={()=>setOpen(false)} className="mt-3 text-xs text-muted hover:text-ink">Never mind</button>
  </section>;
}
