"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

export async function uploadAvatar(formData: FormData) {
  const image = formData.get("avatar");
  if (!(image instanceof File) || image.size <= 0 || image.size > maxBytes || !allowedTypes.has(image.type)) {
    redirect("/profile?status=invalid-avatar");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect("/login?next=/profile");

  const path = `${profileId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, image, { contentType: image.type, upsert: true });
  if (uploadError) redirect("/profile?status=avatar-error");

  const { data: updatedProfile, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profileId).select("id").maybeSingle();
  if (error || !updatedProfile) redirect("/profile?status=avatar-error");

  revalidatePath("/", "layout");
  redirect("/profile?status=avatar-updated");
}

export async function updateProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!fullName || fullName.length > 160 || (phone && phone.length > 80)) {
    redirect("/profile?status=invalid-profile");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect("/login?next=/profile");

  const { data: updatedProfile, error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", profileId).select("id").maybeSingle();
  if (error || !updatedProfile) redirect("/profile?status=profile-error");

  revalidatePath("/", "layout");
  redirect("/profile?status=profile-updated");
}
