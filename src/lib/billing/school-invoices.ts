import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { billingPeriodDescriptor } from "@/lib/domain/state-descriptors";

type Client = SupabaseClient<Database>;

export type SchoolInvoice = {
  id: string;
  billingAccountId: string;
  familyName: string;
  label: string;
  amountDueCents: number;
  currency: string;
  status: string;
  statusLabel: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
};

export async function loadSchoolInvoices(client: Client, schoolId: string, limit?: number): Promise<SchoolInvoice[]> {
  let periodQuery = client.from("billing_periods")
    .select("id,billing_account_id,label,amount_due_cents,currency,status,period_start,period_end,updated_at")
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false });
  if (limit) periodQuery = periodQuery.limit(limit);
  const [{ data: periods, error: periodError }, { data: accounts, error: accountError }] = await Promise.all([
    periodQuery,
    client.from("billing_accounts").select("id,name").eq("school_id", schoolId),
  ]);
  if (periodError || accountError) throw new Error("Invoices could not be loaded.");
  const accountNames = new Map((accounts ?? []).map((account) => [account.id, account.name]));
  return (periods ?? []).map((period) => ({
    id: period.id,
    billingAccountId: period.billing_account_id,
    familyName: accountNames.get(period.billing_account_id) ?? "Family account",
    label: period.label,
    amountDueCents: period.amount_due_cents,
    currency: period.currency,
    status: period.status,
    statusLabel: billingPeriodDescriptor(period.status).label,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    updatedAt: period.updated_at,
  }));
}

export function invoiceNeedsAttention(invoice: SchoolInvoice) {
  return !["paid", "void", "voided"].includes(invoice.status);
}
