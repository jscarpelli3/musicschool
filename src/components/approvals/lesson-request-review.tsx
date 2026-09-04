"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { resolveLessonChangeRequest } from "@/app/schools/[schoolId]/approvals/actions";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import type { LessonRequestApproval } from "@/lib/approvals/owner-approvals";

type LessonResolution = "count_as_serviced" | "retain_for_reschedule" | "waive";
type AdjustmentKind = "none" | "fee" | "credit";

const outcomeOptions: Array<{ value: LessonResolution; title: string; description: string }> = [
  { value: "retain_for_reschedule", title: "Keep a lesson to schedule later", description: "Remove this calendar event and return one lesson to the student’s Lessons to Schedule pool." },
  { value: "count_as_serviced", title: "Keep the original charge; no replacement", description: "Record that the lesson did not happen, while leaving its original charge intact and creating no replacement lesson." },
  { value: "waive", title: "Cancel without a replacement or charge", description: "Remove the calendar event, create no replacement lesson, and do not count this occurrence toward billing." },
];

function recommendationName(value: string) {
  if (value === "retain_for_reschedule") return "Keep a lesson to schedule later";
  if (value === "count_as_serviced") return "Keep the original charge; no replacement";
  if (value === "waive") return "Cancel without a replacement or charge";
  return "Owner reviews the circumstances";
}

function accountingName(value: string) {
  const names: Record<string, string> = { paid: "Already paid", approved: "Approved for collection", locked: "Included on a locked invoice", draft: "Included on a draft invoice", unaccounted: "Not yet invoiced" };
  return names[value] ?? value.replaceAll("_", " ");
}

export function LessonRequestReview({ schoolId, item, timezone, closeHref }: { schoolId: string; item: LessonRequestApproval; timezone: string; closeHref: string }) {
  const router = useRouter();
  const pending = ["pending", "in_progress"].includes(item.status);
  const policyRequiresJudgment = item.policyLessonResolution === "manual_review";
  const recommendedResolution = policyRequiresJudgment ? null : item.policyLessonResolution as LessonResolution;
  const initialResolution: LessonResolution = recommendedResolution ?? (item.requestedResolution === "reschedule" ? "retain_for_reschedule" : "waive");
  const recommendedAdjustment: AdjustmentKind = item.policyFeeCents > 0 ? "fee" : "none";
  const [resolution, setResolution] = useState<LessonResolution>(initialResolution);
  const [adjustmentKind, setAdjustmentKind] = useState<AdjustmentKind>(recommendedAdjustment);
  const [amount, setAmount] = useState(item.policyFeeCents / 100);
  const [reason, setReason] = useState("");
  const format = useMemo(() => new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }), [timezone]);
  const money = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);
  const amountCents = Math.round(Number.isFinite(amount) ? amount * 100 : 0);
  const isOverride = !policyRequiresJudgment && (resolution !== recommendedResolution || adjustmentKind !== recommendedAdjustment || amountCents !== item.policyFeeCents);
  const requestName = item.requestType === "reschedule" ? "Reschedule request" : "Cancellation request";
  const requestedAction = item.requestedResolution === "reschedule" ? "Keep this lesson and arrange a new time" : item.requestedResolution === "lesson_credit" ? "Cancel this lesson and apply its value to the family account" : "Cancel this lesson without retaining it for later";
  const selectedOutcome = outcomeOptions.find((option) => option.value === resolution)!;

  useEffect(() => {
    const previous = document.body.style.overflow;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") router.push(closeHref); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [router, closeHref]);

  async function submit(decision: "approved" | "declined") {
    const result = await resolveLessonChangeRequest(schoolId, item.id, { decision, lessonResolution: decision === "approved" ? resolution : null, adjustmentKind: decision === "approved" && adjustmentKind !== "none" ? adjustmentKind : null, adjustmentAmountCents: decision === "approved" ? amountCents : 0, reason });
    if (result.ok) {
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Request resolved", message: result.message } }));
      router.push(closeHref);
      router.refresh();
    }
    return result;
  }

  function usePolicyRecommendation() {
    if (recommendedResolution) setResolution(recommendedResolution);
    setAdjustmentKind(recommendedAdjustment);
    setAmount(item.policyFeeCents / 100);
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="lesson-request-title">
      <Link href={closeHref} aria-label="Close request review" className="fixed inset-0 bg-[var(--ui-overlay)]" />
      <section className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[min(50rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-brand bg-canvas p-5 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div><p className="text-xs uppercase tracking-[0.14em] text-brand">{requestName}</p><h2 id="lesson-request-title" className="mt-3 font-display text-4xl">{item.student}’s family wants to {item.requestType === "reschedule" ? "reschedule" : "cancel"}.</h2><p className="mt-3 text-sm leading-6 text-muted">Teacher: {item.teacher}</p></div>
          <Link href={closeHref} className="text-sm text-muted transition hover:text-ink">Close</Link>
        </div>

        <dl className="mt-7 grid gap-px bg-line sm:grid-cols-2">
          <div className="bg-canvas p-5"><dt className="text-xs text-muted">Lesson</dt><dd className="mt-2 text-sm font-medium">{format.format(new Date(item.lessonAt))}</dd></div>
          <div className="bg-canvas p-5"><dt className="text-xs text-muted">Request recorded</dt><dd className="mt-2 text-sm font-medium">{format.format(new Date(item.requestedAt))}</dd></div>
          <div className="bg-canvas p-5"><dt className="text-xs text-muted">Family asked to</dt><dd className="mt-2 text-sm">{requestedAction}.</dd></div>
          <div className="bg-canvas p-5"><dt className="text-xs text-muted">Current accounting</dt><dd className="mt-2 text-sm capitalize">{accountingName(item.accountingState)}</dd></div>
        </dl>

        <section className="mt-6 border-l-2 border-brand bg-surface-raised p-5">
          <p className="text-sm font-medium">{item.withinPolicyWindow ? "Within" : "Outside"} the {item.cutoffHours}-hour cancellation window</p>
          <p className="mt-2 text-sm leading-6 text-muted">{item.policyGuidance}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm"><span className="text-muted">Policy recommends: </span>{recommendationName(item.policyLessonResolution)}{item.policyFeeCents > 0 ? ` plus a ${money.format(item.policyFeeCents / 100)} late fee` : ""}.</p>
            {recommendedResolution && isOverride ? <button type="button" onClick={usePolicyRecommendation} className="text-sm text-brand underline-offset-4 transition hover:underline">Use recommendation</button> : null}
          </div>
        </section>

        {pending ? <>
          <fieldset className="mt-8">
            <legend className="text-lg font-medium">Choose the outcome</legend>
            <p className="mt-1 text-sm text-muted">The policy guides this choice. You can make a different call when the situation calls for it.</p>
            <div className="mt-4 grid gap-3" role="radiogroup">
              {outcomeOptions.map((option) => {
                const selected = resolution === option.value;
                return <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => setResolution(option.value)} className={`p-4 text-left transition ${selected ? "bg-brand text-canvas" : "border border-line bg-canvas hover:border-brand"}`}><span className="block text-sm font-medium">{option.title}</span><span className={`mt-2 block text-sm leading-6 ${selected ? "text-canvas/80" : "text-muted"}`}>{option.description}</span></button>;
              })}
            </div>
          </fieldset>

          <fieldset className="mt-7">
            <legend className="text-sm font-medium">Add a separate account adjustment?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["none", "fee", "credit"] as const).map((kind) => <button key={kind} type="button" onClick={() => setAdjustmentKind(kind)} className={`border px-4 py-2 text-sm capitalize transition ${adjustmentKind === kind ? "border-brand bg-brand text-canvas" : "border-line hover:border-brand"}`}>{kind === "none" ? "No adjustment" : `Add ${kind}`}</button>)}
            </div>
            {adjustmentKind !== "none" ? <label className="mt-4 block max-w-xs"><span className="text-sm font-medium">{adjustmentKind === "fee" ? "Fee" : "Credit"} amount</span><span className="relative block"><span className="absolute left-0 top-5 text-muted">$</span><input type="number" min="0.01" max="10000" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-2 w-full border-b border-line bg-transparent py-3 pl-5 outline-none focus:border-brand" /></span></label> : null}
          </fieldset>

          <label className="mt-7 block"><span className="text-sm font-medium">Internal decision note {isOverride ? "· required for this exception" : "· optional"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full border border-line bg-transparent p-3 outline-none focus:border-brand" placeholder="What did you agree on with the family?" /></label>

          <aside className="mt-7 border border-brand bg-surface-raised p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-brand">What will happen</p><p className="mt-3 text-base font-medium">{selectedOutcome.title}</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted"><li>• The scheduled calendar event will be cancelled.</li><li>• {selectedOutcome.description}</li><li>• {adjustmentKind === "none" || amountCents <= 0 ? "No separate account fee or credit will be added." : `A ${money.format(amountCents / 100)} ${adjustmentKind} will be recorded.`}</li><li>• The family and assigned teacher will be notified of the owner’s decision.</li></ul>
            {isOverride ? <p className="mt-4 text-xs text-brand">This differs from the published policy and will be recorded as an owner exception.</p> : null}
          </aside>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <HoldToConfirm action={() => submit("approved")} disabled={(isOverride && !reason.trim()) || (adjustmentKind !== "none" && amountCents <= 0)} idleLabel="Hold to apply this outcome" holdingLabel="Keep holding to resolve…" submittingLabel="Applying lesson and account changes…" successLabel="Request resolved" />
            <HoldToConfirm action={() => submit("declined")} idleLabel="Hold to decline; keep lesson scheduled" holdingLabel="Keep holding to decline…" submittingLabel="Declining request…" successLabel="Request declined" />
          </div>
        </> : <p className="mt-7 text-sm capitalize text-muted">This request is {item.status.replaceAll("_", " ")}.</p>}
      </section>
    </div>
  );
}
