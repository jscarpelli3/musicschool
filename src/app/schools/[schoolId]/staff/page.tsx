import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeacherInstrumentFields } from "@/components/staff/teacher-instrument-fields";
import { TeacherSchedulingSettingsForm } from "@/components/staff/teacher-scheduling-settings-form";
import { TeacherInviteForm } from "@/components/teacher/teacher-invite-form";
import { WeeklyAvailabilityEditor } from "@/components/scheduling/weekly-availability-editor";
import { createClient } from "@/lib/supabase/server";
import { createAndInviteTeacher, deactivateTeacherAccess, inviteTeacherAccess, setTeacherSchedulingSettings } from "./actions";
import { saveTeacherWeeklyAvailability } from "../availability-actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ invite?: string; access?: string }> }) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff`);

  const [{ data: school }, { data: membership }, { data: teachers }, { data: people }, { data: members }, { data: deliveries }, { data: instruments }, { data: availability, error: availabilityError }] = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id, default_lesson_minutes, scheduling_authority, can_manage_own_availability, outside_availability_policy").eq("school_id", schoolId),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("school_members").select("profile_id, role, status").eq("school_id", schoolId),
    supabase.from("teacher_invitation_deliveries").select("teacher_id, recipient_email, status, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("school_instruments").select("name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("teacher_availability_rules").select("teacher_id, weekday, start_time, end_time, effective_from, effective_until").eq("school_id", schoolId).order("weekday").order("start_time"),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner") redirect(`/schools/${schoolId}`);

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const currentAvailability = (availability ?? []).filter((rule) => rule.effective_from <= today && (!rule.effective_until || rule.effective_until >= today));
  const instrumentNames = (instruments ?? []).map((instrument) => instrument.name);
  const roleByProfile = new Map((members ?? []).map((member) => [member.profile_id, member]));
  const latestDeliveryByTeacher = new Map<string, NonNullable<typeof deliveries>[number]>();
  for (const delivery of deliveries ?? []) if (!latestDeliveryByTeacher.has(delivery.teacher_id)) latestDeliveryByTeacher.set(delivery.teacher_id, delivery);
  const roster = (teachers ?? []).flatMap((teacher) => {
    const person = personById.get(teacher.person_id);
    if (!person) return [];
    const member = person.profile_id ? roleByProfile.get(person.profile_id) : null;
    return [{ ...person, role: member?.role ?? "teacher", membershipStatus: member?.status ?? "not invited", defaultMinutes: teacher.default_lesson_minutes, schedulingAuthority: teacher.scheduling_authority, canManageOwnAvailability: teacher.can_manage_own_availability, outsideAvailabilityPolicy: teacher.outside_availability_policy, availability: currentAvailability.filter((rule) => rule.teacher_id === person.id).map((rule) => ({ weekday: rule.weekday, start_time: rule.start_time.slice(0,5), end_time: rule.end_time.slice(0,5) })), latestDelivery: latestDeliveryByTeacher.get(person.id) ?? null }];
  });
  const inviteStatus = query.invite === "sent"
    ? { tone: "text-brand border-brand/40 bg-brand/10", message: "Teacher invitation sent." }
    : query.invite === "delivery-failed"
      ? { tone: "text-danger border-danger/40 bg-danger/10", message: "The teacher was created and access was prepared, but the invitation email was not sent. Find the teacher in the staff roster and resend the invitation after the email-provider problem is corrected." }
      : query.invite === "duplicate"
        ? { tone: "text-danger border-danger/40 bg-danger/10", message: "That email is already used by another teacher at this school." }
        : query.invite === "identity-error"
          ? { tone: "text-danger border-danger/40 bg-danger/10", message: "The teacher identity could not be prepared. Nothing was linked." }
          : query.invite
            ? { tone: "text-danger border-danger/40 bg-danger/10", message: "The teacher invitation could not be prepared. Check the form and try again." }
            : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="grid gap-5 border-b border-line pb-8 md:grid-cols-[1fr_2fr] md:items-end"><p className="text-sm text-muted">{school.name}</p><div><p className="text-sm text-brand">People and access</p><h1 className="mt-3 font-display text-5xl tracking-[-0.04em] sm:text-6xl">Staff.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Invite teachers, review access, and set each person’s scheduling boundaries.</p></div></header>
      {inviteStatus ? <div id="staff-status" role="alert" className={`scroll-mt-6 border p-4 text-sm leading-6 ${inviteStatus.tone}`}>{inviteStatus.message}</div> : null}
      {query.access ? <p role="status" className={`border-b border-line py-4 text-sm ${query.access === "disabled" ? "text-brand" : "text-danger"}`}>{query.access === "disabled" ? "Teacher access disabled for this school." : "Teacher access could not be changed."}</p> : null}
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Add a teacher</h2><p className="mt-3 text-sm leading-6 text-muted">Create the school record, prepare passwordless access, and send the first invitation.</p></div>
        <TeacherInviteForm action={createAndInviteTeacher.bind(null, schoolId)} disabled={instrumentNames.length === 0} className="grid gap-5 py-10 md:grid-cols-2 md:pl-10">
          <label><span className="text-xs text-muted">First name</span><input required name="first_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label><span className="text-xs text-muted">Last name</span><input required name="last_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Email</span><input required type="email" name="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <TeacherInstrumentFields instruments={instrumentNames} />
        </TeacherInviteForm>
      </section>
      <section className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div><p className="text-xs uppercase tracking-[0.14em] text-muted">Team</p><h2 className="mt-2 font-display text-4xl">Staff roster</h2></div>
          <p className="text-sm text-muted">{roster.length} teaching {roster.length === 1 ? "staff member" : "staff members"}</p>
        </div>
        <div className="grid gap-6 pt-6">
          {roster.map((person) => (
            <article key={person.id} className="border border-line bg-surface/40 p-5 sm:p-7">
              <header className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-5">
                <div><div className="flex flex-wrap items-center gap-3"><h3 className="font-display text-3xl"><Link href={`/schools/${schoolId}/staff/${person.id}`} className="hover:text-brand">{person.preferred_name || person.first_name} {person.last_name}</Link></h3><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${person.membershipStatus === "active" ? "border-brand/40 bg-brand/10 text-brand" : "border-line text-muted"}`}>{person.membershipStatus}</span></div><p className="mt-2 text-sm text-muted">{person.email || "No email address"}{person.phone ? ` · ${person.phone}` : ""}</p></div>
                <Link href={`/schools/${schoolId}/staff/${person.id}`} className="border-b border-brand pb-1 text-sm text-brand hover:text-brand-hover">Open calendar →</Link>
              </header>
              <dl className="grid gap-px bg-line sm:grid-cols-3"><div className="bg-canvas p-4"><dt className="text-xs text-muted">School role</dt><dd className="mt-2 text-sm capitalize">{person.role}</dd></div><div className="bg-canvas p-4"><dt className="text-xs text-muted">Schedule changes</dt><dd className="mt-2 text-sm">{person.schedulingAuthority === "manage_assigned_lessons" ? "Can move assigned lessons" : "Owner approval required"}</dd></div><div className="bg-canvas p-4"><dt className="text-xs text-muted">Outside availability</dt><dd className="mt-2 text-sm">{person.outsideAvailabilityPolicy === "require_approval" ? "Teacher approval required" : "Notify teacher"}</dd></div></dl>
              <div className="grid gap-6 pt-6 lg:grid-cols-2">
                <details className="border border-line p-4"><summary className="cursor-pointer text-sm text-brand">Access and invitation</summary><div className="pt-5"><form action={inviteTeacherAccess.bind(null, schoolId, person.id)} className="grid gap-3"><label><span className="text-xs text-muted">Login email</span><input required type="email" name="email" defaultValue={person.email ?? ""} placeholder="teacher@example.com" className="mt-2 w-full border-b border-line bg-transparent py-2 text-sm outline-none focus:border-brand" /></label><button className="justify-self-start border border-brand px-4 py-2 text-sm text-brand">{person.membershipStatus === "active" ? "Send access email again" : person.latestDelivery ? "Resend invitation" : "Invite teacher"}</button></form>{person.latestDelivery ? <p className="mt-4 text-xs text-muted">Latest invitation: {person.latestDelivery.status === "accepted" ? "handed to email provider" : person.latestDelivery.status} · {new Date(person.latestDelivery.created_at).toLocaleString()}</p> : null}{person.membershipStatus === "active" || person.membershipStatus === "invited" ? <form action={deactivateTeacherAccess.bind(null, schoolId, person.id)} className="mt-5 border-t border-line pt-4"><button className="text-xs text-danger">Disable teacher access</button></form> : null}</div></details>
                <details className="border border-line p-4"><summary className="cursor-pointer text-sm text-brand">Scheduling permissions</summary><TeacherSchedulingSettingsForm initialAuthority={person.schedulingAuthority} initialCanManageAvailability={person.canManageOwnAvailability} initialOutsidePolicy={person.outsideAvailabilityPolicy} action={setTeacherSchedulingSettings.bind(null,schoolId,person.id)} /></details>
              </div>
              <details className="mt-6 border-t border-line"><summary className="cursor-pointer py-4 text-sm text-brand">Weekly availability · {person.availability.length} {person.availability.length === 1 ? "block" : "blocks"}</summary><div className="pb-2">{availabilityError ? <p role="alert" className="border border-danger/40 bg-danger/10 p-4 text-sm text-danger">Availability could not be loaded, so editing is disabled. Reload and try again.</p> : <WeeklyAvailabilityEditor initialBlocks={person.availability} action={saveTeacherWeeklyAvailability.bind(null,schoolId,person.id)} />}</div></details>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
