import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SchoolManagementNav } from "@/components/schools/school-management-nav";
import { createClient } from "@/lib/supabase/server";
import { AppSignOut } from "@/components/auth/app-sign-out";
import { loadCurrentSchoolAccess } from "@/lib/auth/school-access";
import { loadOwnerApprovalSummary } from "@/lib/approvals/owner-approvals";
import { loadSchoolInvoiceSummary } from "@/lib/billing/school-invoices";

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
          <span className="min-w-0"><span className="block text-xs capitalize text-muted">{membership.role}</span><span className="mt-2 flex min-w-0 items-center gap-2"><Link href={`/schools/${schoolId}`} className="truncate font-display text-3xl hover:text-brand sm:text-4xl">{school.name}</Link>{capabilities.has("school.setup.manage") ? <Link href={`/schools/${schoolId}/setup`} aria-label={`School setup for ${school.name}`} title="School setup" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.7"><path d="M9.6 3.2h4.8l.6 2.3 2 .8 2.1-1.2 2.4 4.2-1.8 1.6.2 2.2 1.6 1.6-2.4 4.2-2.2-1-2 .8-.5 2.3H9.6L9 18.5l-2-.8-2.1 1.2-2.4-4.2 1.8-1.6-.2-2.2-1.6-1.6 2.4-4.2 2.2 1 2-.8.5-2.1Z"/><circle cx="12" cy="12" r="3"/></svg></Link> : null}</span><span className="mt-1 hidden text-xs text-muted sm:block">{school.timezone} · {school.family_billing_mode.replaceAll("_"," ")}</span></span>
        </div>
        <div className="flex shrink-0 items-start gap-3"><Link href="/profile" aria-label="Profile settings" className="flex items-center gap-3 py-control text-sm text-muted hover:text-ink">{avatarUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={avatarUrl} alt="Your avatar" className="h-10 w-10 rounded-full border border-line object-cover" /> : null}<span className="hidden sm:inline">Profile</span></Link><AppSignOut /></div>
      </header>
      <SchoolManagementNav schoolId={schoolId} capabilities={[...capabilities]} recentApprovals={approvalSummary.items.map((item) => ({ id: item.id, kind: item.kind, teacherId: item.teacherId, studentId: item.studentId, teacher: item.teacher, student: item.student, detail: item.kind === "schedule_proposal" ? "Schedule change" : item.requestType === "cancellation" ? "Cancellation request" : "Reschedule request" }))} approvalCount={approvalSummary.count} recentInvoices={invoiceSummary.invoices.slice(0, 5)} invoiceCount={invoiceSummary.attentionCount} />
    </div>
    {children}
  </div>;
}
