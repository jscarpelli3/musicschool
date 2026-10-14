import Link from "next/link";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";

export function InvoiceList({ schoolId, invoices, compact = false }: { schoolId: string; invoices: SchoolInvoice[]; compact?: boolean }) {
  if (!invoices.length) return <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>;
  return <div className={compact ? "divide-y divide-line" : "grid gap-3"}>
    {invoices.map((invoice) => {
      const money = new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amountDueCents / 100);
      const statusClass = invoice.status === "paid"
        ? "border-brand/50 bg-brand text-canvas"
        : invoice.status === "draft" || invoice.status === "review"
          ? "border-ink/25 bg-ink/10 text-ink"
          : "border-brand/30 bg-brand/10 text-brand";
      return <article key={invoice.id} className={compact ? "py-3" : "ui-card p-5 sm:p-6"}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Link href={`/schools/${schoolId}/families/${invoice.billingAccountId}?period=${invoice.id}`} className="font-medium transition hover:text-brand">{invoice.familyName}</Link>
            <p className="mt-1 text-xs text-muted">{invoice.label} · {invoice.periodStart}–{invoice.periodEnd}</p>
          </div>
          <div className="sm:text-right"><p className="text-sm">{money}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClass}`}>{invoice.statusLabel}</span></div>
        </div>
      </article>;
    })}
  </div>;
}
