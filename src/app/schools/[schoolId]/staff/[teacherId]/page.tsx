import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeacherScheduleCalendar } from "@/components/scheduling/teacher-schedule-calendar";
import { ProposalManagementControls } from "@/components/scheduling/proposal-management-controls";
import { ApprovalList } from "@/components/approvals/approval-list";
import { LessonsToSchedule } from "@/components/scheduling/lessons-to-schedule";
import { loadOwnerApprovals } from "@/lib/approvals/owner-approvals";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { lessonProposalDescriptor } from "@/lib/domain/state-descriptors";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherCalendar, personDisplayName } from "@/lib/scheduling/teacher-calendar";
import { loadServiceEntitlements } from "@/lib/scheduling/service-entitlements";
import { PageHeading } from "@/components/ui/page-heading";
import { lessonPlaceLabel } from "@/lib/scheduling/lesson-place-label";

export const dynamic = "force-dynamic";

export default async function StaffTeacherPage({ params }: {
  params: Promise<{ schoolId: string; teacherId: string }>;
}) {
  const { schoolId, teacherId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff/${teacherId}`);

  const [{ data: school }, { data: membership }, { data: teacher }, { data: teacherRecord }, capabilities] = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId).eq("id", teacherId).maybeSingle(),
    supabase.from("teachers").select("person_id, bio, default_lesson_minutes, scheduling_authority, can_manage_own_availability, outside_availability_policy").eq("school_id", schoolId).eq("person_id", teacherId).maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);
  if (!school || !membership || !teacher || !teacherRecord) notFound();
  if (!capabilities.has("school.teacher_records.manage")) redirect(`/schools/${schoolId}`);

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const rangeEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const schedule = await loadTeacherCalendar(supabase, schoolId, teacherId, { rangeStart, rangeEnd });
  const [studentRowsResult, peopleResult, productsResult, placesResult, membersResult, teacherInstrumentsResult, instrumentsResult] = await Promise.all([
    supabase.from("students").select("person_id,primary_teacher_id").eq("school_id",schoolId).in("enrollment_status",["active","prospect"]),
    supabase.from("people").select("id,first_name,last_name,preferred_name").eq("school_id",schoolId).eq("status","active"),
    supabase.from("service_products").select("id,name,duration_minutes,price_cents,currency,default_schedule_type").eq("school_id",schoolId).eq("status","active").eq("format","private_lesson").order("name"),
    supabase.from("lesson_places").select("id,name,kind").eq("school_id",schoolId).eq("status","active").order("name"),
    supabase.from("school_members").select("profile_id,role,status").eq("school_id",schoolId),
    supabase.from("teacher_instruments").select("instrument_id").eq("school_id",schoolId).eq("teacher_id",teacherId),
    supabase.from("school_instruments").select("id,name").eq("school_id",schoolId),
  ]);
  const creationFailure = [studentRowsResult,peopleResult,productsResult,placesResult,membersResult,teacherInstrumentsResult,instrumentsResult].find((result) => result.error);
  if (creationFailure?.error) throw new Error("Lesson creation choices could not be loaded.");
  const peopleById = new Map((peopleResult.data ?? []).map((person) => [person.id,person]));
  const initialDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: school.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const minimumTimeToday = new Intl.DateTimeFormat("en-GB", { timeZone: school.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const teacherName = personDisplayName(teacher);
  const teacherMembership = teacher.profile_id ? (membersResult.data ?? []).find((member) => member.profile_id === teacher.profile_id) : null;
  const instrumentIds = new Set((teacherInstrumentsResult.data ?? []).map((item) => item.instrument_id));
  const teacherInstruments = (instrumentsResult.data ?? []).filter((item) => instrumentIds.has(item.id)).map((item) => item.name).sort();
  const currentAvailabilityCount = schedule.availability.filter((rule) => rule.effective_from <= initialDate && (!rule.effective_until || rule.effective_until >= initialDate)).length;
  const initialDateValue = new Date(`${initialDate}T12:00:00Z`);
  const mondayOffset = initialDateValue.getUTCDay() === 0 ? -6 : 1 - initialDateValue.getUTCDay();
  const currentWeekStart = new Date(initialDateValue);
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + mondayOffset);
  const omittedCurrentWeekDays = schedule.availability.flatMap((rule) => {
    if (rule.effective_from > initialDate || (rule.effective_until && rule.effective_until < initialDate)) return [];
    const occurrence = new Date(currentWeekStart);
    occurrence.setUTCDate(currentWeekStart.getUTCDate() + (rule.weekday === 0 ? 6 : rule.weekday - 1));
    const occurrenceKey = occurrence.toISOString().slice(0, 10);
    return occurrenceKey < rule.effective_from ? [rule.weekday] : [];
  });
  const omittedDayNames = [...new Set(omittedCurrentWeekDays)].map((weekday) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday]);
  const availabilityCalendarNote = omittedDayNames.length
    ? `${new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(omittedDayNames)} ${omittedDayNames.length === 1 ? "is" : "are"} part of the usual weekly schedule, but ${omittedDayNames.length === 1 ? "it falls" : "they fall"} before these hours began. ${omittedDayNames.length === 1 ? "It appears" : "They appear"} on the calendar starting next week.`
    : null;
  const approvals = await loadOwnerApprovals(supabase,schoolId,{teacherId});
  const entitlements = await loadServiceEntitlements(supabase,schoolId,{teacherId});
  const lessonCreationOptions = {
    students: (studentRowsResult.data ?? []).flatMap(({person_id}) => { const person=peopleById.get(person_id); return person ? [{id:person_id,label:personDisplayName(person)}] : []; }),
    primaryTeacherByStudent: Object.fromEntries((studentRowsResult.data ?? []).flatMap((student) => student.primary_teacher_id ? [[student.person_id, student.primary_teacher_id]] : [])),
    teachers: [{id:teacherId,label:teacherName,outsideAvailabilityPolicy:teacherRecord.outside_availability_policy === "require_approval" ? "require_approval" as const : "notify_only" as const}],
    products: (productsResult.data ?? []).map((product) => ({id:product.id,label:product.name,durationMinutes:product.duration_minutes,priceLabel:new Intl.NumberFormat("en-US",{style:"currency",currency:product.currency}).format(product.price_cents/100),defaultScheduleType:product.default_schedule_type === "one_time" ? "one_time" as const : "weekly" as const})),
    places: (placesResult.data ?? []).map((place) => ({id:place.id,label:lessonPlaceLabel(place),kind:["student_home","online","other"].includes(place.kind)?place.kind as "student_home"|"online"|"other":"school" as const})),availability:schedule.availability,
    busyLessons:schedule.lessons.map((lesson)=>({teacherId,studentId:lesson.student_id,startsAt:lesson.starts_at,endsAt:lesson.ends_at,status:lesson.status})),today:initialDate,minimumTimeToday,
  };

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-section">
    <header className="flex flex-wrap items-end justify-between gap-6 pb-4">
      <div>
        <p className="text-xs text-muted">Staff record</p>
        <div className="mt-3"><PageHeading kind="staff" title={teacherName} /></div>
        <p className="mt-4 text-sm text-muted">Teacher details, scheduling boundaries, and calendar.</p>
      </div>
      <Link href={`/schools/${schoolId}/staff`} className="text-sm text-muted hover:text-ink">All staff</Link>
    </header>
    <section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-12 md:p-8">
      <div><h2 className="font-display text-3xl">Teacher details</h2><p className="mt-3 text-sm leading-6 text-muted">Contact, access, teaching focus, and the scheduling defaults used by this school.</p></div>
      <div><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-xs text-muted">Email</dt><dd className="mt-2 text-sm">{teacher.email || "Not provided"}</dd></div><div><dt className="text-xs text-muted">Phone</dt><dd className="mt-2 text-sm">{teacher.phone || "Not provided"}</dd></div><div><dt className="text-xs text-muted">School access</dt><dd className="mt-2 text-sm capitalize">{teacherMembership ? `${teacherMembership.role} · ${teacherMembership.status}` : "Not invited"}</dd></div><div><dt className="text-xs text-muted">Record status</dt><dd className="mt-2 text-sm capitalize">{teacher.status}</dd></div><div><dt className="text-xs text-muted">Default lesson</dt><dd className="mt-2 text-sm">{teacherRecord.default_lesson_minutes} minutes</dd></div><div><dt className="text-xs text-muted">Weekly availability</dt><dd className={`mt-2 text-sm ${currentAvailabilityCount ? "" : "text-brand"}`}>{currentAvailabilityCount ? `${currentAvailabilityCount} ${currentAvailabilityCount === 1 ? "block" : "blocks"}` : "Not configured"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted">Instruments</dt><dd className="mt-2 text-sm">{teacherInstruments.length ? teacherInstruments.join(" · ") : "None assigned"}</dd></div><div><dt className="text-xs text-muted">Schedule changes</dt><dd className="mt-2 text-sm">{teacherRecord.scheduling_authority === "manage_assigned_lessons" ? "Can move assigned lessons" : "Owner approval required"}</dd></div><div><dt className="text-xs text-muted">Outside availability</dt><dd className="mt-2 text-sm">{teacherRecord.outside_availability_policy === "require_approval" ? "Teacher approval required" : "Notify teacher"}</dd></div></dl>{teacherRecord.bio ? <div className="mt-6 rounded-control bg-surface p-4"><p className="text-xs text-muted">Bio</p><p className="mt-2 text-sm leading-6">{teacherRecord.bio}</p></div> : null}</div>
    </section>
    {approvals.length?<section className="ui-card mt-6 p-6 sm:p-8"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-4"><div><p className="text-xs text-brand">Needs attention</p><h2 className="mt-2 font-display text-3xl">Pending approvals</h2></div><Link href={`/schools/${schoolId}/approvals`} className="text-sm text-muted hover:text-brand">View all →</Link></div><ApprovalList schoolId={schoolId} items={approvals} timezone={school.timezone} compact/></section>:null}
    {entitlements.length?<section className="ui-card mt-6 p-6 sm:p-8"><p className="text-xs text-brand">Needs scheduling</p><h2 className="mt-2 mb-5 font-display text-3xl">Replacement lessons assigned to {teacherName}</h2><LessonsToSchedule schoolId={schoolId} items={entitlements} timezone={school.timezone} lessonCreationOptions={lessonCreationOptions} compact/></section>:null}
    {schedule.pendingProposals.length ? <section id="pending-schedule-proposals" className="ui-card mt-6 scroll-mt-24 p-6 sm:p-8"><p className="text-xs text-brand">Proposed calendar times</p><h2 className="mt-2 font-display text-3xl">Waiting for a decision</h2><div className="mt-5 divide-y divide-line">{schedule.pendingProposals.map((proposal) => <div key={proposal.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-start"><div><p className="font-medium"><Link href={`/schools/${schoolId}/students/${proposal.student_id}`} className="hover:text-brand">{peopleById.has(proposal.student_id) ? personDisplayName(peopleById.get(proposal.student_id)!) : "Student"}</Link></p><p className="mt-1 text-sm text-muted">{new Intl.DateTimeFormat("en-US",{timeZone:school.timezone,weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(proposal.proposed_starts_at))} · {proposal.schedule_type === "weekly" ? "Weekly" : "One time"}</p>{proposal.created_by===profileId?<ProposalManagementControls schoolId={schoolId} proposalId={proposal.id} localStart={proposal.proposed_local_start} reason={proposal.reason}/>:null}</div><span className="text-xs text-brand">{lessonProposalDescriptor(proposal.status).label}</span></div>)}</div></section> : null}
    <div className="mt-6">{availabilityCalendarNote ? <p className="mb-4 rounded-control bg-brand/10 px-4 py-3 text-sm leading-6 text-muted"><strong className="font-medium text-ink">Usual hours are saved.</strong> {availabilityCalendarNote}</p> : null}<TeacherScheduleCalendar
      schoolId={schoolId}
      initialDate={initialDate}
      timezone={school.timezone}
      teacher={{ id: teacherId, name: teacherName, isOwner: teacher.profile_id === profileId }}
      schedule={schedule}
      contextLabel={`${teacherName}’s schedule`}
      canReschedule
      currentTimeMs={now.getTime()}
      proposalHref="#pending-schedule-proposals"
      lessonCreationOptions={lessonCreationOptions}
    /></div>
  </main>;
}
