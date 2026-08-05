import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/policies`);
  const [{ data: school }, { data: membership }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="policies" />
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Policies</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Human-readable terms backed by rules the schedule and billing system can enforce.</p>
        </div>
        <div className="py-10 md:pl-10">
          <div className="border-l border-brand pl-5">
            <p className="text-lg">No policies yet</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted">Cancellation and payment policies will each support one school default, version history, and offering-specific selection.</p>
          </div>
          <button disabled className="mt-8 border-b border-line pb-2 text-sm text-muted">Add policy — editor coming next</button>
        </div>
      </section>
      <section className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Documents</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Private legal and operational files kept on hand for the school.</p>
        </div>
        <div className="py-10 md:pl-10">
          <p className="text-sm text-muted">No documents uploaded.</p>
          <button disabled className="mt-8 border-b border-line pb-2 text-sm text-muted">Upload document — storage setup coming next</button>
        </div>
      </section>
    </main>
  );
}
