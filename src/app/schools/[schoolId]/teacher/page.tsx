import { notFound, redirect } from "next/navigation";
import { LessonOutcomeForm } from "@/components/teacher/lesson-outcome-form";
import { TeacherScheduleCalendar } from "@/components/scheduling/teacher-schedule-calendar";
import { TeacherRescheduleControls } from "@/components/teacher/teacher-reschedule-controls";
import { LessonProposalControls } from "@/components/teacher/lesson-proposal-controls";
import { WeeklyAvailabilityEditor } from "@/components/scheduling/weekly-availability-editor";
import { loadTeacherCalendar, personDisplayName } from "@/lib/scheduling/teacher-calendar";
import { createClient } from "@/lib/supabase/server";
import { saveTeacherWeeklyAvailability } from "../availability-actions";
import { decideLessonProposal, recordTeacherLessonOutcome, rescheduleTeacherLesson } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeacherPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/teacher`);

  const [{ data: school }, { data: membership }, { data: teacherPerson }] = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("people").select("id, first_name, last_name, preferred_name").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (!new Set(["teacher","owner","admin"]).has(membership.role)) redirect(`/schools/${schoolId}`);
  if (!teacherPerson) {
    return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8"><h1 className="font-display text-5xl">Teacher setup needed.</h1><p className="mt-5 max-w-xl text-sm leading-6 text-muted">Your login is active, but it is not linked to a teacher record at this school. Ask the school owner to finish your staff setup.</p></main>;
  }

  const { data: teacherSettings } = await supabase.from("teachers").select("scheduling_authority, can_manage_own_availability").eq("school_id", schoolId).eq("person_id", teacherPerson.id).maybeSingle();
  if (!teacherSettings) notFound();

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const rangeEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const schedule = await loadTeacherCalendar(supabase, schoolId, teacherPerson.id, { rangeStart, rangeEnd });
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const currentAvailability = schedule.availability.filter((rule) => rule.effective_from <= today && (!rule.effective_until || rule.effective_until >= today)).map((rule) => ({ weekday: rule.weekday, start_time: rule.start_time.slice(0,5), end_time: rule.end_time.slice(0,5) }));
  const lessons = schedule.lessons;
  const { data: proposals } = await supabase.from("lesson_schedule_proposals").select("id,student_id,proposed_starts_at,proposed_ends_at,reason,schedule_type").eq("school_id",schoolId).eq("teacher_id",teacherPerson.id).eq("status","pending_teacher").order("created_at");
  const studentById = new Map(Object.entries(schedule.studentNames));
  const productById = new Map(Object.entries(schedule.productNames));
  const placeById = new Map(Object.entries(schedule.placeDetails));
  const dateTime = new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const time = new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, hour: "numeric", minute: "2-digit" });
  const nowMs = now.getTime();
  const earliestLocalParts = new Intl.DateTimeFormat("sv-SE", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const localPart = (type: string) => earliestLocalParts.find((part) => part.type === type)?.value ?? "";
  const earliestLocal = `${localPart("year")}-${localPart("month")}-${localPart("day")}T${localPart("hour")}:${localPart("minute")}`;
  const initialDate = earliestLocal.slice(0,10);
  const upcoming = lessons.filter((lesson) => new Date(lesson.ends_at).getTime() > nowMs && lesson.status === "scheduled");
  const recent = lessons.filter((lesson) => new Date(lesson.ends_at).getTime() <= nowMs || lesson.status !== "scheduled").reverse();

  const lessonList = (rows: typeof lessons) => rows?.length ? (
    <div className="border-t border-line">
      {rows.map((lesson) => {
        const place = lesson.place_id ? placeById.get(lesson.place_id) : null;
        const canLog = lesson.status === "scheduled" && new Date(lesson.ends_at).getTime() <= nowMs;
        return (
          <details key={lesson.id} className="group border-b border-line">
            <summary className="grid cursor-pointer list-none gap-2 py-5 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline">
              <span className="text-sm text-muted">{dateTime.format(new Date(lesson.starts_at))}</span>
              <span><strong className="font-medium">{studentById.get(lesson.student_id) ?? "Student"}</strong><span className="mt-1 block text-sm text-muted">{productById.get(lesson.product_id) ?? "Lesson"} · {time.format(new Date(lesson.starts_at))}–{time.format(new Date(lesson.ends_at))}</span></span>
              <span className="text-sm capitalize text-brand">{lesson.outcome?.replaceAll("_", " ") ?? lesson.status}</span>
            </summary>
            <div className="pb-7 sm:pl-40">
              <p className="text-sm text-muted">{place?.name ?? "Place not assigned"}{place?.details ? ` · ${place.details}` : ""}</p>
              {lesson.staff_notes ? <p className="mt-4 border-l border-line pl-4 text-sm leading-6">{lesson.staff_notes}</p> : null}
              {lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() > nowMs ? <TeacherRescheduleControls canSelfReschedule={teacherSettings.scheduling_authority === "manage_assigned_lessons"} earliestLocal={earliestLocal} rescheduleAction={rescheduleTeacherLesson.bind(null, schoolId, lesson.id)} /> : null}
              {canLog ? <LessonOutcomeForm action={recordTeacherLessonOutcome.bind(null, schoolId, lesson.id)} /> : null}
            </div>
          </details>
        );
      })}
    </div>
  ) : <p className="border-t border-line py-8 text-sm text-muted">No lessons in this section.</p>;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
      <header className="border-b border-line pb-9"><p className="text-sm text-muted">{school.name}</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">Your lessons.</h1><p className="mt-4 text-sm text-muted">{personDisplayName(teacherPerson)} · Times shown in {school.timezone}</p></header>
      {proposals?.length ? <section id="lesson-proposals" className="scroll-mt-6 border-b border-line py-10"><h2 className="font-display text-3xl">Needs your approval</h2><p className="mt-3 text-sm text-muted">These proposed lessons are outside your saved availability and are not on the calendar yet.</p><div className="mt-6 divide-y divide-line border-y border-line">{proposals.map((proposal)=><article key={proposal.id} className="py-5"><p className="font-medium">{studentById.get(proposal.student_id)??"Student"} · {dateTime.format(new Date(proposal.proposed_starts_at))}</p><p className="mt-2 text-sm text-muted">{proposal.schedule_type==="weekly"?"Weekly proposal":"One-time lesson"} · {proposal.reason}</p><LessonProposalControls accept={decideLessonProposal.bind(null,schoolId,proposal.id,"accept")} decline={decideLessonProposal.bind(null,schoolId,proposal.id,"decline")} /></article>)}</div></section>:null}
      <TeacherScheduleCalendar
        schoolId={schoolId}
        initialDate={initialDate}
        timezone={school.timezone}
        teacher={{ id: teacherPerson.id, name: personDisplayName(teacherPerson), isOwner: false }}
        schedule={schedule}
        contextLabel="My schedule"
        canReschedule
        rescheduleMode={teacherSettings.scheduling_authority === "manage_assigned_lessons" ? "apply" : "propose"}
        rescheduleAction={async ({ lessonId, localStart, reason }) => {
          "use server";
          return rescheduleTeacherLesson(schoolId, lessonId, localStart, reason);
        }}
        currentTimeMs={nowMs}
      />
      <section className="border-b border-line py-10"><h2 className="font-display text-3xl">Weekly availability</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Record every recurring block when lessons normally fit. Availability guides scheduling; changing it never moves an existing lesson.</p><div className="mt-6">{teacherSettings.can_manage_own_availability ? <WeeklyAvailabilityEditor initialBlocks={currentAvailability} action={saveTeacherWeeklyAvailability.bind(null,schoolId,teacherPerson.id)} /> : <p className="border border-line p-4 text-sm text-muted">The school owner manages your availability. Ask them to update these blocks.</p>}</div></section>
      <section className="py-10"><div className="flex items-baseline justify-between gap-4"><h2 className="font-display text-3xl">Upcoming</h2><span className="text-sm text-muted">{upcoming.length}</span></div><div className="mt-6">{lessonList(upcoming)}</div></section>
      <section className="border-t border-line py-10"><div className="flex items-baseline justify-between gap-4"><h2 className="font-display text-3xl">Recent and ready to log</h2><span className="text-sm text-muted">{recent.length}</span></div><div className="mt-6">{lessonList(recent)}</div></section>
    </main>
  );
}
