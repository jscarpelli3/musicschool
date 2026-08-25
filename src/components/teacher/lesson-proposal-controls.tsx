"use client";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

export function LessonProposalControls({ accept, decline }: { accept: () => Promise<{ok:boolean;message:string}>; decline: () => Promise<{ok:boolean;message:string}> }) {
  return <div className="mt-4 flex flex-wrap gap-3"><HoldToConfirm action={accept} idleLabel="Hold to accept" submittingLabel="Checking conflicts…" successLabel="Lesson accepted" /><HoldToConfirm action={decline} idleLabel="Hold to decline" submittingLabel="Declining…" successLabel="Lesson declined" /></div>;
}
