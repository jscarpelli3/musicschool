/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MdAccessTime, MdCheckCircle, MdFamilyRestroom, MdGroups, MdLocationOn, MdMusicNote, MdPayments, MdRoute, MdStorefront } from "react-icons/md";
import type { IconType } from "react-icons";
import { AvatarUploader } from "@/app/profile/avatar-uploader";
import { SchoolLogoUploader } from "@/components/school-setup/school-logo-uploader";
import { InstrumentCatalogForm } from "@/components/school-setup/instrument-catalog-form";
import { AddTeacherDialog } from "@/components/staff/add-teacher-dialog";
import { WeeklyAvailabilityEditor } from "@/components/scheduling/weekly-availability-editor";
import { FocusedModal } from "@/components/ui/focused-modal";
import { AppSelect } from "@/components/ui/app-select";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { getStripeMode } from "@/lib/stripe/server";
import { updateSchoolInstrumentCatalog } from "../setup/instrument-actions";
import { updateSchoolInfo } from "../setup/actions";
import { createAndInviteTeacher } from "../staff/actions";
import { saveTeacherWeeklyAvailability } from "../availability-actions";
import { finishOnboarding } from "./actions";
import { BillingWalkthrough } from "./billing-walkthrough";
import { FamilyForm, type OnboardingFamily } from "./family-form";
import { OnboardingStepper } from "./onboarding-stepper";
import { updateSchoolBillingTiming } from "../products/actions";
import { ProductForm } from "../products/product-form";
import { PlaceForm } from "../places/place-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your school · Common Time", robots: { index: false, follow: false } };

function personName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

function StepHeading({ icon: Icon, title, children }: { icon: IconType; title: string; children: ReactNode }) {
  return <header className="mb-7 flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand/12 text-brand"><Icon aria-hidden="true" className="h-6 w-6" /></span><div><h2 className="font-display text-3xl text-ink">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{children}</p></div></header>;
}

export default async function OnboardingPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ finish?: string; step?: string; created?: string; billing?: string; school?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/onboarding`);

  const results = await Promise.all([
    supabase.from("schools").select("id,name,timezone,logo_path,onboarding_completed_at,phone,reply_to_email,address_line_1,address_line_2,city,region,postal_code,billing_timing_default,billing_day,payer_review_days,intended_charge_day").eq("id", schoolId).maybeSingle(),
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
    supabase.from("lesson_places").select("id,name,kind,details,status").eq("school_id", schoolId).eq("status", "active").order("name"),
    loadMySchoolCapabilities(schoolId),
  ]);
  const failed = results.find((result) => "error" in result && result.error);
  if (failed && "error" in failed && failed.error) throw new Error("School onboarding could not be loaded.");
  const [schoolResult, membershipResult, profileResult, teacherResult, instrumentResult, accountResult, peopleResult, studentLinkResult, availabilityResult, productResult, paymentConnectionResult, placeResult, capabilities] = results;
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
  const ownerEmail = typeof auth?.claims?.email === "string" ? auth.claims.email : null;
  const billingTiming = school.billing_timing_default === "after_service" ? "after_service" : "before_service";
  const schoolField = "mt-2 w-full rounded-control border border-line bg-canvas/60 px-3 py-2.5 text-sm outline-none transition focus:border-brand";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="text-center"><p className="text-xs uppercase tracking-[0.14em] text-brand">{school.onboarding_completed_at ? "Setup guide" : "New school setup"}</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">{school.name}</h1></div>
      <OnboardingStepper initialStep={query.step}>
        <div>
          <StepHeading icon={MdStorefront} title="Your school">Keep the details families and teachers use to recognize and contact your school in one place.</StepHeading>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <form action={updateSchoolInfo.bind(null, schoolId)} className="rounded-control bg-surface p-5 sm:p-6"><input type="hidden" name="return_path" value={`/schools/${schoolId}/onboarding?step=school`} /><div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-control bg-canvas/60 px-4 py-3 text-sm"><span><span className="text-muted">Owner</span> · {profile.full_name || "Not added"}</span><span className="break-all"><span className="text-muted">Account email</span> · {ownerEmail || "Not available"}</span><span><span className="text-muted">Timezone</span> · {school.timezone}</span></div><div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="text-xs text-muted">School name</span><input required name="name" defaultValue={school.name} className={schoolField} /></label>
              <label><span className="text-xs text-muted">Primary school email</span><input name="reply_to_email" type="email" defaultValue={school.reply_to_email ?? ""} placeholder={ownerEmail ?? "school@example.com"} className={schoolField} /></label>
              <label><span className="text-xs text-muted">Phone</span><input name="phone" type="tel" defaultValue={school.phone ?? ""} className={schoolField} /></label>
              <label className="sm:col-span-2"><span className="text-xs text-muted">Address</span><input name="address_line_1" defaultValue={school.address_line_1 ?? ""} className={schoolField} /></label>
              <label className="sm:col-span-2"><span className="text-xs text-muted">Suite or unit</span><input name="address_line_2" defaultValue={school.address_line_2 ?? ""} className={schoolField} /></label>
              <label><span className="text-xs text-muted">City</span><input name="city" defaultValue={school.city ?? ""} className={schoolField} /></label>
              <label><span className="text-xs text-muted">State or region</span><input name="region" defaultValue={school.region ?? ""} className={schoolField} /></label>
              <label><span className="text-xs text-muted">Postal code</span><input name="postal_code" defaultValue={school.postal_code ?? ""} className={schoolField} /></label>
              <div className="flex items-end"><button className="rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-canvas">Save school info</button></div>
            </div>{query.school ? <p className={`mt-4 text-sm ${query.school === "saved" ? "text-brand" : "text-danger"}`}>{query.school === "saved" ? "School information saved." : "Check the school information and try again."}</p> : null}</form>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-control bg-surface p-4"><p className="text-sm font-medium">School logo</p>{logo?.data?.signedUrl ? <img src={logo.data.signedUrl} alt={`${school.name} logo`} className="mt-3 h-16 w-16 object-contain" /> : <div className="mt-3 grid h-16 w-16 place-items-center border border-line font-display text-2xl text-brand">{school.name[0]}</div>}<SchoolLogoUploader schoolId={schoolId} compact /></div>
              <div className="rounded-control bg-surface p-4"><p className="mb-3 text-sm font-medium">Your avatar</p><AvatarUploader compact currentUrl={avatar?.data?.signedUrl ?? profile.avatar_url ?? null} initial={profile.full_name?.[0] ?? "?"} /></div>
            </div>
          </div>
        </div>

        <div><StepHeading icon={MdMusicNote} title="Instruments">Choose what your school teaches. Changes save as soon as you check or uncheck an instrument.</StepHeading><div className="rounded-control bg-surface p-5 sm:p-6"><InstrumentCatalogForm instruments={instrumentNames} action={updateSchoolInstrumentCatalog.bind(null, schoolId)} /></div></div>

        <div><StepHeading icon={MdFamilyRestroom} title="Students and payers">Add each student and connect the person responsible for their invoices and payment setup.</StepHeading><FamilyForm schoolId={schoolId} families={families} /></div>

        <div><StepHeading icon={MdLocationOn} title="Lesson places">Add the usual places lessons happen. Student home addresses stay protected on each family record.</StepHeading><div className="rounded-control bg-surface p-5 sm:p-6">
          {placeResult.data?.length ? <div className="space-y-2">{placeResult.data.map((place) => <div key={place.id} className="flex items-center justify-between gap-4 rounded-control bg-canvas/55 px-4 py-3"><span className="text-sm font-medium">{place.name}</span><span className="text-xs text-muted">{place.kind === "student_home" ? "Student home" : place.kind === "online" ? "Online" : place.kind === "other" ? "Other" : "School location"}</span></div>)}</div> : <p className="text-sm text-muted">No lesson places yet.</p>}
          <div className="mt-5"><FocusedModal triggerLabel="Add lesson place +" eyebrow="Lesson places" title="Add a lesson place" description="Choose a school location, student home, online meeting, or another place."><PlaceForm schoolId={schoolId} returnPath={`/schools/${schoolId}/onboarding?step=locations`} /></FocusedModal></div>
        </div></div>

        <div><StepHeading icon={MdGroups} title="Teaching team">Add the people who teach. If that includes you, add yourself here too.</StepHeading><div className="rounded-control bg-surface p-5 sm:p-6">
          {onboardingTeachers.length ? <div className="space-y-3"><div className="grid grid-cols-2 gap-3 px-4 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted"><span>Teacher</span><span className="text-right">Email</span></div>{onboardingTeachers.map((teacher) => <div key={teacher.id} className="grid grid-cols-2 items-center gap-3 rounded-control bg-canvas/60 p-4"><span className="flex min-w-0 items-center gap-2"><MdGroups aria-hidden="true" className="shrink-0 text-xl text-brand" /><span className="truncate text-sm font-medium">{personName(teacher)}</span></span><span className="truncate text-right text-sm text-muted">{teacher.email || "No email"}</span></div>)}</div> : <p className="text-sm text-muted">No teachers added yet.</p>}
          <div className="mt-5 flex justify-center"><AddTeacherDialog instruments={instrumentNames} action={createAndInviteTeacher.bind(null, schoolId)} emptyMessage="Save at least one instrument before adding a teacher." triggerLabel={onboardingTeachers.length ? "Add another teacher +" : "Add teacher +"} /></div>
        </div></div>

        <div><StepHeading icon={MdAccessTime} title="Teaching hours">Show when each teacher usually works so Find an Opening can make useful suggestions. You can still schedule an exception outside these times.</StepHeading>{onboardingTeachers.length ? <div className="space-y-6">{onboardingTeachers.map((teacher, index) => { const name = personName(teacher); return <section key={teacher.id} className="rounded-card border border-line bg-surface p-4 shadow-sm sm:p-6" aria-labelledby={`teacher-hours-${teacher.id}`}><div className="mb-5 flex items-center gap-3 border-b border-line pb-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand/12 text-brand"><MdGroups aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted">{onboardingTeachers.length > 1 ? `Teacher ${index + 1} of ${onboardingTeachers.length}` : "Teacher schedule"}</p><h3 id={`teacher-hours-${teacher.id}`} className="mt-1 text-lg font-medium">{name}</h3></div></div><WeeklyAvailabilityEditor compactSetup teacherName={name} initialBlocks={currentAvailability.filter((rule) => rule.teacher_id === teacher.id).map((rule) => ({ weekday: rule.weekday, start_time: rule.start_time.slice(0,5), end_time: rule.end_time.slice(0,5) }))} action={saveTeacherWeeklyAvailability.bind(null,schoolId,teacher.id)} /></section>; })}</div> : <p className="rounded-control bg-surface p-5 text-sm text-muted">Add a teacher first, or return to teaching hours later.</p>}</div>

        <div><StepHeading icon={MdPayments} title="Payments and lesson types">Choose when you normally invoice, connect payments, and add the lessons your school sells.</StepHeading><div className="space-y-6">
          <form action={updateSchoolBillingTiming.bind(null, schoolId)} className="rounded-control bg-surface p-5 sm:p-6"><input type="hidden" name="return_path" value={`/schools/${schoolId}/onboarding?step=payments`} /><h3 className="text-lg font-medium">When do you invoice?</h3><div className="mt-5 grid gap-5 sm:grid-cols-3"><label className="sm:col-span-3"><span className="text-xs text-muted">Usual timing</span><AppSelect name="billing_timing_default" defaultValue={billingTiming} className="mt-2 w-full border-b border-line bg-transparent py-3"><option value="before_service">Monthly, before lessons happen</option><option value="after_service">Monthly, after lessons happen</option></AppSelect></label><label><span className="text-xs text-muted">Prepare on day</span><input name="billing_day" type="number" min={1} max={28} defaultValue={school.billing_day} className="mt-2 w-full border-b border-line bg-transparent py-3" /></label><label><span className="text-xs text-muted">Payer review time</span><input name="payer_review_days" type="number" min={1} max={14} defaultValue={school.payer_review_days} className="mt-2 w-full border-b border-line bg-transparent py-3" /><span className="mt-1 block text-xs text-muted">days</span></label><label><span className="text-xs text-muted">Plan to charge on day</span><input name="intended_charge_day" type="number" min={1} max={28} defaultValue={school.intended_charge_day} className="mt-2 w-full border-b border-line bg-transparent py-3" /></label></div><button className="mt-5 rounded-control bg-brand px-5 py-3 text-sm text-canvas">Save billing timing</button>{query.billing ? <p className={`mt-3 text-sm ${query.billing === "saved" ? "text-brand" : "text-danger"}`}>{query.billing === "saved" ? "Billing timing saved." : "Check these billing choices and try again."}</p> : null}</form>
          <div className={`rounded-control p-5 sm:p-6 ${paymentsReady ? "bg-brand/10" : "bg-surface"}`}><h3 className="text-lg font-medium">Take card payments</h3>{paymentsReady ? <p className="mt-3 flex items-center gap-2 text-sm font-medium"><MdCheckCircle aria-hidden="true" className="text-brand" />Stripe is connected</p> : <><p className="mt-3 text-sm text-muted">Connect Stripe before adding priced lesson types or collecting payments.</p><Link href={`/schools/${schoolId}/payments`} className="mt-4 inline-flex rounded-control border border-brand px-4 py-2 text-sm text-brand transition hover:bg-brand hover:text-canvas">Set up payments →</Link></>}</div>
          <div className="rounded-control bg-surface p-5 sm:p-6"><h3 className="text-lg font-medium">Lesson types</h3>
            {query.created ? <p className="mt-4 text-sm text-brand">Lesson type added.</p> : null}
            {products.length ? <div className="mt-4 space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 rounded-control bg-canvas/55 px-4 py-3"><span className="text-sm font-medium">{product.name}</span><span className="text-xs text-muted">{product.duration_minutes} min · {money(product.price_cents, product.currency)}</span></div>)}</div> : <p className="mt-4 text-sm text-muted">No lesson types yet.</p>}
            {paymentsReady ? <div className="mt-5"><FocusedModal triggerLabel="Add lesson type +" eyebrow="Lesson type" title="Add a lesson type" description="Set its length, frequency, and price."><ProductForm schoolId={schoolId} returnPath={`/schools/${schoolId}/onboarding?step=payments`} /></FocusedModal></div> : null}
          </div>
        </div></div>

        <div><StepHeading icon={MdRoute} title="From a new student to getting paid">Common Time keeps the monthly journey clear while you stay focused on teaching and the people you serve. Open a question whenever you want more detail.</StepHeading><div className="text-center"><BillingWalkthrough />{school.onboarding_completed_at ? <Link href={`/schools/${schoolId}`} className="mt-8 inline-flex rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Return to my school</Link> : !hasStudent ? <p className="mt-7 text-sm text-danger">Add the first student and payer before finishing setup.</p> : <form action={finishOnboarding.bind(null, schoolId)} className="mt-8"><button className="rounded-control bg-ink px-7 py-3 text-sm font-medium text-canvas">Finish setup</button>{query.finish ? <p className="mt-3 text-sm text-danger">Setup could not be completed. Reload and try again.</p> : null}</form>}</div></div>
      </OnboardingStepper>
    </main>
  );
}
