"use client";

import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

export type RescheduleProposal = {
  dateKey: string;
  teacherId: string;
  minutes: number;
  valid: boolean;
  issue: string | null;
};

type LessonSummary = {
  teacherId: string;
  placeId: string;
  billingServiceDate: string;
  start: { dateKey: string; minutes: number };
  end: { minutes: number };
};

export const rescheduleReasons = [
  ["family_request", "Family requested another time"],
  ["teacher_request", "Teacher requested another time"],
  ["school_closure", "School closure or holiday"],
  ["illness", "Illness"],
  ["schedule_conflict", "Schedule conflict"],
  ["other", "Other"],
] as const;

function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function RescheduleConfirmation({
  lesson,
  proposal,
  teacherName,
  placeName,
  reason,
  onReason,
  allowOutsideAvailability,
  action,
  onClose,
  onSuccess,
}: {
  lesson: LessonSummary;
  proposal: RescheduleProposal;
  teacherName: string;
  placeName: string;
  reason: string;
  onReason: (reason: string) => void;
  allowOutsideAvailability: boolean;
  action: () => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const duration = lesson.end.minutes - lesson.start.minutes;
  const [reasonCode = "", reasonDetail = ""] = reason.split("::", 2);
  const reasonComplete = Boolean(reasonCode && (reasonCode !== "other" || reasonDetail.trim()));
  return (
    <div className="reschedule-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="reschedule-confirm-title">
      <button type="button" aria-label="Return to calendar" className="lesson-sheet-backdrop" onClick={onClose} />
      <section className="reschedule-confirm-panel">
        <div className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div><p className="text-xs uppercase tracking-[0.14em] text-brand">Proposed move</p><h3 id="reschedule-confirm-title" className="mt-3 font-display text-4xl">Confirm the new time.</h3></div>
          <button type="button" onClick={onClose} className="line-action pb-2 text-sm text-muted">Back</button>
        </div>
        <div className="grid gap-6 border-b border-line py-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div><p className="text-xs text-muted">From</p><p className="mt-2 text-sm">{lesson.start.dateKey}</p><p className="mt-1 text-lg">{clock(lesson.start.minutes)}–{clock(lesson.end.minutes)}</p></div>
          <span className="text-brand">→</span>
          <div><p className="text-xs text-muted">To</p><p className="mt-2 text-sm">{proposal.dateKey}</p><p className="mt-1 text-lg">{clock(proposal.minutes)}–{clock(proposal.minutes + duration)}</p></div>
        </div>
        <dl className="divide-y divide-line border-b border-line"><Detail label="Teacher" value={teacherName} /><Detail label="Place" value={placeName} /><Detail label="Billing" value={`Remains anchored to ${lesson.billingServiceDate.slice(0, 7)}`} /></dl>
        {!proposal.valid ? <p className="mt-6 border-l-2 border-danger pl-4 text-sm text-danger">{proposal.issue}{allowOutsideAvailability && proposal.issue === "Outside this teacher’s availability." ? " Owner override selected." : ""}</p> : null}
        <div className="mt-6 border border-brand px-4 py-3 text-sm text-brand"><span aria-hidden="true" className="mr-2">!</span>A reason is required before this lesson can be rescheduled.</div>
        <ReasonField value={reason} onChange={onReason} className="mt-5" autoFocus />
        <div className="mt-7"><HoldToConfirm action={action} idleLabel="Hold to reschedule" holdingLabel="Keep holding to move the lesson…" duration={1400} disabled={!reasonComplete} disabledMessage="Select a rescheduling reason to continue." onSuccess={onSuccess} /></div>
      </section>
    </div>
  );
}

function ReasonField({ value, onChange, className = "", autoFocus = false }: { value: string; onChange: (value: string) => void; className?: string; autoFocus?: boolean }) {
  const [code = "", detail = ""] = value.split("::", 2);
  return (
    <div className={className}>
      <label><span className="block text-xs text-muted">Reason recorded on this lesson <span className="text-brand">· required</span></span>
        <select autoFocus={autoFocus} required value={code} onChange={(event) => onChange(`${event.target.value}::`)} className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand">
          <option value="">Select a reason</option>
          {rescheduleReasons.map(([reasonCode, label]) => <option key={reasonCode} value={reasonCode}>{label}</option>)}
        </select>
      </label>
      {code === "other" ? <label><span className="sr-only">Other reason</span><input required maxLength={400} value={detail} onChange={(event) => onChange(`${code}::${event.target.value}`)} placeholder="Enter the reason" className="mt-3 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[6rem_1fr] gap-5 py-5 text-sm"><dt className="text-muted">{label}</dt><dd>{value}</dd></div>;
}
