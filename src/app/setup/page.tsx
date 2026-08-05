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
      <section className="w-full max-w-md border-t border-line pt-8">
        <p className="text-sm text-muted">First step</p>
        <h1 className="mt-10 font-display text-5xl font-normal tracking-[-0.035em]">Create your school.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          You will become the school owner. Staff and teachers can be invited later.
        </p>
        <SchoolForm />
      </section>
    </main>
  );
}
