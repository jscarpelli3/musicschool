"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type Result = { ok: boolean; message: string };

export function TeacherRescheduleControls({
  canSelfReschedule,
  earliestLocal,
  rescheduleAction,
}: {
  canSelfReschedule: boolean;
  earliestLocal: string;
  rescheduleAction: (localStart: string, reason: string) => Promise<Result>;
}) {
  const [localStart, setLocalStart] = useState("");
  const [reason, setReason] = useState("");

  return (
    <section className="mt-6 border-t border-line pt-6">
      <h3 className="font-display text-2xl">Reschedule</h3>
      <div className="mt-4">
          <p className="text-sm leading-6 text-muted">{canSelfReschedule ? "Choose a new time. The owner will be notified when the lesson moves." : "Suggest a specific new time. The lesson remains where it is until the owner approves your proposal."}</p>
          <label className="mt-4 block"><span className="text-xs text-muted">New date and time</span><input type="datetime-local" min={earliestLocal} value={localStart} onChange={(event) => setLocalStart(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 outline-none focus:border-brand" /></label>
          <label className="mt-4 block"><span className="text-xs text-muted">Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full resize-y border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-brand" /></label>
          <div className="mt-5"><HoldToConfirm action={() => rescheduleAction(localStart, reason)} disabled={!localStart || !reason.trim()} disabledMessage="Choose the new time and record a reason." idleLabel={canSelfReschedule ? "Hold to reschedule lesson" : "Hold to propose new time"} successLabel={canSelfReschedule ? "Lesson rescheduled" : "Proposal sent"} refreshOnSuccess /></div>
      </div>
    </section>
  );
}
