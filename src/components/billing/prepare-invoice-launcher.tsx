"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MdReceiptLong, MdSearch } from "react-icons/md";
import { FocusedModal } from "@/components/ui/focused-modal";

export type InvoicePayerChoice = { id: string; name: string; students: string[] };

export function PrepareInvoiceLauncher({ schoolId, payers, variant }: { schoolId: string; payers: InvoicePayerChoice[]; variant: "nav" | "dashboard" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return payers;
    return payers.filter((payer) => [payer.name, ...payer.students].some((label) => label.toLocaleLowerCase().includes(query)));
  }, [payers, search]);
  const dashboard = variant === "dashboard";

  function choosePayer(id: string) {
    setOpen(false);
    setSearch("");
    router.push(`/schools/${schoolId}/families/${id}?prepareInvoice=1`, { scroll: false });
  }

  return <FocusedModal open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }} triggerLabel="Prepare an invoice" eyebrow="New invoice" title="Who are you billing?" description="Search by payer, family, or student. You’ll choose the service month after selecting the payer account." disabled={!payers.length}
    triggerContent={dashboard ? <><MdReceiptLong aria-hidden="true" className="mb-2 text-3xl text-brand" /><span className="font-display text-3xl font-normal tracking-[-0.03em]">Prepare an invoice</span><span className="mt-2 max-w-xs text-xs leading-5 text-muted">Choose a payer, then review their unpaid lessons for a month.</span></> : <><MdReceiptLong aria-hidden="true" className="text-lg" />Prepare invoice</>}
    triggerClassName={dashboard ? "flex h-full min-h-40 w-full flex-col items-center justify-center rounded-card border border-transparent bg-surface-raised/55 px-6 py-7 text-center shadow-[var(--ui-shadow-soft)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-brand/50 hover:bg-surface-raised hover:text-brand hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50" : "inline-flex items-center gap-1.5 text-sm text-brand transition hover:text-brand-hover disabled:cursor-not-allowed disabled:text-muted"}>
    <label className="flex items-center gap-3 rounded-control border border-line bg-canvas px-4 focus-within:border-brand">
      <MdSearch aria-hidden="true" className="shrink-0 text-lg text-muted" /><span className="sr-only">Search payers and students</span>
      <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a payer or student…" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted" />
    </label>
    <div className="mt-4 max-h-80 overflow-y-auto border-t border-line pt-3">
      {filtered.length ? filtered.map((payer) => <button key={payer.id} type="button" onClick={() => choosePayer(payer.id)} className="block w-full rounded-control px-4 py-3 text-left transition hover:bg-brand/10"><span className="block text-sm text-ink">{payer.name}</span><span className="mt-1 block text-xs text-muted">{payer.students.length ? payer.students.join(" · ") : "No students connected"}</span></button>) : <p className="px-4 py-8 text-center text-sm text-muted">No payer or student matches that search.</p>}
    </div>
  </FocusedModal>;
}
