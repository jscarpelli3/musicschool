import { notFound, redirect } from "next/navigation";
import { LessonOutcomeForm } from "@/components/teacher/lesson-outcome-form";
import { TeacherRescheduleControls } from "@/components/teacher/teacher-reschedule-controls";
import { createClient } from "@/lib/supabase/server";
import { recordTeacherLessonOutcome, reportStudentRescheduleRequest, rescheduleTeacherLesson } from "./actions";

export const dynamic = "force-dynamic";

function displayName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

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
  if (membership.role !== "teacher") redirect(`/schools/${schoolId}`);
  if (!teacherPerson) {
    return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8"><h1 className="font-display text-5xl">Teacher setup needed.</h1><p className="mt-5 max-w-xl text-sm leading-6 text-muted">Your login is active, but it is not linked to a teacher record at this school. Ask the school owner to finish your staff setup.</p></main>;
  }

  const { data: teacherSettings } = await supabase.from("teachers").select("can_self_reschedule").eq("school_id", schoolId).eq("person_id", teacherPerson.id).maybeSingle();
  if (!teacherSettings) notFound();

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const rangeEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const { data: lessons, error: lessonError } = await supabase
    .from("lesson_events")
    .select("id, student_id, product_id, place_id, starts_at, ends_at, status, outcome, staff_notes")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherPerson.id)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd)
    .order("starts_at");
  if (lessonError) throw new Error("Your lesson schedule could not be loaded.");

  const studentIds = [...new Set((lessons ?? []).map((lesson) => lesson.student_id))];
  const productIds = [...new Set((lessons ?? []).map((lesson) => lesson.product_id))];
  const placeIds = [...new Set((lessons ?? []).map((lesson) => lesson.place_id).filter(Boolean))] as string[];
  const [{ data: students }, { data: products }, { data: places }] = await Promise.all([
    studentIds.length ? supabase.from("people").select("id, first_name, last_name, preferred_name").eq("school_id", schoolId).in("id", studentIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("service_products").select("id, name").eq("school_id", schoolId).in("id", productIds) : Promise.resolve({ data: [] }),
    placeIds.length ? supabase.from("lesson_places").select("id, name, details").eq("school_id", schoolId).in("id", placeIds) : Promise.resolve({ data: [] }),
  ]);
  const studentById = new Map((students ?? []).map((student) => [student.id, displayName(student)]));
  const productById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const placeById = new Map((places ?? []).map((place) => [place.id, place]));
  const dateTime = new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const time = new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, hour: "numeric", minute: "2-digit" });
  const nowMs = now.getTime();
  const earliestLocalParts = new Intl.DateTimeFormat("sv-SE", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const localPart = (type: string) => earliestLocalParts.find((part) => part.type === type)?.value ?? "";
  const earliestLocal = `${localPart("year")}-${localPart("month")}-${localPart("day")}T${localPart("hour")}:${localPart("minute")}`;
  const upcoming = (lessons ?? []).filter((lesson) => new Date(lesson.ends_at).getTime() > nowMs && lesson.status === "scheduled");
  const recent = (lessons ?? []).filter((lesson) => new Date(lesson.ends_at).getTime() <= nowMs || lesson.status !== "scheduled").reverse();

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
              {lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() > nowMs ? <TeacherRescheduleControls canSelfReschedule={teacherSettings.can_self_reschedule} earliestLocal={earliestLocal} rescheduleAction={rescheduleTeacherLesson.bind(null, schoolId, lesson.id)} requestAction={reportStudentRescheduleRequest.bind(null, schoolId, lesson.id)} /> : null}
              {canLog ? <LessonOutcomeForm action={recordTeacherLessonOutcome.bind(null, schoolId, lesson.id)} /> : null}
            </div>
          </details>
        );
      })}
    </div>
  ) : <p className="border-t border-line py-8 text-sm text-muted">No lessons in this section.</p>;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
      <header className="border-b border-line pb-9"><p className="text-sm text-muted">{school.name}</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">Your lessons.</h1><p className="mt-4 text-sm text-muted">{displayName(teacherPerson)} · Times shown in {school.timezone}</p></header>
      <section className="py-10"><div className="flex items-baseline justify-between gap-4"><h2 className="font-display text-3xl">Upcoming</h2><span className="text-sm text-muted">{upcoming.length}</span></div><div className="mt-6">{lessonList(upcoming)}</div></section>
      <section className="border-t border-line py-10"><div className="flex items-baseline justify-between gap-4"><h2 className="font-display text-3xl">Recent and ready to log</h2><span className="text-sm text-muted">{recent.length}</span></div><div className="mt-6">{lessonList(recent)}</div></section>
    </main>
  );
}
