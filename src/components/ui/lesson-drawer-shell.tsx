"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function LessonDrawerShell({ titleId, eyebrow, title, onClose, children, width = "narrow", surface = "surface" }: {
  titleId: string;
  eyebrow: ReactNode;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: "narrow" | "wide";
  surface?: "canvas" | "surface";
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector("[data-nested-modal]")) return;
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <div className="fixed inset-0 z-[80] flex justify-end">
    <button type="button" aria-label="Close lesson details" onClick={onClose} className="absolute inset-0 cursor-default border-0 bg-[var(--ui-overlay)] p-0" />
    <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative z-10 h-full w-full overflow-y-auto border-l border-line px-6 py-7 shadow-2xl sm:px-8 ${width === "wide" ? "sm:max-w-xl" : "sm:max-w-md"} ${surface === "surface" ? "bg-surface" : "bg-canvas"}`}>
      <header className="flex items-start justify-between gap-6 pb-6">
        <div><p className="text-xs text-brand">{eyebrow}</p><h2 id={titleId} className="mt-3 font-display text-4xl font-normal tracking-[-0.035em]">{title}</h2></div>
        <button ref={closeRef} type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-muted hover:text-ink">Close</button>
      </header>
      {children}
    </aside>
  </div>;
}
