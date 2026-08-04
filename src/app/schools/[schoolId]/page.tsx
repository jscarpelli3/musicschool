import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SchoolDashboard({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);

  const [{ data: school }, { data: membership }] = await Promise.all([
    supabase.from("schools").select("id, name, slug, timezone, family_billing_mode").eq("id", schoolId).maybeSingle(),
    supabase
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (!school || !membership) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-800 pb-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
            {membership.role}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{school.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {school.timezone} · {school.family_billing_mode.replaceAll("_", " ")}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white">
            Sign out
          </button>
        </form>
      </header>
      <section className="py-12">
        <h2 className="text-xl font-medium">Foundation ready</h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
          This dashboard is protected by school-scoped Row Level Security. People, calendars,
          scheduling, and billing will build on this tenant boundary.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-emerald-400 hover:text-emerald-300">
          Switch school
        </Link>
      </section>
    </main>
  );
}
