import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { ThemeSelector } from "@/components/school-setup/theme-selector";
import { createClient } from "@/lib/supabase/server";
import { isSchoolThemeKey } from "@/lib/ui/school-themes";
import { uploadSchoolLogo } from "../media-actions";
import { updateSchoolInfo, updateSchoolTheme } from "./actions";

export const dynamic = "force-dynamic";
const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export default async function SchoolInfoPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ status?: string; media?: string; theme?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/setup`);

  const [{ data: school }, { data: membership }] = await Promise.all([
    supabase.from("schools").select("id, name, logo_path, phone, address_line_1, address_line_2, city, region, postal_code, timezone, theme_key").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
  ]);
  if (!school || !membership) notFound();
  if (membership.role !== "owner" && membership.role !== "admin") redirect(`/schools/${schoolId}`);

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
      {query.status ? <p className={`border-b border-line py-4 text-sm ${query.status === "saved" ? "text-brand" : "text-danger"}`}>{query.status === "saved" ? "School information saved." : "School information could not be saved."}</p> : null}
      {logoMessage ? <p className={`border-b border-line py-4 text-sm ${logoMessage.error ? "text-danger" : "text-brand"}`}>{logoMessage.text}</p> : null}
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Identity</h2>
          <p className="mt-3 text-sm leading-6 text-muted">The details families and staff use to recognize and contact the school.</p>
        </div>
        <div className="py-10 md:pl-10">
          <div className="flex items-center gap-6">
            {logo?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.signedUrl} alt={`${school.name} logo`} className="h-24 w-24 border border-line object-contain p-3" />
            ) : <div className="grid h-24 w-24 place-items-center border border-line font-display text-4xl text-brand">{school.name[0]}</div>}
            <form action={uploadSchoolLogo.bind(null, schoolId)}>
              <input type="hidden" name="return_path" value={`/schools/${schoolId}/setup`} />
              <input required name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="block max-w-60 text-sm text-muted file:mr-3 file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-ink" />
              <button className="mt-4 border-b border-brand pb-1 text-sm text-brand">Update logo</button>
            </form>
          </div>
        </div>
      </section>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Palette</h2><p className="mt-3 text-sm leading-6 text-muted">A complete, contrast-tested color system for this school’s workspace.</p>{query.theme ? <p role="status" className={`mt-4 text-sm ${query.theme === "saved" ? "text-brand" : "text-danger"}`}>{query.theme === "saved" ? "Palette updated." : "The palette could not be updated."}</p> : null}</div>
        {membership.role === "owner" ? <ThemeSelector currentTheme={isSchoolThemeKey(school.theme_key) ? school.theme_key : "midnight"} action={updateSchoolTheme.bind(null, schoolId)} /> : <p className="py-10 text-sm text-muted md:pl-10">Only the school owner can change the workspace palette.</p>}
      </section>
      <form action={updateSchoolInfo.bind(null, schoolId)} className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Contact</h2>
          <p className="mt-3 text-sm text-muted">Timezone: {school.timezone}</p>
        </div>
        <div className="grid gap-7 py-10 md:grid-cols-2 md:pl-10">
          <label className="md:col-span-2"><span className="text-xs text-muted">School name</span><input required name="name" defaultValue={school.name} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Phone number</span><input name="phone" type="tel" defaultValue={school.phone ?? ""} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Address</span><input name="address_line_1" defaultValue={school.address_line_1 ?? ""} className={field} /></label>
          <label className="md:col-span-2"><span className="text-xs text-muted">Suite or unit</span><input name="address_line_2" defaultValue={school.address_line_2 ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">City</span><input name="city" defaultValue={school.city ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">State / region</span><input name="region" defaultValue={school.region ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">Postal code</span><input name="postal_code" defaultValue={school.postal_code ?? ""} className={field} /></label>
          <div className="flex items-end"><button className="border-b border-brand pb-2 text-sm text-brand">Save school info →</button></div>
        </div>
      </form>
    </main>
  );
}
