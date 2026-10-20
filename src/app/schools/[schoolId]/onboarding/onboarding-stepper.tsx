"use client";

import { Children, useState, type ReactNode } from "react";
import { MdAccessTime, MdFamilyRestroom, MdGroups, MdMusicNote, MdReceiptLong, MdStorefront } from "react-icons/md";

const steps = [
  { key: "school", label: "School", icon: MdStorefront },
  { key: "offerings", label: "What you teach", icon: MdMusicNote },
  { key: "students", label: "Students & payers", icon: MdFamilyRestroom },
  { key: "team", label: "Teaching team", icon: MdGroups },
  { key: "hours", label: "Teaching hours", icon: MdAccessTime },
  { key: "billing", label: "Billing", icon: MdReceiptLong },
] as const;

export function OnboardingStepper({ children, initialStep = "school" }: { children: ReactNode; initialStep?: string }) {
  const pages = Children.toArray(children);
  const startingIndex = Math.max(0, steps.findIndex((step) => step.key === initialStep));
  const [active, setActive] = useState(startingIndex);
  const step = steps[active];
  const Icon = step.icon;

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
    <div className="mx-auto flex max-w-2xl items-center gap-3" aria-label={`Setup step ${active + 1} of ${steps.length}`}>
      {steps.map((item, index) => <button key={item.key} type="button" onClick={() => move(index)} aria-label={`Go to ${item.label}`} aria-current={index === active ? "step" : undefined} className={`h-2 flex-1 rounded-full transition ${index <= active ? "bg-brand" : "bg-line"}`} />)}
    </div>

    <header className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-4 text-center">
      <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--school-section-tab)] text-3xl text-ink"><Icon /></span>
      <div className="text-left">
        <p className="text-[0.68rem] text-muted">{active + 1} of {steps.length}</p>
        <h2 className="mt-1 text-xs font-medium uppercase tracking-[0.17em] text-brand">{step.label}</h2>
      </div>
    </header>

    <div className="mt-8 text-left">
      {pages.map((page, index) => <section key={steps[index]?.key ?? index} hidden={index !== active}>{page}</section>)}
    </div>

    <nav className="mt-10 flex items-center justify-between border-t border-line pt-6" aria-label="Setup steps">
      <button type="button" onClick={() => move(active - 1)} disabled={active === 0} className="rounded-control px-4 py-2 text-sm text-muted transition hover:bg-surface disabled:invisible">← Previous</button>
      <span className="text-xs text-muted">{step.label}</span>
      <button type="button" onClick={() => move(active + 1)} disabled={active === steps.length - 1} className="rounded-control bg-ink px-5 py-2.5 text-sm text-canvas transition hover:opacity-85 disabled:invisible">Next →</button>
    </nav>
  </div>;
}
