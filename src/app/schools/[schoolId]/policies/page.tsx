import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { CancellationPolicyForm } from "@/components/school-setup/cancellation-policy-form";
import { FamilyCancellationAccessForm } from "@/components/school-setup/family-cancellation-access-form";
import { createClient } from "@/lib/supabase/server";
import { publishCancellationPolicy,saveFamilyCancellationAccess } from "./actions";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/policies`);
  const [{ data: school }, { data: membership }, { data: policies },{data:familyAccess}] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_policies").select("id, name, school_policy_versions(id, version_number, published_at, cancellation_policy_rules(*))").eq("school_id", schoolId).eq("kind", "cancellation").eq("status", "active").eq("is_default", true).maybeSingle(),
    supabase.from("school_family_cancellation_settings").select("timely_approval_mode,refund_portal_mode").eq("school_id",schoolId).maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);

  const versions = policies?.school_policy_versions ?? [];
  const latestVersion = [...versions].filter((version) => version.published_at).sort((a, b) => b.version_number - a.version_number)[0];
  const rules = Array.isArray(latestVersion?.cancellation_policy_rules)
    ? latestVersion.cancellation_policy_rules[0]
    : latestVersion?.cancellation_policy_rules;
  const initial = {
    name: policies?.name ?? "Standard cancellation policy",
    cancelCutoffHours: rules?.student_cancel_cutoff_hours ?? 24,
    rescheduleCutoffHours: rules?.student_reschedule_cutoff_hours ?? 24,
    timelyDisposition: rules?.timely_cancel_disposition ?? "waive",
    lateLessonResolution: rules?.late_lesson_resolution ?? (rules?.late_cancel_disposition === "charge" ? "count_as_serviced" : "manual_review"),
    lateRescheduleFeeCents: rules?.late_reschedule_fee_cents ?? 0,
    replacementWindowDays: rules?.replacement_window_days ?? 90,
    mustKeepAssignedTeacher: rules?.must_keep_assigned_teacher ?? true,
    timelyGuidance: rules?.timely_request_guidance ?? "Requests made within the cancellation period are normally approved.",
    lateGuidance: rules?.late_request_guidance ?? "This request was made outside the cancellation period. The school will review the request using this policy.",
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="policies" />
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Policies</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Human-readable terms backed by rules the schedule and billing system can enforce.</p>
        </div>
        <div className="py-10 md:pl-10">
          <CancellationPolicyForm initial={initial} action={publishCancellationPolicy.bind(null, schoolId)} />
          {latestVersion ? <p className="mt-8 border-t border-line pt-5 text-xs text-muted">Currently published: version {latestVersion.version_number} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(new Date(latestVersion.published_at!))}</p> : null}
        </div>
      </section>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Family cancellation access</h2><p className="mt-3 text-sm leading-6 text-muted">Control when families can act immediately and how refund choices appear. Individual payer exceptions remain private and audited.</p></div>
        <div className="py-10 md:pl-10"><FamilyCancellationAccessForm initial={{timelyApprovalMode:familyAccess?.timely_approval_mode??"owner_review",refundPortalMode:familyAccess?.refund_portal_mode??"contact_school"}} action={saveFamilyCancellationAccess.bind(null,schoolId)}/></div>
      </section>
      <section className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Documents</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Private legal and operational files kept on hand for the school.</p>
        </div>
        <div className="py-10 md:pl-10">
          <p className="text-sm text-muted">No documents uploaded.</p>
          <button disabled className="mt-8 border-b border-line pb-2 text-sm text-muted">Upload document — storage setup coming next</button>
        </div>
      </section>
    </main>
  );
}
