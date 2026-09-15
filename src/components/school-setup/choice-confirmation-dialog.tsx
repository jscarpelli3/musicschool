"use client";

import { useEffect, useId, useRef } from "react";

export function ChoiceConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Cancel change" onClick={onCancel} className="fixed inset-0 border-0 bg-[var(--ui-overlay)]" />
      <section className="fixed left-1/2 top-1/2 z-[101] w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--ui-radius-card)] bg-surface p-6 shadow-xl sm:p-8">
        <h2 id={titleId} className="font-display text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink transition hover:border-brand">Keep current</button>
          <button type="submit" className="rounded-md bg-brand px-4 py-2.5 text-sm text-surface transition hover:opacity-90">{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
