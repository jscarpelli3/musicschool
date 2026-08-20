import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) redirect("/login");

  const { data: memberships } = await supabase
    .from("school_members")
    .select("role, schools(id, name, slug)")
    .eq("profile_id", profileId)
    .eq("status", "active");

  if (!memberships?.length) redirect("/setup");

  if (memberships.length === 1 && memberships[0].schools) {
    redirect(`/schools/${memberships[0].schools.id}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-20">
      <section>
        <p className="mb-8 text-sm text-muted">Common Time</p>
        <h1 className="font-display text-5xl font-normal tracking-[-0.035em]">Choose a school.</h1>
        <div className="mt-10 border-t border-line">
          {memberships.map(({ role, schools: school }) =>
            school ? (
              <Link
                key={school.id}
                href={`/schools/${school.id}`}
                className="grid grid-cols-[1fr_auto] border-b border-line py-5 transition hover:text-brand"
              >
                <span className="block text-lg font-medium">{school.name}</span>
                <span className="text-sm capitalize text-muted">{role}</span>
              </Link>
            ) : null,
          )}
        </div>
      </section>
    </main>
  );
}
