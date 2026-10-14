import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { AddFamilyDialog } from "@/components/families/add-family-dialog";
import { addStudentAndPayer } from "./actions";
import { invoiceNeedsAttention, loadSchoolInvoices } from "@/lib/billing/school-invoices";
import { FamilyDirectory, type FamilyDirectoryRow } from "@/components/families/family-directory";

export const dynamic = "force-dynamic";

function displayName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function FamiliesPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/families`);

  const results = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_accounts").select("id, name, status, billing_contact_person_id").eq("school_id", schoolId).order("name"),
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone").eq("school_id", schoolId),
    supabase.from("billing_account_students").select("billing_account_id, student_id").eq("school_id", schoolId),
    loadMySchoolCapabilities(schoolId),
    loadSchoolInvoices(supabase, schoolId),
  ]);
  const failed = results.find((result) => "error" in result && result.error);
  if (failed && "error" in failed && failed.error) throw new Error(`Families could not load: ${failed.error.message}`);
  const [{ data: school }, { data: membership }, { data: accounts }, { data: people }, { data: studentLinks }, capabilities, invoices] = results;
  if (!school || !membership) notFound();

  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  const studentCount = (studentLinks ?? []).reduce<Record<string, number>>((counts, link) => {
    counts[link.billing_account_id] = (counts[link.billing_account_id] ?? 0) + 1;
    return counts;
  }, {});
  const activeInvoiceByAccount = new Map<string, (typeof invoices)[number]>();
  for (const invoice of invoices) {
    if (invoiceNeedsAttention(invoice) && !activeInvoiceByAccount.has(invoice.billingAccountId)) activeInvoiceByAccount.set(invoice.billingAccountId, invoice);
  }
  const directoryRows: FamilyDirectoryRow[] = (accounts ?? []).map((account) => {
    const contact = peopleById.get(account.billing_contact_person_id);
    const invoice = activeInvoiceByAccount.get(account.id);
    return {
      id: account.id,
      schoolId,
      name: account.name,
      status: account.status,
      contactName: contact ? displayName(contact) : "No payer assigned",
      contactDetail: contact?.email || contact?.phone || "No contact details",
      studentCount: studentCount[account.id] ?? 0,
      invoice: invoice ? {
        statusLabel: invoice.statusLabel,
        label: invoice.label,
        amountDue: new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amountDueCents / 100),
      } : null,
    };
  });

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-4">
        <div><h1 className="font-display text-5xl tracking-[-0.04em] sm:text-6xl">Families.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Review payer accounts, contact details, and the students connected to each family.</p><p className="mt-2 text-sm text-muted">{accounts?.length ?? 0} payer accounts</p></div>
        {capabilities.has("school.billing.manage") ? <AddFamilyDialog action={addStudentAndPayer.bind(null, schoolId)} triggerLabel="Add family +" /> : null}
      </header>
      <FamilyDirectory rows={directoryRows} />
    </main>
  );
}
