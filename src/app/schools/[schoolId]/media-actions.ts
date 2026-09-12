"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { protectServerAction } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= maxBytes && allowedTypes.has(value.type);
}

export async function uploadSchoolLogo(schoolId: string, formData: FormData) {
  const requestedReturnPath = String(formData.get("return_path") ?? "");
  const returnPath = requestedReturnPath === `/schools/${schoolId}/setup`
    ? requestedReturnPath
    : `/schools/${schoolId}`;
  const image = formData.get("logo");
  if (!validImage(image)) redirect(`${returnPath}?media=invalid-logo`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.appearance.manage")) redirect(`/schools/${schoolId}`);
  try { await protectServerAction({ scope: "school.logo.upload", subject: `actor:${profileId}|school:${schoolId}`, limit: 10, windowSeconds: 3600 }); }
  catch { redirect(`${returnPath}?media=rate-limited`); }

  let normalizedImage: Buffer;
  try {
    normalizedImage = await sharp(Buffer.from(await image.arrayBuffer()), { failOn: "warning", limitInputPixels: 40_000_000 })
      .rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  } catch { redirect(`${returnPath}?media=invalid-logo`); }

  const { data: currentSchool } = await supabase.from("schools").select("logo_path").eq("id", schoolId).maybeSingle();

  const path = `${schoolId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, normalizedImage, { contentType: "image/webp", upsert: false, cacheControl: "3600" });

  if (uploadError) redirect(`${returnPath}?media=logo-error`);

  const { data: updatedSchool, error: schoolError } = await supabase
    .from("schools")
    .update({ logo_path: path })
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (schoolError || !updatedSchool) {
    await supabase.storage.from("school-logos").remove([path]);
    redirect(`${returnPath}?media=logo-error`);
  }
  if (currentSchool?.logo_path?.startsWith(`${schoolId}/`) && currentSchool.logo_path !== path) {
    await supabase.storage.from("school-logos").remove([currentSchool.logo_path]);
  }
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/setup`);
  redirect(`${returnPath}?media=logo-updated`);
}
