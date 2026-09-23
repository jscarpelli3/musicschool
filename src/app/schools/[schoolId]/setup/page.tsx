import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { InstrumentCatalogForm } from "@/components/school-setup/instrument-catalog-form";
import { SchoolLogoUploader } from "@/components/school-setup/school-logo-uploader";
import { createClient } from "@/lib/supabase/server";
import { updateSchoolInfo } from "./actions";
import { updateSchoolInstrumentCatalog } from "./instrument-actions";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";

export const dynamic = "force-dynamic";
const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export default async function SchoolInfoPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ status?: string; media?: string; instruments?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/setup`);

  const [{ data: school }, { data: membership }, { data: instruments },capabilities] = await Promise.all([
    supabase.from("schools").select("id, name, logo_path, phone, reply_to_email, address_line_1, address_line_2, city, region, postal_code, timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_instruments").select("name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    loadMySchoolCapabilities(schoolId),
  ]);
  if (!school || !membership) notFound();
  if (!capabilities.has("school.setup.manage")) redirect(`/schools/${schoolId}`);

  const { data: logo } = school.logo_path
    ? await supabase.storage.from("school-logos").createSignedUrl(school.logo_path, 3600)
    : { data: null };
  const logoMessage = query.media === "logo-updated"
    ? { text: "School logo updated.", error: false }
    : query.media === "invalid-logo"
      ? { text: "Choose a JPG, PNG, or WebP image no larger than 2 MB.", error: true }
      : query.media === "logo-error"
        ? { text: "The school logo could not be saved.", error: true }
        : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="info" />
      {query.status ? <p className={`mt-5 rounded-md bg-surface-raised px-4 py-3 text-sm ${query.status === "saved" ? "text-brand" : "text-danger"}`}>{query.status === "saved" ? "School information saved." : "School information could not be saved."}</p> : null}
      {logoMessage ? <p className={`mt-5 rounded-md bg-surface-raised px-4 py-3 text-sm ${logoMessage.error ? "text-danger" : "text-brand"}`}>{logoMessage.text}</p> : null}
      {query.instruments ? <p role="status" className={`mt-5 rounded-md bg-surface-raised px-4 py-3 text-sm ${query.instruments === "saved" ? "text-brand" : "text-danger"}`}>{query.instruments === "saved" ? "School instruments saved." : "The instrument list could not be saved."}</p> : null}
      <section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8">
        <div>
          <h2 className="font-display text-3xl">Identity</h2>
          <p className="mt-3 text-sm leading-6 text-muted">The details families and staff use to recognize and contact the school.</p>
        </div>
        <div>
          <div className="flex items-center gap-6">
            {logo?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.signedUrl} alt={`${school.name} logo`} className="h-24 w-24 border border-line object-contain p-3" />
            ) : <div className="grid h-24 w-24 place-items-center border border-line font-display text-4xl text-brand">{school.name[0]}</div>}
            <SchoolLogoUploader schoolId={schoolId} />
          </div>
        </div>
      </section>
      <form action={updateSchoolInfo.bind(null, schoolId)} className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8">
        <div>
          <h2 className="font-display text-3xl">Contact</h2>
          <p className="mt-3 text-sm text-muted">Timezone: {school.timezone}</p>
        </div>
        <div className="grid gap-7 md:grid-cols-2">
          <label className="md:col-span-2"><span className="text-xs text-muted">School name</span><input required name="name" defaultValue={school.name} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Phone number</span><input name="phone" type="tel" defaultValue={school.phone ?? ""} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Email replies go to</span><input name="reply_to_email" type="email" autoComplete="email" defaultValue={school.reply_to_email ?? ""} className={field} /><span className="mt-2 block text-xs leading-5 text-muted">Families and teachers can reply here. Messages still come from Common Time’s authenticated notification address.</span></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Address</span><input name="address_line_1" defaultValue={school.address_line_1 ?? ""} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Suite or unit</span><input name="address_line_2" defaultValue={school.address_line_2 ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">City</span><input name="city" defaultValue={school.city ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">State / region</span><input name="region" defaultValue={school.region ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">Postal code</span><input name="postal_code" defaultValue={school.postal_code ?? ""} className={field} /></label>
          <div className="flex items-end"><button className="rounded-md bg-brand px-4 py-2.5 text-sm text-surface transition hover:opacity-90">Save school info</button></div>
        </div>
      </form>
      <section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[1fr_2fr] md:gap-12 md:p-8">
        <div><h2 className="font-display text-3xl">Instruments</h2><p className="mt-3 text-sm leading-6 text-muted">Choose the instruments this school teaches. Staff profiles use this shared catalog.</p></div>
        <div><InstrumentCatalogForm instruments={(instruments ?? []).map((item) => item.name)} action={updateSchoolInstrumentCatalog.bind(null, schoolId)} /></div>
      </section>
    </main>
  );
}
