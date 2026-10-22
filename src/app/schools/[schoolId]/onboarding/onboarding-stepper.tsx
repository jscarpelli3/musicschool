"use client";

import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MdAccessTime, MdAutorenew, MdFamilyRestroom, MdGroups, MdLocationOn, MdMusicNote, MdPayments, MdRoute, MdStorefront } from "react-icons/md";

const steps = [
  { key: "school", label: "School", icon: MdStorefront },
  { key: "instruments", label: "Instruments", icon: MdMusicNote },
  { key: "students", label: "Students & payers", icon: MdFamilyRestroom },
  { key: "locations", label: "Lesson places", icon: MdLocationOn },
  { key: "team", label: "Teaching team", icon: MdGroups },
  { key: "hours", label: "Teaching hours", icon: MdAccessTime },
  { key: "payments", label: "Payments & offerings", icon: MdPayments },
  { key: "flow", label: "How it works", icon: MdRoute },
] as const;

export function OnboardingStepper({ children, initialStep = "school" }: { children: ReactNode; initialStep?: string }) {
  const pages = Children.toArray(children);
  const startingIndex = Math.max(0, steps.findIndex((step) => step.key === initialStep));
  const [active, setActive] = useState(startingIndex);
  const [displayed, setDisplayed] = useState(startingIndex);
  const [phase, setPhase] = useState<"idle" | "exiting" | "resizing" | "entering">("idle");
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const step = steps[active];

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  useLayoutEffect(() => {
    if (phase !== "resizing") return;
    const frame = window.requestAnimationFrame(() => {
      const nextHeight = contentRef.current?.scrollHeight;
      if (nextHeight) setContentHeight(nextHeight);
      timers.current.push(window.setTimeout(() => setPhase("entering"), 720));
      timers.current.push(window.setTimeout(() => {
        setPhase("idle");
        setContentHeight(null);
      }, 1300));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayed, phase]);

  function move(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    if (next === active) return;
    clearTimers();
    setActive(next);
    const url = new URL(window.location.href);
    url.searchParams.set("step", steps[next].key);
    url.searchParams.delete("finish");
    window.history.replaceState(null, "", url);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayed(next);
      setPhase("idle");
      setContentHeight(null);
      return;
    }
    setContentHeight(contentRef.current?.scrollHeight ?? null);
    setPhase("exiting");
    timers.current.push(window.setTimeout(() => {
      setDisplayed(next);
      setPhase("resizing");
    }, 520));
  }

  const contentMotion = phase === "exiting"
    ? "opacity-0 -translate-x-2 scale-[0.995]"
    : phase === "resizing"
      ? "opacity-0 translate-x-4 scale-[0.99]"
      : "opacity-100 translate-x-0 scale-100";

  return <div className="mt-8">
    <div className="mx-auto flex max-w-4xl items-start justify-between gap-2" aria-label={`Setup step ${active + 1} of ${steps.length}`}>
      {steps.map((item, index) => { const ItemIcon = item.icon; return <button key={item.key} type="button" onClick={() => move(index)} aria-label={`Go to ${item.label}`} aria-current={index === active ? "step" : undefined} className={`group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-control px-1 py-2 text-center transition ${index === active ? "bg-[var(--school-section-tab)] text-ink" : "text-muted hover:bg-surface hover:text-ink"}`}><ItemIcon aria-hidden="true" className={`text-2xl transition ${index === active ? "scale-110 text-brand" : "opacity-60 group-hover:opacity-100"}`} /><span className={`hidden text-[0.62rem] uppercase tracking-[0.1em] sm:block ${index === active ? "font-medium" : ""}`}>{item.label}</span></button>; })}
    </div>

    <div className="mt-7 rounded-card bg-[color-mix(in_srgb,var(--school-section-tab)_46%,var(--ui-surface-raised))] p-5 text-left shadow-[var(--ui-shadow-soft)] transition-[background-color,box-shadow] duration-700 [overflow-anchor:none] sm:p-8 lg:p-10">
      <h2 className="sr-only">{step.label}</h2>
      <div className="overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" style={contentHeight === null ? undefined : { height: contentHeight }}>
        <section ref={contentRef} className={`origin-center transform-gpu transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${contentMotion}`}>{pages[displayed]}</section>
      </div>
    </div>

    <nav className="mt-10 grid grid-cols-3 items-center border-t border-line pt-6" aria-label="Setup steps">
      <button type="button" onClick={() => move(active - 1)} disabled={active === 0} className="justify-self-start rounded-control px-4 py-2 text-sm text-muted transition hover:bg-surface disabled:invisible">← Previous</button>
      <span className="justify-self-center" role="status" aria-live="polite">{phase !== "idle" ? <><MdAutorenew aria-hidden="true" className="h-5 w-5 animate-spin text-brand" /><span className="sr-only">Changing setup section</span></> : null}</span>
      <button type="button" onClick={() => move(active + 1)} disabled={active === steps.length - 1} className="justify-self-end rounded-control bg-ink px-5 py-2.5 text-sm text-canvas transition hover:opacity-85 disabled:invisible">Next →</button>
    </nav>
  </div>;
}
