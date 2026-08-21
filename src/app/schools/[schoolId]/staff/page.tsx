import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";
import { createAndInviteTeacher, deactivateTeacherAccess, inviteTeacherAccess, setTeacherSelfReschedulePermission } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ invite?: string; access?: string }> }) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff`);

  const [{ data: school }, { data: membership }, { data: teachers }, { data: people }, { data: members }, { data: deliveries }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id, default_lesson_minutes, can_self_reschedule").eq("school_id", schoolId),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("school_members").select("profile_id, role, status").eq("school_id", schoolId),
    supabase.from("teacher_invitation_deliveries").select("teacher_id, recipient_email, status, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner") redirect(`/schools/${schoolId}`);

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const roleByProfile = new Map((members ?? []).map((member) => [member.profile_id, member]));
  const latestDeliveryByTeacher = new Map<string, NonNullable<typeof deliveries>[number]>();
  for (const delivery of deliveries ?? []) if (!latestDeliveryByTeacher.has(delivery.teacher_id)) latestDeliveryByTeacher.set(delivery.teacher_id, delivery);
  const roster = (teachers ?? []).flatMap((teacher) => {
    const person = personById.get(teacher.person_id);
    if (!person) return [];
    const member = person.profile_id ? roleByProfile.get(person.profile_id) : null;
    return [{ ...person, role: member?.role ?? "teacher", membershipStatus: member?.status ?? "not invited", defaultMinutes: teacher.default_lesson_minutes, canSelfReschedule: teacher.can_self_reschedule, latestDelivery: latestDeliveryByTeacher.get(person.id) ?? null }];
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="staff" />
      {query.invite ? <p role="status" className={`border-b border-line py-4 text-sm ${query.invite === "sent" ? "text-brand" : "text-danger"}`}>{query.invite === "sent" ? "Teacher invitation sent." : query.invite === "delivery-failed" ? "Teacher access was prepared, but the invitation email failed. Correct the provider problem and resend it." : query.invite === "duplicate" ? "That email is already used by another teacher at this school." : query.invite === "identity-error" ? "The teacher identity could not be prepared. Nothing was linked." : "The teacher invitation could not be prepared."}</p> : null}
      {query.access ? <p role="status" className={`border-b border-line py-4 text-sm ${query.access === "disabled" ? "text-brand" : "text-danger"}`}>{query.access === "disabled" ? "Teacher access disabled for this school." : "Teacher access could not be changed."}</p> : null}
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Add a teacher</h2><p className="mt-3 text-sm leading-6 text-muted">Create the school record, prepare passwordless access, and send the first invitation.</p></div>
        <form action={createAndInviteTeacher.bind(null, schoolId)} className="grid gap-5 py-10 md:grid-cols-2 md:pl-10">
          <label><span className="text-xs text-muted">First name</span><input required name="first_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label><span className="text-xs text-muted">Last name</span><input required name="last_name" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Email</span><input required type="email" name="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
          <label><span className="text-xs text-muted">Default lesson length</span><select name="default_lesson_minutes" defaultValue="30" className="mt-2 w-full border-b border-line bg-transparent py-2"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
          <div className="flex items-end"><button className="border border-brand px-5 py-3 text-sm text-brand">Add and invite teacher</button></div>
        </form>
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
