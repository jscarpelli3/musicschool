import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SchoolManagementNav } from "@/components/schools/school-management-nav";
import { createClient } from "@/lib/supabase/server";
import { AppSignOut } from "@/components/auth/app-sign-out";

export const dynamic = "force-dynamic";

export default async function SchoolLayout({ children, params }: { children: ReactNode; params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);
  const [{ data: school }, { data: membership }, { data: profile }, approvalCountResult] = await Promise.all([
    supabase.from("schools").select("id, name, timezone, family_billing_mode, logo_path, theme_key").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("avatar_url, avatar_path").eq("id", profileId).maybeSingle(),
    supabase.from("lesson_schedule_proposals").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("proposal_kind","reschedule").eq("status","pending_owner"),
  ]);
  if (!school || !membership) notFound();
  const [{ data: avatar }, { data: logo }] = await Promise.all([
    profile?.avatar_path ? supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600) : Promise.resolve({ data: null }),
    school.logo_path ? supabase.storage.from("school-logos").createSignedUrl(school.logo_path, 3600) : Promise.resolve({ data: null }),
  ]);
  const avatarUrl = avatar?.signedUrl ?? profile?.avatar_url;
  return <div data-school-theme={school.theme_key} className="min-h-screen bg-canvas text-ink">
    <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 sm:pt-10">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-7">
        <Link href={`/schools/${schoolId}`} className="flex min-w-0 items-center gap-4">
          {logo?.signedUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={logo.signedUrl} alt={`${school.name} logo`} className="h-14 w-14 shrink-0 rounded-card border border-line bg-surface object-contain p-2" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-card border border-line bg-surface text-xl font-semibold text-brand">{school.name.slice(0,1).toUpperCase()}</span>}
          <span className="min-w-0"><span className="block text-xs capitalize text-muted">{membership.role}</span><span className="mt-2 block truncate font-display text-3xl sm:text-4xl">{school.name}</span><span className="mt-1 hidden text-xs text-muted sm:block">{school.timezone} · {school.family_billing_mode.replaceAll("_"," ")}</span></span>
        </Link>
        <div className="flex shrink-0 items-start gap-3"><Link href="/profile" aria-label="Profile settings" className="flex items-center gap-3 py-control text-sm text-muted hover:text-ink">{avatarUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={avatarUrl} alt="Your avatar" className="h-10 w-10 rounded-full border border-line object-cover" /> : null}<span className="hidden sm:inline">Profile</span></Link><AppSignOut /></div>
      </header>
      <SchoolManagementNav schoolId={schoolId} role={membership.role} approvalCount={approvalCountResult.count??0} />
    </div>
    {children}
  </div>;
}
