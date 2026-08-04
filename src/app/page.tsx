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
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Music School
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Choose a school</h1>
        <div className="mt-8 grid gap-3">
          {memberships.map(({ role, schools: school }) =>
            school ? (
              <Link
                key={school.id}
                href={`/schools/${school.id}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-emerald-500/60"
              >
                <span className="block text-lg font-medium">{school.name}</span>
                <span className="mt-1 block text-sm capitalize text-zinc-500">{role}</span>
              </Link>
            ) : null,
          )}
        </div>
      </section>
    </main>
  );
}
