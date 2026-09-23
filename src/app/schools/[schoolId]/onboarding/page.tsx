/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MdCreditCard, MdHowToReg, MdLockOutline, MdReceiptLong, MdScheduleSend } from "react-icons/md";
import { AvatarUploader } from "@/app/profile/avatar-uploader";
import { SchoolLogoUploader } from "@/components/school-setup/school-logo-uploader";
import { InstrumentCatalogForm } from "@/components/school-setup/instrument-catalog-form";
import { AddTeacherDialog } from "@/components/staff/add-teacher-dialog";
import { Term } from "@/components/ui/term";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { updateSchoolInstrumentCatalog } from "../setup/instrument-actions";
import { createAndInviteTeacher } from "../staff/actions";
import { finishOnboarding } from "./actions";
import { FamilyForm, type OnboardingFamily } from "./family-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your school · Common Time", robots: { index: false, follow: false } };

function personName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function OnboardingPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ finish?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/onboarding`);

  const results = await Promise.all([
    supabase.from("schools").select("id,name,timezone,logo_path,onboarding_completed_at").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("full_name,avatar_path,avatar_url").eq("id", profileId).maybeSingle(),
    supabase.from("teachers").select("person_id").eq("school_id", schoolId),
    supabase.from("school_instruments").select("name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("billing_accounts").select("id,name,billing_contact_person_id").eq("school_id", schoolId).eq("status", "active").order("created_at"),
    supabase.from("people").select("id,first_name,last_name,preferred_name,email").eq("school_id", schoolId),
    supabase.from("billing_account_students").select("billing_account_id,student_id").eq("school_id", schoolId),
    loadMySchoolCapabilities(schoolId),
  ]);
  const failed = results.find((result) => "error" in result && result.error);
  if (failed && "error" in failed && failed.error) throw new Error("School onboarding could not be loaded.");
  const [schoolResult, membershipResult, profileResult, teacherResult, instrumentResult, accountResult, peopleResult, studentLinkResult, capabilities] = results;
  const school = schoolResult.data;
  const membership = membershipResult.data;
  const profile = profileResult.data;
  if (!school || !membership || !profile) notFound();
  if (!capabilities.has("school.setup.manage")) redirect(`/schools/${schoolId}`);
  const peopleById = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const studentIdsByAccount = (studentLinkResult.data ?? []).reduce<Record<string, string[]>>((groups, link) => {
    (groups[link.billing_account_id] ??= []).push(link.student_id);
    return groups;
  }, {});
  const families: OnboardingFamily[] = (accountResult.data ?? []).map((account) => {
    const payer = peopleById.get(account.billing_contact_person_id);
    return {
      id: account.id,
      name: account.name,
      payer: payer?.email ? { firstName: payer.first_name, lastName: payer.last_name, email: payer.email } : null,
      students: (studentIdsByAccount[account.id] ?? []).flatMap((studentId) => {
        const student = peopleById.get(studentId);
        return student ? [{ id: studentId, name: personName(student) }] : [];
      }),
    };
  });
  const studentCount = families.reduce((count, family) => count + family.students.length, 0);
  const hasStudent = studentCount > 0;
  const logo = school.logo_path ? await supabase.storage.from("school-logos").createSignedUrl(school.logo_path, 3600) : null;
  const avatar = profile.avatar_path ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600) : null;
  const instrumentNames = (instrumentResult.data ?? []).map((instrument) => instrument.name);
  const onboardingTeachers = (teacherResult.data ?? []).flatMap((teacher) => {
    const person = peopleById.get(teacher.person_id);
    return person ? [person] : [];
  }).sort((a, b) => personName(a).localeCompare(personName(b)));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 text-center sm:px-8 sm:py-20">
      <p className="text-xs uppercase tracking-[0.14em] text-brand">{school.onboarding_completed_at ? "School setup guide" : "New school setup"}</p>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">{school.onboarding_completed_at ? `${school.name}, all in one place.` : `Let’s make ${school.name} feel like yours.`}</h1>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-muted">{school.onboarding_completed_at ? "Review your setup, add people, or revisit how billing moves from lessons to completed payments." : "You can change all of this later. We’ll begin with the people and details Common Time needs to keep schedules and billing understandable."}</p>
      <ol className="mx-auto mt-8 flex max-w-xl justify-center gap-3 text-xs text-muted" aria-label="Onboarding steps"><li>1 · School</li><li>2 · Family</li><li>3 · Teachers</li><li>4 · How billing works</li></ol>

      <section className="mt-14 border-t border-line py-10">
        <p className="text-xs uppercase tracking-[0.14em] text-brand">1 · School and owner</p>
        <h2 className="mt-3 font-display text-4xl">Add the faces people will recognize.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Your school logo appears on school communications. Your avatar identifies you to teachers and staff.</p>
        <div className="mt-8 grid gap-8 text-left sm:grid-cols-2">
          <div className="rounded-control bg-surface p-5"><h3 className="text-sm font-medium">School logo</h3>{logo?.data?.signedUrl ? <img src={logo.data.signedUrl} alt={`${school.name} logo`} className="mt-4 h-24 w-24 object-contain" /> : null}<SchoolLogoUploader schoolId={schoolId} /></div>
          <div className="rounded-control bg-surface p-5"><h3 className="text-sm font-medium">Your avatar</h3><div className="mt-4"><AvatarUploader currentUrl={avatar?.data?.signedUrl ?? profile.avatar_url ?? null} initial={profile.full_name?.[0] ?? "?"} /></div></div>
        </div>
        <p className="mt-6 text-sm text-muted">School name: <strong className="text-ink">{school.name}</strong> · Timezone: <strong className="text-ink">{school.timezone}</strong> · <Link href={`/schools/${schoolId}/setup`} className="text-brand underline">add address or phone</Link></p>
      </section>

      <section className="border-t border-line py-10">
        <p className="text-xs uppercase tracking-[0.14em] text-brand">2 · Families</p>
        <h2 className="mt-3 font-display text-4xl">Add students and the people who pay.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">A <Term definition="The person responsible for receiving billing summaries and approving or paying charges for a student.">payer</Term> can be a parent, guardian, or an adult student paying for themselves. Students sharing a payer stay connected to one family billing account.</p>
        <FamilyForm schoolId={schoolId} families={families} />
      </section>

      <section className="border-t border-line py-10">
        <p className="text-xs uppercase tracking-[0.14em] text-brand">3 · Teaching team</p>
        <h2 className="mt-3 font-display text-4xl">Invite the people who teach.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Set the instruments your school teaches first. Then add the people who teach them.</p>
        <div className="mx-auto mt-8 max-w-2xl space-y-6 text-left">
          <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-brand">First · Choose your instruments</p>
            <h3 className="mt-2 font-display text-3xl">What does your school teach right now?</h3>
            <p className="mt-3 text-sm leading-6 text-muted">Select the instruments you currently offer—not everything you might add later. This list controls the choices available when you add teachers and lessons, and you can update it anytime.</p>
            <div className="mt-6"><InstrumentCatalogForm instruments={instrumentNames} action={updateSchoolInstrumentCatalog.bind(null, schoolId)} /></div>
          </div>

          <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-brand">Next · Add teachers</p>
            <h3 className="mt-2 font-display text-3xl">Who teaches at your school?</h3>
            <p className="mt-3 text-sm leading-6 text-muted">Teachers receive a private email invitation and sign in without a password. Add everyone now, or return to Staff later.</p>
            <aside className="mt-6 border-l-4 border-brand bg-brand/10 px-5 py-4">
              <h4 className="font-display text-2xl text-ink">Are you the owner and a teacher?</h4>
              <p className="mt-2 text-sm leading-6 text-ink">Add yourself here too. Your owner account manages the school, while your teacher record connects you to instruments, students, and lessons.</p>
            </aside>
            <div className="mt-6 border-t border-line pt-6">
              {onboardingTeachers.length ? (
                <div>
                  <p className="text-sm font-medium text-ink">{onboardingTeachers.length} {onboardingTeachers.length === 1 ? "teacher" : "teachers"} added</p>
                  <ul className="mt-3 divide-y divide-line border-y border-line" aria-label="Teachers added">
                    {onboardingTeachers.map((teacher) => (
                      <li key={teacher.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                        <span className="font-medium text-ink">{personName(teacher)}</span>
                        <span className="text-sm text-muted">{teacher.email || "No email address"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-sm text-muted">No teachers added yet.</p>}
              <div className="mt-5">
                <AddTeacherDialog
                  instruments={instrumentNames}
                  action={createAndInviteTeacher.bind(null, schoolId)}
                  emptyMessage="Choose at least one instrument above and save the list before adding teachers."
                  triggerLabel={onboardingTeachers.length ? "Add another teacher +" : "Add teacher +"}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-10">
        <p className="text-xs uppercase tracking-[0.14em] text-brand">4 · Billing in plain English</p>
        <h2 className="mt-3 font-display text-4xl">What happens when money is involved.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Money moves forward in deliberate stages. Each handoff is visible, and nothing is charged simply because a lesson exists.</p>
        <ol className="relative mx-auto mt-10 grid max-w-5xl gap-8 text-left lg:grid-cols-5 lg:gap-5" aria-label="Billing flow">
          <span aria-hidden="true" className="absolute top-8 bottom-8 left-8 w-px bg-brand/40 lg:inset-x-[10%] lg:top-8 lg:bottom-auto lg:h-px lg:w-auto" />
          {[
            { number: "01", title: "Collect", icon: MdReceiptLong, description: <>Lessons and fees gather in a draft <Term definition="An itemized summary of charges for one family during a date range. Nothing is charged merely because a statement exists.">statement</Term>.</> },
            { number: "02", title: "Review & lock", icon: MdLockOutline, description: <>You check every line, then lock the exact statement so it cannot quietly change.</> },
            { number: "03", title: "Get approval", icon: MdHowToReg, description: <>The payer sees the itemized amount and gives <Term definition="Clear permission from the payer for one exact statement and amount.">approval</Term>.</> },
            { number: "04", title: "Notify & wait", icon: MdScheduleSend, description: <>Automatic payments still receive advance notice and observe the agreed waiting period.</> },
            { number: "05", title: "Charge", icon: MdCreditCard, description: <>Only then—with permission and a saved payment method—does Common Time attempt payment.</> },
          ].map((step) => {
            const Icon = step.icon;
            return <li key={step.number} className="relative grid grid-cols-[4rem_1fr] gap-4 lg:block">
              <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 border-brand bg-canvas text-brand shadow-[0_0_0_6px_var(--color-canvas)] lg:mx-auto">
                <Icon aria-hidden="true" className="h-7 w-7" />
              </div>
              <div className="rounded-control border border-line bg-surface p-5 lg:mt-7 lg:min-h-64">
                <span className="text-xs font-medium tracking-[0.14em] text-brand">STEP {step.number}</span>
                <h3 className="mt-3 font-display text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>
              </div>
            </li>;
          })}
        </ol>
        <aside className="mx-auto mt-8 max-w-5xl border-l-4 border-brand bg-brand/10 px-5 py-4 text-left">
          <p className="text-xs uppercase tracking-[0.12em] text-brand">A clear paper trail</p>
          <p className="mt-2 text-sm leading-6 text-ink">Invoices, credits, failed attempts, and receipts stay separate, so you and the payer can always see exactly what happened.</p>
        </aside>
        {school.onboarding_completed_at ? (
          <Link href={`/schools/${schoolId}`} className="mt-8 inline-flex rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Return to my school</Link>
        ) : !hasStudent ? <p className="mt-7 text-sm text-danger">Add the first student and payer before finishing setup.</p> : <form action={finishOnboarding.bind(null, schoolId)} className="mt-8"><button className="rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Finish setup and open my school</button>{query.finish ? <p className="mt-3 text-sm text-danger">Setup could not be completed. Reload and try again.</p> : null}</form>}
      </section>
    </main>
  );
}
