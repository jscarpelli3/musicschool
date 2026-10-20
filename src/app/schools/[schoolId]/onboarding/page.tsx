/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MdCheckCircle, MdMusicNote } from "react-icons/md";
import { AvatarUploader } from "@/app/profile/avatar-uploader";
import { SchoolLogoUploader } from "@/components/school-setup/school-logo-uploader";
import { InstrumentCatalogForm } from "@/components/school-setup/instrument-catalog-form";
import { AddTeacherDialog } from "@/components/staff/add-teacher-dialog";
import { WeeklyAvailabilityEditor } from "@/components/scheduling/weekly-availability-editor";
import { FocusedModal } from "@/components/ui/focused-modal";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe/server";
import { updateSchoolInstrumentCatalog } from "../setup/instrument-actions";
import { createAndInviteTeacher } from "../staff/actions";
import { saveTeacherWeeklyAvailability } from "../availability-actions";
import { finishOnboarding } from "./actions";
import { BillingWalkthrough } from "./billing-walkthrough";
import { EditableSetupCard } from "./editable-setup-card";
import { FamilyForm, type OnboardingFamily } from "./family-form";
import { OnboardingStepper } from "./onboarding-stepper";
import { ProductForm } from "../products/product-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your school · Common Time", robots: { index: false, follow: false } };

function personName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export default async function OnboardingPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ finish?: string; step?: string; created?: string }>;
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
    supabase.from("teacher_availability_rules").select("teacher_id,weekday,start_time,end_time,effective_from,effective_until").eq("school_id", schoolId).order("weekday").order("start_time"),
    supabase.from("service_products").select("id,name,duration_minutes,price_cents,currency,status,format").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("school_payment_connections").select("status,charges_enabled").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", getStripeMode() === "live").maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);
  const failed = results.find((result) => "error" in result && result.error);
  if (failed && "error" in failed && failed.error) throw new Error("School onboarding could not be loaded.");
  const [schoolResult, membershipResult, profileResult, teacherResult, instrumentResult, accountResult, peopleResult, studentLinkResult, availabilityResult, productResult, paymentConnectionResult, capabilities] = results;
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
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const currentAvailability = (availabilityResult.data ?? []).filter((rule) => rule.effective_from <= today && (!rule.effective_until || rule.effective_until >= today));
  const products = productResult.data ?? [];
  const paymentsReady = paymentConnectionResult.data?.status === "enabled" && paymentConnectionResult.data.charges_enabled;
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="text-center"><p className="text-xs uppercase tracking-[0.14em] text-brand">{school.onboarding_completed_at ? "Setup guide" : "New school setup"}</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">{school.name}</h1></div>
      <OnboardingStepper initialStep={query.step}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-control bg-surface p-5"><EditableSetupCard saved={Boolean(logo?.data?.signedUrl)} editLabel="Change school logo" completion={<>{logo?.data?.signedUrl ? <img src={logo.data.signedUrl} alt={`${school.name} logo`} className="h-24 w-24 object-contain" /> : null}<MdCheckCircle aria-hidden="true" className="mt-4 h-6 w-6 text-brand" /><p className="mt-2 text-sm font-medium">School logo saved</p></>}><p className="text-xs uppercase tracking-[0.12em] text-brand">School logo</p>{logo?.data?.signedUrl ? <img src={logo.data.signedUrl} alt={`${school.name} logo`} className="mt-4 h-24 w-24 object-contain" /> : null}<SchoolLogoUploader schoolId={schoolId} /></EditableSetupCard></div>
          <div className="rounded-control bg-surface p-5"><EditableSetupCard saved={Boolean(avatar?.data?.signedUrl || profile.avatar_url)} editLabel="Change my avatar" completion={<>{avatar?.data?.signedUrl || profile.avatar_url ? <img src={avatar?.data?.signedUrl ?? profile.avatar_url ?? ""} alt="Your avatar" className="h-24 w-24 rounded-full border border-line object-cover" /> : null}<MdCheckCircle aria-hidden="true" className="mt-4 h-6 w-6 text-brand" /><p className="mt-2 text-sm font-medium">Avatar saved</p></>}><p className="text-xs uppercase tracking-[0.12em] text-brand">Your avatar</p><div className="mt-4"><AvatarUploader currentUrl={avatar?.data?.signedUrl ?? profile.avatar_url ?? null} initial={profile.full_name?.[0] ?? "?"} /></div></EditableSetupCard></div>
          <p className="sm:col-span-2 text-center text-sm text-muted">{school.timezone} · <Link href={`/schools/${schoolId}/setup`} className="text-brand underline underline-offset-4">School details</Link></p>
        </div>

        <div className="space-y-6">
          <div className="rounded-control bg-surface p-5 sm:p-6"><p className="text-xs uppercase tracking-[0.12em] text-brand">Instruments</p><EditableSetupCard saved={instrumentNames.length > 0} editLabel="Edit instruments" completion={<><MdCheckCircle aria-hidden="true" className="h-6 w-6 text-brand" /><p className="mt-3 text-sm font-medium">{instrumentNames.join(" · ")}</p></>}><div className="mt-5"><InstrumentCatalogForm instruments={instrumentNames} action={updateSchoolInstrumentCatalog.bind(null, schoolId)} /></div></EditableSetupCard></div>
          <div className="rounded-control bg-surface p-5 sm:p-6"><div className="flex items-center gap-3"><MdMusicNote aria-hidden="true" className="text-2xl text-brand" /><p className="text-xs uppercase tracking-[0.12em] text-brand">Lesson types</p></div>
            {query.created ? <p className="mt-4 text-sm text-brand">Lesson type added.</p> : null}
            {products.length ? <div className="mt-4 space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 rounded-control bg-canvas/55 px-4 py-3"><span className="text-sm font-medium">{product.name}</span><span className="text-xs text-muted">{product.duration_minutes} min · {money(product.price_cents, product.currency)}</span></div>)}</div> : <p className="mt-4 text-sm text-muted">No lesson types yet.</p>}
            <div className="mt-5">{paymentsReady ? <FocusedModal triggerLabel="Add lesson type +" eyebrow="Lesson type" title="Add a lesson type" description="Set its length, frequency, and price."><ProductForm schoolId={schoolId} returnPath={`/schools/${schoolId}/onboarding?step=offerings`} /></FocusedModal> : <div className="rounded-control bg-canvas/55 p-4 text-sm"><p>Connect payments before adding priced lesson types.</p><Link href={`/schools/${schoolId}/payments`} className="mt-2 inline-block text-brand underline underline-offset-4">Set up payments →</Link></div>}</div>
          </div>
        </div>

        <div><h3 className="text-lg font-medium">Add students and the people who pay.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">A payer can be a parent, guardian, or an adult student. Students who share a payer stay on one family billing account.</p><FamilyForm schoolId={schoolId} families={families} /></div>

        <div className="rounded-control bg-surface p-5 sm:p-6">
          {onboardingTeachers.length ? <div className="space-y-2">{onboardingTeachers.map((teacher) => <div key={teacher.id} className="flex items-center gap-3 rounded-control bg-canvas/55 px-4 py-3"><MdCheckCircle aria-hidden="true" className="text-brand" /><span className="text-sm font-medium">{personName(teacher)}</span></div>)}</div> : <p className="text-sm text-muted">No teachers added yet.</p>}
          <p className="mt-5 text-sm text-muted">If you teach, add yourself as a teacher too.</p>
          <div className="mt-4"><AddTeacherDialog instruments={instrumentNames} action={createAndInviteTeacher.bind(null, schoolId)} emptyMessage="Save at least one instrument before adding a teacher." triggerLabel={onboardingTeachers.length ? "Add another teacher +" : "Add teacher +"} /></div>
        </div>

        <div>{onboardingTeachers.length ? <div className="space-y-5"><p className="text-sm leading-6 text-muted">Time blocks show when each teacher normally works. Scheduling outside them is still possible.</p>{onboardingTeachers.map((teacher) => <div key={teacher.id} className="rounded-control bg-canvas/45 p-4 sm:p-5"><h3 className="mb-4 text-sm font-medium">{personName(teacher)}</h3><WeeklyAvailabilityEditor compactSetup initialBlocks={currentAvailability.filter((rule) => rule.teacher_id === teacher.id).map((rule) => ({ weekday: rule.weekday, start_time: rule.start_time.slice(0,5), end_time: rule.end_time.slice(0,5) }))} action={saveTeacherWeeklyAvailability.bind(null,schoolId,teacher.id)} /></div>)}</div> : <p className="rounded-control bg-surface p-5 text-sm text-muted">Add a teacher first. You can also skip this and return later.</p>}</div>

        <div className="text-center"><BillingWalkthrough />{school.onboarding_completed_at ? <Link href={`/schools/${schoolId}`} className="mt-8 inline-flex rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Return to my school</Link> : !hasStudent ? <p className="mt-7 text-sm text-danger">Add the first student and payer before finishing setup.</p> : <form action={finishOnboarding.bind(null, schoolId)} className="mt-8"><button className="rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Finish setup</button>{query.finish ? <p className="mt-3 text-sm text-danger">Setup could not be completed. Reload and try again.</p> : null}</form>}</div>
      </OnboardingStepper>
    </main>
  );
}
