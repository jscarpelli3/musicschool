import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/staff`);

  const [{ data: school }, { data: membership }, { data: teachers }, { data: people }, { data: members }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id, default_lesson_minutes").eq("school_id", schoolId),
    supabase.from("people").select("id, profile_id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("school_members").select("profile_id, role, status").eq("school_id", schoolId),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner") redirect(`/schools/${schoolId}`);

  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const roleByProfile = new Map((members ?? []).map((member) => [member.profile_id, member]));
  const roster = (teachers ?? []).flatMap((teacher) => {
    const person = personById.get(teacher.person_id);
    if (!person) return [];
    const member = person.profile_id ? roleByProfile.get(person.profile_id) : null;
    return [{ ...person, role: member?.role ?? "teacher", membershipStatus: member?.status ?? "not invited", defaultMinutes: teacher.default_lesson_minutes }];
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="border-b border-line pb-7"><h1 className="font-display text-5xl">Staff.</h1><p className="mt-3 text-sm text-muted">{roster.length} teaching staff at {school.name}</p></header>
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
              </div>
              <p className="text-sm text-muted">Default {person.defaultMinutes} min</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
