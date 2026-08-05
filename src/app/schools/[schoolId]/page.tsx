import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OwnerPlanner } from "@/components/planner/owner-planner";
import { createClient } from "@/lib/supabase/server";
import { uploadAvatar, uploadSchoolLogo } from "./media-actions";

export const dynamic = "force-dynamic";

export default async function SchoolDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ media?: string }>;
}) {
  const { schoolId } = await params;
  const { media } = await searchParams;
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
  ] = await Promise.all([
    supabase.from("teachers").select("person_id").eq("school_id", schoolId),
    supabase.from("students").select("person_id").eq("school_id", schoolId),
    supabase.from("people").select("id, first_name, last_name, preferred_name, profile_id, email, phone").eq("school_id", schoolId),
    supabase
      .from("teacher_availability_rules")
      .select("id, teacher_id, weekday, start_time, end_time, effective_from, effective_until")
      .eq("school_id", schoolId),
    supabase
      .from("lesson_events")
      .select("id, product_id, teacher_id, student_id, starts_at, ends_at, status, notes, place_id")
      .eq("school_id", schoolId)
      .order("starts_at"),
    supabase.from("service_products").select("id, name").eq("school_id", schoolId),
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
  ]);

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
          accountName: account.name,
          name: `${payer.preferred_name || payer.first_name} ${payer.last_name}`,
          email: payer.email,
          phone: payer.phone,
          selfPaying: payer.id === person_id,
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
  const mediaMessage =
    media === "avatar-updated"
      ? "Avatar updated."
      : media === "logo-updated"
        ? "School logo updated."
        : media?.startsWith("invalid-")
          ? "Choose a JPG, PNG, or WebP image no larger than 2 MB."
          : media?.endsWith("-error")
            ? "The image could not be saved. Please try again."
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
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Your avatar" className="h-10 w-10 rounded-full border border-line object-cover" />
          ) : null}
          <form action="/auth/signout" method="post">
            <button className="rounded-control border border-line px-4 py-control text-sm text-muted transition hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {mediaMessage ? (
        <p className={`mt-6 rounded-control border p-3 text-sm ${media?.endsWith("updated") ? "border-brand/30 text-brand" : "border-danger/30 text-danger"}`}>
          {mediaMessage}
        </p>
      ) : null}
      <nav className="flex gap-8 py-6" aria-label="School management">
        <Link href="/" className="text-sm text-brand hover:text-brand-hover">
          Switch school
        </Link>
        {canManageSchool ? (
          <Link href={`/schools/${schoolId}/products`} className="text-sm text-brand hover:text-brand-hover">
            Set up products →
          </Link>
        ) : null}
        <Link href={`/schools/${schoolId}/places`} className="text-sm text-brand hover:text-brand-hover">
          Places →
        </Link>
      </nav>
      <OwnerPlanner
        initialDate={initialDate}
        timezone={school.timezone}
        teachers={teachers}
        studentNames={studentNames}
        studentDetails={studentDetails}
        productNames={productNames}
        placeDetails={placeDetails}
        availability={availabilityRows ?? []}
        lessons={lessonRows ?? []}
      />
      <section className="grid border-t border-line py-section md:grid-cols-2 md:divide-x md:divide-line">
        <form
          action={uploadAvatar.bind(null, schoolId)}
          className="pb-10 md:pr-10 md:pb-0"
        >
          <h2 className="font-display text-2xl font-normal">Your avatar</h2>
          <p className="mt-2 text-sm text-muted">JPG, PNG, or WebP. Maximum 2 MB.</p>
          <input
            required
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-5 block w-full text-sm text-muted file:mr-4 file:rounded-control file:border-0 file:bg-surface-raised file:px-4 file:py-control file:text-ink"
          />
          <button className="mt-5 rounded-control bg-brand px-4 py-control text-sm font-medium text-zinc-950 hover:bg-brand-hover">
            Upload avatar
          </button>
        </form>
        {canManageSchool ? (
          <form
            action={uploadSchoolLogo.bind(null, schoolId)}
            className="border-t border-line pt-10 md:border-t-0 md:pt-0 md:pl-10"
          >
            <h2 className="font-display text-2xl font-normal">School logo</h2>
            <p className="mt-2 text-sm text-muted">Visible to members of this school. Maximum 2 MB.</p>
            <input
              required
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-5 block w-full text-sm text-muted file:mr-4 file:rounded-control file:border-0 file:bg-surface-raised file:px-4 file:py-control file:text-ink"
            />
            <button className="mt-5 rounded-control bg-brand px-4 py-control text-sm font-medium text-zinc-950 hover:bg-brand-hover">
              Upload logo
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
