import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SchoolForm } from "./school-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  const email = typeof data?.claims?.email === "string" ? data.claims.email.trim().toLowerCase() : null;
  if (!profileId) redirect("/login");

  const { data: memberships } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1);

  if (memberships?.length) redirect("/");

  const { data: invitation, error: invitationError } = email ? await createAdminClient()
    .from("school_onboarding_invitations")
    .select("intended_school_name")
    .eq("normalized_email", email)
    .eq("status", "invited")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle() : { data: null, error: null };

  if (invitationError) throw new Error("School invitation could not be loaded.");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20">
      <section className="w-full max-w-md border-t border-line pt-8">
        <p className="text-sm text-muted">First step</p>
        <h1 className="mt-10 font-display text-5xl font-normal tracking-[-0.035em]">Create your school.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          You will be the school owner. Next, we will guide you through your logo, first student and payer, and teacher invitations.
        </p>
        <SchoolForm initialName={invitation?.intended_school_name ?? ""} />
      </section>
    </main>
  );
}
