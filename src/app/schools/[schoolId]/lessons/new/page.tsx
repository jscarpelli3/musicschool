import { notFound, redirect } from "next/navigation";
import { NewLessonForm } from "@/components/scheduling/new-lesson-form";
import { createClient } from "@/lib/supabase/server";
import { createSingleLesson, type CreateLessonState } from "./actions";

export const dynamic = "force-dynamic";
const initialCreateLessonState: CreateLessonState = { status: "idle", message: "" };

function name(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function NewLessonPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ teacher?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/lessons/new`);

  const results = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("person_id").eq("school_id", schoolId),
    supabase.from("students").select("person_id").eq("school_id", schoolId).in("enrollment_status", ["active", "prospect"]),
    supabase.from("people").select("id, first_name, last_name, preferred_name").eq("school_id", schoolId).eq("status", "active"),
    supabase.from("service_products").select("id, name, duration_minutes, price_cents, currency").eq("school_id", schoolId).eq("status", "active").eq("format", "private_lesson").order("name"),
    supabase.from("lesson_places").select("id, name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("teacher_availability_rules").select("id, teacher_id, weekday, start_time, end_time, effective_from, effective_until").eq("school_id", schoolId).order("weekday").order("start_time"),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`New lesson setup could not load: ${failed.error.message}`);
  const [{ data: school }, { data: membership }, teachersResult, studentsResult, peopleResult, productsResult, placesResult, availabilityResult] = results;
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const teachers = (teachersResult.data ?? []).flatMap(({ person_id }) => people.has(person_id) ? [{ id: person_id, label: name(people.get(person_id)!) }] : []).sort((a, b) => a.label.localeCompare(b.label));
  const students = (studentsResult.data ?? []).flatMap(({ person_id }) => people.has(person_id) ? [{ id: person_id, label: name(people.get(person_id)!) }] : []).sort((a, b) => a.label.localeCompare(b.label));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="border-b border-line pb-8">
        <p className="text-xs text-brand">{school.name} · One-time private lesson</p><h1 className="mt-3 font-display text-5xl tracking-[-0.04em] sm:text-6xl">New lesson.</h1>
      </header>
      <NewLessonForm
        action={createSingleLesson.bind(null, schoolId)}
        initialState={initialCreateLessonState}
        students={students}
        teachers={teachers}
        products={(productsResult.data ?? []).map((product) => ({ id: product.id, label: product.name, durationMinutes: product.duration_minutes, priceLabel: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.price_cents / 100) }))}
        places={(placesResult.data ?? []).map((place) => ({ id: place.id, label: place.name }))}
        availability={availabilityResult.data ?? []}
        today={today}
        defaultTeacherId={query.teacher}
      />
    </main>
  );
}
