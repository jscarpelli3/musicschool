import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeacherScheduleCalendar } from "@/components/scheduling/teacher-schedule-calendar";
import { ProposalManagementControls } from "@/components/scheduling/proposal-management-controls";
import { ApprovalList } from "@/components/approvals/approval-list";
import { LessonsToSchedule } from "@/components/scheduling/lessons-to-schedule";
import { loadOwnerApprovals } from "@/lib/approvals/owner-approvals";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherCalendar, personDisplayName } from "@/lib/scheduling/teacher-calendar";
import { loadServiceEntitlements } from "@/lib/scheduling/service-entitlements";

export const dynamic = "force-dynamic";

export default async function StaffTeacherPage({ params }: {
  params: Promise<{ schoolId: string; teacherId: string }>;
}) {
  const { schoolId, teacherId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff/${teacherId}`);

  const [{ data: school }, { data: membership }, { data: teacher }, { data: teacherRecord }] = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone").eq("school_id", schoolId).eq("id", teacherId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id, outside_availability_policy").eq("school_id", schoolId).eq("person_id", teacherId).maybeSingle(),
  ]);
  if (!school || !membership || !teacher || !teacherRecord) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const rangeEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const schedule = await loadTeacherCalendar(supabase, schoolId, teacherId, { rangeStart, rangeEnd });
  const [studentRowsResult, peopleResult, productsResult, placesResult] = await Promise.all([
    supabase.from("students").select("person_id").eq("school_id",schoolId).in("enrollment_status",["active","prospect"]),
    supabase.from("people").select("id,first_name,last_name,preferred_name").eq("school_id",schoolId).eq("status","active"),
    supabase.from("service_products").select("id,name,duration_minutes,price_cents,currency").eq("school_id",schoolId).eq("status","active").eq("format","private_lesson").order("name"),
    supabase.from("lesson_places").select("id,name").eq("school_id",schoolId).eq("status","active").order("name"),
  ]);
  const creationFailure = [studentRowsResult,peopleResult,productsResult,placesResult].find((result) => result.error);
  if (creationFailure?.error) throw new Error("Lesson creation choices could not be loaded.");
  const peopleById = new Map((peopleResult.data ?? []).map((person) => [person.id,person]));
  const initialDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: school.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const teacherName = personDisplayName(teacher);
  const approvals = await loadOwnerApprovals(supabase,schoolId,{teacherId});
  const entitlements = await loadServiceEntitlements(supabase,schoolId,{teacherId});

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-section">
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
      <div>
        <p className="text-xs text-muted">Staff · teacher schedule</p>
        <h1 className="mt-3 font-display text-5xl tracking-[-0.04em] sm:text-6xl">{teacherName}</h1>
        <p className="mt-4 text-sm text-muted">{teacher.email || "No email"}{teacher.phone ? ` · ${teacher.phone}` : ""}</p>
      </div>
      <div className="flex gap-5 text-sm">
        <Link href={`/schools/${schoolId}/lessons/new?teacher=${teacherId}`} className="text-brand hover:text-brand-hover">Add lesson +</Link>
        <Link href={`/schools/${schoolId}/staff`} className="text-muted hover:text-ink">All staff</Link>
      </div>
    </header>
    {approvals.length?<section className="border-b border-line py-8"><div className="mb-5 flex items-baseline justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Needs attention</p><h2 className="mt-2 font-display text-3xl">{teacherName}’s pending approvals</h2></div><Link href={`/schools/${schoolId}/approvals`} className="text-sm text-muted hover:text-brand">View all →</Link></div><ApprovalList schoolId={schoolId} items={approvals} timezone={school.timezone} compact/></section>:null}
    {entitlements.length?<section className="border-b border-line py-8"><p className="text-xs uppercase tracking-[0.14em] text-brand">Needs scheduling</p><h2 className="mt-2 mb-5 font-display text-3xl">Paid lessons assigned to {teacherName}</h2><LessonsToSchedule schoolId={schoolId} items={entitlements} timezone={school.timezone} compact/></section>:null}
    {schedule.pendingProposals.length ? <section id="pending-schedule-proposals" className="scroll-mt-24 border-b border-line py-8"><p className="text-xs uppercase tracking-[0.14em] text-brand">Proposed calendar times</p><h2 className="mt-2 font-display text-3xl">Waiting for a decision</h2><div className="mt-5 divide-y divide-line border-y border-line">{schedule.pendingProposals.map((proposal) => <div key={proposal.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-start"><div><p className="font-medium">{peopleById.has(proposal.student_id) ? personDisplayName(peopleById.get(proposal.student_id)!) : "Student"}</p><p className="mt-1 text-sm text-muted">{new Intl.DateTimeFormat("en-US",{timeZone:school.timezone,weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(proposal.proposed_starts_at))} · {proposal.schedule_type === "weekly" ? "Weekly" : "One time"}</p>{proposal.created_by===profileId?<ProposalManagementControls schoolId={schoolId} proposalId={proposal.id} localStart={proposal.proposed_local_start} reason={proposal.reason}/>:null}</div><span className="text-xs text-brand">{proposal.status === "pending_teacher" ? "Waiting for teacher" : "Waiting for owner"}</span></div>)}</div></section> : null}
    <TeacherScheduleCalendar
      schoolId={schoolId}
      initialDate={initialDate}
      timezone={school.timezone}
      teacher={{ id: teacherId, name: teacherName, isOwner: teacher.profile_id === profileId }}
      schedule={schedule}
      contextLabel={`${teacherName}’s schedule`}
      canReschedule
      currentTimeMs={now.getTime()}
      proposalHref="#pending-schedule-proposals"
      lessonCreationOptions={{
        students: (studentRowsResult.data ?? []).flatMap(({person_id}) => { const person=peopleById.get(person_id); return person ? [{id:person_id,label:personDisplayName(person)}] : []; }),
        teachers: [{id:teacherId,label:teacherName,outsideAvailabilityPolicy:teacherRecord.outside_availability_policy === "require_approval" ? "require_approval" : "notify_only"}],
        products: (productsResult.data ?? []).map((product) => ({id:product.id,label:product.name,durationMinutes:product.duration_minutes,priceLabel:new Intl.NumberFormat("en-US",{style:"currency",currency:product.currency}).format(product.price_cents/100)})),
        places: (placesResult.data ?? []).map((place) => ({id:place.id,label:place.name})),
        availability: schedule.availability,
        today: initialDate,
      }}
    />
  </main>;
}
