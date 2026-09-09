import { createClient } from "@/lib/supabase/server";
import { LessonCalendar } from "@/components/calendar/lesson-calendar";
import { PortalAuth } from "./portal-auth";
import { PortalSignOut } from "./portal-sign-out";
import { CalendarSubscription } from "./calendar-subscription";
import { AutomaticPaymentSettings } from "./automatic-payment-settings";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return <main className="flex min-h-screen items-center px-5 py-16 sm:px-8"><PortalAuth /></main>;

  const email = typeof auth.claims.email === "string" ? auth.claims.email : "your verified email";
  const { data: accessState, error: accessError } = await supabase.rpc("current_client_portal_access_state");
  if (accessError) throw new Error(`Portal access could not be checked: ${accessError.message}`);

  if (accessState !== "ready") return <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex items-end justify-between border-b border-line pb-7"><div><p className="text-sm text-brand">Family scheduling</p><h1 className="mt-3 font-display text-5xl">{accessState === "ambiguous" ? "Account needs attention" : "Portal not set up"}</h1></div><PortalSignOut label="Use a different email" /></header>
    <section className="mt-10 border border-line p-8"><p className="text-sm leading-6">{accessState === "ambiguous" ? "More than one family account uses this email. Please contact the school for help." : <>The family portal for <strong>{email}</strong> has not been set up yet.</>}</p><p className="mt-3 text-sm leading-6 text-muted">Check that you used the email address your school has on file, or contact the school for help.</p></section>
  </main>;

  const [{ data: lessons, error }, { data: calendarAccounts, error: calendarError }, { data: collectionAccounts, error: collectionError }] = await Promise.all([
    supabase.rpc("get_client_portal_lessons"),
    supabase.rpc("get_client_portal_calendar_accounts"),
    supabase.rpc("get_client_portal_collection_accounts"),
  ]);
  if (error) throw new Error(`Portal schedule could not load: ${error.message}`);
  if (calendarError) throw new Error(`Portal calendar access could not load: ${calendarError.message}`);
  if (collectionError) throw new Error(`Portal payment settings could not load: ${collectionError.message}`);
  const rangeStart = new Date();
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 3);
  const schools = new Map<string, { name: string; timeZone: string; lessons: NonNullable<typeof lessons> }>();
  for (const lesson of lessons ?? []) {
    const school = schools.get(lesson.school_id) ?? { name: lesson.school_name, timeZone: lesson.school_timezone, lessons: [] };
    school.lessons.push(lesson);
    schools.set(lesson.school_id, school);
  }

  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
    <header className="flex items-end justify-between gap-6 border-b border-line pb-7"><div><p className="text-sm text-brand">Family scheduling</p><h1 className="mt-3 font-display text-5xl">Upcoming lessons</h1><p className="mt-3 text-xs text-muted">Signed in as {email}</p></div><PortalSignOut label="Use a different email" /></header>
    <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">Scheduled lessons for the next three months. On phones, the same calendar becomes a compact agenda for easier reading.</p>
    {collectionAccounts?.some((account) => account.mandate_status === "active") ? <section className="mt-10">
      <p className="text-sm text-brand">Payment preferences</p>
      <h2 className="mt-2 font-display text-3xl">Automatic payment</h2>
      <div className="mt-6 grid gap-5">{collectionAccounts.filter((account) => account.mandate_status === "active" && account.accepted_at).map((account) => <AutomaticPaymentSettings
        key={account.mandate_id}
        schoolId={account.school_id}
        schoolName={account.school_name}
        billingAccountId={account.billing_account_id}
        billingAccountName={account.billing_account_name}
        currency={account.currency!}
        paymentMethodLabel={account.payment_method_label}
        paymentMethodLastFour={account.payment_method_last_four}
        monthlyCapCents={account.monthly_cap_cents}
        advanceNoticeDays={account.advance_notice_days!}
        acceptedAt={account.accepted_at!}
      />)}</div>
    </section> : null}
    <div className="mt-10 space-y-section">{lessons?.length ? Array.from(schools.entries()).map(([schoolId, school]) => <section key={schoolId}>
      {schools.size > 1 ? <header className="mb-8 border-b border-line pb-4"><h2 className="font-display text-3xl">{school.name}</h2><p className="mt-2 text-xs text-muted">Times shown in {school.timeZone}</p></header> : null}
      <div className="mb-8"><CalendarSubscription schoolId={schoolId} schoolName={school.name} active={calendarAccounts?.find((account) => account.school_id === schoolId)?.subscription_active ?? false} /></div>
      <LessonCalendar
        id={`family-lessons-${schoolId}`}
        lessons={school.lessons.map((lesson) => ({ lessonId: lesson.lesson_id, studentName: lesson.student_name, teacherName: lesson.teacher_name, productName: lesson.product_name, placeName: lesson.place_name, startsAt: lesson.starts_at, endsAt: lesson.ends_at }))}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        timeZone={school.timeZone}
      />
    </section>) : <section className="border-t border-line py-8"><h2 className="font-display text-3xl">No upcoming lessons</h2><p className="mt-3 text-sm leading-6 text-muted">No scheduled lessons were found for this family during the next three months.</p>{calendarAccounts?.map((account) => <div key={account.school_id} className="mt-8"><CalendarSubscription schoolId={account.school_id} schoolName={account.school_name} active={account.subscription_active} /></div>)}</section>}</div>
  </main>;
}
