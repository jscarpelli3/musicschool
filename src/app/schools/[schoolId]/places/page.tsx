import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { archivePlace } from "./actions";
import { PlaceForm } from "./place-form";

export const dynamic = "force-dynamic";

export default async function PlacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { schoolId } = await params;
  const { created } = await searchParams;
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
      <header className="grid gap-8 border-b border-line pb-10 md:grid-cols-[1fr_2fr]">
        <Link href={`/schools/${schoolId}`} className="text-sm text-muted hover:text-ink">← {school.name}</Link>
        <div>
          <h1 className="font-display text-6xl font-normal tracking-[-0.04em]">Places.</h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted">
            Use the language your school uses. Places can be rooms, homes, stages, addresses, or online spaces.
          </p>
        </div>
      </header>

      {created ? <p className="border-b border-line py-4 text-sm text-brand">Place added.</p> : null}

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

      {canCreate ? (
        <section className="grid md:grid-cols-[1fr_2fr]">
          <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
            <h2 className="font-display text-3xl font-normal">Add a place</h2>
          </div>
          <div className="py-10 md:pl-10"><PlaceForm schoolId={schoolId} /></div>
        </section>
      ) : null}
    </main>
  );
}
