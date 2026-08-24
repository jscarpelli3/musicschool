import { notFound, redirect } from "next/navigation";
import { InstrumentCatalogForm } from "@/components/school-setup/instrument-catalog-form";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { TeacherInstrumentFields } from "@/components/staff/teacher-instrument-fields";
import { TeacherInviteForm } from "@/components/teacher/teacher-invite-form";
import { createClient } from "@/lib/supabase/server";
import { createAndInviteTeacher, deactivateTeacherAccess, inviteTeacherAccess, setTeacherSelfReschedulePermission } from "./actions";
import { updateSchoolInstrumentCatalog } from "./instrument-actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ invite?: string; access?: string; instruments?: string }> }) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff`);

  const [{ data: school }, { data: membership }, { data: teachers }, { data: people }, { data: members }, { data: deliveries }, { data: instruments }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id, default_lesson_minutes, can_self_reschedule").eq("school_id", schoolId),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("school_members").select("profile_id, role, status").eq("school_id", schoolId),
    supabase.from("teacher_invitation_deliveries").select("teacher_id, recipient_email, status, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("school_instruments").select("name").eq("school_id", schoolId).eq("is_active", true).order("name"),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner") redirect(`/schools/${schoolId}`);

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const instrumentNames = (instruments ?? []).map((instrument) => instrument.name);
  const roleByProfile = new Map((members ?? []).map((member) => [member.profile_id, member]));
  const latestDeliveryByTeacher = new Map<string, NonNullable<typeof deliveries>[number]>();
  for (const delivery of deliveries ?? []) if (!latestDeliveryByTeacher.has(delivery.teacher_id)) latestDeliveryByTeacher.set(delivery.teacher_id, delivery);
  const roster = (teachers ?? []).flatMap((teacher) => {
    const person = personById.get(teacher.person_id);
    if (!person) return [];
    const member = person.profile_id ? roleByProfile.get(person.profile_id) : null;
    return [{ ...person, role: member?.role ?? "teacher", membershipStatus: member?.status ?? "not invited", defaultMinutes: teacher.default_lesson_minutes, canSelfReschedule: teacher.can_self_reschedule, latestDelivery: latestDeliveryByTeacher.get(person.id) ?? null }];
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
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="staff" />
      {inviteStatus ? <div id="staff-status" role="alert" className={`scroll-mt-6 border p-4 text-sm leading-6 ${inviteStatus.tone}`}>{inviteStatus.message}</div> : null}
      {query.access ? <p role="status" className={`border-b border-line py-4 text-sm ${query.access === "disabled" ? "text-brand" : "text-danger"}`}>{query.access === "disabled" ? "Teacher access disabled for this school." : "Teacher access could not be changed."}</p> : null}
      {query.instruments ? <p role="status" className={`border-b border-line py-4 text-sm ${query.instruments === "saved" ? "text-brand" : "text-danger"}`}>{query.instruments === "saved" ? "School instruments saved." : "The instrument list could not be saved."}</p> : null}
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Instruments</h2><p className="mt-3 text-sm leading-6 text-muted">Set the instruments taught at this school. This becomes the shared list used when adding staff.</p></div>
        <div className="py-10 md:pl-10"><InstrumentCatalogForm instruments={instrumentNames} action={updateSchoolInstrumentCatalog.bind(null, schoolId)} /></div>
      </section>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Add a teacher</h2><p className="mt-3 text-sm leading-6 text-muted">Create the school record, prepare passwordless access, and send the first invitation.</p></div>
        <TeacherInviteForm action={createAndInviteTeacher.bind(null, schoolId)} disabled={instrumentNames.length === 0} className="grid gap-5 py-10 md:grid-cols-2 md:pl-10">
          <label><span className="text-xs text-muted">First name</span><input required name="first_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label><span className="text-xs text-muted">Last name</span><input required name="last_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Email</span><input required type="email" name="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <TeacherInstrumentFields instruments={instrumentNames} />
        </TeacherInviteForm>
      </section>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Staff roster</h2>
          <p className="mt-3 text-sm text-muted">{roster.length} teaching staff</p>
        </div>
        <div className="py-10 md:pl-10">
          {roster.map((person) => (
            <article key={person.id} className="grid gap-4 border-t border-line py-5 first:border-t-0 sm:grid-cols-[1fr_auto]">
              <div>
                <h3 className="text-lg">{person.preferred_name || person.first_name} {person.last_name}</h3>
                <p className="mt-1 text-sm capitalize text-muted">{person.role} · {person.membershipStatus}</p>
                <p className="mt-2 text-sm text-muted">{person.email || "No email"}{person.phone ? ` · ${person.phone}` : ""}</p>
                {person.latestDelivery ? <p className="mt-2 text-xs text-muted">Latest invitation: {person.latestDelivery.status === "accepted" ? "sent to email provider" : person.latestDelivery.status} · {new Date(person.latestDelivery.created_at).toLocaleString()}</p> : null}
                <form action={inviteTeacherAccess.bind(null, schoolId, person.id)} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row">
                  <label className="flex-1"><span className="sr-only">Teacher email</span><input required type="email" name="email" defaultValue={person.email ?? ""} placeholder="teacher@example.com" className="w-full border-b border-line bg-transparent py-2 text-sm outline-none focus:border-brand" /></label>
                  <button className="border border-brand px-4 py-2 text-sm text-brand">{person.membershipStatus === "active" ? "Send access email again" : person.latestDelivery ? "Resend invitation" : "Invite teacher"}</button>
                </form>
                {person.membershipStatus === "active" || person.membershipStatus === "invited" ? <form action={deactivateTeacherAccess.bind(null, schoolId, person.id)} className="mt-3"><button className="text-xs text-danger">Disable teacher access</button></form> : null}
              </div>
              <div className="text-sm text-muted">
                <p>Default {person.defaultMinutes} min</p>
                <form action={setTeacherSelfReschedulePermission.bind(null, schoolId, person.id)} className="mt-3">
                  <input type="hidden" name="allowed" value={person.canSelfReschedule ? "false" : "true"} />
                  <button className="border-b border-brand pb-1 text-brand">
                    {person.canSelfReschedule ? "Disable own rescheduling" : "Allow own rescheduling"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
