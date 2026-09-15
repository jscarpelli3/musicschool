import Link from "next/link";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";

export function InvoiceList({ schoolId, invoices, compact = false }: { schoolId: string; invoices: SchoolInvoice[]; compact?: boolean }) {
  if (!invoices.length) return <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>;
  return <div className={compact ? "divide-y divide-line" : "grid gap-3"}>
    {invoices.map((invoice) => {
      const money = new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amountDueCents / 100);
      return <article key={invoice.id} className={compact ? "py-3" : "ui-card p-5 sm:p-6"}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Link href={`/schools/${schoolId}/families/${invoice.billingAccountId}?period=${invoice.id}`} className="font-medium transition hover:text-brand">{invoice.familyName}</Link>
            <p className="mt-1 text-xs text-muted">{invoice.label} · {invoice.periodStart}–{invoice.periodEnd}</p>
          </div>
          <div className="sm:text-right"><p className="text-sm">{money}</p><p className={`mt-1 text-xs ${invoice.status === "paid" ? "text-brand" : "text-muted"}`}>{invoice.statusLabel}</p></div>
        </div>
      </article>;
    })}
  </div>;
}
