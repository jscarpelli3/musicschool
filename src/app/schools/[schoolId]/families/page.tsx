import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function displayName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function FamiliesPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/families`);

  const results = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_accounts").select("id, name, status, billing_contact_person_id").eq("school_id", schoolId).order("name"),
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone").eq("school_id", schoolId),
    supabase.from("billing_account_students").select("billing_account_id, student_id").eq("school_id", schoolId),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Families could not load: ${failed.error.message}`);
  const [{ data: school }, { data: membership }, { data: accounts }, { data: people }, { data: studentLinks }] = results;
  if (!school || !membership) notFound();

  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  const studentCount = (studentLinks ?? []).reduce<Record<string, number>>((counts, link) => {
    counts[link.billing_account_id] = (counts[link.billing_account_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="border-b border-line pb-7">
        <h1 className="font-display text-5xl">Families.</h1>
        <p className="mt-3 text-sm text-muted">{accounts?.length ?? 0} payer accounts</p>
      </header>
      <div>
        {(accounts ?? []).map((account) => {
          const contact = peopleById.get(account.billing_contact_person_id);
          const count = studentCount[account.id] ?? 0;
          return <Link key={account.id} href={`/schools/${schoolId}/families/${account.id}`} className="grid gap-3 border-b border-line py-6 transition-colors hover:bg-surface/40 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-4"><div><h2 className="text-lg">{account.name}</h2><p className="mt-1 text-xs capitalize text-muted">{account.status}</p></div><div className="text-sm text-muted"><p>{contact ? displayName(contact) : "No payer assigned"}</p><p className="mt-1 text-xs">{contact?.email || contact?.phone || "No contact details"}</p></div><p className="text-sm text-brand">{count} {count === 1 ? "student" : "students"} →</p></Link>;
        })}
        {!accounts?.length ? <p className="py-12 text-sm text-muted">No family accounts have been created.</p> : null}
      </div>
    </main>
  );
}
