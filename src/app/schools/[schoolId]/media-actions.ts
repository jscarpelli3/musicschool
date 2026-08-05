"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= maxBytes && allowedTypes.has(value.type);
}

export async function uploadAvatar(schoolId: string, formData: FormData) {
  const image = formData.get("avatar");
  if (!validImage(image)) redirect(`/schools/${schoolId}?media=invalid-avatar`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);

  const path = `${profileId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, image, { contentType: image.type, upsert: true });

  if (uploadError) redirect(`/schools/${schoolId}?media=avatar-error`);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", profileId);

  if (profileError) redirect(`/schools/${schoolId}?media=avatar-error`);
  revalidatePath(`/schools/${schoolId}`);
  redirect(`/schools/${schoolId}?media=avatar-updated`);
}

export async function uploadSchoolLogo(schoolId: string, formData: FormData) {
  const image = formData.get("logo");
  if (!validImage(image)) redirect(`/schools/${schoolId}?media=invalid-logo`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}`);

  const path = `${schoolId}/logo`;
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, image, { contentType: image.type, upsert: true });

  if (uploadError) redirect(`/schools/${schoolId}?media=logo-error`);

  const { error: schoolError } = await supabase
    .from("schools")
    .update({ logo_path: path })
    .eq("id", schoolId);

  if (schoolError) redirect(`/schools/${schoolId}?media=logo-error`);
  revalidatePath(`/schools/${schoolId}`);
  redirect(`/schools/${schoolId}?media=logo-updated`);
}
