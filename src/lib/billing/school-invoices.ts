import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "@/types/database";
import { billingPeriodDescriptor, billingPeriodStates } from "@/lib/domain/state-descriptors";

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
  return !billingPeriodDescriptor(invoice.status).terminal;
}

const attentionStatuses = Object.entries(billingPeriodStates)
  .filter(([, descriptor]) => !descriptor.terminal)
  .map(([status]) => status);

export const loadSchoolInvoiceSummary = cache(async function loadSchoolInvoiceSummary(client: Client, schoolId: string, limit = 6) {
  const [invoices, countResult] = await Promise.all([
    loadSchoolInvoices(client, schoolId, limit),
    client.from("billing_periods").select("id", { count: "exact", head: true }).eq("school_id", schoolId).in("status", attentionStatuses),
  ]);
  if (countResult.error) throw new Error("Invoice attention count could not be loaded.");
  return { invoices, attentionCount: countResult.count ?? 0 };
});
