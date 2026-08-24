import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import { AvatarUploader } from "./avatar-uploader";

export const dynamic = "force-dynamic";
const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

const messages: Record<string, { text: string; error?: boolean }> = {
  "avatar-updated": { text: "Avatar updated." },
  "profile-updated": { text: "Profile updated." },
  "invalid-avatar": { text: "Choose a JPG, PNG, or WebP image no larger than 2 MB.", error: true },
  "avatar-error": { text: "The avatar could not be saved.", error: true },
  "invalid-profile": { text: "Check your name and phone number.", error: true },
  "profile-error": { text: "The profile could not be saved.", error: true },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect("/login?next=/profile");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone, avatar_url, avatar_path").eq("id", profileId).maybeSingle(),
    supabase.from("school_members").select("schools(id, name)").eq("profile_id", profileId).eq("status", "active").limit(1),
  ]);
  if (!profile) redirect("/login");

  const { data: avatar } = profile.avatar_path
    ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  const avatarUrl = avatar?.signedUrl ?? profile.avatar_url;
  const school = memberships?.[0]?.schools;
  const message = status ? messages[status] : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8 sm:py-section">
      <header className="grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_2fr] md:items-end">
        <Link href={school ? `/schools/${school.id}` : "/"} className="text-sm text-muted hover:text-ink">← {school?.name ?? "Home"}</Link>
        <div>
          <p className="text-sm text-muted">Personal settings</p>
          <h1 className="mt-3 font-display text-5xl tracking-[-0.04em] sm:text-6xl">Your profile.</h1>
        </div>
      </header>
      {message ? <p className={`border-b border-line py-4 text-sm ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</p> : null}

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Avatar</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Your image follows you across the schools where you work.</p>
        </div>
        <div className="py-10 md:pl-10"><AvatarUploader currentUrl={avatarUrl ?? null} initial={profile.full_name?.[0] ?? "?"} /></div>
      </section>

      <form action={updateProfile} className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h2 className="font-display text-3xl">Contact</h2>
          <p className="mt-3 text-sm text-muted">{profile.email}</p>
        </div>
        <div className="grid gap-8 py-10 md:pl-10">
          <label><span className="text-xs text-muted">Full name</span><input required name="full_name" defaultValue={profile.full_name ?? ""} className={field} /></label>
          <label><span className="text-xs text-muted">Phone number</span><input name="phone" type="tel" defaultValue={profile.phone ?? ""} className={field} /></label>
          <div><button className="border-b border-brand pb-2 text-sm text-brand">Save profile →</button></div>
        </div>
      </form>
    </main>
  );
}
