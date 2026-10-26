import type { SchoolInvoice } from "@/lib/billing/school-invoices";
import { InvoiceWorkspaceList } from "./invoice-workspace-list";

export function InvoiceList({ schoolId, invoices, compact = false }: { schoolId: string; invoices: SchoolInvoice[]; compact?: boolean }) {
  return <InvoiceWorkspaceList schoolId={schoolId} invoices={invoices} compact={compact} />;
}
