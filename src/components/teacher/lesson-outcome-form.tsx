"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

type Result = { ok: boolean; message: string };

export function LessonOutcomeForm({
  action,
}: {
  action: (outcome: string, notes: string) => Promise<Result>;
}) {
  const [outcome, setOutcome] = useState("completed");
  const [notes, setNotes] = useState("");
  const labels: Record<string, string> = {
    completed: "taught as planned",
    no_show: "student did not attend",
  };

  return (
    <div className="mt-6 border-t border-line pt-6">
      <h3 className="font-display text-2xl">Log this lesson</h3>
      <div className="mt-4 grid gap-2">
        {Object.entries(labels).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-3 border border-line px-4 py-3 text-sm has-[:checked]:border-brand">
            <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
            <span className="capitalize">{label}</span>
          </label>
        ))}
      </div>
      <label className="mt-5 block">
        <span className="text-xs text-muted">Private staff notes (optional)</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full resize-y border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-brand" />
      </label>
      <div className="mt-5">
        <HoldToConfirm
          action={() => action(outcome, notes)}
          idleLabel={`Hold to record: ${labels[outcome]}`}
          successLabel="Lesson logged"
          refreshOnSuccess
        />
      </div>
    </div>
  );
}
