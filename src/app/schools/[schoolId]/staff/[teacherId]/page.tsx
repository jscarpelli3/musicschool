import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeacherScheduleCalendar } from "@/components/scheduling/teacher-schedule-calendar";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherCalendar, personDisplayName } from "@/lib/scheduling/teacher-calendar";

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
    supabase.from("teachers").select("person_id").eq("school_id", schoolId).eq("person_id", teacherId).maybeSingle(),
  ]);
  if (!school || !membership || !teacher || !teacherRecord) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const rangeEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const schedule = await loadTeacherCalendar(supabase, schoolId, teacherId, { rangeStart, rangeEnd });
  const initialDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: school.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const teacherName = personDisplayName(teacher);

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
    <TeacherScheduleCalendar
      schoolId={schoolId}
      initialDate={initialDate}
      timezone={school.timezone}
      teacher={{ id: teacherId, name: teacherName, isOwner: teacher.profile_id === profileId }}
      schedule={schedule}
      contextLabel={`${teacherName}’s schedule`}
    />
  </main>;
}
