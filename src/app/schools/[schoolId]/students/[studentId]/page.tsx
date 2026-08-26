import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DetailHeader, DetailSection, EmptyDetail } from "@/components/people/detail-shell";
import { ApprovalList } from "@/components/approvals/approval-list";
import { loadOwnerApprovals } from "@/lib/approvals/owner-approvals";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function displayName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function StudentDetailPage({ params }: {
  params: Promise<{ schoolId: string; studentId: string }>;
}) {
  const { schoolId, studentId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/students/${studentId}`);

  const initial = await Promise.all([
    supabase.from("schools").select("id, name, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("students").select("person_id, birth_date, enrollment_status, notes").eq("school_id", schoolId).eq("person_id", studentId).maybeSingle(),
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId).eq("id", studentId).maybeSingle(),
  ]);
  const failedInitial = initial.find((result) => result.error);
  if (failedInitial?.error) throw new Error(`Student detail could not load: ${failedInitial.error.message}`);
  const [{ data: school }, { data: membership }, { data: student }, { data: person }] = initial;
  if (!school || !membership || !student || !person) notFound();

  const related = await Promise.all([
    supabase.from("student_contacts").select("contact_person_id, relationship, is_primary, is_billing_contact").eq("school_id", schoolId).eq("student_id", studentId),
    supabase.from("billing_account_students").select("billing_account_id").eq("school_id", schoolId).eq("student_id", studentId),
    supabase.from("lesson_events").select("id, starts_at, ends_at, status, outcome, cancellation_timing, teacher_id, product_id, place_id, actual_starts_at, actual_ends_at, actual_place_id").eq("school_id", schoolId).eq("student_id", studentId).order("starts_at", { ascending: false }).limit(18),
    supabase.from("lesson_series").select("id, status, starts_on, ends_on, recurrence_rule, teacher_id, product_id, default_place_id").eq("school_id", schoolId).eq("student_id", studentId).order("starts_on", { ascending: false }),
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone").eq("school_id", schoolId),
    supabase.from("service_products").select("id, name, duration_minutes, price_cents, currency").eq("school_id", schoolId),
    supabase.from("lesson_places").select("id, name").eq("school_id", schoolId),
    supabase.from("billing_accounts").select("id, name, billing_contact_person_id, status").eq("school_id", schoolId),
  ]);
  const failedRelated = related.find((result) => result.error);
  if (failedRelated?.error) throw new Error(`Student detail could not load: ${failedRelated.error.message}`);
  const [contactsResult, billingLinksResult, lessonsResult, seriesResult, peopleResult, productsResult, placesResult, accountsResult] = related;

  const people = new Map((peopleResult.data ?? []).map((row) => [row.id, row]));
  const products = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const places = new Map((placesResult.data ?? []).map((row) => [row.id, row]));
  const billingIds = new Set((billingLinksResult.data ?? []).map((row) => row.billing_account_id));
  const accounts = (accountsResult.data ?? []).filter((account) => billingIds.has(account.id));
  const dateTime = (value: string) => new Intl.DateTimeFormat("en-US", {
    timeZone: school.timezone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
  const approvals = ["owner","admin"].includes(membership.role) ? await loadOwnerApprovals(supabase,schoolId,{studentIds:[studentId]}) : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <DetailHeader eyebrow={`${school.name} · Student`} title={displayName(person)} meta={`${student.enrollment_status} enrollment · ${person.status} record`} />

      {approvals.length?<DetailSection title="Needs approval" description="Pending owner decisions involving this student. Resolving one here removes it from every active approval list."><ApprovalList schoolId={schoolId} items={approvals} timezone={school.timezone} compact/></DetailSection>:null}

      <DetailSection title="Student record" description="School-facing identity and enrollment information.">
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Email</dt><dd className="mt-2 text-sm">{person.email ?? "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted">Phone</dt><dd className="mt-2 text-sm">{person.phone ?? "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted">Birth date</dt><dd className="mt-2 text-sm">{student.birth_date ?? "Not recorded"}</dd></div>
          <div><dt className="text-xs text-muted">Enrollment</dt><dd className="mt-2 text-sm capitalize">{student.enrollment_status}</dd></div>
        </dl>
        {student.notes ? <div className="mt-8 border-l border-brand pl-4"><p className="text-xs text-brand">Staff-only notes</p><p className="mt-2 text-sm leading-6">{student.notes}</p></div> : null}
      </DetailSection>

      <DetailSection title="Family & billing" description="Contacts and billing accounts currently linked to this student.">
        <div className="space-y-7">
          {(contactsResult.data ?? []).map((contact) => {
            const contactPerson = people.get(contact.contact_person_id);
            if (!contactPerson) return null;
            return <div key={contact.contact_person_id} className="border-b border-line pb-6 last:border-0 last:pb-0"><p>{displayName(contactPerson)}</p><p className="mt-2 text-xs text-muted">{contact.relationship}{contact.is_primary ? " · primary contact" : ""}{contact.is_billing_contact ? " · billing contact" : ""}</p><p className="mt-2 text-sm text-muted">{[contactPerson.email, contactPerson.phone].filter(Boolean).join(" · ") || "No contact details"}</p></div>;
          })}
          {!(contactsResult.data ?? []).length ? <EmptyDetail>No family contacts are linked.</EmptyDetail> : null}
          {accounts.map((account) => <Link key={account.id} href={`/schools/${schoolId}/families/${account.id}`} className="block border-l border-brand py-1 pl-4 text-sm text-brand hover:text-ink">Open {account.name} billing record →</Link>)}
        </div>
      </DetailSection>

      <DetailSection title="Lesson plan" description="Recurring intent. Individual occurrences below remain the record of what actually happened.">
        <div className="space-y-6">
          {(seriesResult.data ?? []).map((series) => {
            const teacher = people.get(series.teacher_id);
            const product = products.get(series.product_id);
            const place = places.get(series.default_place_id);
            return <div key={series.id} className="border-b border-line pb-6 last:border-0"><div className="flex flex-wrap items-baseline justify-between gap-3"><p>{product?.name ?? "Lesson series"}</p><span className="text-xs uppercase tracking-[0.16em] text-brand">{series.status}</span></div><p className="mt-2 text-sm text-muted">{teacher ? displayName(teacher) : "Unassigned teacher"} · {place?.name ?? "Unassigned place"}</p><p className="mt-2 text-xs text-muted">From {series.starts_on}{series.ends_on ? ` through ${series.ends_on}` : " · ongoing"}</p></div>;
          })}
          {!(seriesResult.data ?? []).length ? <EmptyDetail>No lesson series is configured.</EmptyDetail> : null}
        </div>
      </DetailSection>

      <DetailSection title="Recent lessons" description="Scheduled and actual lesson records, newest first.">
        <div className="space-y-1">
          {(lessonsResult.data ?? []).map((lesson) => {
            const teacher = people.get(lesson.teacher_id);
            const product = products.get(lesson.product_id);
            const place = places.get(lesson.actual_place_id ?? lesson.place_id);
            return <div key={lesson.id} className="grid gap-2 border-b border-line py-5 first:pt-0 sm:grid-cols-[1fr_auto]"><div><p>{product?.name ?? "Lesson"}</p><p className="mt-2 text-sm text-muted">{dateTime(lesson.actual_starts_at ?? lesson.starts_at)} · {teacher ? displayName(teacher) : "Unassigned"} · {place?.name ?? "Unassigned"}</p></div><span className="text-xs uppercase tracking-[0.14em] text-brand">{lesson.outcome ?? lesson.status}</span></div>;
          })}
          {!(lessonsResult.data ?? []).length ? <EmptyDetail>No lesson occurrences are recorded.</EmptyDetail> : null}
        </div>
      </DetailSection>
    </main>
  );
}
