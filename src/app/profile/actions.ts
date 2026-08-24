"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

export type AvatarUploadResult = { ok: boolean; message: string; avatarUrl?: string };

export async function uploadAvatar(formData: FormData): Promise<AvatarUploadResult> {
  const image = formData.get("avatar");
  if (!(image instanceof File) || image.size <= 0 || image.size > maxBytes || !allowedTypes.has(image.type)) {
    return { ok: false, message: "Choose a JPG, PNG, or WebP image no larger than 2 MB." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect("/login?next=/profile");

  let normalizedImage: Buffer;
  try {
    normalizedImage = await sharp(Buffer.from(await image.arrayBuffer()), { failOn: "warning", limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    return { ok: false, message: "That file is not a complete, readable image. Your existing avatar was not changed." };
  }

  const { data: currentProfile, error: profileReadError } = await supabase.from("profiles").select("avatar_path").eq("id", profileId).maybeSingle();
  if (profileReadError || !currentProfile) return { ok: false, message: "Your profile could not be checked. Your existing avatar was not changed." };

  const path = `${profileId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, normalizedImage, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
  if (uploadError) return { ok: false, message: "The image could not be uploaded. Your existing avatar was not changed." };

  const { data: updatedProfile, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profileId).select("id").maybeSingle();
  if (error || !updatedProfile) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, message: "The image uploaded, but your profile could not be updated. The staged image was discarded and your existing avatar was not changed." };
  }

  if (currentProfile.avatar_path?.startsWith(`${profileId}/`) && currentProfile.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([currentProfile.avatar_path]);
  }

  revalidatePath("/", "layout");
  const { data: signedAvatar } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return { ok: true, message: "Avatar updated.", avatarUrl: signedAvatar?.signedUrl };
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
