import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SchoolForm } from "./school-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect("/login");

  const { data: memberships } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1);

  if (memberships?.length) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          First step
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Create your school</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          You will become the school owner. Staff and teachers can be invited later.
        </p>
        <SchoolForm />
      </section>
    </main>
  );
}
