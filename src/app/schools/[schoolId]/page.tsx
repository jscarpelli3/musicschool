import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OwnerPlanner } from "@/components/planner/owner-planner";
import { StudentRosterTable, type LessonOutcome, type RosterViewSettings, type StudentRosterRow } from "@/components/students/student-roster-table";
import { createClient } from "@/lib/supabase/server";
import { saveStudentRosterView } from "./dashboard-actions";

export const dynamic = "force-dynamic";

export default async function SchoolDashboard({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);

  const [{ data: school }, { data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, slug, timezone, family_billing_mode, logo_path")
      .eq("id", schoolId)
      .maybeSingle(),
    supabase
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, email, avatar_url, avatar_path")
      .eq("id", profileId)
      .maybeSingle(),
  ]);

  if (!school || !membership) notFound();

  const dashboardQueries = await Promise.all([
    supabase.from("teachers").select("person_id").eq("school_id", schoolId),
    supabase.from("students").select("person_id").eq("school_id", schoolId),
    supabase.from("people").select("id, first_name, last_name, preferred_name, profile_id, email, phone").eq("school_id", schoolId),
    supabase
      .from("teacher_availability_rules")
      .select("id, teacher_id, weekday, start_time, end_time, effective_from, effective_until")
      .eq("school_id", schoolId),
    supabase
      .from("lesson_events")
      .select("id, product_id, teacher_id, student_id, starts_at, ends_at, status, cancellation_timing, notes, place_id, reschedule_allowed, reschedule_blocked_reason, reschedule_reason_code, reschedule_reason_detail")
      .eq("school_id", schoolId)
      .order("starts_at"),
    supabase.from("service_products").select("id, name, sessions_per_interval, interval_count, interval_unit").eq("school_id", schoolId),
    supabase
      .from("student_contacts")
      .select("student_id, contact_person_id, relationship, is_primary, is_billing_contact")
      .eq("school_id", schoolId),
    supabase
      .from("billing_account_students")
      .select("student_id, billing_account_id")
      .eq("school_id", schoolId),
    supabase
      .from("billing_accounts")
      .select("id, name, billing_contact_person_id")
      .eq("school_id", schoolId),
    supabase.from("lesson_places").select("id, name, details").eq("school_id", schoolId),
    supabase.from("user_view_preferences").select("settings").eq("school_id", schoolId).eq("profile_id", profileId).eq("view_key", "student_roster").maybeSingle(),
    supabase.from("lesson_event_price_snapshots").select("lesson_event_id, billing_service_date").eq("school_id", schoolId),
  ]);

  const failedDashboardQuery = dashboardQueries.find((result) => result.error);
  if (failedDashboardQuery?.error) throw new Error(`The dashboard could not load: ${failedDashboardQuery.error.message}`);

  const [
    { data: teacherRows },
    { data: studentRows },
    { data: peopleRows },
    { data: availabilityRows },
    { data: lessonRows },
    { data: productRows },
    { data: contactRows },
    { data: billingLinkRows },
    { data: billingAccountRows },
    { data: placeRows },
    { data: rosterPreference },
    { data: lessonPriceSnapshots },
  ] = dashboardQueries;

  const people = new Map((peopleRows ?? []).map((person) => [person.id, person]));
  const teachers = (teacherRows ?? []).flatMap(({ person_id }) => {
    const person = people.get(person_id);
    return person
      ? [{
          id: person.id,
          name: `${person.preferred_name || person.first_name} ${person.last_name}`,
          isOwner: person.profile_id === profileId,
        }]
      : [];
  }).sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));
  const studentNames = Object.fromEntries((studentRows ?? []).flatMap(({ person_id }) => {
    const person = people.get(person_id);
    return person ? [[person.id, `${person.preferred_name || person.first_name} ${person.last_name}`]] : [];
  }));
  const productNames = Object.fromEntries((productRows ?? []).map((product) => [product.id, product.name]));
  const products = new Map((productRows ?? []).map((product) => [product.id, product]));
  const placeDetails = Object.fromEntries((placeRows ?? []).map((place) => [place.id, { name: place.name, details: place.details }]));
  const billingAccounts = new Map((billingAccountRows ?? []).map((account) => [account.id, account]));
  const studentDetails = Object.fromEntries((studentRows ?? []).flatMap(({ person_id }) => {
    const student = people.get(person_id);
    if (!student) return [];
    const displayName = `${student.preferred_name || student.first_name} ${student.last_name}`;
    const contacts = (contactRows ?? [])
      .filter((contact) => contact.student_id === person_id)
      .flatMap((contact) => {
        const person = people.get(contact.contact_person_id);
        return person ? [{
          name: `${person.preferred_name || person.first_name} ${person.last_name}`,
          relationship: contact.relationship,
          isPrimary: contact.is_primary,
          isBillingContact: contact.is_billing_contact,
          email: person.email,
          phone: person.phone,
        }] : [];
      });
    const payers = (billingLinkRows ?? [])
      .filter((link) => link.student_id === person_id)
      .flatMap((link) => {
        const account = billingAccounts.get(link.billing_account_id);
        const payer = account ? people.get(account.billing_contact_person_id) : null;
        return account && payer ? [{
          accountId: account.id,
          accountName: account.name,
          name: `${payer.preferred_name || payer.first_name} ${payer.last_name}`,
          email: payer.email,
          phone: payer.phone,
          selfPaying: payer.id === person_id,
          relationship: payer.id === person_id
            ? "self"
            : (contactRows ?? []).find((contact) => contact.student_id === person_id && contact.contact_person_id === payer.id)?.relationship ?? "payer",
        }] : [];
      });
    return [[person_id, { name: displayName, email: student.email, phone: student.phone, contacts, payers }]];
  }));
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: school.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const todayPart = (type: string) => todayParts.find((part) => part.type === type)?.value;
  const initialDate = `${todayPart("year")}-${todayPart("month")}-${todayPart("day")}`;
  const monthKey = initialDate.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: school.timezone }).format(new Date());
  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const billingDates = new Map((lessonPriceSnapshots ?? []).map((snapshot) => [snapshot.lesson_event_id, snapshot.billing_service_date]));
  const occurrenceParts = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: school.timezone,
      year: "numeric",
      month: "2-digit",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const weekday = get("weekday");
    const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(weekday);
    return {
      month: `${get("year")}-${get("month")}`,
      weekday,
      dayOrder: dayIndex < 0 ? 7 : dayIndex,
      minutes: Number(get("hour")) * 60 + Number(get("minute")),
    };
  };
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", {
    timeZone: school.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  const now = new Date().getTime();
  const studentRowsForTable: StudentRosterRow[] = (studentRows ?? []).flatMap(({ person_id }) => {
    const student = people.get(person_id);
    const details = studentDetails[person_id];
    if (!student || !details) return [];
    const studentLessons = (lessonRows ?? []).filter((lesson) => lesson.student_id === person_id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const representative = studentLessons.find((lesson) => new Date(lesson.starts_at).getTime() >= now) ?? studentLessons.at(-1);
    const product = representative ? products.get(representative.product_id) : null;
    const place = representative ? placeDetails[representative.place_id]?.name : null;
    const teacher = representative ? teacherNames.get(representative.teacher_id) : null;
    const schedule = representative ? occurrenceParts(representative.starts_at) : null;
    const frequency = product?.sessions_per_interval === 1 && product.interval_count === 1 && product.interval_unit === "week"
      ? "Every"
      : product
        ? `${product.sessions_per_interval} lessons every ${product.interval_count === 1 ? "" : `${product.interval_count} `}${product.interval_unit}`
        : "No recurring plan";
    const payer = details.payers[0];
    const primary = details.contacts.find((contact) => contact.isPrimary) ?? details.contacts[0];
    const monthLessons = studentLessons.filter((lesson) => occurrenceParts(lesson.starts_at).month === monthKey).map((lesson) => {
      let outcome: LessonOutcome;
      if (lesson.status === "completed") outcome = "completed";
      else if (lesson.status === "rescheduled") outcome = "rescheduled";
      else if (lesson.status === "cancelled") outcome = lesson.cancellation_timing === "timely" ? "cancelled_timely" : "cancelled_late";
      else if (lesson.status === "no_show") outcome = "no_show";
      else outcome = new Date(lesson.starts_at).getTime() >= now ? "upcoming" : "unrecorded";
      return { id: lesson.id, outcome };
    });
    return [{
      id: person_id,
      billingAccountId: payer?.accountId ?? null,
      schoolId,
      family: payer?.accountName ?? `${student.last_name} family`,
      student: details.name,
      studentFirst: student.preferred_name || student.first_name,
      studentLast: student.last_name,
      parent: payer?.selfPaying
        ? "Self-paying · self"
        : `${payer?.name ?? primary?.name ?? "—"}${payer?.relationship || primary?.relationship ? ` · ${payer?.relationship ?? primary?.relationship}` : ""}`,
      payerName: payer?.name ?? primary?.name ?? details.name,
      payerRelationship: payer?.relationship ?? primary?.relationship ?? (payer?.selfPaying ? "self" : "payer"),
      day: representative && schedule ? `${frequency} ${schedule.weekday}` : "—",
      dayOrder: schedule?.dayOrder ?? 7,
      time: representative ? `${time(representative.starts_at)}–${time(representative.ends_at)}` : "—",
      timeMinutes: schedule?.minutes ?? 1440,
      teacher: teacher ?? "Unassigned",
      place: place?.toUpperCase() ?? "Unassigned",
      lessons: monthLessons,
    }];
  }).sort((a, b) => a.family.localeCompare(b.family) || a.student.localeCompare(b.student));

  const [{ data: avatar }, { data: logo }] = await Promise.all([
    profile?.avatar_path
      ? supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600)
      : Promise.resolve({ data: null }),
    school.logo_path
      ? supabase.storage.from("school-logos").createSignedUrl(school.logo_path, 3600)
      : Promise.resolve({ data: null }),
  ]);
  const avatarUrl = avatar?.signedUrl ?? profile?.avatar_url;
  const canManageSchool = membership.role === "owner" || membership.role === "admin";
  const currentTeacherId = membership.role === "teacher"
    ? (peopleRows ?? []).find((person) => person.profile_id === profileId)?.id ?? null
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-section">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          {logo?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo.signedUrl}
              alt={`${school.name} logo`}
              className="h-16 w-16 rounded-card border border-line bg-surface object-contain p-2"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-card border border-line bg-surface text-xl font-semibold text-brand">
              {school.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
          <p className="text-sm capitalize text-muted">{membership.role}</p>
          <h1 className="mt-3 font-display text-5xl font-normal tracking-[-0.035em]">{school.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {school.timezone} · {school.family_billing_mode.replaceAll("_", " ")}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile" aria-label="Profile settings" className="flex items-center gap-3 text-sm text-muted hover:text-ink">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Your avatar" className="h-10 w-10 rounded-full border border-line object-cover" />
          ) : null}
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-control border border-line px-4 py-control text-sm text-muted transition hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <nav className="flex gap-8 py-6" aria-label="School management">
        {canManageSchool ? (
          <Link href={`/schools/${schoolId}/lessons/new`} className="text-sm text-brand hover:text-brand-hover">
            New lesson +
          </Link>
        ) : null}
        {canManageSchool ? (
          <Link href={`/schools/${schoolId}/setup`} className="text-sm text-brand hover:text-brand-hover">
            School setup →
          </Link>
        ) : null}
      </nav>
      <StudentRosterTable
        rows={studentRowsForTable}
        monthLabel={monthLabel}
        initialView={rosterPreference?.settings as Partial<RosterViewSettings> | null}
        saveView={saveStudentRosterView.bind(null, schoolId)}
      />
      <OwnerPlanner
        schoolId={schoolId}
        canReschedule={canManageSchool}
        initialDate={initialDate}
        timezone={school.timezone}
        teachers={teachers}
        studentNames={studentNames}
        studentDetails={studentDetails}
        productNames={productNames}
        placeDetails={placeDetails}
        availability={availabilityRows ?? []}
        lessons={(lessonRows ?? []).map((lesson) => ({
          ...lesson,
          billing_service_date: billingDates.get(lesson.id) ?? lesson.starts_at.slice(0, 10),
          can_reschedule: lesson.reschedule_allowed && lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() > now,
          can_mark_reschedule: canManageSchool || currentTeacherId === lesson.teacher_id,
        }))}
      />
    </main>
  );
}
