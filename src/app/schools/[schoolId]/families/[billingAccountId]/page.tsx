import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DetailHeader, DetailSection, EmptyDetail } from "@/components/people/detail-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function name(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function FamilyDetailPage({ params }: {
  params: Promise<{ schoolId: string; billingAccountId: string }>;
}) {
  const { schoolId, billingAccountId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/families/${billingAccountId}`);

  const initial = await Promise.all([
    supabase.from("schools").select("id, name, currency").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_accounts").select("id, name, status, billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle(),
  ]);
  const failedInitial = initial.find((result) => result.error);
  if (failedInitial?.error) throw new Error(`Family detail could not load: ${failedInitial.error.message}`);
  const [{ data: school }, { data: membership }, { data: account }] = initial;
  if (!school || !membership || !account) notFound();

  const related = await Promise.all([
    supabase.from("people").select("id, first_name, last_name, preferred_name, email, phone, status").eq("school_id", schoolId),
    supabase.from("billing_account_students").select("student_id").eq("school_id", schoolId).eq("billing_account_id", billingAccountId),
    supabase.from("billing_periods").select("id, label, period_start, period_end, status, amount_due_cents, currency").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("period_start", { ascending: false }).limit(12),
    supabase.from("billing_payment_methods").select("id, display_label, brand, last_four, exp_month, exp_year, is_default, status").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).order("is_default", { ascending: false }),
    supabase.from("payment_attempts").select("billing_period_id, amount_cents, status").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("status", "succeeded"),
  ]);
  const failedRelated = related.find((result) => result.error);
  if (failedRelated?.error) throw new Error(`Family detail could not load: ${failedRelated.error.message}`);
  const [peopleResult, studentsResult, periodsResult, methodsResult, attemptsResult] = related;
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const contact = people.get(account.billing_contact_person_id);
  const students = (studentsResult.data ?? []).flatMap((link) => {
    const person = people.get(link.student_id);
    return person ? [{ id: link.student_id, person }] : [];
  });
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const paidByPeriod = (attemptsResult.data ?? []).reduce<Record<string, number>>((totals, attempt) => {
    totals[attempt.billing_period_id] = (totals[attempt.billing_period_id] ?? 0) + attempt.amount_cents;
    return totals;
  }, {});

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <DetailHeader backHref={`/schools/${schoolId}`} backLabel="Dashboard" eyebrow={`${school.name} · Family account`} title={account.name} meta={`${account.status} billing relationship · ${students.length} ${students.length === 1 ? "student" : "students"}`} />

      <DetailSection title="Primary payer" description="The person currently responsible for this billing account.">
        {contact ? <div><p className="font-display text-3xl">{name(contact)}</p><p className="mt-3 text-sm text-muted">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</p><p className="mt-3 text-xs uppercase tracking-[0.14em] text-brand">{contact.status}</p></div> : <EmptyDetail>The billing contact record is unavailable.</EmptyDetail>}
      </DetailSection>

      <DetailSection title="Students" description="Students whose charges roll into this family billing account.">
        <div className="space-y-1">
          {students.map(({ id, person }) => <Link key={id} href={`/schools/${schoolId}/students/${id}`} className="flex items-center justify-between border-b border-line py-5 first:pt-0 hover:text-brand"><span>{name(person)}</span><span className="text-brand">→</span></Link>)}
          {!students.length ? <EmptyDetail>No students are linked to this account.</EmptyDetail> : null}
        </div>
      </DetailSection>

      <DetailSection title="Billing history" description="Durable monthly billing periods. Draft amounts remain visibly distinct from paid provider truth.">
        <div className="space-y-1">
          {(periodsResult.data ?? []).map((period) => <div key={period.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-line py-5 first:pt-0"><div><p>{period.label}</p><p className="mt-2 text-xs text-muted">{period.period_start}–{period.period_end} · <span className="uppercase">{period.status}</span></p></div><div className="text-right"><p>{money(period.amount_due_cents, period.currency)}</p><p className="mt-2 text-xs text-muted">{money(paidByPeriod[period.id] ?? 0, period.currency)} paid</p></div></div>)}
          {!(periodsResult.data ?? []).length ? <EmptyDetail>No billing periods have been prepared.</EmptyDetail> : null}
        </div>
      </DetailSection>

      <DetailSection title="Payment methods" description="Safe provider references only. MusicSchool never stores card numbers or bank credentials.">
        <div className="space-y-5">
          {(methodsResult.data ?? []).map((method) => <div key={method.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-5 last:border-0"><div><p>{method.display_label}</p><p className="mt-2 text-xs text-muted">{method.brand ?? "Payment method"}{method.last_four ? ` · •••• ${method.last_four}` : ""}{method.exp_month && method.exp_year ? ` · expires ${method.exp_month}/${method.exp_year}` : ""}</p></div><span className="text-xs uppercase tracking-[0.14em] text-brand">{method.is_default ? "Default" : method.status}</span></div>)}
          {!(methodsResult.data ?? []).length ? <EmptyDetail>No payment method has been set up.</EmptyDetail> : null}
        </div>
      </DetailSection>
    </main>
  );
}
