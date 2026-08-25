"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function FocusedModal({
  triggerLabel,
  eyebrow,
  title,
  description,
  children,
  disabled = false,
  variant = "primary",
  open: controlledOpen,
  onOpenChange,
}: {
  triggerLabel: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  // setOpen intentionally reflects the current controlled/uncontrolled state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={() => setOpen(true)} className={`border px-5 py-3 text-sm transition disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted ${variant === "primary" ? "border-brand bg-brand text-canvas hover:bg-brand-hover" : "border-line bg-transparent text-ink hover:border-brand hover:text-brand"}`}>
      {triggerLabel}
    </button>
    {open ? <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label={`Close ${title}`} onClick={() => setOpen(false)} className="fixed inset-0 border-0 bg-[var(--ui-overlay)]" />
      <section className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-surface p-6 shadow-xl sm:p-9">
        <header className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div>
            {eyebrow ? <p className="text-xs uppercase tracking-[0.14em] text-brand">{eyebrow}</p> : null}
            <h2 id={titleId} className="mt-3 font-display text-4xl">{title}</h2>
            {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted transition hover:text-ink">Close</button>
        </header>
        <div className="pt-7">{children}</div>
      </section>
    </div> : null}
  </>;
}
