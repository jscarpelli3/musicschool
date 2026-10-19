"use client";

import { useRef, useState } from "react";
import { MdCreditCard, MdHowToReg, MdLockOutline, MdReceiptLong, MdScheduleSend } from "react-icons/md";

const steps = [
  { title: "Gather what is owed", icon: MdReceiptLong, description: "Completed lessons and any fees are gathered into a draft invoice for each payer. Nothing is charged yet." },
  { title: "Check the invoice", icon: MdLockOutline, description: "You review every item and amount. When it looks right, you lock it so the payer sees exactly what you approved." },
  { title: "Ask the payer to approve it", icon: MdHowToReg, description: "Common Time emails the payer an itemized invoice. They approve that exact amount before you can charge their saved payment method." },
  { title: "Give them advance notice", icon: MdScheduleSend, description: "If the payer chose automatic payments, Common Time still sends notice and waits for the agreed amount of time before charging." },
  { title: "Collect the payment", icon: MdCreditCard, description: "After the required approval and notice, you can charge the saved payment method. The invoice is marked paid only after the payment is confirmed." },
];

export function BillingWalkthrough() {
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

  return <div className="mx-auto mt-9 grid max-w-3xl gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
    <ol ref={scroller} onScroll={updateProgress} className="onboarding-billing-scroll relative h-80 snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth text-left" aria-label="How billing works">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return <li key={step.title} className="relative grid min-h-80 snap-center grid-cols-[4rem_1fr] items-center gap-5 py-8">
          <span aria-hidden="true" className={`absolute bottom-0 left-8 top-0 w-px bg-brand/40 ${index === 0 ? "top-1/2" : ""} ${index === steps.length - 1 ? "bottom-1/2" : ""}`} />
          <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 border-brand bg-canvas text-brand shadow-[0_0_0_7px_var(--color-canvas)]">
            <Icon aria-hidden="true" className="h-7 w-7" />
          </div>
          <article className="rounded-control border border-line bg-surface p-6 shadow-sm sm:p-8">
            <span className="text-xs font-medium tracking-[0.14em] text-brand">STEP {String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 font-display text-3xl text-ink">{step.title}</h3>
            <p className="mt-4 text-sm leading-7 text-muted">{step.description}</p>
          </article>
        </li>;
      })}
    </ol>
    <div className="flex justify-center gap-2 sm:flex-col" aria-label={`Step ${active + 1} of ${steps.length}`}>
      {steps.map((step, index) => <button key={step.title} type="button" onClick={() => show(index)} aria-label={`Show step ${index + 1}: ${step.title}`} aria-current={active === index ? "step" : undefined} className={`h-2.5 rounded-full transition-all ${active === index ? "w-8 bg-brand sm:h-8 sm:w-2.5" : "w-2.5 bg-line"}`} />)}
    </div>
  </div>;
}
