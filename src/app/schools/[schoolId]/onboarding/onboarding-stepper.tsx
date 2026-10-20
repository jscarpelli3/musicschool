"use client";

import { Children, useState, type ReactNode } from "react";
import { MdAccessTime, MdFamilyRestroom, MdGroups, MdMusicNote, MdPayments, MdRoute, MdStorefront } from "react-icons/md";

const steps = [
  { key: "school", label: "School", icon: MdStorefront },
  { key: "instruments", label: "Instruments", icon: MdMusicNote },
  { key: "students", label: "Students & payers", icon: MdFamilyRestroom },
  { key: "team", label: "Teaching team", icon: MdGroups },
  { key: "hours", label: "Teaching hours", icon: MdAccessTime },
  { key: "payments", label: "Payments & offerings", icon: MdPayments },
  { key: "flow", label: "How it works", icon: MdRoute },
] as const;

export function OnboardingStepper({ children, initialStep = "school" }: { children: ReactNode; initialStep?: string }) {
  const pages = Children.toArray(children);
  const startingIndex = Math.max(0, steps.findIndex((step) => step.key === initialStep));
  const [active, setActive] = useState(startingIndex);
  const step = steps[active];

  function move(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setActive(next);
    const url = new URL(window.location.href);
    url.searchParams.set("step", steps[next].key);
    url.searchParams.delete("finish");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="mt-8">
    <div className="mx-auto flex max-w-4xl items-start justify-between gap-2" aria-label={`Setup step ${active + 1} of ${steps.length}`}>
      {steps.map((item, index) => { const ItemIcon = item.icon; return <button key={item.key} type="button" onClick={() => move(index)} aria-label={`Go to ${item.label}`} aria-current={index === active ? "step" : undefined} className={`group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-control px-1 py-2 text-center transition ${index === active ? "bg-[var(--school-section-tab)] text-ink" : "text-muted hover:bg-surface hover:text-ink"}`}><ItemIcon aria-hidden="true" className={`text-2xl transition ${index === active ? "scale-110 text-brand" : "opacity-60 group-hover:opacity-100"}`} /><span className={`hidden text-[0.62rem] uppercase tracking-[0.1em] sm:block ${index === active ? "font-medium" : ""}`}>{item.label}</span></button>; })}
    </div>

    <div className="mt-7 overflow-hidden rounded-card bg-[color-mix(in_srgb,var(--school-section-tab)_46%,var(--ui-surface-raised))] p-5 text-left shadow-[var(--ui-shadow-soft)] transition-[background-color,box-shadow] duration-500 sm:p-8 lg:p-10">
      <h2 className="sr-only">{step.label}</h2>
      <section key={step.key} className="onboarding-step-enter">{pages[active]}</section>
    </div>

    <nav className="mt-10 flex items-center justify-between border-t border-line pt-6" aria-label="Setup steps">
      <button type="button" onClick={() => move(active - 1)} disabled={active === 0} className="rounded-control px-4 py-2 text-sm text-muted transition hover:bg-surface disabled:invisible">← Previous</button>
      <span className="text-xs text-muted">{step.label}</span>
      <button type="button" onClick={() => move(active + 1)} disabled={active === steps.length - 1} className="rounded-control bg-ink px-5 py-2.5 text-sm text-canvas transition hover:opacity-85 disabled:invisible">Next →</button>
    </nav>
  </div>;
}
