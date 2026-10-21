"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ChoiceCarousel({ label, selectedValue, children }: { label: string; selectedValue: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: -1 | 1) => rail.current?.scrollBy({ left: direction * Math.max(280, rail.current.clientWidth * 0.78), behavior: "smooth" });
  useEffect(() => {
    const container = rail.current;
    const selected = container?.querySelector<HTMLElement>("[data-choice-selected='true']");
    if (!container || !selected) return;
    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const selectedStart = container.scrollLeft + selectedRect.left - containerRect.left;
    const selectedEnd = selectedStart + selectedRect.width;
    const visibleStart = container.scrollLeft;
    const visibleEnd = visibleStart + container.clientWidth;
    if (selectedStart < visibleStart) container.scrollTo({ left: selectedStart, behavior: "smooth" });
    else if (selectedEnd > visibleEnd) container.scrollTo({ left: selectedEnd - container.clientWidth, behavior: "smooth" });
  }, [selectedValue]);

  return <div role="region" aria-label={label} className="min-w-0 max-w-full">
    <div className="mb-4 flex items-center justify-between gap-4">
      <p className="text-xs text-muted">Scroll or use the arrows to explore.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => move(-1)} aria-label={`Show previous ${label.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-muted transition hover:bg-brand/10 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">←</button>
        <button type="button" onClick={() => move(1)} aria-label={`Show next ${label.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-muted transition hover:bg-brand/10 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">→</button>
      </div>
    </div>
    <div ref={rail} className="flex w-full max-w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:thin]">{children}</div>
  </div>;
}
