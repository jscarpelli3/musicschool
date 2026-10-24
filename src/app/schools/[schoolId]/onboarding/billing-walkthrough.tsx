"use client";

import { useRef, useState } from "react";
import { MdCreditCard, MdEventAvailable, MdFamilyRestroom, MdHistory, MdHowToReg, MdMusicNote, MdPersonAdd, MdPolicy, MdReceiptLong } from "react-icons/md";

export function BillingWalkthrough() {
  const steps = [
    { title: "Welcome students and families", icon: MdPersonAdd, description: "Add each student, the people who support them, and the person responsible for payment. Everyone stays connected around the same lessons and account.", detailTitle: "What if a family is set up differently?", detail: "A payer may be a parent, guardian, or an adult student paying for themselves. Siblings can share one payer, and the person who receives invoices does not have to be the only family contact." },
    { title: "Schedule their lessons", icon: MdEventAvailable, description: "Choose the student, teacher, time, place, and kind of lesson. Common Time helps you see openings while leaving room for the real-life exceptions that come with teaching.", detailTitle: "Does the schedule have to be rigid?", detail: "No. Teaching hours help you find good options, but an owner can schedule outside them when everyone agrees. Common Time prevents teacher conflicts and keeps the agreed time clear." },
    { title: "Give families their portal", icon: MdFamilyRestroom, description: "Invite the payer to their private portal, where they can follow the student’s schedule and securely add the card they want the school to charge.", detailTitle: "What can a payer do there?", detail: "Payers can see upcoming lessons and invoice history, request a cancellation or reschedule, ask the school to review an invoice, and manage their saved payment method. They verify themselves before seeing private family information, and their card details go directly to Stripe—not to you." },
    { title: "Teach and keep the month current", icon: MdMusicNote, description: "Teach the lessons and record what actually happened. When plans change, the calendar, lesson record, and people involved stay connected.", detailTitle: "How do teachers and families report changes?", detail: "Teachers have their own portal where they can mark whether a lesson was completed or did not happen and report a schedule change. Families can request cancellations and reschedules from their portal. You review those requests, talk with people when needed, and make the final decision for the school." },
    { title: "Use one clear cancellation policy", icon: MdPolicy, description: "Set the notice you normally require and what usually happens when a lesson is cancelled or moved. Families see the policy when they make a request, so the next step is clear before you respond.", detailTitle: "Does the policy make the decision for me?", detail: "No. Common Time records when the request arrived, shows how your published policy applies, and recommends the normal outcome. You still approve the final result and can make a documented exception after talking with the family. If an invoiced or paid lesson changes, the resulting charge, credit, replacement, or correction stays connected to that decision." },
    { title: "Prepare the monthly invoices", icon: MdReceiptLong, description: "Common Time brings the month’s lessons together for each payer. You review the work, the people, and the amount before anything is sent or charged.", detailTitle: "Can I make a correction or exception?", detail: "Yes. You can leave out a lesson, add another eligible lesson, or add a credit or separate charge. You can also correct a lesson outcome when the real-world conversation calls for it. The invoice keeps those choices visible." },
    { title: "Send each invoice for approval", icon: MdHowToReg, description: "The payer receives a clear, itemized invoice and approves the exact amount. If something looks wrong, they can send it back for review instead.", detailTitle: "What happens when a payer asks for a change?", detail: "Nothing is charged. The invoice returns to you with their request so you can talk it through, make any adjustment, and send the updated amount for approval. Both sides can see what happened." },
    { title: "Charge the card they saved", icon: MdCreditCard, description: "After the invoice is approved, you charge the family’s saved card. Common Time waits for Stripe to confirm the payment before marking the invoice paid.", detailTitle: "What about automatic payments?", detail: "A payer can separately choose automatic payment for future monthly invoices. They still receive the itemized amount and the agreed notice before a charge. You and the payer can turn that arrangement off for future invoices." },
    { title: "Stay focused on the people", icon: MdHistory, description: "You keep teaching, communicating, and making the judgment calls. Common Time keeps the schedule, requests, decisions, invoices, approvals, and payments organized around those relationships.", detailTitle: "Who is really in control?", detail: "You are. Policies provide a normal path, but the owner can make a documented exception, correct a status, add a credit or charge, and speak directly with a family. Common Time supports the relationship and preserves a clear history; it does not try to replace either one.", note: true },
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

  return <div className="mx-auto grid max-w-5xl gap-7 sm:grid-cols-[1fr_auto] sm:items-center">
    <ol ref={scroller} onScroll={updateProgress} className="onboarding-billing-scroll relative flex h-[32rem] snap-y snap-mandatory flex-col gap-4 overflow-y-auto overscroll-contain scroll-smooth pb-14 text-left" aria-label="How your school gets from a lesson to payment">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return <li key={step.title} className="relative grid min-h-[29rem] snap-start grid-cols-[4.5rem_1fr] items-center gap-6 py-4">
          <span aria-hidden="true" className={`absolute bottom-0 left-9 top-0 w-px bg-brand/40 ${index === 0 ? "top-1/2" : ""} ${index === steps.length - 1 ? "bottom-1/2" : ""}`} />
          <div className="relative z-10 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-brand bg-canvas text-brand shadow-[0_0_0_9px_var(--color-canvas)]">
            <Icon aria-hidden="true" className="h-8 w-8" />
          </div>
          <article className="rounded-card bg-surface p-7 shadow-[var(--ui-shadow-soft)] sm:p-9">
            <h3 className="text-2xl font-medium text-ink">{step.title}</h3>
            <p className="mt-4 text-base leading-7 text-muted">{step.description}</p>
            {step.detailTitle ? <details className="mt-6 border-t border-line/70 pt-5"><summary className="cursor-pointer text-base font-medium text-brand">{step.detailTitle}</summary><p className="mt-3 text-sm leading-6 text-muted">{step.detail}</p></details> : null}
          </article>
        </li>;
      })}
    </ol>
    <div className="flex justify-center gap-2 sm:flex-col" aria-label={`Item ${active + 1} of ${steps.length}`}>
      {steps.map((step, index) => <button key={step.title} type="button" onClick={() => show(index)} aria-label={`Show ${step.note ? "paper trail note" : `step ${index + 1}`}: ${step.title}`} aria-current={active === index ? "step" : undefined} className={`h-2.5 rounded-full transition-all ${active === index ? "w-8 bg-brand sm:h-8 sm:w-2.5" : "w-2.5 bg-line"}`} />)}
    </div>
  </div>;
}
