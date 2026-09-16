"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ChoiceCarousel({ label, children }: { label: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: -1 | 1) => rail.current?.scrollBy({ left: direction * Math.max(280, rail.current.clientWidth * 0.78), behavior: "smooth" });
  useEffect(() => {
    rail.current?.querySelector<HTMLElement>("[data-choice-selected='true']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [children]);

  return <div role="region" aria-label={label}>
    <div className="mb-4 flex items-center justify-between gap-4">
      <p className="text-xs text-muted">Scroll or use the arrows to explore.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => move(-1)} aria-label={`Show previous ${label.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-muted transition hover:bg-brand/10 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">←</button>
        <button type="button" onClick={() => move(1)} aria-label={`Show next ${label.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-muted transition hover:bg-brand/10 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">→</button>
      </div>
    </div>
    <div ref={rail} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">{children}</div>
  </div>;
}
