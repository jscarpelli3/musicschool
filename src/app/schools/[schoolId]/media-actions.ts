"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { isAcceptedImageType, SCHOOL_LOGO_UPLOAD_MAX_BYTES } from "@/lib/media/image-upload";
import { protectServerAction } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= SCHOOL_LOGO_UPLOAD_MAX_BYTES && isAcceptedImageType(value.type);
}

export type SchoolLogoUploadResult = { ok: boolean; message: string };

export async function uploadSchoolLogo(schoolId: string, formData: FormData): Promise<SchoolLogoUploadResult> {
  const image = formData.get("logo");
  if (!validImage(image)) return { ok: false, message: "Choose a JPG, PNG, or WebP image no larger than 2 MB." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.appearance.manage")) redirect(`/schools/${schoolId}`);
  try { await protectServerAction({ scope: "school.logo.upload", subject: `actor:${profileId}|school:${schoolId}`, limit: 10, windowSeconds: 3600 }); }
  catch { return { ok: false, message: "Too many logo uploads were attempted. Wait before trying again." }; }

  let normalizedImage: Buffer;
  try {
    normalizedImage = await sharp(Buffer.from(await image.arrayBuffer()), { failOn: "warning", limitInputPixels: 40_000_000 })
      .rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  } catch { return { ok: false, message: "That file is not a complete, readable image." }; }

  const { data: currentSchool } = await supabase.from("schools").select("logo_path").eq("id", schoolId).maybeSingle();

  const path = `${schoolId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, normalizedImage, { contentType: "image/webp", upsert: false, cacheControl: "3600" });

  if (uploadError) return { ok: false, message: "The school logo could not be saved." };

  const { data: updatedSchool, error: schoolError } = await supabase
    .from("schools")
    .update({ logo_path: path })
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (schoolError || !updatedSchool) {
    await supabase.storage.from("school-logos").remove([path]);
    return { ok: false, message: "The school logo could not be saved." };
  }
  if (currentSchool?.logo_path?.startsWith(`${schoolId}/`) && currentSchool.logo_path !== path) {
    await supabase.storage.from("school-logos").remove([currentSchool.logo_path]);
  }
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/setup`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  return { ok: true, message: "School logo updated." };
}
