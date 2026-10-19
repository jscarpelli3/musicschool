import { notFound, redirect } from "next/navigation";
import { InvoiceList } from "@/components/billing/invoice-list";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { loadSchoolInvoices } from "@/lib/billing/school-invoices";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/invoices`);
  const [{ data: school }, capabilities] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);
  if (!school) notFound();
  if (!capabilities.has("school.billing.manage")) redirect(`/schools/${schoolId}`);
  const invoices = await loadSchoolInvoices(supabase, schoolId);
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 sm:py-section">
    <header className="pb-4"><PageHeading kind="billing" title="Invoices." description="Follow each family’s invoice from draft preparation through approval and payment." meta={`${invoices.length} total`} /></header>
    <section className="mt-8"><InvoiceList schoolId={schoolId} invoices={invoices} /></section>
  </main>;
}
