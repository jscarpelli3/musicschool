"use client";

import { useEffect, useRef, useState } from "react";
import { MdExpandMore } from "react-icons/md";
import { formatCompactDate } from "@/lib/date-format";

type ArchivedLine = { id: string; billing_period_id: string; description: string; service_label: string; amount_cents: number };
type ArchivedPeriod = { id: string; label: string; period_start: string; period_end: string; amount_due_cents: number; currency: string; paid_at: string | null };

export function BillingArchive({ periods, lines, totalCount }: { periods: ArchivedPeriod[]; lines: ArchivedLine[]; totalCount: number }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = priorOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (!totalCount) return null;
  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline decoration-line underline-offset-4 transition hover:text-brand">
      View archived invoices ({totalCount})
    </button>
    {open ? <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="billing-archive-title">
      <button type="button" aria-label="Close archived invoices" onClick={close} className="absolute inset-0 bg-[var(--ui-overlay)]" />
      <section className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-card border border-line bg-canvas p-6 text-ink shadow-[var(--ui-shadow-strong)] sm:p-9">
        <header className="flex items-start justify-between gap-5 border-b border-line pb-6">
          <div><p className="text-xs uppercase tracking-[0.16em] text-brand">Billing history</p><h2 id="billing-archive-title" className="mt-3 font-display text-4xl">Archived invoices</h2><p className="mt-3 text-sm leading-6 text-muted">Paid statements older than six months. Payment records remain unchanged.</p></div>
          <button ref={closeRef} type="button" onClick={close} className="text-sm text-muted hover:text-ink">Close</button>
        </header>
        <div className="mt-6 space-y-3">
          {periods.map((period) => {
            const periodLines = lines.filter((line) => line.billing_period_id === period.id);
            return <details key={period.id} className="group rounded-card border border-line bg-surface p-5 opacity-70 transition open:opacity-100">
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-4 marker:hidden">
                <div><p className="font-display text-2xl">{period.label}</p><p className="mt-2 text-xs text-muted">{formatCompactDate(period.period_start)}–{formatCompactDate(period.period_end)} · Paid{period.paid_at ? ` ${new Date(period.paid_at).toLocaleDateString()}` : ""}</p></div>
                <div className="flex items-start gap-3"><p>{money(period.amount_due_cents, period.currency)}</p><MdExpandMore aria-hidden="true" className="mt-1 text-xl text-muted transition group-open:rotate-180" /></div>
              </summary>
              <div className="mt-5 border-t border-line pt-2">{periodLines.map((line) => <div key={line.id} className="grid gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[1fr_auto]"><div><p className="text-sm">{line.description}</p><p className="mt-1 text-xs text-muted">{line.service_label}</p></div><p className="text-sm sm:text-right">{money(line.amount_cents, period.currency)}</p></div>)}</div>
            </details>;
          })}
          {totalCount > periods.length ? <p className="pt-3 text-xs leading-5 text-muted">Showing the newest {periods.length} of {totalCount} archived invoices.</p> : null}
        </div>
      </section>
    </div> : null}
  </>;
}
