import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSingleLesson } from "./actions";

export const dynamic = "force-dynamic";
const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";
const messages: Record<string, string> = {
  created: "Lesson created and added to the planner.",
  invalid: "Check the lesson details and try again.",
  outside_teacher_availability: "That time is outside the teacher’s availability. Choose another time or record an override below.",
  teacher_conflict: "That teacher already has a lesson during this time.",
  student_conflict: "That student already has a lesson during this time.",
  override_reason_required: "Record why this lesson is being scheduled outside normal availability.",
  lesson_too_far_in_past: "A new lesson cannot be created that far in the past.",
  error: "The lesson could not be created. Nothing was added to the calendar.",
};

function name(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function NewLessonPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ status?: string }>;
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
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`New lesson setup could not load: ${failed.error.message}`);
  const [{ data: school }, { data: membership }, teachersResult, studentsResult, peopleResult, productsResult, placesResult] = results;
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const teachers = (teachersResult.data ?? []).flatMap(({ person_id }) => people.has(person_id) ? [{ id: person_id, label: name(people.get(person_id)!) }] : []).sort((a, b) => a.label.localeCompare(b.label));
  const students = (studentsResult.data ?? []).flatMap(({ person_id }) => people.has(person_id) ? [{ id: person_id, label: name(people.get(person_id)!) }] : []).sort((a, b) => a.label.localeCompare(b.label));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const statusMessage = query.status ? messages[query.status] ?? messages.error : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="grid gap-7 border-b border-line pb-8 md:grid-cols-[1fr_2fr] md:items-end">
        <Link href={`/schools/${schoolId}`} className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <div><p className="text-xs text-brand">{school.name} · One-time private lesson</p><h1 className="mt-3 font-display text-5xl tracking-[-0.04em] sm:text-6xl">New lesson.</h1></div>
      </header>
      {statusMessage ? <p role="status" className={`border-b border-line py-4 text-sm ${query.status === "created" ? "text-brand" : "text-danger"}`}>{statusMessage}</p> : null}

      <form action={createSingleLesson.bind(null, schoolId)} className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-9 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">The plan</h2><p className="mt-3 text-sm leading-6 text-muted">Creates one durable calendar occurrence. Recurring series will reuse this pattern later.</p></div>
        <div className="grid gap-7 py-9 md:grid-cols-2 md:pl-10">
          <label className="md:col-span-2"><span className="text-xs text-muted">Student</span><select required name="student_id" defaultValue="" className={field}><option value="" disabled>Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select></label>
          <label><span className="text-xs text-muted">Teacher</span><select required name="teacher_id" defaultValue="" className={field}><option value="" disabled>Select a teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.label}</option>)}</select></label>
          <label><span className="text-xs text-muted">Lesson offering</span><select required name="product_id" defaultValue="" className={field}><option value="" disabled>Select an offering</option>{(productsResult.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.duration_minutes} min · {new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.price_cents / 100)}</option>)}</select></label>
          <label><span className="text-xs text-muted">Date</span><input required name="date" type="date" min={today} defaultValue={today} className={field} /></label>
          <label><span className="text-xs text-muted">Start time</span><input required name="time" type="time" step="300" className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Place</span><select required name="place_id" defaultValue="" className={field}><option value="" disabled>Select a place</option>{(placesResult.data ?? []).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Internal notes</span><textarea name="notes" maxLength={1000} rows={3} className={field} /></label>
          <div className="md:col-span-2 border-l border-line pl-4"><label className="flex items-start gap-3 text-sm"><input name="allow_outside_availability" type="checkbox" className="mt-1 accent-[var(--color-brand)]" /><span>Allow outside this teacher’s availability</span></label><label className="mt-4 block"><span className="text-xs text-muted">Override reason, required when checked</span><input name="override_reason" maxLength={240} className={field} /></label></div>
          <div className="md:col-span-2 flex justify-end"><button className="border border-brand px-6 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas">Create lesson →</button></div>
        </div>
      </form>
    </main>
  );
}
