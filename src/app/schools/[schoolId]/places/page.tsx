import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { FocusedModal } from "@/components/ui/focused-modal";
import { createClient } from "@/lib/supabase/server";
import { archivePlace } from "./actions";
import { PlaceForm } from "./place-form";

export const dynamic = "force-dynamic";

export default async function PlacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ created?: string; archived?: string; error?: string }>;
}) {
  const { schoolId } = await params;
  const { created, archived, error } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/places`);

  const [{ data: school }, { data: membership }, { data: places }] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("lesson_places").select("id, name, details, status, created_by").eq("school_id", schoolId).order("status").order("name"),
  ]);

  if (!school || !membership) notFound();
  const canCreate = ["owner", "admin", "teacher"].includes(membership.role);
  const canManageAll = membership.role === "owner" || membership.role === "admin";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="spaces" />
      <p className="border-b border-line py-6 text-sm leading-6 text-muted">Use the language your school uses. Spaces can be rooms, homes, stages, addresses, or online spaces.</p>

      {created ? <p className="border-b border-line py-4 text-sm text-brand">Place added.</p> : null}
      {archived ? <p className="border-b border-line py-4 text-sm text-brand">Space archived.</p> : null}
      {error ? <p className="border-b border-line py-4 text-sm text-danger">The space could not be archived. Nothing changed.</p> : null}

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl font-normal">Current list</h2>
          <p className="mt-3 text-sm text-muted">{places?.filter((place) => place.status === "active").length ?? 0} active</p>
        </div>
        <div className="py-10 md:pl-10">
          {places?.map((place) => {
            const canArchive = place.status === "active" && (canManageAll || place.created_by === profileId);
            return (
              <article key={place.id} className="grid grid-cols-[1fr_auto] gap-5 border-t border-line py-5 first:border-t-0">
                <div>
                  <h3>{place.name}</h3>
                  {place.details ? <p className="mt-2 text-sm text-muted">{place.details}</p> : null}
                  {place.status === "archived" ? <p className="mt-2 text-xs text-muted">Archived</p> : null}
                </div>
                {canArchive ? (
                  <form action={archivePlace.bind(null, schoolId, place.id)}>
                    <button className="text-xs text-muted hover:text-ink">Archive</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {canCreate ? <section className="flex items-center justify-between gap-6 py-10">
        <div><h2 className="font-display text-3xl font-normal">Need another space?</h2><p className="mt-2 text-sm text-muted">Add it without leaving the current list.</p></div>
        <FocusedModal triggerLabel="Add place +" eyebrow="School spaces" title="Add a place." description="Create a room, address, stage, home, or online space."><PlaceForm schoolId={schoolId} /></FocusedModal>
      </section> : null}
    </main>
  );
}
