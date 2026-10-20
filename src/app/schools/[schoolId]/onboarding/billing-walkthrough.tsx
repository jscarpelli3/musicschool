"use client";

import { useRef, useState } from "react";
import { MdCreditCard, MdEventAvailable, MdHistory, MdHowToReg, MdLockOutline, MdMusicNote, MdReceiptLong } from "react-icons/md";

export function BillingWalkthrough({ timing, billingDay, reviewDays, chargeDay }: { timing: "before_service" | "after_service"; billingDay: number; reviewDays: number; chargeDay: number }) {
  const billsAfter = timing === "after_service";
  const steps = [
    { title: "Schedule the lessons", icon: MdEventAvailable, description: billsAfter ? "Build the month’s schedule. These lessons will become eligible for the invoice after they happen." : "Build the coming month’s schedule. Scheduled lessons can be included in the invoice before they happen.", detailTitle: "How does the payer’s card get connected?", detail: "Send the payer their secure portal link when you are ready. They verify their identity and save a payment method themselves; you never handle their card number." },
    ...(billsAfter ? [{ title: "Teach and record the month", icon: MdMusicNote, description: "Teach the scheduled lessons. Changes, cancellations, and teacher reports stay attached to each lesson as the month unfolds.", detailTitle: "What if a lesson changes?", detail: "A payer can request a cancellation or reschedule from their portal, and a teacher can report what happened. You make the final call under your school policy, and Common Time keeps the decision with the lesson." }] : []),
    { title: billsAfter ? `Prepare the invoice after the month ends` : `Prepare the invoice on day ${billingDay}`, icon: MdReceiptLong, description: billsAfter ? "At month-end, prepare an invoice from the completed lessons and recorded outcomes." : `On day ${billingDay}, prepare an invoice from the lessons scheduled for the coming service month.`, detailTitle: "Can I change the amount?", detail: "Yes. Before locking, you can leave out a lesson, add another eligible lesson, or add a credit or separate charge. Your adjustments remain visible in the record." },
    { title: "Review and lock it", icon: MdLockOutline, description: "Check the people, lessons, adjustments, and total. Locking freezes that exact version so it cannot quietly change." },
    { title: "Ask the payer to approve", icon: MdHowToReg, description: `Common Time sends the itemized invoice. The payer gets ${reviewDays} day${reviewDays === 1 ? "" : "s"} to review and approve that exact amount.` },
    { title: `Charge the saved card${chargeDay ? ` around day ${chargeDay}` : ""}`, icon: MdCreditCard, description: "Once approval and any required notice are complete, you submit the charge. Common Time marks it paid only after Stripe confirms the payment." },
    { title: "Keep the human decisions organized", icon: MdHistory, description: "You remain in control. You can correct lesson outcomes, choose exceptions, add credits or charges, and communicate directly with families. Common Time keeps those decisions clear and traceable.", detailTitle: "What does Common Time control?", detail: "The system protects the sequence, records what changed, and prevents accidental charges. It does not replace your judgment or your relationship with families.", note: true },
  ];
  const scroller = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  function updateProgress() {
    const element = scroller.current;
    if (!element) return;
    const cards = Array.from(element.querySelectorAll<HTMLElement>("li"));
    const center = element.scrollTop + element.clientHeight / 2;
    const closest = cards.reduce((best, card, index) => {
      const cardCenter = card.offsetTop + card.offsetHeight / 2;
      return Math.abs(cardCenter - center) < best.distance ? { index, distance: Math.abs(cardCenter - center) } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    setActive(closest.index);
  }

  function show(index: number) {
    const card = scroller.current?.querySelectorAll<HTMLElement>("li")[index];
    if (card && scroller.current) scroller.current.scrollTo({ top: card.offsetTop, behavior: "smooth" });
    setActive(index);
  }

  return <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
    <ol ref={scroller} onScroll={updateProgress} className="onboarding-billing-scroll relative flex h-[24rem] snap-y snap-mandatory flex-col gap-3 overflow-y-auto overscroll-contain scroll-smooth pb-10 text-left" aria-label="How your school gets from a lesson to payment">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return <li key={step.title} className="relative grid min-h-[22rem] snap-start grid-cols-[3.5rem_1fr] items-center gap-4 py-3">
          <span aria-hidden="true" className={`absolute bottom-0 left-8 top-0 w-px bg-brand/40 ${index === 0 ? "top-1/2" : ""} ${index === steps.length - 1 ? "bottom-1/2" : ""}`} />
          <div className="relative z-10 grid h-14 w-14 place-items-center rounded-full border-2 border-brand bg-canvas text-brand shadow-[0_0_0_7px_var(--color-canvas)]">
            <Icon aria-hidden="true" className="h-6 w-6" />
          </div>
          <article className="rounded-control bg-surface p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-medium text-ink">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>
            {step.detailTitle ? <details className="mt-4 border-t border-line/70 pt-4"><summary className="cursor-pointer text-sm font-medium text-brand">{step.detailTitle}</summary><p className="mt-2 text-sm leading-6 text-muted">{step.detail}</p></details> : null}
          </article>
        </li>;
      })}
    </ol>
    <div className="flex justify-center gap-2 sm:flex-col" aria-label={`Item ${active + 1} of ${steps.length}`}>
      {steps.map((step, index) => <button key={step.title} type="button" onClick={() => show(index)} aria-label={`Show ${step.note ? "paper trail note" : `step ${index + 1}`}: ${step.title}`} aria-current={active === index ? "step" : undefined} className={`h-2.5 rounded-full transition-all ${active === index ? "w-8 bg-brand sm:h-8 sm:w-2.5" : "w-2.5 bg-line"}`} />)}
    </div>
  </div>;
}
