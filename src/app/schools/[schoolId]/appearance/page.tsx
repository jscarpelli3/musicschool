import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/school-setup/setup-header";
import { ThemeSelector } from "@/components/school-setup/theme-selector";
import { FontSelector } from "@/components/school-setup/font-selector";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { isSchoolThemeKey } from "@/lib/ui/school-themes";
import { isSchoolFontKey } from "@/lib/ui/school-fonts";
import { updateSchoolFont, updateSchoolTheme } from "../setup/actions";

export const dynamic = "force-dynamic";

export default async function AppearancePage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { schoolId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/appearance`);

  const [{ data: school }, { data: membership }, capabilities] = await Promise.all([
    supabase.from("schools").select("id, name, theme_key, font_key").eq("id", schoolId).maybeSingle(),
    supabase
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);
  if (!school || !membership) notFound();
  if (!capabilities.has("school.appearance.manage")) redirect(`/schools/${schoolId}`);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8 sm:py-section">
      <SetupHeader schoolId={schoolId} schoolName={school.name} active="appearance" />
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Workspace palette</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Choose a complete, contrast-tested color system for this school’s workspace.
          </p>
          {query.status ? (
            <p
              role="status"
              className={`mt-4 text-sm ${query.status === "saved" ? "text-brand" : "text-danger"}`}
            >
              {query.status === "saved" ? `${query.type === "font" ? "Typography" : "Palette"} updated.` : `The ${query.type === "font" ? "typography" : "palette"} could not be updated.`}
            </p>
          ) : null}
        </div>
        {capabilities.has("school.appearance.palette_manage") ? (
          <ThemeSelector
            currentTheme={isSchoolThemeKey(school.theme_key) ? school.theme_key : "midnight"}
            action={updateSchoolTheme.bind(null, schoolId)}
          />
        ) : (
          <p className="py-10 text-sm text-muted md:pl-10">
            Only the school owner can change the workspace palette.
          </p>
        )}
      </section>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10"><h2 className="font-display text-3xl">Typography</h2><p className="mt-3 text-sm leading-6 text-muted">Choose the voice used for headings and everyday interface text across this school.</p></div>
        {capabilities.has("school.appearance.palette_manage") ? <FontSelector currentFont={isSchoolFontKey(school.font_key) ? school.font_key : "editorial"} action={updateSchoolFont.bind(null, schoolId)} /> : <p className="py-10 text-sm text-muted md:pl-10">Only the school owner can change shared typography.</p>}
      </section>
    </main>
  );
}
