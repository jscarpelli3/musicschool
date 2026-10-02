import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/account-menu";
import { SchoolManagementNav } from "@/components/schools/school-management-nav";
import { createClient } from "@/lib/supabase/server";
import { loadCurrentSchoolAccess } from "@/lib/auth/school-access";
import { loadOwnerApprovalSummary } from "@/lib/approvals/owner-approvals";
import { loadSchoolInvoiceSummary } from "@/lib/billing/school-invoices";
import { MdChecklist, MdSettings } from "react-icons/md";

export const dynamic = "force-dynamic";

export default async function SchoolLayout({ children, params }: { children: ReactNode; params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { profileId, school, membership, capabilities } = await loadCurrentSchoolAccess(schoolId);
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);
  const [{ data: profile }, approvalSummary, invoiceSummary] = await Promise.all([
    supabase.from("profiles").select("avatar_url, avatar_path").eq("id", profileId).maybeSingle(),
    capabilities.has("school.approvals.review") ? loadOwnerApprovalSummary(supabase, schoolId) : Promise.resolve({ items: [], count: 0 }),
    capabilities.has("school.billing.manage") ? loadSchoolInvoiceSummary(supabase, schoolId, 6) : Promise.resolve({ invoices: [], attentionCount: 0 }),
  ]);
  if (!school || !membership) notFound();
  const [{ data: avatar }, { data: logo }] = await Promise.all([
    profile?.avatar_path ? supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600) : Promise.resolve({ data: null }),
    school.logo_path ? supabase.storage.from("school-logos").createSignedUrl(school.logo_path, 3600) : Promise.resolve({ data: null }),
  ]);
  const avatarUrl = avatar?.signedUrl ?? profile?.avatar_url;
  return <div data-school-theme={school.theme_key} data-school-font={school.font_key} className="min-h-screen bg-canvas text-ink">
    <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 sm:pt-10">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-7">
        <div className="flex min-w-0 items-center gap-4">
          {logo?.signedUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={logo.signedUrl} alt={`${school.name} logo`} className="h-14 w-14 shrink-0 rounded-card border border-line bg-surface object-contain p-2" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-card border border-line bg-surface text-xl font-semibold text-brand">{school.name.slice(0,1).toUpperCase()}</span>}
          <span className="min-w-0">
            <Link href={`/schools/${schoolId}`} className="block truncate font-display text-3xl hover:text-brand sm:text-4xl">{school.name}</Link>
            <span className="mt-1 block text-xs text-muted">{school.timezone} · {school.family_billing_mode.replaceAll("_"," ")}</span>
            {capabilities.has("school.setup.manage") ? <span className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <Link href={`/schools/${schoolId}/setup`} className="inline-flex items-center gap-1.5 text-muted transition hover:text-brand"><MdSettings aria-hidden="true" className="text-base" />School settings</Link>
              <Link href={`/schools/${schoolId}/onboarding`} className="inline-flex items-center gap-1.5 text-muted transition hover:text-brand"><MdChecklist aria-hidden="true" className="text-base" />Setup guide</Link>
            </span> : null}
          </span>
        </div>
        <div className="flex shrink-0 items-end gap-4"><Link href="/support" className="mb-2.5 text-sm text-muted hover:text-ink">Help</Link><AccountMenu avatarUrl={avatarUrl} role={membership.role} /></div>
      </header>
      <SchoolManagementNav schoolId={schoolId} capabilities={[...capabilities]} recentApprovals={approvalSummary.items.map((item) => ({ id: item.id, kind: item.kind, teacherId: item.teacherId, studentId: item.studentId, teacher: item.teacher, student: item.student, detail: item.kind === "schedule_proposal" ? "Schedule change" : item.requestType === "cancellation" ? "Cancellation request" : "Reschedule request" }))} approvalCount={approvalSummary.count} recentInvoices={invoiceSummary.invoices.slice(0, 5)} invoiceCount={invoiceSummary.attentionCount} />
    </div>
    {children}
  </div>;
}
